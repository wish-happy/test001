"""
QA Chatbot v4.1 — Self-RAG + Chained Multi-hop + Actionable Fallback
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

try:
    from openai import OpenAI
    HAS_EMBED = True
except ImportError:
    HAS_EMBED = False


def _decode_filename(name):
    if not name: return name
    return re.sub(r'#U([0-9a-fA-F]{4})', lambda m: chr(int(m.group(1), 16)), name)

def _tokenize_ko(text):
    return re.findall(r'[가-힣a-zA-Z0-9]{2,}', text.lower())


# ═══════════════════════════════════════════
# 1. Contextual Chunk Header
# ═══════════════════════════════════════════

class ContextualChunker:
    @staticmethod
    def enrich_chunk(doc, categories=None):
        filename = doc.get("filename", "")
        content = doc.get("content", "")

        people = re.findall(r'[가-힣]{2,4}\s*(?:부장|과장|팀장|대리|사원|사무관|주무관|수석|선임)', content)
        depts = re.findall(r'[가-힣]{2,8}(?:부|과|팀|실|센터|단)', content)
        phones = re.findall(r'(?:내선|전화|연락)?\s*[:：]?\s*(\d{3,4}[-.]?\d{3,4})', content)

        # 연락처/인사 문서 태그
        is_contact = any(k in filename for k in ['연락', '인사', '전화', '비상', '조직']) or \
                     any(k in content[:300] for k in ['내선', '연락처', '전화번호', '비상연락'])

        header_parts = [f"[문서: {filename}]"]
        if is_contact:
            header_parts.append("[유형: 연락처/조직정보]")
        if depts:
            header_parts.append(f"[부서: {', '.join(list(set(depts))[:4])}]")
        if people:
            header_parts.append(f"[인물: {', '.join(list(set(people))[:6])}]")
        if phones:
            header_parts.append(f"[내선: {', '.join(list(set(phones))[:4])}]")

        enriched = doc.copy()
        enriched["content"] = " ".join(header_parts) + "\n" + content
        enriched["is_contact"] = is_contact
        enriched["entities"] = {
            "people": list(set(people))[:6],
            "departments": list(set(depts))[:6],
            "phones": list(set(phones))[:4],
        }
        return enriched


# ═══════════════════════════════════════════
# 2. Hybrid Search Engine
# ═══════════════════════════════════════════

class HybridSearchEngine:
    def __init__(self):
        self.docs = []
        self.bm25 = None
        self.embeddings = []
        self.embed_client = None
        self.contact_docs = []  # 연락처 문서 별도 보관

        if HAS_EMBED:
            api_key = os.getenv("GEMINI_API_KEY", "")
            if api_key:
                try:
                    self.embed_client = OpenAI(api_key=api_key,
                        base_url="https://generativelanguage.googleapis.com/v1beta/openai/")
                except Exception:
                    pass

    def index(self, docs):
        self.docs = docs
        self.contact_docs = [d for d in docs if d.get("is_contact")]
        if not docs: return

        if HAS_BM25:
            tokenized = [_tokenize_ko(d["content"] + " " + d["filename"]) for d in docs]
            self.bm25 = BM25Okapi(tokenized)

        if self.embed_client and len(docs) <= 50:
            try:
                texts = [(d["filename"] + " " + d["content"])[:2000] for d in docs]
                resp = self.embed_client.embeddings.create(model="text-embedding-005", input=texts)
                self.embeddings = [e.embedding for e in resp.data]
            except Exception as e:
                print(f"[Embed] {e}")

    def search(self, query, top_k=8, include_contacts=False):
        if not self.docs: return []
        scores = {i: 0.0 for i in range(len(self.docs))}

        # BM25 (0.4)
        if self.bm25 and HAS_BM25:
            tokens = _tokenize_ko(query)
            if tokens:
                bm25_scores = self.bm25.get_scores(tokens)
                mx = max(bm25_scores) if max(bm25_scores) > 0 else 1
                for i, s in enumerate(bm25_scores):
                    scores[i] += 0.4 * (s / mx)

        # 임베딩 (0.4)
        if self.embeddings and self.embed_client:
            try:
                q_emb = self.embed_client.embeddings.create(model="text-embedding-005", input=[query]).data[0].embedding
                for i, de in enumerate(self.embeddings):
                    scores[i] += 0.4 * max(0, self._cos(q_emb, de))
            except Exception:
                pass

        # 키워드 (0.2)
        tokens = _tokenize_ko(query)
        for i, doc in enumerate(self.docs):
            cl, fl = doc["content"].lower(), doc["filename"].lower()
            ks = sum(cl.count(t) for t in tokens if t in cl) + sum(3 for t in tokens if t in fl)
            if ks > 0: scores[i] += 0.2 * min(1.0, ks / 10)

        ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        results = [{**{k:v for k,v in self.docs[i].items() if k != 'relevance_score'}, 'relevance_score': round(s, 3)} for i, s in ranked[:top_k] if s > 0]

        # ★ 핵심: 연락처/인사 문서 강제 포함
        if include_contacts and self.contact_docs:
            existing_files = {r["filename"] for r in results}
            for cd in self.contact_docs:
                if cd["filename"] not in existing_files:
                    results.append({**{k:v for k,v in cd.items() if k != 'relevance_score'}, 'relevance_score': 0.1})

        return results if results else self.docs[:top_k]

    @staticmethod
    def _cos(a, b):
        dot = sum(x*y for x,y in zip(a,b))
        na = sum(x*x for x in a)**0.5
        nb = sum(x*x for x in b)**0.5
        return dot/(na*nb) if na and nb else 0


# ═══════════════════════════════════════════
# 3. Document Grader
# ═══════════════════════════════════════════

class DocumentGrader:
    def __init__(self, llm):
        self.llm = llm

    def grade(self, question, docs):
        if len(docs) <= 3:
            return {"relevant": docs, "irrelevant": [], "missing_hint": None}

        doc_list = "\n".join(f"[{i}] {d['filename']}: {d['content'][:200]}" for i, d in enumerate(docs))
        prompt = f"""질문: {question}

아래 문서의 관련성을 판단하세요. JSON만 반환:
{doc_list}

{{"relevant_indices": [번호], "irrelevant_indices": [번호], "is_sufficient": true/false, "missing_search_terms": ["부족시 추가 검색어"]}}"""

        try:
            raw = self.llm.complete("문서 관련성 판단기. JSON만 반환.", prompt)
            r = _robust_json_parse(raw)
            relevant = [docs[i] for i in r.get("relevant_indices", range(len(docs))) if i < len(docs)]
            return {
                "relevant": relevant or docs,
                "irrelevant": [docs[i] for i in r.get("irrelevant_indices", []) if i < len(docs)],
                "missing_hint": r.get("missing_search_terms") if not r.get("is_sufficient", True) else None,
            }
        except Exception:
            return {"relevant": docs, "irrelevant": [], "missing_hint": None}


# ═══════════════════════════════════════════
# 4. Executive System Prompt (수정됨)
# ═══════════════════════════════════════════

EXECUTIVE_SYSTEM_PROMPT = """당신은 인수인계 업무 전문 AI 비서 '업무바통'입니다.

[핵심 원칙]
1. [참조 문서]의 사실만 근거로 답변하세요.
2. 내부 변수명을 절대 노출하지 마세요.
3. 텍스트 본문(answer) 안에 '[출처: 파일명.txt]' 같은 출처 표기를 절대 넣지 마세요. UI에서 자동으로 표기됩니다.
4. 어떤 질문(인사, 업무 무관, 오류 포함)이 들어와도 반드시 최종 출력은 [응답 JSON 규격]을 100% 준수해야 합니다. 일반 텍스트만 출력하면 시스템이 다운됩니다.

[절대 금지 문구 — 답변에 사용 금지]
- "전임자에게 확인이 필요합니다"
- "전임자에게 직접 확인이 필요합니다"
- "최신 법령 여부는 별도 확인이 필요합니다"
(※ 문서에 세부 내용이 없을 경우: 억지로 지어내지 말고 "문서상 상세 기준은 확인되지 않으나, 관련 소관 부서인 [부서/담당자/내선]로 문의하십시오" 형태로 안내하세요.)

[답변 포맷 — 질문 유형에 따라 자동 분기]

■ 단순 사실 질의 (연락처, 일정, 단일 수치 등):
→ 1~2문장으로 핵심만 깔끔하게 답변 (출처 파일명 텍스트 기재 금지).
예) "기획조정실 이상호 사무관의 내선번호는 3421입니다."

■ 복합 분석 / 인수인계 / 현황 질의:
→ 2단 포맷 준수:

📌 업무 현황 및 주요 리스크
- 항목별 핵심 팩트와 리스크를 간결하게 정리
- 문서 간 금액/일정 불일치가 있을 경우 명시

🎯 즉시 조치 계획 (Action Items)
1. [부서/담당자/연락처]: 구체적인 실행 조치 내용
2. [부서/담당자/연락처]: 구체적인 실행 조치 내용

■ 일상 인사 / 소개:
→ answer 필드에 친절하고 간결한 인사말 기재.

■ 업무 무관 질문 (음식 추천, 일상 잡담 등):
→ answer 필드에 "업무 인수인계와 관련된 질문을 입력해 주세요." 기재.

[응답 JSON 규격 — 필수 준수]
{
  "answer": "위 포맷에 맞춘 깔끔한 답변 텍스트 (출처 태그 제외)",
  "sources": ["실제참조한파일명.txt"],
  "citations": [{"text": "원문 인용 문장", "file": "실제참조한파일명.txt"}],
  "confidence": "high/medium/low",
  "action_items": [
    {"담당자": "이름", "부서": "소속부서", "연락처": "내선번호", "조치": "실행할 업무"}
  ]
}
(※ 단순 사실 질의, 인사, 업무 무관 질문일 경우 sources/citations/action_items는 빈 배열 []로 반환할 것)"""


# ═══════════════════════════════════════════
# 5. QA Chatbot v4.1 — Chained Multi-hop
# ═══════════════════════════════════════════

class QAChatbot:
    def __init__(self, llm):
        self.llm = llm
        self.search_engine = HybridSearchEngine()
        self.grader = DocumentGrader(llm)
        self.context_docs = []
        self.categories = []
        self.chat_history = []
        self.interview_context = ""

    def load_context(self, parsed_files, categories=None, interview_answers=None):
        self.context_docs = []
        cat_dicts = []

        if categories:
            for cat in categories:
                d = cat.to_dict()
                cat_dicts.append({
                    "업무명": _decode_filename(d.get("name", "")),
                    "설명": d.get("description", ""),
                    "주기": d.get("cycle_type", ""),
                    "관련인물": d.get("related_people", []),
                })
            self.categories = cat_dicts

        for pf in parsed_files:
            if not pf.content or not pf.content.strip(): continue
            doc = {
                "filename": _decode_filename(pf.filename),
                "folder": _decode_filename(pf.metadata.get("parent_folder", ".")),
                "content": pf.content[:3000],
            }
            doc = ContextualChunker.enrich_chunk(doc, cat_dicts)
            self.context_docs.append(doc)

        self.search_engine.index(self.context_docs)

        self.interview_context = ""
        if interview_answers:
            parts = [f"- {a.strip()}" for a in interview_answers.values() if a and a.strip()]
            if parts: self.interview_context = "\n[전임자 답변]\n" + "\n".join(parts)

        self.chat_history = []
        contact_count = len(self.search_engine.contact_docs)
        print(f"[QA v4.1] {len(self.context_docs)}개 문서 인덱싱 (연락처 문서: {contact_count}개)")

    # ── Chained Multi-hop: 1차 결과를 2차 검색에 반영 ──
    def _chained_multi_hop(self, question, top_k=10):
        """순차적 질문 분해 → 이전 단계 결과를 다음 검색에 반영"""
        sub_queries = self._decompose(question)
        print(f"[Chain] '{question}' → {sub_queries}")

        all_docs = {}
        accumulated_context = ""

        for step, sq in enumerate(sub_queries):
            # 이전 단계에서 추출된 키워드를 현재 검색에 추가
            enriched_query = sq
            if accumulated_context:
                enriched_query = f"{sq} {accumulated_context}"

            # 마지막 단계이거나 연락처/번호 관련 질문이면 연락처 문서 강제 포함
            needs_contact = any(k in sq for k in ['내선', '번호', '연락', '전화', '담당자'])
            hits = self.search_engine.search(enriched_query, top_k=6, include_contacts=needs_contact)

            for doc in hits:
                key = doc["filename"]
                if key not in all_docs:
                    all_docs[key] = doc
                else:
                    all_docs[key]["relevance_score"] = all_docs[key].get("relevance_score", 0) + doc.get("relevance_score", 0)

            # 이전 단계 결과에서 핵심 키워드 추출 → 다음 검색에 주입
            if step < len(sub_queries) - 1:
                for doc in hits[:2]:
                    entities = doc.get("entities", {})
                    new_terms = entities.get("departments", []) + entities.get("people", [])
                    if new_terms:
                        accumulated_context += " " + " ".join(new_terms[:3])
                        print(f"[Chain Step {step+1}] 추출 키워드: {new_terms[:3]}")

        # ★ 마지막에 연락처 문서 한번 더 강제 포함
        if any(k in question for k in ['내선', '번호', '연락', '전화', '담당자', '누구']):
            for cd in self.search_engine.contact_docs:
                if cd["filename"] not in all_docs:
                    all_docs[cd['filename']] = {**{k:v for k,v in cd.items() if k != 'relevance_score'}, 'relevance_score': 0.15}

        ranked = sorted(all_docs.values(), key=lambda x: x.get("relevance_score", 0), reverse=True)
        return ranked[:top_k]

    def _decompose(self, question):
        prompt = f"""다음 질문을 답변에 필요한 단계별 하위 질문으로 분해하세요.
각 단계는 이전 단계의 답을 바탕으로 다음을 검색하는 순서입니다.
단순 질문이면 원래 질문만 반환. JSON 배열만 반환.

예시:
"AI위원회에서 가이드라인 설명한 부서의 보안 담당자 내선번호?"
→ ["AI혁신위원회에서 가이드라인을 설명한 부서는?", "해당 부서의 보안 실무 담당자는 누구인가?", "해당 담당자의 내선번호는?"]

질문: {question}"""
        try:
            raw = self.llm.complete("질문을 순차적 하위 질문으로 분해. JSON 배열만 반환.", prompt)
            result = _robust_json_parse(raw) if '{' in raw else json.loads(raw)
            if isinstance(result, list): return result[:4]
            if isinstance(result, dict): return result.get("queries", result.get("questions", [question]))[:4]
        except Exception:
            pass
        return [question]

    # ── Self-RAG 검증 루프 ──
    def _self_rag_loop(self, question):
        candidates = self._chained_multi_hop(question, top_k=10)
        grade = self.grader.grade(question, candidates)
        relevant = grade["relevant"]

        if grade["missing_hint"]:
            print(f"[Self-RAG] 보완: {grade['missing_hint']}")
            for hint in grade["missing_hint"][:2]:
                extra = self.search_engine.search(hint, top_k=3, include_contacts=True)
                existing = {r["filename"] for r in relevant}
                for doc in extra:
                    if doc["filename"] not in existing:
                        relevant.append(doc)

        print(f"[Self-RAG] 최종 {len(relevant)}개 문서")
        return relevant[:8]

    def ask(self, question):
        relevant = self._self_rag_loop(question)

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
            raw = self.llm.complete(EXECUTIVE_SYSTEM_PROMPT, user_prompt)
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
        result.setdefault("action_items", [])

        result["search_info"] = {
            "method": "self-rag + chained-multi-hop + hybrid",
            "docs_total": len(self.context_docs),
            "docs_retrieved": len(relevant),
        }

        self.chat_history.append({"question": question, "answer": result.get("answer", "")})
        return result

    def _clean(self, text):
        # 내부 변수명 제거
        text = re.sub(r'관련_people\s*[:：]\s*\[.*?\]', '', text)
        text = re.sub(r'(category_id|file_indices|related_category_ids)\s*[:：]\s*"?[^"\n]*"?', '', text)
        # 하드코딩 고정 문구 제거
        text = re.sub(r'전임자에게?\s*(?:직접\s*)?확인이?\s*필요합니다\.?', '', text)
        text = re.sub(r'최신\s*법령\s*여부는?\s*별도\s*확인이?\s*필요합니다\.?', '', text)
        text = re.sub(r'⚠️?\s*최신\s*법령.*?필요.*?[.。]', '', text)
        return re.sub(r'\n{3,}', '\n\n', text).strip()
