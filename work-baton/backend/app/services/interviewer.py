"""
AI Interviewer — 문서에서 못 찾은 암묵지를 전임자에게 질문으로 채움
1. 커버리지 분석: 업무별 문서 충분도 진단
2. 갭 질문 생성: 빈틈을 채울 질문 자동 생성
3. 답변 통합: 전임자 답변을 인수인계 데이터에 병합
"""

import json
from dataclasses import dataclass, field
from .classifier import WorkCategory
from .llm_adapter import LLMAdapter


@dataclass
class CoverageReport:
    """업무별 커버리지 진단 + 리스크 평가"""
    category_id: str
    category_name: str
    coverage: str          # 🟢충분 / 🟡보통 / 🔴부족
    score: int             # 0~100
    found: list[str] = field(default_factory=list)
    missing: list[str] = field(default_factory=list)
    questions: list[dict] = field(default_factory=list)
    risk_level: str = "Medium"     # High / Medium / Low
    risk_reason: str = ""          # 위험 사유
    dday_checklist: dict = field(default_factory=dict)  # D-30, D-7, D-1

    def to_dict(self):
        return {
            "category_id": self.category_id,
            "category_name": self.category_name,
            "coverage": self.coverage,
            "score": self.score,
            "found": self.found,
            "missing": self.missing,
            "questions": self.questions,
            "risk_level": self.risk_level,
            "risk_reason": self.risk_reason,
            "dday_checklist": self.dday_checklist,
        }


INTERVIEW_SYSTEM_PROMPT = """당신은 공공기관 인수인계 전문가입니다.
업무 분류 결과와 각 업무의 문서 내용을 분석하여:
1. 각 업무의 인수인계 커버리지를 진단하고
2. 문서에 없는 빈틈(암묵지: 장애 복구 절차, 비공식 키맨, 예외 처리 등)을 찾아 질문을 생성하고
3. 각 업무의 리스크 수준과 인수인계 D-day 체크리스트를 작성하세요.

인수인계에 필요한 핵심 항목:
- 업무 목적과 배경
- 주요 이해관계자 (협의 대상, 보고 대상)
- 일정과 기한 (정기/비정기)
- 진행 중인 현안과 상태
- 주의사항과 노하우 (암묵지)
- 관련 시스템/도구 접근 방법
- 예산 현황
- 장애/예외 발생 시 대응 절차

응답 형식 (JSON):
{
  "reports": [
    {
      "category_id": "work_01",
      "category_name": "업무명",
      "score": 75,
      "found": ["업무 목적이 명시됨", "일정이 확인됨"],
      "missing": ["주요 협의 대상 미확인", "진행 중인 현안 불명확"],
      "risk_level": "High",
      "risk_reason": "기한 도래 업무가 있어 인계 지연 시 업무 공백 발생",
      "dday_checklist": {
        "D-30": ["핵심 업무 담당자 인터뷰", "시스템 접근 권한 목록 확인"],
        "D-7": ["업무 권한 위임 및 테스트", "비상 연락망 최신화"],
        "D-1": ["최종 인수인계서 확인", "메일/메신저 전달 설정"]
      },
      "questions": [
        {
          "id": "q1",
          "question": "이 업무에서 가장 자주 협의하는 사람은 누구인가요?",
          "why": "문서에 협의 대상이 명시되지 않아 후임자가 어려움을 겪을 수 있습니다",
          "priority": "high"
        }
      ]
    }
  ]
}

중요 - 점수 다양화:
- 각 업무의 score는 실제 문서 충분도에 따라 반드시 다르게 매겨야 합니다
- 모든 업무를 같은 점수로 주지 마세요. 문서가 많은 업무는 85~95, 적은 업무는 40~70
- risk_level도 업무별 특성에 따라 High/Medium/Low를 골고루 배분하세요
- 시행계획, 예산, 계약 관련 업무는 기한이 있으므로 risk가 높습니다
- 단순 참고자료, 메모 위주 업무는 risk가 낮습니다

질문 작성 기준:
- 문서에서 확인되지 않은 항목만 질문
- 전임자가 간단히 답할 수 있는 구체적 질문
- 암묵지(장애 대응, 비공식 키맨, 예외 절차)를 반드시 포함
- priority: high(필수) / medium(중요) / low(참고)
- 업무당 질문 3~5개

리스크 평가 기준:
- High: 기한 임박, 금전적/법적 영향, 시스템 장애 위험
- Medium: 업무 연속성에 영향, 협의 필요
- Low: 참고사항 수준"""


class AIInterviewer:
    """문서 빈틈을 분석하고 전임자 인터뷰 질문을 생성"""

    def __init__(self, llm=None):
        from .llm_adapter import LLMAdapter
        self.llm = llm or LLMAdapter()

    def analyze_coverage(self, categories: list[WorkCategory]) -> list[CoverageReport]:
        """업무별 커버리지 분석 + 질문 생성"""
        if not categories:
            return []

        # 업무별 요약을 LLM에 전달
        cat_summaries = []
        for cat in categories:
            file_contents = []
            for f in cat.files:
                file_contents.append({
                    "filename": f.filename,
                    "preview": f.content[:1500],
                })
            cat_summaries.append({
                "id": cat.id,
                "name": cat.name,
                "description": cat.description,
                "cycle_type": cat.cycle_type,
                "file_count": cat.file_count,
                "files": file_contents,
            })

        user_prompt = f"""다음 업무 분류 결과를 분석하여 각 업무의 인수인계 커버리지를 진단하고,
문서에 없는 빈틈을 채울 전임자 질문을 생성하세요.

업무 목록:
{json.dumps(cat_summaries, ensure_ascii=False, indent=2)}"""

        try:
            result = self.llm.complete_json(INTERVIEW_SYSTEM_PROMPT, user_prompt)
        except Exception as e:
            print(f"[Interviewer LLM Error] {e}")
            return self._fallback_coverage(categories)

        reports = []
        raw_reports = result.get("reports", [])
        if not isinstance(raw_reports, list):
            print(f"[Interviewer] 'reports' is not a list: {type(raw_reports)}")
            return self._fallback_coverage(categories)

        for r in raw_reports:
            if not isinstance(r, dict):
                continue
            try:
                score = int(r.get("score", 50))
            except (ValueError, TypeError):
                score = 50

            if score >= 70:
                coverage = "🟢"
            elif score >= 40:
                coverage = "🟡"
            else:
                coverage = "🔴"

            # 질문 ID 보정 (LLM이 숫자로 줄 수 있음)
            questions = r.get("questions", [])
            for i, q in enumerate(questions):
                if isinstance(q, dict):
                    q.setdefault("id", f"q{i+1}")
                    q.setdefault("priority", "medium")
                    q.setdefault("why", "")

            reports.append(CoverageReport(
                category_id=r.get("category_id", f"work_{len(reports)+1:02d}"),
                category_name=r.get("category_name", "미확인 업무"),
                coverage=coverage,
                score=score,
                found=r.get("found", []),
                missing=r.get("missing", []),
                questions=questions,
                risk_level=r.get("risk_level", "Medium"),
                risk_reason=r.get("risk_reason", ""),
                dday_checklist=r.get("dday_checklist", {}),
            ))

        if not reports:
            return self._fallback_coverage(categories)

        return reports

    def _fallback_coverage(self, categories: list[WorkCategory]) -> list[CoverageReport]:
        """LLM 없이 기본 커버리지 진단"""
        reports = []
        default_questions = [
            {"id": "q1", "question": "이 업무에서 가장 자주 협의하는 사람은 누구인가요?",
             "why": "주요 이해관계자 파악 필요", "priority": "high"},
            {"id": "q2", "question": "현재 진행 중인 현안이나 이슈가 있나요?",
             "why": "업무 연속성 확보", "priority": "high"},
            {"id": "q3", "question": "이 업무에서 특히 주의해야 할 점이 있나요?",
             "why": "암묵지 전달", "priority": "medium"},
        ]

        for cat in categories:
            score = min(cat.file_count * 25, 80)
            if score >= 70:
                coverage = "🟢"
            elif score >= 40:
                coverage = "🟡"
            else:
                coverage = "🔴"

            reports.append(CoverageReport(
                category_id=cat.id,
                category_name=cat.name,
                coverage=coverage,
                score=score,
                found=[f"파일 {cat.file_count}개 확인"],
                missing=["상세 분석에는 LLM 연결이 필요합니다"],
                questions=default_questions,
                risk_level="Medium",
                risk_reason="LLM 미연결로 상세 리스크 분석 불가",
                dday_checklist={
                    "D-30": ["핵심 업무 담당자 인터뷰", "시스템 접근 권한 목록 확인"],
                    "D-7": ["업무 권한 위임 및 테스트", "비상 연락망 최신화"],
                    "D-1": ["최종 인수인계서 확인", "메일/메신저 전달 설정"],
                },
            ))

        return reports

    def merge_answers(self, reports: list[CoverageReport], answers: dict) -> list[CoverageReport]:
        """전임자 답변을 커버리지 리포트에 병합
        answers: {question_id: answer_text}
        """
        for report in reports:
            for q in report.questions:
                qid = q["id"]
                if qid in answers and answers[qid].strip():
                    q["answer"] = answers[qid].strip()
                    q["answered"] = True
                else:
                    q["answered"] = False
        return reports
