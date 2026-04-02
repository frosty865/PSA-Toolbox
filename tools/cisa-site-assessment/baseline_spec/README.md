# Baseline Specification

This directory contains the **frozen, authoritative inputs** that define the PSA baseline assessment structure.

## Baseline Definition

The baseline assessment is defined as:

- **Question structure**: Primary questions with YES/NO/N_A response options
- **Components**: Scored checklists (standards/maturity indicators) associated with each question
- **NO-side OFC selectors**: Links to Options for Consideration (OFCs) when answer is NO
- **Gating rules**: Conditional logic that shows/hides subordinate questions based on parent answers

### Key Principles

1. **Components ARE the scored maturity/standards** (not "evidence only")
   - When answer = YES: Components checked = standards met
   - When answer = NO: Components total = standards lost
   - When answer = YES with unchecked components: Enhancement opportunities

2. **Baseline must stay "all facilities" (sector-agnostic language)**
   - No sector-specific terminology
   - No subsector-specific language
   - Technology-neutral where possible

3. **OFC text is NOT generated**
   - OFCs are discovered from corpus sources (VOFC_LIBRARY.xlsx, approved PDFs)
   - OFCs are always traceable (document + locator + excerpt)
   - Exception: Explicit baseline library may be curated later

4. **Sector/subsector/technology content is additive overlays**
   - Expansion questions are separate from baseline
   - Overlays must not modify baseline questions
   - Baseline questions remain unchanged regardless of overlay selection

## Files in This Directory

### `ALT_SAFE_Assessment.html`
- **Purpose**: Authoritative HTML structure for baseline assessment
- **Usage**: Source of truth for question structure, components, gating rules
- **Status**: FROZEN - Do not edit

### `SAFE3.0_Question_Logic_README.md`
- **Purpose**: Behavioral specification for question logic and scoring
- **Usage**: Reference for scoring rules, gating behavior, component counting
- **Status**: FROZEN - Do not edit

### `VSS_Section_Complete.json`
- **Purpose**: Example discipline implementation (Video Surveillance Systems)
- **Usage**: Reference for gating + scoring implementation patterns
- **Status**: FROZEN - Do not edit

### `SAFE_V2.2.html`
- **Purpose**: Reference only (historical)
- **Usage**: Not used unless explicitly promoted later
- **Status**: FROZEN - Reference only

## Extraction and Processing

The baseline specification files are processed by:

- `tools/extract_baseline_from_alt_safe_html.py` - Extracts baseline question graph from HTML
- `tools/verify_baseline_graph.py` - Validates extracted baseline structure

## Version Control

- All files in this directory are version-controlled
- Changes to baseline spec require explicit approval
- Baseline hash is locked in runtime to prevent drift

## Related Documentation

- Baseline question graph schema: `baseline/baseline_questions.v1.json`
- Extraction tool: `tools/extract_baseline_from_alt_safe_html.py`
- Verification tool: `tools/verify_baseline_graph.py`
- Drift gate: `tools/quality/drift_gate.py`


