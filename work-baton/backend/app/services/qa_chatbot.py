"""
QA Chatbot — 전임자 자료 기반 Q&A (v2)
"""

import json
import re
from .file_parser import ParsedFile
from .classifier import WorkCategory
from .llm_adapter import LLMAdapter, _robust_json_parse


def _decode_filename(name):
    if not name: return name
    return re.sub(r'#U([0-9a-fA-F]{4})', lambda m: chr(int(m.group(1), 16)), name)


class QAChatbot:
    def __init__(self, llm):
        self.llm = llm
        self.context_docs = []
        self.categories = []
        self.chat_history = []
        self.interview_context = ""

    def load_context(self, parsed_files, categories=None, interview_answers=None):
        self.context_docs = []
        for pf in parsed_files:
            if not pf.content or not pf.content.strip(): continue
            self.context_docs.append({
                "filename": _decode_filename(pf.filename),
                "folder": _decode_filename(pf.metadata.get("parent_folder", ".")),
                "content": pf.content[:3000],
            })
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
            if parts: self.interview_context = "\n[전임자 인터뷰 답변]\n" + "\n".join(parts)
        self.chat_history = []

    def ask(self, question):
        relevant = self._search_relevant(question, top_k=5)
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
            except:
                result = {"answer": self._clean(raw), "sources": [], "citations": [], "confidence": "medium"}
        except Exception as e:
            print(f"[QA Error] {e}")
            result = {"answer": f"LLM 연결 오류: {str(e)[:80]}", "sources": [], "citations": [], "confidence": "low"}

        if "answer" in result: result["answer"] = self._clean(result["answer"])
        result.setdefault("citations", [])
        self.chat_history.append({"question": question, "answer": result.get("answer", "")})
        return result

    def _search_relevant(self, query, top_k=5):
        tokens = set(re.findall(r'[가-힣a-zA-Z0-9]{2,}', query.lower()))
        if not tokens: return self.context_docs[:top_k]
        scored = []
        for doc in self.context_docs:
            cl = doc["content"].lower()
            fl = doc["filename"].lower()
            score = sum(cl.count(t) for t in tokens if t in cl) + sum(3 for t in tokens if t in fl)
            if score > 0: scored.append((score, doc))
        scored.sort(key=lambda x: x[0], reverse=True)
        return [d for _, d in scored[:top_k]] or self.context_docs[:top_k]

    def _clean(self, text):
        text = re.sub(r'관련_people\s*[:：]\s*\[.*?\]', '', text)
        text = re.sub(r'(category_id|file_indices|related_category_ids)\s*[:：]\s*"?[^"\n]*"?', '', text)
        return re.sub(r'\n{3,}', '\n\n', text).strip()
