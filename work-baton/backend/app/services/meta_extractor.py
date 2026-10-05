"""
하이브리드 메타 추출기
1단계: 정규식으로 날짜/인물/금액/전화번호 추출 (토큰 0)
2단계: 파일명+키워드로 그룹핑 (토큰 0)
3단계: 그룹 단위 LLM 요약 (토큰 절감 90%)
4단계: 결과 캐싱 (재실행 시 토큰 0)
"""

import re, json, hashlib, os
from pathlib import Path
from collections import defaultdict

CACHE_DIR = Path("/tmp/baton_cache")
CACHE_DIR.mkdir(exist_ok=True)

# ── 1단계: 정규식 메타 추출 (토큰 0) ──

def extract_meta_by_regex(content: str, filename: str) -> dict:
    """코드로 정확하게 추출 가능한 것들"""
    meta = {
        "filename": filename,
        "dates": [],
        "people": [],
        "amounts": [],
        "phones": [],
        "emails": [],
        "keywords": [],
        "has_schedule": False,
        "has_budget": False,
        "is_plan": False,
        "is_regulation": False,
        "is_contact": False,
    }
    
    # 날짜 (2026.06.15, 2026년 6월, 2026-06-15)
    dates = re.findall(r'20\d{2}[\.\-/년]\s*\d{1,2}[\.\-/월]\s*\d{0,2}[일\.]?', content)
    meta["dates"] = list(set(d.strip() for d in dates))[:15]
    
    # 인물 (이름 + 직급/직위)
    people = re.findall(r'([가-힣]{2,4})\s*(부장|과장|팀장|선임|대리|사원|주무관|사무관|수석|책임|위원장|위원|교수|PM)', content)
    meta["people"] = list(set(f"{n} {t}" for n, t in people))[:10]
    
    # 금액
    amounts = re.findall(r'[\d,]+\s*(?:천원|만원|억원|백만원|원)', content)
    meta["amounts"] = list(set(amounts))[:10]
    
    # 전화번호
    phones = re.findall(r'(?:내선\s*)?(?:010-?\d{4}-?\d{4}|\d{3,4}-\d{3,4}(?:-\d{4})?)', content)
    meta["phones"] = list(set(phones))[:10]
    
    # 이메일
    emails = re.findall(r'[\w.-]+@[\w.-]+\.\w+', content)
    meta["emails"] = list(set(emails))[:5]
    
    # 파일 유형 판별
    fn_lower = filename.lower()
    combined = fn_lower + " " + content[:500].lower()
    
    if any(k in combined for k in ["시행계획", "추진계획", "사업계획", "운영계획"]):
        meta["is_plan"] = True
    if any(k in combined for k in ["규정", "지침", "규칙", "방침", "가이드라인"]):
        meta["is_regulation"] = True
    if any(k in combined for k in ["연락", "비상", "연락망", "연락처", "분장"]):
        meta["is_contact"] = True
    if any(k in combined for k in ["예산", "집행", "결산", "세출", "원가"]):
        meta["has_budget"] = True
    if any(k in combined for k in ["일정", "마감", "기한", "분기", "반기", "월별"]):
        meta["has_schedule"] = True
    
    # 핵심 키워드 추출
    kw_patterns = [
        r'N2SF', r'CSAP', r'SLA', r'AI\s*플랫폼', r'클라우드',
        r'보안검증', r'인수인계', r'위원회', r'계약', r'예산',
        r'감사', r'인사', r'복무', r'총무', r'서무',
    ]
    for p in kw_patterns:
        if re.search(p, content, re.IGNORECASE):
            meta["keywords"].append(re.sub(r'\\s\*', ' ', p))
    
    return meta


# ── 2단계: 파일 그룹핑 (토큰 0) ──

def group_files(parsed_files: list) -> dict:
    """파일명과 키워드 기반으로 그룹핑"""
    groups = defaultdict(list)
    
    for f in parsed_files:
        # 폴더명 기반 그룹핑
        parts = Path(f.filepath).parts
        folder = "기타"
        for p in parts:
            if any(k in p for k in ["예산", "재정"]):
                folder = "예산_재정"; break
            elif any(k in p for k in ["혁신위", "위원회"]):
                folder = "AI혁신위원회"; break
            elif any(k in p for k in ["계약", "서비스", "디지털"]):
                folder = "디지털서비스_계약"; break
            elif any(k in p for k in ["보안", "정보보호", "N2SF"]):
                folder = "보안검증"; break
            elif any(k in p for k in ["플랫폼", "구축"]):
                folder = "AI플랫폼"; break
            elif any(k in p for k in ["총무", "서무"]):
                folder = "총무_서무"; break
            elif any(k in p for k in ["인사", "복무"]):
                folder = "인사_복무"; break
            elif any(k in p for k in ["규정", "지침"]):
                folder = "규정_지침"; break
            elif any(k in p for k in ["협력", "업체", "대외"]):
                folder = "대외협력"; break
            elif any(k in p for k in ["일지", "참고", "메모"]):
                folder = "업무일지"; break
        
        groups[folder].append(f)
    
    return dict(groups)


# ── 3단계: LLM 그룹 요약 (배치) ──

def enrich_with_llm(groups: dict, all_metas: list, llm) -> list:
    """그룹 단위로 LLM 호출하여 문서 요약 (캐시 사용)"""
    enriched = []
    
    for group_name, files in groups.items():
        # 캐시 키 생성
        cache_key = _cache_key(group_name, files)
        cached = _load_cache(cache_key)
        if cached:
            enriched.extend(cached)
            print(f"  [Cache] {group_name}: {len(files)}개 캐시 로드")
            continue
        
        # 10개씩 배치
        for i in range(0, len(files), 10):
            batch = files[i:i+10]
            batch_metas = []
            for f in batch:
                meta = next((m for m in all_metas if m["filename"] == f.filename), {})
                batch_metas.append({
                    "filename": f.filename,
                    "preview": f.content[:600],
                    "meta": {k: v for k, v in meta.items() 
                             if k in ("dates","people","amounts","is_plan","is_regulation","has_budget","keywords")}
                })
            
            prompt = f"""다음 '{group_name}' 그룹의 문서 {len(batch)}개를 분석하세요.
각 문서에 대해 코드가 추출한 메타데이터를 참고하여 요약하세요.

문서 목록:
{json.dumps(batch_metas, ensure_ascii=False, indent=1)}

각 문서에 대해 JSON 응답:
{{"summaries": [
  {{"filename": "파일명", "summary": "2줄 요약", "importance": "high/medium/low", 
    "category_hint": "업무 분류 힌트", "action_needed": "후임자가 해야 할 액션 (없으면 null)"}}
]}}"""

            try:
                result = llm.complete_json(
                    "당신은 공공기관 문서 분석 전문가입니다. 코드가 추출한 메타데이터를 활용하여 정확하게 요약하세요.",
                    prompt
                )
                for s in result.get("summaries", []):
                    s["group"] = group_name
                    enriched.append(s)
            except Exception as e:
                print(f"  [LLM Error] {group_name} 배치 {i}: {e}")
                for f in batch:
                    enriched.append({"filename": f.filename, "summary": f.content[:100], 
                                   "importance": "medium", "group": group_name})
        
        # 캐시 저장
        group_enriched = [e for e in enriched if e.get("group") == group_name]
        _save_cache(cache_key, group_enriched)
        print(f"  [LLM] {group_name}: {len(files)}개 요약 완료")
    
    return enriched


# ── 캐시 유틸 ──

def _cache_key(group_name, files):
    content = group_name + "".join(sorted(f.filename for f in files))
    return hashlib.md5(content.encode()).hexdigest()

def _load_cache(key):
    p = CACHE_DIR / f"{key}.json"
    if p.exists():
        return json.loads(p.read_text(encoding="utf-8"))
    return None

def _save_cache(key, data):
    p = CACHE_DIR / f"{key}.json"
    p.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")

def clear_cache():
    for f in CACHE_DIR.glob("*.json"):
        f.unlink()
