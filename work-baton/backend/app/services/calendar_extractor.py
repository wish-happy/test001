"""
Calendar Extractor — 문서에서 일정·기한·주기를 추출하여 업무 캘린더 생성
상시/순기 업무를 구분하고 연간 달력으로 정리
"""

import json
from dataclasses import dataclass, field
from .classifier import WorkCategory
from .llm_adapter import LLMAdapter


@dataclass
class CalendarEvent:
    """캘린더 이벤트"""
    id: str
    category_id: str
    category_name: str
    title: str
    cycle_type: str        # 상시 / 순기
    month: int | None      # 순기: 해당 월 (1~12), 상시: None
    day: int | None        # 특정 일자
    recurrence: str        # 매일, 매주, 매월, 분기별, 반기별, 매년, 수시
    description: str
    source_file: str       # 출처 파일

    def to_dict(self):
        return {
            "id": self.id,
            "category_id": self.category_id,
            "category_name": self.category_name,
            "title": self.title,
            "cycle_type": self.cycle_type,
            "month": self.month,
            "day": self.day,
            "recurrence": self.recurrence,
            "description": self.description,
            "source_file": self.source_file,
        }


CALENDAR_SYSTEM_PROMPT = """당신은 공공기관 업무일정 분석 전문가입니다.
업무 분류 결과와 문서 내용에서 일정, 기한, 주기를 추출하여 연간 업무 캘린더를 만드세요.

응답 형식 (JSON):
{
  "events": [
    {
      "id": "evt_01",
      "category_id": "work_01",
      "category_name": "예산관리",
      "title": "예산요구서 제출",
      "cycle_type": "순기",
      "month": 6,
      "day": 15,
      "recurrence": "매년",
      "description": "기획조정실에 차년도 예산요구서 제출",
      "source_file": "2026년_예산편성_계획.txt"
    },
    {
      "id": "evt_02",
      "category_id": "work_01",
      "category_name": "예산관리",
      "title": "집행현황 보고",
      "cycle_type": "순기",
      "month": null,
      "day": null,
      "recurrence": "분기별",
      "description": "분기별 예산 집행현황 보고 (3,6,9,12월)",
      "source_file": "분기별_집행현황_보고.txt"
    },
    {
      "id": "evt_03",
      "category_id": "work_02",
      "category_name": "서비스 운영",
      "title": "서비스 모니터링",
      "cycle_type": "상시",
      "month": null,
      "day": null,
      "recurrence": "매일",
      "description": "AI 서비스 장애 모니터링 및 사용자 문의 대응",
      "source_file": "운영매뉴얼.docx"
    }
  ]
}

추출 기준:
- 문서에 명시된 날짜, "매년", "분기별", "매월" 등 시간 표현 추출
- cycle_type: "상시"(일상적·반복적 업무)와 "순기"(특정 시기에 수행하는 업무) 구분
- recurrence: 매일/매주/매월/분기별/반기별/매년/수시 중 택1
- month: 특정 월이 있으면 숫자(1~12), 없으면 null
- 출처 파일명 반드시 포함"""


class CalendarExtractor:
    """문서에서 일정을 추출하여 업무 캘린더 생성"""

    def __init__(self, llm: LLMAdapter):
        self.llm = llm

    def extract(self, categories: list[WorkCategory]) -> list[CalendarEvent]:
        """업무 분류 결과에서 캘린더 이벤트 추출"""
        if not categories:
            return []

        cat_data = []
        for cat in categories:
            files_content = []
            for f in cat.files:
                files_content.append({
                    "filename": f.filename,
                    "content": f.content[:1000],
                })
            cat_data.append({
                "id": cat.id,
                "name": cat.name,
                "cycle_type": cat.cycle_type,
                "cycle_detail": cat.cycle_detail,
                "key_dates": cat.key_dates,
                "files": files_content,
            })

        user_prompt = f"""다음 업무 분류 결과와 문서 내용에서 모든 일정, 기한, 주기를 추출하세요.

{json.dumps(cat_data, ensure_ascii=False, indent=2)}"""

        try:
            result = self.llm.complete_json(CALENDAR_SYSTEM_PROMPT, user_prompt)
        except Exception:
            return self._fallback_extract(categories)

        events = []
        for e in result.get("events", []):
            events.append(CalendarEvent(
                id=e.get("id", ""),
                category_id=e.get("category_id", ""),
                category_name=e.get("category_name", ""),
                title=e.get("title", ""),
                cycle_type=e.get("cycle_type", "상시"),
                month=e.get("month"),
                day=e.get("day"),
                recurrence=e.get("recurrence", "수시"),
                description=e.get("description", ""),
                source_file=e.get("source_file", ""),
            ))

        return events

    def _fallback_extract(self, categories: list[WorkCategory]) -> list[CalendarEvent]:
        """LLM 없이 key_dates 기반 추출"""
        events = []
        idx = 0
        for cat in categories:
            for kd in cat.key_dates:
                idx += 1
                events.append(CalendarEvent(
                    id=f"evt_{idx:02d}",
                    category_id=cat.id,
                    category_name=cat.name,
                    title=kd.get("task", ""),
                    cycle_type=cat.cycle_type,
                    month=None,
                    day=None,
                    recurrence="수시",
                    description=kd.get("date_hint", ""),
                    source_file="",
                ))
        return events

    def get_monthly_view(self, events: list[CalendarEvent]) -> dict:
        """월별 정리된 캘린더 뷰"""
        monthly = {m: [] for m in range(1, 13)}
        always_on = []  # 상시 업무

        for evt in events:
            if evt.cycle_type == "상시":
                always_on.append(evt.to_dict())
            elif evt.month:
                monthly[evt.month].append(evt.to_dict())
            elif evt.recurrence == "분기별":
                for m in [3, 6, 9, 12]:
                    monthly[m].append(evt.to_dict())
            elif evt.recurrence == "반기별":
                for m in [6, 12]:
                    monthly[m].append(evt.to_dict())
            elif evt.recurrence == "매월":
                for m in range(1, 13):
                    monthly[m].append(evt.to_dict())
            else:
                always_on.append(evt.to_dict())

        return {
            "monthly": {str(m): evts for m, evts in monthly.items()},
            "always_on": always_on,
        }
