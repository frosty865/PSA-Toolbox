"""
Two-pass module generation: PASS A (questions) then PASS B (OFCs per question).
Yield guards: if PASS A yields <8 questions, retry once with low-yield correction; if still <8, fail with report (no empty export).
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List

from ..model.module_pass_a_client import run_pass_a, run_pass_a_low_yield_retry
from ..model.module_pass_b_client import run_pass_b

MIN_QUESTIONS_FOR_EXPORT = 8
MAX_OFCS_PER_QUESTION = 4


def load_chunks_from_json(module_code: str, chunks_path: Path, max_chunks: int) -> List[Dict[str, Any]]:
    """Load chunks from data/module_chunks/<module_code>.json into processor format."""
    if not chunks_path.exists():
        return []
    with open(chunks_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    source_index = data.get("source_index") or {}
    chunks_raw = data.get("chunks") or []
    out = []
    for c in chunks_raw[:max_chunks]:
        sid = c.get("source_registry_id") or c.get("doc_id")
        source_file = source_index.get(str(sid), "unknown") if sid else "unknown"
        if isinstance(source_file, str) and len(source_file) > 120:
            source_file = source_file[:117] + "..."
        page = c.get("locator_value") or "1"
        out.append({
            "chunk_id": str(c.get("chunk_id", "")),
            "chunk_text": (c.get("text") or "").strip(),
            "page_range": page,
            "source_file": source_file,
        })
    return out


def generate_module_two_pass(
    *,
    model: str,
    module_code: str,
    module_title: str,
    chunks: List[Dict[str, Any]],
    chunks_path: Path | None = None,
    max_chunks: int = 80,
    max_chunk_chars: int = 2000,
    run_pass_b_per_question: bool = True,
    pass_b_timeout: int = 300,
    report_dir: Path | None = None,
) -> Dict[str, Any]:
    """
    Run 2-pass generation: PASS A (questions) then PASS B (OFCs per question).
    Returns:
      - risk_drivers, questions, question_ofcs (question_code -> list of OFC dicts)
      - export_status: "OK" | "FAILED"
      - report: counts, drop reasons, subtype resolution stats, warnings
    If PASS A yields <8 questions, retry once with low-yield correction. If still <8, export_status=FAILED and report written.
    """
    report: Dict[str, Any] = {
        "pass_a_question_count": 0,
        "pass_a_retry_used": False,
        "pass_b_ofc_counts": [],
        "questions_with_zero_ofcs": [],
        "warnings": [],
        "export_status": "OK",
    }
    risk_drivers: List[Dict[str, Any]] = []
    questions: List[Dict[str, Any]] = []
    question_ofcs: Dict[str, List[Dict[str, Any]]] = {}

    if not chunks:
        report["export_status"] = "FAILED"
        report["warnings"].append("no_chunks")
        if report_dir:
            (report_dir / "module_generation_report.json").write_text(
                json.dumps({"module_code": module_code, "report": report}, indent=2),
                encoding="utf-8",
            )
        return {
            "module_code": module_code,
            "module_title": module_title,
            "risk_drivers": risk_drivers,
            "questions": questions,
            "question_ofcs": question_ofcs,
            "export_status": "FAILED",
            "report": report,
        }

    # PASS A
    pass_a_result = run_pass_a(
        model=model,
        module_code=module_code,
        module_title=module_title,
        chunks=chunks,
        max_chunk_chars=max_chunk_chars,
        timeout=1200,
    )
    risk_drivers = pass_a_result.get("risk_drivers") or []
    questions = pass_a_result.get("questions") or []
    if not isinstance(questions, list):
        questions = []

    # Yield guard: if <8 questions, retry once with low-yield correction
    if len(questions) < MIN_QUESTIONS_FOR_EXPORT:
        report["pass_a_retry_used"] = True
        retry_result = run_pass_a_low_yield_retry(
            model=model,
            module_code=module_code,
            module_title=module_title,
            chunks=chunks,
            max_chunk_chars=max_chunk_chars,
            timeout=1200,
        )
        retry_questions = retry_result.get("questions") or []
        if isinstance(retry_questions, list) and len(retry_questions) > len(questions):
            questions = retry_questions
            risk_drivers = retry_result.get("risk_drivers") or risk_drivers

    report["pass_a_question_count"] = len(questions)

    if len(questions) < MIN_QUESTIONS_FOR_EXPORT:
        report["export_status"] = "FAILED"
        report["warnings"].append(
            f"pass_a_yield_below_minimum: {len(questions)} questions (minimum {MIN_QUESTIONS_FOR_EXPORT}); source may be empty or out-of-scope"
        )
        if report_dir:
            (report_dir / "module_generation_report.json").write_text(
                json.dumps(
                    {
                        "module_code": module_code,
                        "report": report,
                        "diagnostics": {"items_empty_reason": pass_a_result.get("items_empty_reason")},
                    },
                    indent=2,
                ),
                encoding="utf-8",
            )
        return {
            "module_code": module_code,
            "module_title": module_title,
            "risk_drivers": risk_drivers,
            "questions": questions,
            "question_ofcs": question_ofcs,
            "export_status": "FAILED",
            "report": report,
        }

    # PASS B: OFCs per question
    if run_pass_b_per_question:
        for q in questions:
            if not isinstance(q, dict):
                continue
            qcode = (q.get("question_code") or "").strip()
            if not qcode:
                continue
            ofcs = run_pass_b(
                model=model,
                module_code=module_code,
                question=q,
                timeout=pass_b_timeout,
            )
            if len(ofcs) > MAX_OFCS_PER_QUESTION:
                ofcs = ofcs[:MAX_OFCS_PER_QUESTION]
            question_ofcs[qcode] = ofcs
            report["pass_b_ofc_counts"].append({"question_code": qcode, "ofc_count": len(ofcs)})
            if len(ofcs) == 0:
                report["questions_with_zero_ofcs"].append(qcode)

    if report_dir:
        (report_dir / "module_generation_report.json").write_text(
            json.dumps({"module_code": module_code, "report": report}, indent=2),
            encoding="utf-8",
        )

    return {
        "module_code": module_code,
        "module_title": module_title,
        "risk_drivers": risk_drivers,
        "questions": questions,
        "question_ofcs": question_ofcs,
        "export_status": "OK",
        "report": report,
    }
