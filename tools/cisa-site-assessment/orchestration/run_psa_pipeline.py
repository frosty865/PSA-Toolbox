"""Orchestration entry point for full PSA pipeline execution.

This module provides a single entry point that:
- Invokes psa_engine (Phase 2, Phase 3, projection)
- Derives baseline coverage summary
- Generates a DOCX report

It does NOT embed engine logic, catch-and-soften errors, or infer sectors.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Dict, Any, Literal

import psa_engine
from psa_engine.phase2.evaluators import RuleBasedEvaluator
from psa_engine.projection.report_projection import project_phase3_for_report

# Import reporting functions (assumed to exist in psa-rebuild)
# If these don't exist yet, they should be created per previous design
try:
    from reporting.baseline_text_report import derive_baseline_coverage_summary
    from reporting.docx_report import generate_docx_report
except ImportError:
    # Fallback: define minimal stubs if reporting modules don't exist yet
    def derive_baseline_coverage_summary(report_projection: Dict[str, Any]) -> Dict[str, Any]:
        """Placeholder if reporting module not yet created."""
        raise NotImplementedError("reporting.baseline_text_report not yet implemented")

    def generate_docx_report(
        report_projection: Dict[str, Any],
        baseline_summary: Dict[str, Any],
        output_path: str | Path,
    ) -> None:
        """Placeholder if reporting module not yet created."""
        raise NotImplementedError("reporting.docx_report not yet implemented")


def _create_evaluator(
    evaluator_type: Literal["rule_based", "ollama"],
    evaluator_config: Dict[str, Any] | None = None,
) -> Any:
    """Create evaluator instance based on type.

    Raises:
        ValueError: If evaluator_type is invalid or Ollama is requested but not enabled
        RuntimeError: If evaluator creation fails or Ollama is requested outside internal mode
    """
    if evaluator_config is None:
        evaluator_config = {}

    if evaluator_type == "rule_based":
        rules = evaluator_config.get("rules", {})
        if not rules:
            raise ValueError("rule_based evaluator requires 'rules' in evaluator_config")
        return RuleBasedEvaluator(rules)

    if evaluator_type == "ollama":
        # Policy guard: Ollama evaluator is restricted to internal/admin execution only
        internal_mode = os.getenv("INTERNAL_MODE", "").strip().lower() in ("1", "true", "yes")
        use_ollama = os.getenv("USE_OLLAMA", "").strip().lower() in ("1", "true", "yes")
        
        if not internal_mode:
            raise RuntimeError(
                "Ollama evaluator is restricted to internal/admin execution only. "
                "Set INTERNAL_MODE=true to enable."
            )
        
        if not use_ollama:
            raise ValueError(
                "Ollama evaluator requires USE_OLLAMA=true environment variable"
            )
        
        try:
            from psa_engine.llm.ollama_evaluator import OllamaEvaluator
        except ImportError as e:
            raise RuntimeError(f"Failed to import OllamaEvaluator: {e}") from e

        model = evaluator_config.get("model", "llama3")
        temperature = evaluator_config.get("temperature", 0.0)
        seed = evaluator_config.get("seed")
        return OllamaEvaluator(model=model, temperature=temperature, seed=seed)

    raise ValueError(f"Unknown evaluator_type: {evaluator_type}")


def run_psa_pipeline(
    document_id: str,
    document_context: Dict[str, Any],
    evaluator_type: Literal["rule_based", "ollama"] = "rule_based",
    evaluator_config: Dict[str, Any] | None = None,
    sector_delta_code: str | None = None,
    output_path: str | Path | None = None,
) -> Path:
    """Run the full PSA pipeline and generate a DOCX report.

    Args:
        document_id: Unique document identifier
        document_context: Document-specific context (parsed text, metadata, etc.)
        evaluator_type: "rule_based" or "ollama"
        evaluator_config: Configuration dict for the evaluator:
            - For "rule_based": {"rules": {element_code: [keywords]}}
            - For "ollama": {"model": "...", "temperature": 0.0, "seed": ...}
        sector_delta_code: Optional sector delta code (metadata only)
        output_path: Path for DOCX output (defaults to {document_id}_report.docx)

    Returns:
        Path to generated DOCX file

    Raises:
        ValueError: If configuration is invalid
        RuntimeError: If engine execution or DOCX generation fails
    """
    if not isinstance(document_id, str) or not document_id.strip():
        raise ValueError("document_id must be a non-empty string")

    # Create evaluator
    evaluator = _create_evaluator(evaluator_type, evaluator_config)

    # Phase 2: Baseline coverage
    phase2_payload = psa_engine.run_phase2(
        document_id=document_id,
        document_context=document_context,
        evaluator=evaluator,
        sector_delta_code=sector_delta_code,
    )

    # Phase 3: Interpretation
    phase3_payload = psa_engine.run_phase3(phase2_payload)

    # Projection: Report-ready structure
    report_projection = project_phase3_for_report(phase3_payload)

    # Derive baseline coverage summary
    baseline_summary = derive_baseline_coverage_summary(report_projection)

    # Generate DOCX
    if output_path is None:
        output_path = Path(f"{document_id}_report.docx")
    else:
        output_path = Path(output_path)

    generate_docx_report(
        report_projection=report_projection,
        baseline_summary=baseline_summary,
        output_path=output_path,
    )

    return output_path


def main() -> None:
    """CLI entry point (thin wrapper)."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Run PSA pipeline and generate DOCX report"
    )
    parser.add_argument("document_id", help="Document identifier")
    parser.add_argument("--evaluator", choices=["rule_based", "ollama"], default="rule_based")
    parser.add_argument("--sector-delta", help="Sector delta code (optional)")
    parser.add_argument("--output", help="Output DOCX path (default: {document_id}_report.docx)")
    args = parser.parse_args()

    # Minimal document_context (CLI would need to load actual document)
    document_context = {"text": ""}  # Placeholder; real CLI would load from file/DB

    # Minimal evaluator_config (CLI would need to load rules/config)
    evaluator_config = {}  # Placeholder; real CLI would load from config file

    try:
        output_path = run_psa_pipeline(
            document_id=args.document_id,
            document_context=document_context,
            evaluator_type=args.evaluator,
            evaluator_config=evaluator_config,
            sector_delta_code=args.sector_delta,
            output_path=args.output,
        )
        print(f"DOCX report generated: {output_path}")
    except Exception as e:
        print(f"Pipeline failed: {e}", file=__import__("sys").stderr)
        raise


if __name__ == "__main__":
    main()
