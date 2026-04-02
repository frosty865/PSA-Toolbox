# Subtype Reference Implementations (Doctrine)

Purpose: Provide subtype-bound, assessor-safe interpretation of baseline intent as:
- a single existence question (YES/NO/N_A),
- a short "what right looks like" definition (recognition-based, not evaluative),
- descriptive branching questions (YES-only) for context capture,
- non-user-facing notes for OFC narrowing after capture.

Hard rules:
- Subtype-specific only. No system-wide abstractions.
- Baseline intent is existence-based only (no adequacy, reliability, lifecycle, or maintenance language).
- Branching questions may describe context but may never invalidate a YES answer.
- No assessor enforcement language.
- OFCs are attached only after NO or via descriptive context (never via intent).

Location:
- model/doctrine/reference_impls/
- Registry: model/doctrine/reference_impls/index.json
- Loader: model/doctrine/reference_impls.py

Current reference implementations:
- Key Control — Rekeying Procedures
- Access Control Systems — Visitor Management Systems
