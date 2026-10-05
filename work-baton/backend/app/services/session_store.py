"""
세션 영속화 — JSON 파일로 저장/로드
서버 재시작해도 세션 유지
"""
import json, os
from pathlib import Path

STORE_DIR = Path(__file__).parent.parent.parent / "session_store"
STORE_DIR.mkdir(exist_ok=True)


def _make_serializable(v):
    """객체를 JSON 직렬화 가능하게 변환"""
    if isinstance(v, dict):
        return v
    if hasattr(v, 'to_dict'):
        return v.to_dict()
    if hasattr(v, '__dict__'):
        return v.__dict__
    return str(v)


def save_session(session_id: str, data: dict):
    """세션을 JSON으로 저장"""
    serializable = {}
    for k, v in data.items():
        if k in ("parsed_files", "llm"):
            continue
        try:
            if isinstance(v, list):
                serializable[k] = [_make_serializable(i) for i in v]
            elif isinstance(v, dict):
                serializable[k] = v
            else:
                json.dumps(v)
                serializable[k] = v
        except (TypeError, ValueError, AttributeError):
            continue

    path = STORE_DIR / f"{session_id}.json"
    path.write_text(json.dumps(serializable, ensure_ascii=False, indent=1, default=str), encoding="utf-8")


def load_session(session_id: str) -> dict:
    """저장된 세션 로드"""
    path = STORE_DIR / f"{session_id}.json"
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def load_all_sessions() -> dict:
    """서버 시작 시 모든 세션 로드"""
    sessions = {}
    for path in STORE_DIR.glob("*.json"):
        sid = path.stem
        try:
            sessions[sid] = json.loads(path.read_text(encoding="utf-8"))
        except:
            continue
    return sessions


def delete_session(session_id: str):
    """세션 파일 삭제"""
    path = STORE_DIR / f"{session_id}.json"
    if path.exists():
        path.unlink()
