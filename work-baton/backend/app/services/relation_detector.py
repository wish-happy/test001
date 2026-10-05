"""
문서 간 관계 탐지 — 100% 코드 기반 (LLM 토큰 0)
공통 인물, 금액 참조, 키워드 교집합으로 관계 추론
"""

def detect_relations(all_metas: list) -> list:
    """문서 간 관계를 코드로 탐지"""
    relations = []
    
    for i, a in enumerate(all_metas):
        for j, b in enumerate(all_metas):
            if i >= j:
                continue
            
            score = 0
            reasons = []
            
            # 공통 인물
            people_a = set(a.get("people", []))
            people_b = set(b.get("people", []))
            common_people = people_a & people_b
            if common_people:
                score += len(common_people) * 2
                reasons.append(f"공통 담당자: {', '.join(list(common_people)[:3])}")
            
            # 공통 금액
            amounts_a = set(a.get("amounts", []))
            amounts_b = set(b.get("amounts", []))
            common_amounts = amounts_a & amounts_b
            if common_amounts:
                score += len(common_amounts) * 3
                reasons.append(f"동일 금액 참조: {', '.join(list(common_amounts)[:2])}")
            
            # 공통 키워드
            kw_a = set(a.get("keywords", []))
            kw_b = set(b.get("keywords", []))
            common_kw = kw_a & kw_b
            if common_kw:
                score += len(common_kw)
                reasons.append(f"공통 키워드: {', '.join(list(common_kw)[:3])}")
            
            # 공통 날짜
            dates_a = set(a.get("dates", []))
            dates_b = set(b.get("dates", []))
            common_dates = dates_a & dates_b
            if len(common_dates) >= 2:
                score += 2
                reasons.append("일정 연관")
            
            if score >= 3:
                relations.append({
                    "file_a": a["filename"],
                    "file_b": b["filename"],
                    "score": score,
                    "reasons": reasons,
                    "relation_type": _classify_relation(a, b, reasons)
                })
    
    # 점수 순 정렬, 상위 50개
    relations.sort(key=lambda x: x["score"], reverse=True)
    return relations[:50]


def _classify_relation(a, b, reasons):
    """관계 유형 분류"""
    reason_text = " ".join(reasons)
    if "금액" in reason_text:
        return "예산-계약 연관"
    if "담당자" in reason_text and "키워드" in reason_text:
        return "동일 업무 문서"
    if "담당자" in reason_text:
        return "담당자 공유"
    if "일정" in reason_text:
        return "일정 연관"
    return "키워드 연관"
