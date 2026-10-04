"""
LLM Adapter — 모델 비종속 구조
Groq를 기본 프로바이더로 사용하며, .env에서 API 키를 자동 로드합니다.
OpenAI 호환 API를 사용하므로 Ollama, vLLM, EXAONE 등으로 교체 가능합니다.
"""

import json
import re
import os
from openai import OpenAI
from pydantic import BaseModel
from typing import Optional

# .env 파일 로드 시도
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass


class LLMConfig(BaseModel):
    provider: str = "groq"
    model: str = "openai/gpt-oss-20b"
    base_url: Optional[str] = "https://api.groq.com/openai/v1"
    api_key: Optional[str] = None
    temperature: float = 0.2
    max_tokens: int = 8192


# ── 프리셋: 대회 심사 시 모델 교체 시연용 ──
MODEL_PRESETS = {
    "groq": LLMConfig(
        provider="groq",
        model="openai/gpt-oss-20b",
        base_url="https://api.groq.com/openai/v1",
        api_key=os.getenv("GROQ_API_KEY", ""),
    ),
    "groq-fast": LLMConfig(
        provider="groq",
        model="openai/gpt-oss-20b",
        base_url="https://api.groq.com/openai/v1",
        api_key=os.getenv("GROQ_API_KEY", ""),
    ),
    "gemini": LLMConfig(
        provider="gemini",
        model="gemini-2.0-flash",
        base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
        api_key=os.getenv("GEMINI_API_KEY", ""),
    ),
    "openai": LLMConfig(
        provider="openai",
        model="gpt-4o-mini",
        base_url=None,
        api_key=os.getenv("OPENAI_API_KEY", ""),
    ),
    "ollama-gemma": LLMConfig(
        provider="ollama",
        model="gemma2:9b",
        base_url="http://localhost:11434/v1",
        api_key="ollama",
    ),
    "ollama-llama": LLMConfig(
        provider="ollama",
        model="llama3.1:8b",
        base_url="http://localhost:11434/v1",
        api_key="ollama",
    ),
}


def _robust_json_parse(raw: str) -> dict:
    """
    LLM 응답에서 JSON을 안전하게 추출.
    - ```json 펜스 제거
    - 잘린 JSON 복구 시도
    - 여러 전략으로 파싱
    """
    text = raw.strip()

    # 1) 마크다운 펜스 제거
    if text.startswith("```"):
        text = re.sub(r'^```(?:json)?\s*\n?', '', text)
    if text.endswith("```"):
        text = text[:-3].rstrip()

    # 2) JSON 블록만 추출 (첫 { 부터 마지막 } 까지)
    first_brace = text.find("{")
    last_brace = text.rfind("}")
    if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
        text = text[first_brace:last_brace + 1]

    # 3) 그대로 파싱 시도
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # 4) 잘린 JSON 복구 — 닫히지 않은 괄호 보정
    repaired = text
    open_braces = repaired.count("{") - repaired.count("}")
    open_brackets = repaired.count("[") - repaired.count("]")

    # 잘린 문자열 닫기
    if repaired.rstrip().endswith('"') is False:
        # 마지막 열린 따옴표 찾기
        last_quote = repaired.rfind('"')
        before_quote = repaired[:last_quote].rstrip()
        if before_quote.endswith(":") or before_quote.endswith(","):
            repaired += '"'

    repaired += "]" * max(0, open_brackets)
    repaired += "}" * max(0, open_braces)

    try:
        return json.loads(repaired)
    except json.JSONDecodeError:
        pass

    # 5) 문자열 내 줄바꿈을 이스케이프
    cleaned = re.sub(r'(?<!\\)\n', r'\\n', text)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    # 6) 최후의 수단: 빈 결과
    raise ValueError(f"JSON 파싱 실패 (원본 {len(raw)}자)")


class LLMAdapter:
    """모델 교체 가능한 LLM 어댑터"""

    def __init__(self, config: Optional[LLMConfig] = None, preset: Optional[str] = None):
        if preset and preset in MODEL_PRESETS:
            self.config = MODEL_PRESETS[preset].model_copy()
        elif config:
            self.config = config
        else:
            # 기본값: .env에서 GROQ_API_KEY 자동 로드
            self.config = MODEL_PRESETS["gemini"].model_copy()

        # API 키가 비었으면 환경변수에서 한번 더 시도
        if not self.config.api_key:
            env_key = os.getenv("GEMINI_API_KEY") or os.getenv("GROQ_API_KEY") or os.getenv("OPENAI_API_KEY") or ""
            self.config.api_key = env_key

        self.client = OpenAI(
            api_key=self.config.api_key or "dummy",
            base_url=self.config.base_url,
        )

    def complete(self, system_prompt: str, user_prompt: str) -> str:
        """단일 프롬프트 완성"""
        response = self.client.chat.completions.create(
            model=self.config.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=self.config.temperature,
            max_tokens=self.config.max_tokens,
        )
        return response.choices[0].message.content

    def complete_json(self, system_prompt: str, user_prompt: str) -> dict:
        """JSON 응답을 안전하게 파싱하여 반환"""
        raw = self.complete(system_prompt, user_prompt)
        return _robust_json_parse(raw)

    def get_model_info(self) -> dict:
        return {
            "provider": self.config.provider,
            "model": self.config.model,
            "base_url": self.config.base_url or "default",
        }

    def is_connected(self) -> bool:
        """API 키가 설정되어 있는지 확인"""
        return bool(self.config.api_key and self.config.api_key not in ("", "dummy"))
