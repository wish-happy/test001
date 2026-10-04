"""
QA Chatbot — 전임자 자료 기반 RAG 챗봇
후임자가 "이 업무 담당자 누구야?" 같은 질문을 하면
문서 근거와 함께 답변
"""

import json
from .file_parser import ParsedFile
from .classifier import WorkCategory
from .llm_adapter import LLMAdapter


class QAChatbot:
    """문서 기반 Q&A 챗봇 (간이 RAG)"""

    def __init__(self, llm: LLMAdapter):
        self.llm = llm
        self.context_docs: list[dict] = []
        self.categories: list[dict] = []
        self.chat_history: list[dict] = []

    def load_context(
        self,
        parsed_files: list[ParsedFile],
        categories: list[WorkCategory] = None,
        interview_answers: dict = None,
    ):
        """문서와 분류 결과를 컨텍스트로 로드"""
        self.context_docs = []
        for pf in parsed_files:
            self.context_docs.append({
                "filename": pf.filename,
                "folder": pf.metadata.get("parent_folder", "."),
                "content": pf.content[:2000],
            })

        if categories:
            self.categories = [cat.to_dict() for cat in categories]

        self.interview_data = interview_answers or {}
        self.chat_history = []

    def ask(self, question: str) -> dict:
        """질문에 대해 문서 근거 기반 답변"""
        # 관련 문서 검색
        relevant_docs = self._search_relevant(question, top_k=5)

        system_prompt = """당신은 인수인계 업무 전문 AI 비서 '업무바통'입니다.
전임자의 업무 문서를 바탕으로 후임자의 질문에 정확하고 신뢰성 있게 답변합니다.

[질문 의도 판별 및 가드레일]
1. 일상 인사/소개 ("안녕", "너는 누구야" 등):
   - 업무 인수인계 비서로서 친절하고 간결하게 응답하세요.
   - 출처는 필요 없으므로 sources는 빈 배열 []로 지정하세요.

2. 업무와 무관한 장난/잡담 ("맞짱뜰래?", "점심 뭐 먹을까" 등):
   - 문서를 억지로 인용하지 말고 단호하고 정중하게 거절하세요.
   - 응답: "인수인계 및 업무 문서와 관련 없는 질문입니다. 업무와 관련된 궁금한 점을 질문해 주세요."
   - sources는 빈 배열 [], confidence는 "low"로 지정하세요.

3. 업무 관련 질문이나 문서에 내용이 없는 경우:
   - "해당 내용은 문서에 기재되어 있지 않습니다. 전임자에게 직접 확인이 필요합니다."
   - sources는 빈 배열 [], confidence는 "low"로 지정하세요.

[문서 근거 및 원문 발췌(인용) 규칙]
- 반드시 제공된 [참조 문서]에 적힌 사실만을 기반으로 답변하세요.
- 문서 내용을 기반으로 답변할 때는 후임자가 신뢰할 수 있도록 답변 끝에 반드시 실제 문서의 해당 문장을 [근거 원문 발췌] 형태로 인용하세요.
- 법령·규정이 언급된 경우 "⚠️ 최신 법령 여부는 별도 확인이 필요합니다"를 덧붙이세요.

[답변(answer) 출력 포맷 예시]
(질문에 대한 핵심 답변 설명...)

📌 [근거 원문 발췌]
"{실제 참조 문서에서 발췌한 핵심 문장/수치 데이터 원문}"

응답 형식 (JSON):
{
  "answer": "답변 내용 (설명 + 📌 [근거 원문 발췌] 포함)",
  "sources": ["실제 인용한 근거파일명.txt"],
  "confidence": "high/medium/low",
  "related_category": "관련 업무명 (있으면)"
}"""

        context_str = json.dumps(relevant_docs, ensure_ascii=False, indent=2) if relevant_docs else "일치하는 관련 문서 없음"
        categories_str = json.dumps(self.categories[:5], ensure_ascii=False, indent=2) if self.categories else "없음"

        # 최근 대화 히스토리 (최대 5턴)
        history_str = ""
        if self.chat_history:
            recent = self.chat_history[-5:]
            history_str = "\n이전 대화:\n" + "\n".join(
                f"Q: {h['question']}\nA: {h['answer']}" for h in recent
            )

        user_prompt = f"""참조 문서:
{context_str}

업무 분류:
{categories_str}
{history_str}

질문: {question}"""

        try:
            result = self.llm.complete_json(system_prompt, user_prompt)
        except Exception:
            result = {
                "answer": "LLM 연결 오류입니다. API 설정을 확인해주세요.",
                "sources": [],
                "confidence": "low",
            }

        # 히스토리 저장
        self.chat_history.append({
            "question": question,
            "answer": result.get("answer", ""),
        })

        return result

    def _search_relevant(self, query: str, top_k: int = 5) -> list[dict]:
        """키워드 기반 문서 검색 (매칭 점수가 0점이면 제외)"""
        query_tokens = set(query.lower().replace("?", "").replace(".", "").replace("!", "").split())

        scored = []
        for doc in self.context_docs:
            content_lower = doc["content"].lower()
            score = sum(1 for token in query_tokens if token in content_lower)
            filename_lower = doc["filename"].lower()
            score += sum(2 for token in query_tokens if token in filename_lower)
            scored.append((score, doc))

        scored.sort(key=lambda x: x[0], reverse=True)
        # 키워드 매칭 점수가 1점 이상인 문서만 전달 (장난 질문 시 엉뚱한 문서 주입 차단)
        return [doc for score, doc in scored[:top_k] if score > 0]
