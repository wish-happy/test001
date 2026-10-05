"""
인수인계서 품질 검증
1단계: 코드 체크리스트 (토큰 0)
2단계: 부족분만 LLM 보완 제안 (토큰 최소화)
"""

import json

CHECKLIST = [
    {"id": "purpose", "label": "업무 목적과 배경", "keywords": ["목적", "배경", "개요", "필요성"]},
    {"id": "stakeholder", "label": "주요 이해관계자", "keywords": ["담당", "협의", "보고", "이해관계"]},
    {"id": "schedule", "label": "일정 및 기한", "keywords": ["일정", "기한", "마감", "분기", "월별"]},
    {"id": "status", "label": "진행 중인 현안", "keywords": ["현안", "진행", "이슈", "과제"]},
    {"id": "knowhow", "label": "주의사항 및 노하우", "keywords": ["주의", "노하우", "참고", "유의"]},
    {"id": "system", "label": "시스템/도구 접근", "keywords": ["시스템", "접근", "로그인", "권한"]},
    {"id": "budget", "label": "예산 현황", "keywords": ["예산", "금액", "집행", "잔액"]},
    {"id": "emergency", "label": "비상 대응 절차", "keywords": ["비상", "장애", "긴급", "대응"]},
    {"id": "contacts", "label": "연락처 정보", "keywords": ["연락", "내선", "전화", "이메일"]},
    {"id": "handover_items", "label": "인수인계 항목 목록", "keywords": ["인수", "인계", "이관", "전달"]},
]

def check_quality(handover_text: str, categories: list, llm=None) -> dict:
    """인수인계서 품질을 체크리스트로 검증"""
    
    # 1단계: 코드 체크 (토큰 0)
    results = []
    found_count = 0
    text_lower = handover_text.lower()
    
    for item in CHECKLIST:
        found = any(kw in text_lower for kw in item["keywords"])
        results.append({
            "id": item["id"],
            "label": item["label"],
            "found": found,
            "status": "✅ 포함" if found else "⚠️ 누락"
        })
        if found:
            found_count += 1
    
    score = round(found_count / len(CHECKLIST) * 100)
    missing = [r for r in results if not r["found"]]
    
    quality = {
        "score": score,
        "grade": "A" if score >= 90 else "B" if score >= 70 else "C" if score >= 50 else "D",
        "checklist": results,
        "missing_count": len(missing),
        "total_count": len(CHECKLIST),
        "suggestions": []
    }
    
    # 2단계: 누락 항목이 있으면 LLM으로 보완 제안 (최소 토큰)
    if missing and llm:
        missing_labels = [m["label"] for m in missing]
        cat_names = [c.name if hasattr(c, 'name') else str(c) for c in categories[:5]]
        
        prompt = f"""인수인계서에서 다음 항목이 누락되었습니다:
{json.dumps(missing_labels, ensure_ascii=False)}

업무 영역: {', '.join(cat_names)}

각 누락 항목에 대해 "어떤 내용을 보완해야 하는지" 한 줄씩 제안하세요.
JSON 형식: {{"suggestions": [{{"item": "항목명", "suggestion": "보완 제안"}}]}}"""

        try:
            result = llm.complete_json(
                "인수인계서 품질 검증 전문가입니다. 누락 항목에 대한 보완 제안을 합니다.",
                prompt
            )
            quality["suggestions"] = result.get("suggestions", [])
        except:
            quality["suggestions"] = [{"item": m, "suggestion": f"{m} 관련 내용을 추가하세요"} for m in missing_labels]
    
    return quality
