"""
업무바통 E2E 자동 테스트
백엔드 API를 순서대로 호출하여 전체 파이프라인 검증
"""
import requests, json, time, sys, os

BASE = "http://localhost:8080/api/baton"
MOCK_DIR = "/home/claude/mock_data/AI기획부_전임자폴더"
PASS = 0
FAIL = 0

def check(name, condition, detail=""):
    global PASS, FAIL
    if condition:
        PASS += 1
        print(f"  ✅ {name} — OK {detail}")
    else:
        FAIL += 1
        print(f"  ❌ {name} — FAIL {detail}")

def section(title):
    print(f"\n{'='*50}")
    print(f"  {title}")
    print(f"{'='*50}")

# ══════════════════════════════════════
# 0. 서버 상태 확인
# ══════════════════════════════════════
section("0. 서버 상태 확인")
try:
    r = requests.get(f"{BASE}/models", timeout=5)
    check("서버 응답", r.status_code == 200, f"(status: {r.status_code})")
except:
    print("  ❌ 서버가 응답하지 않습니다. 백엔드를 먼저 실행하세요.")
    sys.exit(1)

# ══════════════════════════════════════
# 1. 파일 업로드
# ══════════════════════════════════════
section("1. 파일 업로드")

# 모의데이터 폴더에서 파일 수집
files_to_upload = []
if os.path.exists(MOCK_DIR):
    for root, dirs, files in os.walk(MOCK_DIR):
        for f in files:
            fp = os.path.join(root, f)
            files_to_upload.append(fp)
    print(f"  📁 모의데이터: {len(files_to_upload)}개 파일 발견")
else:
    # 모의데이터 없으면 간단한 테스트 파일 생성
    print("  ⚠️ 모의데이터 폴더 없음, 기본 파일로 테스트")
    os.makedirs("/tmp/baton_test", exist_ok=True)
    test_files = {
        "업무연락처.txt": "김정훈 사무관 내선 3421 예산담당\n이수진 대리 내선 4512 보안검증\n박현우 부장 내선 2100",
        "2026년_예산편성_시행계획.txt": "1. 추진기간: 2026.05~09\n2. 6/15 부서별 요구서 제출 마감\n담당: 김정훈 사무관(내선 3421)",
        "N2SF_보안검증_체크리스트.txt": "1. 접근통제 SSO 연동\n2. TLS 1.3 암호화\n담당: 이수진 대리(내선 4512)",
        "AI혁신위원회_운영규정.txt": "제1조 목적: AI 도입 심의자문\n제5조 정기회의 반기 1회\n간사: 최영수 선임(내선 2105)",
    }
    for name, content in test_files.items():
        path = f"/tmp/baton_test/{name}"
        open(path, 'w', encoding='utf-8').write(content)
        files_to_upload.append(path)

# 업로드 (최대 30개로 제한 — 속도)
upload_files = files_to_upload[:30]
multipart = []
for fp in upload_files:
    fname = os.path.basename(fp)
    multipart.append(('files', (fname, open(fp, 'rb'))))

t0 = time.time()
r = requests.post(f"{BASE}/upload", files=multipart)
t1 = time.time()

check("업로드 응답", r.status_code == 200, f"({t1-t0:.1f}초)")
data = r.json()
session_id = data.get("session_id", "")
check("세션 ID 생성", bool(session_id), f"(id: {session_id})")
print(f"  📦 업로드 파일 수: {len(upload_files)}개")

# ══════════════════════════════════════
# 2. 파싱
# ══════════════════════════════════════
section("2. 파일 파싱")
t0 = time.time()
r = requests.post(f"{BASE}/parse/{session_id}")
t1 = time.time()

check("파싱 응답", r.status_code == 200, f"({t1-t0:.1f}초)")
data = r.json()
file_count = len(data.get("files", []))
check("파싱 파일 수", file_count > 0, f"({file_count}개)")

# 메타 추출 확인
meta_count = data.get("meta_extracted", 0)
check("메타 추출", meta_count > 0, f"({meta_count}개)")

# 파싱 에러 확인
errors = [f for f in data.get("files", []) if f.get("error")]
if errors:
    print(f"  ⚠️ 파싱 에러 {len(errors)}개: {[e['filename'] for e in errors[:3]]}")

# ══════════════════════════════════════
# 3. 분류
# ══════════════════════════════════════
section("3. AI 분류")
t0 = time.time()
r = requests.post(f"{BASE}/classify/{session_id}", data={"model_preset": "gemini"})
t1 = time.time()

check("분류 응답", r.status_code == 200, f"({t1-t0:.1f}초)")
data = r.json()
cat_count = len(data.get("categories", []))
check("업무 영역 분류", cat_count >= 2, f"({cat_count}개 영역)")

if cat_count > 0:
    for cat in data.get("categories", [])[:5]:
        name = cat.get("name", "?")
        fc = cat.get("file_count", 0)
        print(f"    📂 {name}: {fc}개 파일")

# ══════════════════════════════════════
# 4. 인터뷰
# ══════════════════════════════════════
section("4. AI 인터뷰 (커버리지 분석)")
t0 = time.time()
r = requests.post(f"{BASE}/interview/{session_id}")
t1 = time.time()

check("인터뷰 응답", r.status_code == 200, f"({t1-t0:.1f}초)")
data = r.json()
reports = data.get("reports", [])
check("커버리지 리포트 생성", len(reports) > 0, f"({len(reports)}개)")

# 점수 다양성 확인
scores = [rep.get("score", 0) for rep in reports]
unique_scores = len(set(scores))
check("점수 다양성", unique_scores >= 2, f"(고유 점수: {unique_scores}개, 점수: {scores[:5]})")

risk_levels = [rep.get("risk_level", "") for rep in reports]
has_high = "High" in risk_levels
check("High 리스크 존재", has_high, f"(리스크: {risk_levels[:5]})")

# 답변 제출
section("4-1. 인터뷰 답변 제출")
answers = {}
for rep in reports:
    for q in rep.get("questions", []):
        qid = q.get("id", "")
        if qid:
            answers[qid] = "테스트 답변입니다. 해당 업무는 정상 진행 중입니다."

t0 = time.time()
r = requests.post(f"{BASE}/interview/{session_id}/answer", json=answers)
t1 = time.time()
check("답변 제출", r.status_code == 200, f"({len(answers)}개 답변, {t1-t0:.1f}초)")

# ══════════════════════════════════════
# 5. 캘린더
# ══════════════════════════════════════
section("5. 업무 캘린더 추출")
t0 = time.time()
r = requests.post(f"{BASE}/calendar/{session_id}")
t1 = time.time()

check("캘린더 응답", r.status_code == 200, f"({t1-t0:.1f}초)")
data = r.json()
monthly = data.get("monthly_view", {}).get("monthly", {})
months_with_events = len([m for m, evts in monthly.items() if evts])
check("월별 일정 추출", months_with_events > 0, f"({months_with_events}개월에 일정 존재)")

always_on = data.get("monthly_view", {}).get("always_on", [])
check("상시 업무 추출", len(always_on) > 0, f"({len(always_on)}개)")

# ══════════════════════════════════════
# 6. 인수인계서 생성
# ══════════════════════════════════════
section("6. 인수인계서 생성")
t0 = time.time()
r = requests.post(f"{BASE}/handover/{session_id}")
t1 = time.time()

check("인수인계서 응답", r.status_code == 200, f"({t1-t0:.1f}초)")
data = r.json()
md = data.get("handover_markdown", "")
check("인수인계서 내용", len(md) > 100, f"({len(md)}자)")

# ══════════════════════════════════════
# 7. Q&A 챗봇
# ══════════════════════════════════════
section("7. Q&A 챗봇")

test_questions = [
    ("예산 담당자가 누구야?", ["김정훈", "3421"]),
    ("N2SF 보안검증은 어떻게 진행돼?", ["보안", "검증"]),
    ("AI혁신위원회는 언제 열려?", ["위원회", "회의"]),
]

for question, expected_keywords in test_questions:
    t0 = time.time()
    r = requests.post(f"{BASE}/chat/{session_id}", json={"question": question})
    t1 = time.time()
    
    if r.status_code == 200:
        answer = r.json().get("answer", "")
        has_keyword = any(kw in answer for kw in expected_keywords)
        check(f'Q: "{question[:20]}..."', has_keyword, f"({t1-t0:.1f}초, {len(answer)}자)")
        if not has_keyword:
            print(f"    답변: {answer[:80]}...")
    else:
        check(f'Q: "{question[:20]}..."', False, f"(status: {r.status_code})")

# ══════════════════════════════════════
# 8. 내보내기
# ══════════════════════════════════════
section("8. 내보내기 (DOCX)")
r = requests.get(f"{BASE}/handover/{session_id}/export?format=docx")
check("DOCX 내보내기", r.status_code == 200, f"({len(r.content)}bytes)")

# ══════════════════════════════════════
# 9. 세션 조회 (후임자 접속용)
# ══════════════════════════════════════
section("9. 세션 조회 (후임자 접속)")
r = requests.get(f"{BASE}/session/{session_id}")
check("세션 조회", r.status_code == 200)

# ══════════════════════════════════════
# 결과 요약
# ══════════════════════════════════════
print(f"\n{'='*50}")
print(f"  🏁 E2E 테스트 결과")
print(f"{'='*50}")
print(f"  ✅ 통과: {PASS}개")
print(f"  ❌ 실패: {FAIL}개")
print(f"  총: {PASS + FAIL}개")

if FAIL == 0:
    print(f"\n  🎉 전체 통과! 시연 준비 완료!")
else:
    print(f"\n  ⚠️ {FAIL}개 항목 확인 필요")

print(f"\n  세션 코드: {session_id}")
print(f"  (이 코드를 후임자 모드에서 입력하면 접속 가능)")
