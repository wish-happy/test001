"""
Handover Generator — 인수인계서 자동 생성
분류 결과 + AI 인터뷰 답변 + 캘린더를 합쳐 인수인계서 초안 작성
"""

import json
from .classifier import WorkCategory
from .interviewer import CoverageReport
from .calendar_extractor import CalendarEvent
from .llm_adapter import LLMAdapter


HANDOVER_SYSTEM_PROMPT = """당신은 공공기관 인수인계서 작성 전문가입니다.
주어진 업무 분류, 커버리지 분석, 전임자 답변, 일정 정보를 종합하여
후임자가 바로 업무를 시작할 수 있는 인수인계서를 작성하세요.

형식 (Markdown):
# 인수인계서

## 작성 개요
- 작성일: (오늘)
- 업무 수: N개
- 커버리지: 전체 평균 점수

## 업무별 인수인계

### 1. [업무명] (상시/순기)

**업무 개요**
- 목적: ...
- 주기: ...

**주요 이해관계자**
| 구분 | 이름 | 역할 | 비고 |
|------|------|------|------|
| ... | ... | ... | ... |

**현안 및 주의사항**
- ...

**주요 일정**
- 3월: ...
- 6월: ...

**관련 문서**
- 파일1 (출처 경로)
- 파일2

**전임자 참고사항** (인터뷰 답변 기반)
- ...

---
(다음 업무 반복)

## 연간 업무 캘린더 요약

## 주요 연락처

작성 원칙:
1. 각 내용의 출처(파일명)를 명시
2. 전임자 답변이 있으면 반드시 반영
3. 확인되지 않은 사항은 "⚠️ 확인 필요"로 표시
4. 실용적이고 간결하게 작성"""


class HandoverGenerator:
    """인수인계서 자동 생성"""

    def __init__(self, llm: LLMAdapter):
        self.llm = llm

    def generate(
        self,
        categories: list[WorkCategory],
        coverage_reports: list[CoverageReport] = None,
        calendar_events: list[CalendarEvent] = None,
        interview_answers: dict = None,
    ) -> str:
        """인수인계서 Markdown 생성"""

        # 데이터 정리
        cat_data = []
        for cat in categories:
            entry = {
                "name": cat.name,
                "description": cat.description,
                "cycle_type": cat.cycle_type,
                "cycle_detail": cat.cycle_detail,
                "files": [f.filename for f in cat.files],
                "file_contents": [
                    {"name": f.filename, "preview": f.content[:600]}
                    for f in cat.files
                ],
                "key_dates": cat.key_dates,
                "related_people": cat.related_people,
            }

            # 커버리지 리포트 매칭
            if coverage_reports:
                report = next((r for r in coverage_reports if r.category_id == cat.id), None)
                if report:
                    entry["coverage_score"] = report.score
                    entry["found"] = report.found
                    entry["missing"] = report.missing
                    entry["questions_and_answers"] = [
                        {
                            "question": q["question"],
                            "answer": q.get("answer", "답변 없음"),
                            "answered": q.get("answered", False),
                        }
                        for q in report.questions
                    ]

            cat_data.append(entry)

        # 캘린더 데이터
        calendar_data = []
        if calendar_events:
            calendar_data = [e.to_dict() for e in calendar_events]

        user_prompt = f"""다음 데이터를 종합하여 인수인계서를 작성하세요.

업무 분류 및 분석 결과:
{json.dumps(cat_data, ensure_ascii=False, indent=2)}

업무 캘린더:
{json.dumps(calendar_data, ensure_ascii=False, indent=2)}"""

        try:
            return self.llm.complete(HANDOVER_SYSTEM_PROMPT, user_prompt)
        except Exception as e:
            return self._fallback_generate(categories, coverage_reports, calendar_events)

    def _fallback_generate(
        self,
        categories: list[WorkCategory],
        coverage_reports: list[CoverageReport] = None,
        calendar_events: list[CalendarEvent] = None,
    ) -> str:
        """LLM 없이 기본 인수인계서 생성"""
        lines = ["# 인수인계서\n"]
        lines.append(f"## 작성 개요\n- 업무 수: {len(categories)}개\n")
        lines.append("---\n")

        for i, cat in enumerate(categories, 1):
            lines.append(f"## {i}. {cat.name} ({cat.cycle_type})\n")
            lines.append(f"**설명:** {cat.description}\n")

            if cat.related_people:
                lines.append(f"**관련 인물:** {', '.join(cat.related_people)}\n")

            if cat.key_dates:
                lines.append("**주요 일정:**")
                for kd in cat.key_dates:
                    lines.append(f"- {kd.get('date_hint', '')}: {kd.get('task', '')}")
                lines.append("")

            lines.append("**관련 문서:**")
            for f in cat.files:
                lines.append(f"- {f.filename}")
            lines.append("\n---\n")

        return "\n".join(lines)
