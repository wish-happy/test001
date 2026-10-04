"""
업무바통 API 라우터 — 전체 기능
업로드 → 파싱 → 분류 → 인터뷰 → 캘린더 → 인수인계서 → Q&A
"""

import os, shutil, uuid, json, zipfile, tempfile
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Body
from fastapi.responses import JSONResponse

from ..services.file_parser import FileParser, get_folder_summary
from ..services.classifier import AutoClassifier
from ..services.llm_adapter import LLMAdapter, LLMConfig, MODEL_PRESETS
from ..services.interviewer import AIInterviewer
from ..services.calendar_extractor import CalendarExtractor
from ..services.handover_generator import HandoverGenerator
from ..services.qa_chatbot import QAChatbot
from ..services import mock_data

router = APIRouter(prefix="/api/baton", tags=["업무바통"])
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)
sessions: dict = {}
DEMO_MODE = os.getenv("DEMO_MODE", "false").lower() == "true"


def _get_llm(preset="gemini", api_key=None, base_url=None, model=None):
    """LLM 인스턴스 — 항상 Gemini 기본"""
    return LLMAdapter()


# ─── 1. 업로드 ───
@router.post("/upload")
async def upload_files(
    files: list[UploadFile] = File(...),
    session_id: Optional[str] = Form(None),
):
    if not session_id:
        session_id = str(uuid.uuid4())[:8]
    session_dir = UPLOAD_DIR / session_id
    session_dir.mkdir(parents=True, exist_ok=True)

    uploaded = []
    for file in files:
        content = await file.read()
        safe_name = _fix_korean_filename(file.filename).replace("\\", "/")

        # ZIP 파일이면 압축 해제 (한글 파일명 보정 포함)
        if safe_name.lower().endswith(".zip"):
            extracted = _extract_zip(content, session_dir)
            uploaded.extend(extracted)
        else:
            file_path = session_dir / safe_name
            file_path.parent.mkdir(parents=True, exist_ok=True)
            with open(file_path, "wb") as f:
                f.write(content)
            uploaded.append({"filename": safe_name, "size": len(content)})

    return {"session_id": session_id, "uploaded_count": len(uploaded), "files": uploaded}


def _fix_korean_filename(name: str) -> str:
    """Windows CP949 인코딩된 한글 파일명 보정"""
    if not name:
        return name
    try:
        # 이미 정상 UTF-8이면 그대로
        name.encode("ascii")
        return name
    except UnicodeEncodeError:
        return name  # 이미 유니코드 한글
    except Exception:
        pass
    # CP437 → CP949 재디코딩 시도
    try:
        return name.encode("cp437").decode("cp949")
    except (UnicodeDecodeError, UnicodeEncodeError):
        return name


def _extract_zip(content: bytes, dest_dir: Path) -> list[dict]:
    """ZIP 압축 해제 — 한글 파일명 인코딩 보정 포함"""
    extracted = []
    with tempfile.NamedTemporaryFile(suffix=".zip", delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        with zipfile.ZipFile(tmp_path, "r") as zf:
            for info in zf.infolist():
                if info.is_dir():
                    continue
                # 한글 파일명 보정
                try:
                    fixed_name = info.filename.encode("cp437").decode("cp949")
                except (UnicodeDecodeError, UnicodeEncodeError):
                    fixed_name = info.filename

                fixed_name = fixed_name.replace("\\", "/")
                out_path = dest_dir / fixed_name
                out_path.parent.mkdir(parents=True, exist_ok=True)

                with zf.open(info) as src, open(out_path, "wb") as dst:
                    data = src.read()
                    dst.write(data)

                extracted.append({"filename": fixed_name, "size": len(data)})
    finally:
        os.unlink(tmp_path)

    return extracted


# ─── 2. 파싱 ───
@router.post("/parse/{session_id}")
async def parse_files(session_id: str):
    session_dir = UPLOAD_DIR / session_id
    if not session_dir.exists():
        raise HTTPException(404, "세션을 찾을 수 없습니다")

    parser = FileParser()
    parsed = parser.parse_folder(str(session_dir))
    summary = get_folder_summary(parsed)
    sessions[session_id] = {"parsed_files": parsed, "summary": summary}

    return {
        "session_id": session_id,
        "summary": summary,
        "files": [
            {"filename": pf.filename, "extension": pf.extension,
             "content_length": len(pf.content),
             "folder": pf.metadata.get("parent_folder", "."),
             "preview": pf.content_preview, "error": pf.error}
            for pf in parsed
        ],
    }


# ─── 3. 분류 ───
@router.post("/classify/{session_id}")
async def classify_files(
    session_id: str,
    model_preset: str = Form("gemini"),
    custom_api_key: Optional[str] = Form(None),
    custom_base_url: Optional[str] = Form(None),
    custom_model: Optional[str] = Form(None),
):
    if session_id not in sessions:
        raise HTTPException(404, "먼저 파일을 파싱해주세요")

    parsed_files = sessions[session_id]["parsed_files"]
    llm = _get_llm(model_preset, custom_api_key, custom_base_url, custom_model)

    if DEMO_MODE:
        # Mock 모드: LLM 호출 없이 즉시 반환
        from ..services.classifier import WorkCategory
        mock_cats = []
        for mc in mock_data.MOCK_CLASSIFY["categories"]:
            cat = WorkCategory(id=mc["id"], name=mc["name"], description=mc["description"],
                               cycle_type=mc["cycle_type"], cycle_detail=mc.get("cycle_detail"),
                               key_dates=mc.get("key_dates", []),
                               related_people=mc.get("related_people", []),
                               related_categories=mc.get("related_category_ids", []))
            for idx in mc.get("file_indices", []):
                if idx < len(parsed_files):
                    cat.files.append(parsed_files[idx])
            mock_cats.append(cat)
        categories = mock_cats
        classifier = AutoClassifier(llm)
        relations = classifier.extract_relations(categories)
    else:
        classifier = AutoClassifier(llm)
        categories = classifier.classify(parsed_files)
        relations = classifier.extract_relations(categories)

    sessions[session_id]["categories"] = categories
    sessions[session_id]["relations"] = relations
    sessions[session_id]["llm"] = llm

    return {
        "session_id": session_id,
        "model": {"provider": "demo" if DEMO_MODE else llm.get_model_info()["provider"],
                  "model": "mock-cache" if DEMO_MODE else llm.get_model_info()["model"]},
        "categories": [cat.to_dict() for cat in categories],
        "relations": relations,
        "stats": {
            "total_categories": len(categories),
            "total_files": sum(cat.file_count for cat in categories),
            "cycle_summary": {
                "상시": len([c for c in categories if c.cycle_type == "상시"]),
                "순기": len([c for c in categories if c.cycle_type == "순기"]),
            },
        },
    }


# ─── 4. 커버리지 분석 + 인터뷰 질문 ───
@router.post("/interview/{session_id}")
async def generate_interview(session_id: str):
    if session_id not in sessions or "categories" not in sessions[session_id]:
        raise HTTPException(404, "먼저 분류를 실행해주세요")

    if DEMO_MODE:
        from ..services.interviewer import CoverageReport
        reports = []
        for mr in mock_data.MOCK_INTERVIEW["reports"]:
            score = mr["score"]
            reports.append(CoverageReport(
                category_id=mr["category_id"], category_name=mr["category_name"],
                coverage="🟢" if score >= 70 else ("🟡" if score >= 40 else "🔴"),
                score=score, found=mr.get("found", []), missing=mr.get("missing", []),
                questions=mr.get("questions", []),
            ))
    else:
        llm = LLMAdapter()  # 항상 기본 LLM(Gemini) 사용
        interviewer = AIInterviewer(llm)
        reports = interviewer.analyze_coverage(sessions[session_id]["categories"])

    sessions[session_id]["coverage_reports"] = reports

    return {
        "session_id": session_id,
        "reports": [r.to_dict() for r in reports],
        "total_questions": sum(len(r.questions) for r in reports),
    }


# ─── 4-1. 인터뷰 답변 제출 ───
@router.post("/interview/{session_id}/answer")
async def submit_interview_answers(session_id: str, answers: dict = Body(...)):
    """answers: {"q1": "답변1", "q2": "답변2", ...}"""
    if session_id not in sessions or "coverage_reports" not in sessions[session_id]:
        raise HTTPException(404, "먼저 인터뷰를 생성해주세요")

    llm = LLMAdapter()  # 항상 기본 LLM(Gemini) 사용
    interviewer = AIInterviewer(llm)
    reports = interviewer.merge_answers(sessions[session_id]["coverage_reports"], answers)
    sessions[session_id]["coverage_reports"] = reports
    sessions[session_id]["interview_answers"] = answers

    answered = sum(1 for r in reports for q in r.questions if q.get("answered"))
    total = sum(len(r.questions) for r in reports)

    return {
        "session_id": session_id,
        "answered": answered,
        "total": total,
        "reports": [r.to_dict() for r in reports],
    }


# ─── 5. 캘린더 추출 ───
@router.post("/calendar/{session_id}")
async def extract_calendar(session_id: str):
    if session_id not in sessions or "categories" not in sessions[session_id]:
        raise HTTPException(404, "먼저 분류를 실행해주세요")

    if DEMO_MODE:
        from ..services.calendar_extractor import CalendarEvent
        events = [CalendarEvent(**e) for e in mock_data.MOCK_CALENDAR["events"]]
    else:
        llm = LLMAdapter()  # 항상 기본 LLM(Gemini) 사용
        extractor = CalendarExtractor(llm)
        events = extractor.extract(sessions[session_id]["categories"])

    from ..services.calendar_extractor import CalendarExtractor as CE
    monthly_view = CE(LLMAdapter()).get_monthly_view(events)
    sessions[session_id]["calendar_events"] = events

    return {
        "session_id": session_id,
        "total_events": len(events),
        "events": [e.to_dict() for e in events],
        "monthly_view": monthly_view,
    }


# ─── 6. 인수인계서 생성 ───
@router.post("/handover/{session_id}")
async def generate_handover(session_id: str):
    if session_id not in sessions or "categories" not in sessions[session_id]:
        raise HTTPException(404, "먼저 분류를 실행해주세요")

    if DEMO_MODE:
        handover_md = mock_data.MOCK_HANDOVER
    else:
        llm = LLMAdapter()  # 항상 기본 LLM(Gemini) 사용
        generator = HandoverGenerator(llm)
        handover_md = generator.generate(
            categories=sessions[session_id]["categories"],
            coverage_reports=sessions[session_id].get("coverage_reports"),
            calendar_events=sessions[session_id].get("calendar_events"),
            interview_answers=sessions[session_id].get("interview_answers"),
        )

    sessions[session_id]["handover_md"] = handover_md

    return {
        "session_id": session_id,
        "handover_markdown": handover_md,
        "word_count": len(handover_md),
    }


# ─── 6-1. 인수인계서 내보내기 ───
@router.get("/handover/{session_id}/export")
async def export_handover(session_id: str, format: str = "docx"):
    """인수인계서를 DOCX 또는 PDF로 내보내기"""
    if session_id not in sessions or "handover_md" not in sessions[session_id]:
        raise HTTPException(404, "먼저 인수인계서를 생성해주세요")

    from ..services.exporter import HandoverExporter
    from fastapi.responses import FileResponse

    exporter = HandoverExporter()
    md = sessions[session_id]["handover_md"]
    out_dir = UPLOAD_DIR / session_id
    out_dir.mkdir(exist_ok=True)

    if format == "pdf":
        out_path = str(out_dir / "인수인계서.pdf")
        exporter.to_pdf(md, out_path)
        media = "application/pdf"
    else:
        out_path = str(out_dir / "인수인계서.docx")
        exporter.to_docx(md, out_path)
        media = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

    return FileResponse(out_path, media_type=media,
                        filename=Path(out_path).name)


# ─── 7. Q&A 챗봇 ───
@router.post("/chat/{session_id}")
async def chat(session_id: str, question: str = Body(..., embed=True)):
    if session_id not in sessions:
        raise HTTPException(404, "세션을 찾을 수 없습니다")

    # 챗봇 초기화 (첫 질문 시)
    if "chatbot" not in sessions[session_id]:
        llm = LLMAdapter()  # 항상 기본 LLM(Gemini) 사용
        chatbot = QAChatbot(llm)
        chatbot.load_context(
            sessions[session_id]["parsed_files"],
            sessions[session_id].get("categories"),
            sessions[session_id].get("interview_answers"),
        )
        sessions[session_id]["chatbot"] = chatbot

    result = sessions[session_id]["chatbot"].ask(question)
    return {"session_id": session_id, "question": question, **result}


# ─── 유틸 ───
@router.get("/session/{session_id}")
async def get_session(session_id: str):
    if session_id not in sessions:
        raise HTTPException(404, "세션을 찾을 수 없습니다")
    data = sessions[session_id]
    result = {"session_id": session_id, "summary": data.get("summary")}
    if "categories" in data:
        result["categories"] = [cat.to_dict() for cat in data["categories"]]
        result["relations"] = data.get("relations", [])
    if "handover_md" in data:
        result["has_handover"] = True
    return result


@router.get("/models")
async def list_models():
    return {
        "presets": {
            name: {"provider": c.provider, "model": c.model, "base_url": c.base_url or "default"}
            for name, c in MODEL_PRESETS.items()
        },
    }


@router.delete("/session/{session_id}")
async def delete_session(session_id: str):
    session_dir = UPLOAD_DIR / session_id
    if session_dir.exists():
        shutil.rmtree(session_dir)
    sessions.pop(session_id, None)
    return {"deleted": session_id}
