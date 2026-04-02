from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional


_DOCTRINE_DIR = Path(__file__).resolve().parent / "doctrine" / "reference_impls"
_INDEX_PATH = _DOCTRINE_DIR / "index.json"


@dataclass(frozen=True)
class ReferenceImpl:
    discipline_subtype_id: str
    payload: Dict[str, Any]


class ReferenceImplNotFound(Exception):
    pass


def _load_index() -> Dict[str, Any]:
    if not _INDEX_PATH.exists():
        raise FileNotFoundError(f"Reference implementation index not found: {_INDEX_PATH}")
    return json.loads(_INDEX_PATH.read_text(encoding="utf-8"))


def _resolve_file_for_subtype(discipline_subtype_id: str) -> Optional[Path]:
    idx = _load_index()
    for item in idx.get("items", []):
        if item.get("discipline_subtype_id") == discipline_subtype_id:
            file_name = item.get("file")
            if not file_name:
                return None
            return _DOCTRINE_DIR / file_name
    return None


def get_reference_impl(discipline_subtype_id: str) -> ReferenceImpl:
    """
    Returns the subtype-bound reference implementation payload.

    Notes:
    - This is doctrine data, not scoring.
    - If missing, caller should fall back to subtype doctrine Overview directly.
    """
    path = _resolve_file_for_subtype(discipline_subtype_id)
    if path is None or not path.exists():
        raise ReferenceImplNotFound(f"No reference implementation for discipline_subtype_id={discipline_subtype_id}")
    payload = json.loads(path.read_text(encoding="utf-8"))
    return ReferenceImpl(discipline_subtype_id=discipline_subtype_id, payload=payload)


def try_get_reference_impl(discipline_subtype_id: str) -> Optional[ReferenceImpl]:
    try:
        return get_reference_impl(discipline_subtype_id)
    except Exception:
        return None
