"""
QA Chatbot v3 — Multi-hop Query Decomposition + Hybrid Search (BM25 + Dense + Keyword)
"""

import json
import re
import os
from typing import Optional
from .file_parser import ParsedFile
from .classifier import WorkCategory
from .llm_adapter import LLMAdapter, _robust_json_parse

try:
    from rank_bm25 import BM25Okapi
    HAS_BM25 = True
except ImportError:
    HAS_BM25 = False
    print("[QA] rank_bm25 미설치 — 키워드 검색만 사용")

try:
    from openai import OpenAI
    HAS_EMBED = True
except ImportError:
    HAS_EMBED = False


def _decode_filename(name: str) -> str:
    if not name: return name
    return re.sub(r'#U([0-9a-fA-F]{4})', lambda m: chr(int(m.group(1), 16)), name)


def _tokenize_ko(text: str) -> list[str]:
    """한국어 2글자 이상 토큰 추출"""
    return re.findall(r'[가-힣a-zA-Z0-9]{2,}', text.lower())


class HybridSearchEngine:
    """BM25 + 임베딩 + 키워드 하이브리드 검색"""

    def __init__(self):
        self.docs: list[dict] = []
        self.bm25: Optional[BM25Okapi] = None
        self.embeddings: list[list[float]] = []
        self.embed_client = None

        # Gemini 임베딩 클라이언트 초기화
        if HAS_EMBED:
            api_key = os.getenv("GEMINI_API_KEY", "")
            if api_key:
                try:
                    self.embed_client = OpenAI(
                        api_key=api_key,
                        base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
                    )
                except Exception:
                    pass

    def index(self, docs: list[dict]):
        """문서 인덱싱 — BM25 + 임베딩 구축"""
        self.docs = docs
        if not docs:
            return

        # BM25 인덱스
        if HAS_BM25:
            tokenized = [_tokenize_ko(d["content"] + " " + d["filename"]) for d in docs]
            self.bm25 = BM25Okapi(tokenized)

        # 임베딩 인덱스 (Gemini text-embedding-004)
        if self.embed_client and len(docs) <= 50:
            try:
                texts = [(d["filename"] + " " + d["content"])[:2000] for d in docs]
                response = self.embed_client.embeddings.create(
                    model="text-embedding-004",
                    input=texts,
                )
                self.embeddings = [e.embedding for e in response.data]
            except Exception as e:
                print(f"[Embed] 임베딩 실패: {e}")
                self.embeddings = []

    def search(self, query: str, top_k: int = 5) -> list[dict]:
        """하이브리드 검색 — BM25 + 임베딩 + 키워드 점수 합산"""
        if not self.docs:
            return []

        scores = {i: 0.0 for i in range(len(self.docs))}

        # 1) BM25 점수 (가중치 0.4)
        if self.bm25 and HAS_BM25:
            tokens = _tokenize_ko(query)
            if tokens:
                bm25_scores = self.bm25.get_scores(tokens)
                max_bm25 = max(bm25_scores) if max(bm25_scores) > 0 else 1
                for i, s in enumerate(bm25_scores):
                    scores[i] += 0.4 * (s / max_bm25)

        # 2) 임베딩 유사도 (가중치 0.4)
        if self.embeddings and self.embed_client:
            try:
                q_resp = self.embed_client.embeddings.create(
                    model="text-embedding-004",
                    input=[query],
                )
                q_emb = q_resp.data[0].embedding
                for i, doc_emb in enumerate(self.embeddings):
                    sim = self._cosine_sim(q_emb, doc_emb)
                    scores[i] += 0.4 * max(0, sim)
            except Exception:
                pass

        # 3) 키워드 매칭 (가중치 0.2) — fallback
        tokens = _tokenize_ko(query)
        for i, doc in enumerate(self.docs):
            cl = doc["content"].lower()
            fl = doc["filename"].lower()
            keyword_score = sum(cl.count(t) for t in tokens if t in cl)
            keyword_score += sum(3 for t in tokens if t in fl)
            if keyword_score > 0:
                scores[i] += 0.2 * min(1.0, keyword_score / 10)

        # 점수순 정렬
        ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        results = []
        for idx, score in ranked[:top_k]:
            if score > 0:
                doc = self.docs[idx].copy()
                doc["relevance_score"] = round(score, 3)
                results.append(doc)

        return results if results else self.docs[:top_k]

    @staticmethod
    def _cosine_sim(a: list[float], b: list[float]) -> float:
        dot = sum(x * y for x, y in zip(a, b))
        norm_a = sum(x * x for x in a) ** 0.5
        norm_b = sum(x * x for x in b) ** 0.5
        if norm_a == 0 or norm_b == 0:
            return 0
        return dot / (norm_a * norm_b)


class QAChatbot:
    """문서 기반 Q&A 챗봇 v3 — Multi-hop + Hybrid Search"""

    def __init__(self, llm: LLMAdapter):
        self.llm = llm
        self.search_engine = HybridSearchEngine()
        self.context_docs: list[dict] = []
        self.categories: list[dict] = []
        self.chat_history: list[dict] = []
        self.interview_context = ""

    def load_context(self, parsed_files, categories=None, interview_answers=None):
        self.context_docs = []
        for pf in parsed_files:
            if not pf.content or not pf.content.strip():
                continue
            self.context_docs.append({
                "filename": _decode_filename(pf.filename),
                "folder": _decode_filename(pf.metadata.get("parent_folder", ".")),
                "content": pf.content[:3000],
            })

        # 하이브리드 검색 엔진 인덱싱
        self.search_engine.index(self.context_docs)

        if categories:
            self.categories = []
            for cat in categories:
                d = cat.to_dict()
                self.categories.append({
                    "업무명": _decode_filename(d.get("name", "")),
                    "설명": d.get("description", ""),
                    "주기": d.get("cycle_type", ""),
                    "관련인물": d.get("related_people", []),
                })

        self.interview_context = ""
        if interview_answers:
            parts = [f"- {a.strip()}" for a in interview_answers.values() if a and a.strip()]
            if parts:
                self.interview_context = "\n[전임자 인터뷰 답변]\n" + "\n".join(parts)

        self.chat_history = []

    # ── 핵심: Query Decomposition ──
    def _decompose_query(self, question: str) -> list[str]:
        """복합 질문을 하위 질문으로 분해"""
        prompt = f"""다음 질문을 답변에 필요한 하위 질문 1~3개로 분해하세요.
단순한 질문이면 원래 질문만 반환하세요.

예시:
질문: "RAG 플랫폼 도입에 필요한 보안검증 담당 부서의 내선번호는?"
분해: ["RAG 플랫폼 도입에 필요한 보안검증은 무엇인가?", "해당 보안검증 담당 부서는?", "해당 부서 담당자 연락처는?"]

질문: "예산 담당자가 누구야?"
분해: ["예산 담당자가 누구인가?"]

JSON 배열만 반환하세요. 설명 없이.

질문: {question}"""

        try:
            raw = self.llm.complete("질문을 하위 질문으로 분해하는 도우미입니다. JSON 배열만 반환하세요.", prompt)
            result = _robust_json_parse(raw) if '{' in raw else json.loads(raw)
            if isinstance(result, list):
                return result[:4]
            if isinstance(result, dict) and "queries" in result:
                return result["queries"][:4]
        except Exception:
            pass

        return [question]

    # ── 핵심: Multi-hop 검색 ──
    def _multi_hop_search(self, question: str, top_k: int = 8) -> list[dict]:
        """질문 분해 → 하위 질문별 검색 → 결과 병합 + 중복 제거"""
        sub_queries = self._decompose_query(question)
        print(f"[QA Multi-hop] 원본: '{question}' → 분해: {sub_queries}")

        all_results = {}
        for sq in sub_queries:
            hits = self.search_engine.search(sq, top_k=5)
            for doc in hits:
                key = doc["filename"]
                if key not in all_results:
                    all_results[key] = doc
                else:
                    # 여러 하위 질문에서 히트된 문서는 점수 누적
                    old_score = all_results[key].get("relevance_score", 0)
                    new_score = doc.get("relevance_score", 0)
                    all_results[key]["relevance_score"] = old_score + new_score

        # 점수순 정렬
        ranked = sorted(all_results.values(), key=lambda x: x.get("relevance_score", 0), reverse=True)
        return ranked[:top_k]

    # ── LLM Reranker ──
    def _llm_rerank(self, question: str, docs: list[dict], top_k: int = 5) -> list[dict]:
        """LLM으로 최종 재순위화 — 가장 관련 높은 문서 선별"""
        if len(docs) <= top_k:
            return docs

        doc_summaries = []
        for i, doc in enumerate(docs):
            preview = doc["content"][:300].replace("\n", " ")
            doc_summaries.append(f"[{i}] {doc['filename']}: {preview}")

        prompt = f"""질문: {question}

아래 문서들 중 이 질문에 답하는 데 가장 필요한 문서의 번호를 최대 {top_k}개 골라 JSON 배열로 반환하세요.
번호만 반환. 설명 없이.

{chr(10).join(doc_summaries)}"""

        try:
            raw = self.llm.complete("문서 관련성을 판단하는 도우미입니다. 숫자 배열만 반환하세요.", prompt)
            # [0, 2, 4] 형태 파싱
            indices = json.loads(raw.strip().replace("'", '"'))
            if isinstance(indices, list):
                return [docs[i] for i in indices if isinstance(i, int) and 0 <= i < len(docs)]
        except Exception:
            pass

        return docs[:top_k]

    def ask(self, question: str) -> dict:
        """Multi-hop 검색 + Rerank + 답변 생성"""

        # 1) Multi-hop 검색
        candidates = self._multi_hop_search(question, top_k=8)

        # 2) LLM Reranker (문서 8개 이상이면)
        if len(candidates) > 5:
            relevant = self._llm_rerank(question, candidates, top_k=5)
        else:
            relevant = candidates

        system_prompt = """당신은 인수인계 업무 전문 AI 비서 '업무바통'입니다.

[절대 규칙]
1. [참조 문서]에 적힌 사실만 근거로 답변하세요.
2. 문서에 없는 내용은 추측하지 말고 "문서에 기재되어 있지 않습니다. 전임자 확인 필요"라고 하세요.
3. 답변에 절대로 내부 변수명(related_people, category_id 등)을 노출하지 마세요.
4. 법령·규정이 언급되면 "최신 법령 여부는 별도 확인 필요"를 덧붙이세요.
5. 업무 무관한 질문에는 정중히 거절하세요.

[답변 포맷]
핵심 답변 → 📌 근거: "원문 인용" — 출처파일명

[응답 JSON]
{
  "answer": "자연스러운 한국어 답변",
  "sources": ["출처파일.hwpx"],
  "citations": [{"text": "인용 원문", "file": "출처파일.hwpx"}],
  "confidence": "high/medium/low"
}"""

        if relevant:
            ctx = "\n\n---\n\n".join(f"[파일: {d['filename']}]\n{d['content']}" for d in relevant)
        else:
            ctx = "(관련 문서 없음)"

        cat_str = ""
        if self.categories:
            cat_str = "\n[업무 요약]\n" + "\n".join(
                f"- {c['업무명']} ({c['주기']}): {c['설명']}" + (f" / 관련: {', '.join(c['관련인물'])}" if c['관련인물'] else "")
                for c in self.categories[:5])

        hist = ""
        if self.chat_history:
            hist = "\n[이전 대화]\n" + "\n".join(f"Q: {h['question']}\nA: {h['answer'][:200]}" for h in self.chat_history[-3:])

        user_prompt = f"[참조 문서]\n{ctx}{cat_str}{self.interview_context}{hist}\n\n후임자 질문: {question}"

        try:
            raw = self.llm.complete(system_prompt, user_prompt)
            try:
                result = _robust_json_parse(raw)
            except Exception:
                result = {"answer": self._clean(raw), "sources": [], "citations": [], "confidence": "medium"}
        except Exception as e:
            print(f"[QA Error] {e}")
            result = {"answer": f"LLM 연결 오류: {str(e)[:80]}", "sources": [], "citations": [], "confidence": "low"}

        if "answer" in result:
            result["answer"] = self._clean(result["answer"])
        result.setdefault("citations", [])

        # 검색 메타 정보 추가 (프론트에서 활용 가능)
        result["search_info"] = {
            "method": "multi-hop + hybrid (BM25+embedding+keyword)" if HAS_BM25 else "multi-hop + keyword",
            "docs_searched": len(self.context_docs),
            "docs_retrieved": len(relevant),
        }

        self.chat_history.append({"question": question, "answer": result.get("answer", "")})
        return result

    def _clean(self, text):
        text = re.sub(r'관련_people\s*[:：]\s*\[.*?\]', '', text)
        text = re.sub(r'(category_id|file_indices|related_category_ids)\s*[:：]\s*"?[^"\n]*"?', '', text)
        return re.sub(r'\n{3,}', '\n\n', text).strip()
