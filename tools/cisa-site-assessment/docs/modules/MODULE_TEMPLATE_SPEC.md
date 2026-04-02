# Module Template Spec (Authoritative)

## Purpose
A Module Template defines the authoritative structure of a module:
- Scope and intent (what it covers)
- Allowed question families (existence-only)
- Allowed discipline/subtype anchors (optional)
- Evidence expectations (what we look for in ingested docs)
- Allowed OFC template bank (WHAT capabilities should exist)

Modules are compiled from templates + evidence. Templates come first.

## Template JSON (conceptual)
- module_code: stable identifier (e.g., MODULE_EV_PARKING)
- title: human title
- summary: one-paragraph plain language
- scope:
  - hazards: list (e.g., "EV parking fire")
  - areas: list (e.g., "parking garage", "surface lot")
  - exclusions: list
- question_families: array of families; each family defines:
  - family_code (stable)
  - title
  - intent (plain language)
  - question_prompts (1..N canonical prompts)
  - anchors (optional discipline_subtype_code allowlist)
  - evidence_signals (keywords/phrases we expect to find in documents)
- ofc_template_bank: array of OFC templates (capability-level)
- generation_rules:
  - min_questions_per_family
  - min_ofc_candidates_per_family
  - evidence_thresholds (e.g., must cite at least 1 locator)
