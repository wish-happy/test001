"""
업무바통 — AI 인수인계 도구
전임자는 전화 안 받아도 되고, 후임자는 전화 안 해도 되는 인수인계 도구
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import baton

app = FastAPI(
    title="업무바통",
    description="AI 기반 인수인계 자동화 도구",
    version="0.1.0",
)

# CORS 설정 (프론트엔드 연결용)
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r".*",
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(baton.router)


@app.get("/")
async def root():
    return {
        "name": "업무바통",
        "description": "전임자는 전화 안 받아도 되고, 후임자는 전화 안 해도 되는 AI 인수인계 도구",
        "version": "0.1.0",
        "endpoints": {
            "POST /api/baton/upload": "파일 업로드",
            "POST /api/baton/parse/{session_id}": "파일 파싱",
            "POST /api/baton/classify/{session_id}": "업무별 자동 분류",
            "GET /api/baton/session/{session_id}": "세션 조회",
            "GET /api/baton/models": "지원 모델 목록",
        },
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)


try:
    from app.routers import baton
    app.include_router(baton.router, prefix="/api", tags=["baton-compat"])
except Exception:
    pass


try:
    from app.routers import baton
    baton.router.prefix = ""  # 내부 프리픽스 초기화로 중복 제거
    app.include_router(baton.router, prefix="/api/baton", tags=["baton-full"])
    app.include_router(baton.router, prefix="/api", tags=["baton-api"])
    app.include_router(baton.router, prefix="", tags=["baton-root"])
except Exception as e:
    print("Router config note:", e)
exec("try:\n from app.routers import baton\n app.include_router(baton.router, prefix=\"/api\")\n app.include_router(baton.router, prefix=\"/baton\")\nexcept: pass # compat_routes")


try:
    from app.routers import baton
    app.include_router(baton.router, prefix="/api", tags=["compat_api"])
    app.include_router(baton.router, prefix="", tags=["compat_root"])
except Exception as e:
    pass
