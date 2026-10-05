"""
후임자 액션플랜 생성
기존 인터뷰+캘린더 결과를 재활용하여 LLM 1회 호출로 생성
"""

import json

def generate_action_plan(categories: list, interview_data: list, calendar_data: dict, llm) -> dict:
    """후임자 첫 주 액션플랜 생성"""
    
    # 기존 결과 요약 (새로 분석하지 않음 — 토큰 절감)
    high_risk = [i for i in interview_data if i.get("risk_level") == "High"]
    medium_risk = [i for i in interview_data if i.get("risk_level") == "Medium"]
    
    # 이번 달 일정
    monthly = calendar_data.get("monthly_view", {}).get("monthly", {})
    import datetime
    now_month = str(datetime.datetime.now().month)
    this_month_events = monthly.get(now_month, [])
    
    prompt = f"""후임자의 첫 주 액션플랜을 만드세요.

[위험도 높은 업무] ({len(high_risk)}건)
{json.dumps([{{"name": h.get("category_name",""), "reason": h.get("risk_reason","")}} for h in high_risk], ensure_ascii=False)}

[위험도 보통 업무] ({len(medium_risk)}건)  
{json.dumps([{{"name": m.get("category_name","")}} for m in medium_risk], ensure_ascii=False)}

[이번 달 주요 일정] ({len(this_month_events)}건)
{json.dumps([{{"title": e.get("title",""), "day": e.get("day","")}} for e in this_month_events[:10]], ensure_ascii=False)}

JSON 응답:
{{"first_week": {{
  "day1": {{"theme": "1일차 주제", "tasks": ["할일1", "할일2"]}},
  "day2": {{"theme": "2일차 주제", "tasks": ["할일1", "할일2"]}},
  "day3": {{"theme": "3일차 주제", "tasks": ["할일1", "할일2"]}},
  "day4_5": {{"theme": "4-5일차 주제", "tasks": ["할일1", "할일2"]}}
}},
"priority_contacts": [{{"name": "이름", "role": "역할", "why": "연락 이유"}}],
"immediate_risks": [{{"task": "업무", "deadline": "기한", "action": "조치"}}],
"tips": ["팁1", "팁2", "팁3"]
}}"""

    try:
        result = llm.complete_json(
            "공공기관 인수인계 전문가입니다. 후임자가 첫 주에 효율적으로 업무를 파악할 수 있는 액션플랜을 만듭니다.",
            prompt
        )
        return result
    except Exception as e:
        return {
            "first_week": {"day1": {"theme": "업무 파악", "tasks": ["인수인계서 정독", "주요 담당자 인사"]}},
            "priority_contacts": [],
            "immediate_risks": [{"task": r.get("category_name",""), "deadline": "확인 필요", "action": "전임자 확인"} for r in high_risk],
            "tips": ["인수인계서를 먼저 정독하세요", "담당자 연락처를 저장하세요"]
        }
