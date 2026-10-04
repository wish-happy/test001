"""
Auto Classifier — 파싱된 파일들을 업무 단위로 자동 분류
1단계: 폴더 구조 힌트 활용
2단계: LLM으로 파일 내용 기반 분류
3단계: 업무 간 관계(공통 참조 문서 등) 추출
"""

import json
from dataclasses import dataclass, field
from typing import Optional

from .file_parser import ParsedFile
from .llm_adapter import LLMAdapter


@dataclass
class WorkCategory:
    """업무 분류 단위"""
    id: str
    name: str                                    # 업무명
    description: str                             # 업무 설명
    cycle_type: str = "상시"                      # 상시 / 순기(월간/분기/반기/연간)
    cycle_detail: Optional[str] = None           # "매년 3월", "분기별" 등
    files: list[ParsedFile] = field(default_factory=list)
    key_dates: list[dict] = field(default_factory=list)     # 주요 일정
    related_people: list[str] = field(default_factory=list) # 관련 인물
    related_categories: list[str] = field(default_factory=list)  # 연관 업무 ID

    @property
    def file_count(self) -> int:
        return len(self.files)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "cycle_type": self.cycle_type,
            "cycle_detail": self.cycle_detail,
            "file_count": self.file_count,
            "files": [{"filename": f.filename, "path": f.metadata.get("relative_path", f.filename)} for f in self.files],
            "key_dates": self.key_dates,
            "related_people": self.related_people,
            "related_categories": self.related_categories,
        }


CLASSIFY_SYSTEM_PROMPT = """당신은 공공기관 업무 분류 전문가입니다.
주어진 파일 목록과 내용을 분석하여 업무 단위로 분류해주세요.

응답 형식 (JSON):
{
  "categories": [
    {
      "id": "work_01",
      "name": "업무명",
      "description": "이 업무가 무엇인지 2-3문장",
      "cycle_type": "상시" 또는 "순기",
      "cycle_detail": "순기인 경우 주기 (매년 3월, 분기별 등). 상시이면 null",
      "file_indices": [0, 3, 5],
      "key_dates": [
        {"date_hint": "매년 1월", "task": "연간계획 수립"},
        {"date_hint": "매월 말", "task": "실적보고"}
      ],
      "related_people": ["김과장", "정보화담당관"],
      "related_category_ids": ["work_02"]
    }
  ]
}

분류 기준:
1. 같은 사업·프로젝트에 속하는 문서는 하나의 업무로 묶기
2. 폴더 구조가 힌트가 됨 (같은 폴더 = 같은 업무일 가능성 높음)
3. 문서 내 반복되는 키워드, 사업명, 기관명으로 연관성 판단
4. 업무 주기(상시/순기)를 문서 내 날짜, "매년", "분기" 등 표현으로 판단
5. 문서에 등장하는 인물(과장, 담당 등)을 related_people에 추출
6. 서로 참조하거나 연관된 업무는 related_category_ids로 연결"""


class AutoClassifier:
    """파싱된 파일들을 업무별로 자동 분류"""

    def __init__(self, llm: LLMAdapter):
        self.llm = llm

    def classify(self, parsed_files: list[ParsedFile]) -> list[WorkCategory]:
        """파일 목록을 분석하여 업무 카테고리로 분류"""
        if not parsed_files:
            return []

        # 파일 정보를 LLM에 전달할 형태로 정리
        file_summaries = []
        for i, pf in enumerate(parsed_files):
            summary = {
                "index": i,
                "filename": pf.filename,
                "folder": pf.metadata.get("parent_folder", "."),
                "extension": pf.extension,
                "content_preview": pf.content_preview,
            }
            # 메타데이터에서 유용한 정보 추가
            if pf.metadata.get("title"):
                summary["title"] = pf.metadata["title"]
            if pf.metadata.get("author"):
                summary["author"] = pf.metadata["author"]
            file_summaries.append(summary)

        user_prompt = f"""다음은 한 공무원의 업무 폴더에서 추출한 파일 {len(file_summaries)}개입니다.
이 파일들을 업무 단위로 분류해주세요.

파일 목록:
{json.dumps(file_summaries, ensure_ascii=False, indent=2)}"""

        # LLM으로 분류
        try:
            result = self.llm.complete_json(CLASSIFY_SYSTEM_PROMPT, user_prompt)
        except Exception as e:
            print(f"[Classifier LLM Error] {e}")
            return self._fallback_classify(parsed_files)

        # 결과를 WorkCategory 객체로 변환
        categories = []
        raw_cats = result.get("categories", [])
        if not isinstance(raw_cats, list):
            print(f"[Classifier] 'categories' is not a list: {type(raw_cats)}")
            return self._fallback_classify(parsed_files)

        for cat_data in raw_cats:
            if not isinstance(cat_data, dict):
                continue
            cat = WorkCategory(
                id=cat_data.get("id", f"work_{len(categories)+1:02d}"),
                name=cat_data.get("name", "미분류"),
                description=cat_data.get("description", ""),
                cycle_type=cat_data.get("cycle_type", "상시"),
                cycle_detail=cat_data.get("cycle_detail"),
                key_dates=cat_data.get("key_dates", []),
                related_people=cat_data.get("related_people", []),
                related_categories=cat_data.get("related_category_ids", []),
            )
            # 파일 매핑 — 인덱스 타입 안전 처리
            for idx in cat_data.get("file_indices", []):
                try:
                    idx = int(idx)
                except (ValueError, TypeError):
                    continue
                if 0 <= idx < len(parsed_files):
                    cat.files.append(parsed_files[idx])

            categories.append(cat)

        # 미분류 파일 처리
        classified_indices = set()
        for cat in categories:
            for f in cat.files:
                idx = next(
                    (i for i, pf in enumerate(parsed_files) if pf.filepath == f.filepath),
                    None,
                )
                if idx is not None:
                    classified_indices.add(idx)

        unclassified = [
            parsed_files[i] for i in range(len(parsed_files)) if i not in classified_indices
        ]
        if unclassified:
            misc = WorkCategory(
                id="work_misc",
                name="미분류",
                description="자동 분류되지 않은 파일들입니다. 수동 분류가 필요합니다.",
                files=unclassified,
            )
            categories.append(misc)

        return categories

    def _fallback_classify(self, parsed_files: list[ParsedFile]) -> list[WorkCategory]:
        """LLM 없이 폴더 구조 기반 분류 (fallback)"""
        folder_map: dict[str, list[ParsedFile]] = {}

        for pf in parsed_files:
            folder = pf.metadata.get("parent_folder", "기타")
            if folder == ".":
                folder = "루트"
            if folder not in folder_map:
                folder_map[folder] = []
            folder_map[folder].append(pf)

        categories = []
        for i, (folder_name, files) in enumerate(folder_map.items()):
            cat = WorkCategory(
                id=f"work_{i+1:02d}",
                name=folder_name,
                description=f"'{folder_name}' 폴더의 파일 {len(files)}개",
                files=files,
            )
            categories.append(cat)

        return categories

    def extract_relations(self, categories: list[WorkCategory]) -> list[dict]:
        """업무 간 관계를 추출 (관계도 시각화용)"""
        relations = []

        # 1. LLM이 지정한 관계
        for cat in categories:
            for related_id in cat.related_categories:
                relations.append({
                    "source": cat.id,
                    "target": related_id,
                    "type": "related",
                    "reason": "LLM 분석 기반 연관 업무",
                })

        # 2. 같은 사람이 연관된 업무
        people_map: dict[str, list[str]] = {}
        for cat in categories:
            for person in cat.related_people:
                if person not in people_map:
                    people_map[person] = []
                people_map[person].append(cat.id)

        for person, cat_ids in people_map.items():
            if len(cat_ids) > 1:
                for i in range(len(cat_ids)):
                    for j in range(i + 1, len(cat_ids)):
                        relations.append({
                            "source": cat_ids[i],
                            "target": cat_ids[j],
                            "type": "shared_person",
                            "reason": f"공통 관련자: {person}",
                        })

        return relations
