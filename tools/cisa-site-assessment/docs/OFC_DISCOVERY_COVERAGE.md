# OFC Discovery and Coverage Model

## Overview

The OFC Discovery system extends ingestion to discover OFC candidates from documents and map them to ALL current questions (BASE + EXPANSION). This enables comprehensive coverage analysis and ensures no questions are left without candidate support.

## Core Principles

### 1. Universal Matching (Always Runs)

- **All questions included**: Matches candidates against all BASE primary questions (36) and all EXPANSION questions
- **No exclusions**: Every question is eligible for candidate matching
- **Top K per type**: Keeps top 3 matches per target_type (BASE_PRIMARY, EXPANSION_QUESTION)

### 2. Context Matching (When Sector/Subsector Known)

- **Sector/subsector preference**: When document has sector/subsector context, performs second pass
- **Boost scoring**: Expansion questions matching sector/subsector get score boost
- **Separate tracking**: Context matches stored separately from universal matches

### 3. Selection-Only (No Auto-Promotion)

- **Candidates remain candidates**: Matching creates links, does not promote to library
- **Review required**: Human reviewer must select final target and promote
- **Citations required**: Promotion still requires ≥1 citation

## Data Model

### Tables

1. **`ofc_candidate_queue`**
   - Stores candidate snippets extracted from documents
   - Fields: `candidate_id`, `source_id`, `snippet_text`, `page_locator`, `sector`, `subsector`, `status`
   - Optional: `best_universal_target`, `best_context_target` (for quick display)

2. **`ofc_candidate_targets`**
   - Links candidates to question targets
   - Fields: `candidate_id`, `target_type`, `target_key`, `match_mode`, `match_score`
   - Unique: `(candidate_id, target_type, target_key, match_mode)`
   - One candidate can map to multiple questions

### Views

1. **`v_candidate_targets_with_details`**
   - Candidate targets with full question and source details
   - Used for review UI

2. **`v_question_coverage`**
   - Coverage summary per question
   - Counts: universal candidates, context candidates, promoted OFCs
   - Scores: best universal, best context

## Question Matcher Index

### Index Structure

**File**: `analytics/runtime/question_matcher_index.json`

```json
{
  "metadata": {
    "version": "1.0",
    "base_question_count": 36,
    "expansion_question_count": N,
    "total_questions": 36 + N
  },
  "base_questions": [
    {
      "target_key": "Awareness",
      "question_text": "...",
      "section_title": "...",
      "keywords": ["awareness", "campaign", "training", ...]
    }
  ],
  "expansion_questions": [
    {
      "target_key": "question_id",
      "question_text": "...",
      "subtype_code": "...",
      "profile_id": "...",
      "sector": "...",
      "subsector": "...",
      "keywords": ["keyword1", "keyword2", ...]
    }
  ]
}
```

### Building the Index

```bash
python tools/build_question_matcher_index.py
```

**Process**:
1. Loads BASE questions from `alt_safe_model_extracted.json`
2. Loads EXPANSION questions from database (`expansion_questions` table)
3. Loads synonyms from `question_synonyms.json`
4. Extracts keywords from question text (normalized, stop words removed)
5. Adds synonyms to keyword sets
6. Outputs index JSON

### Synonyms

**File**: `analytics/runtime/question_synonyms.json`

- Hand-curated synonyms for question matching
- Small and focused (no invented taxonomy)
- Structure: `target_key -> [synonyms...]`

## Matching Algorithm

### Universal Matching

1. **Extract keywords** from candidate snippet
2. **Calculate Jaccard similarity** with each question's keywords
3. **Apply phrase boost** if significant overlap (≥3 keywords)
4. **Filter by threshold** (score > 0.1)
5. **Sort by score** and take top K=3 per target_type

### Context Matching

1. **Same as universal** but with:
   - Slightly lower threshold (0.08) for BASE questions
   - Score boost for EXPANSION questions:
     - +30% if sector matches
     - +50% if subsector matches
2. **Only runs** if document has sector/subsector

### Match Score Calculation

```python
# Jaccard similarity
intersection = snippet_keywords & question_keywords
union = snippet_keywords | question_keywords
jaccard = len(intersection) / len(union)

# Phrase boost (if ≥3 keywords overlap)
if len(intersection) >= 3:
    jaccard *= 1.2

# Context boost (for expansion questions)
if sector_match:
    score *= 1.3
if subsector_match:
    score *= 1.5
```

## Workflow

### 1. Build Question Index

```bash
python tools/build_question_matcher_index.py
```

**Output**: `analytics/runtime/question_matcher_index.json`

### 2. Extract Candidates (Ingestion)

- Extract recommendation snippets from documents
- Store in `ofc_candidate_queue` with:
  - `source_id` (from `canonical_sources`)
  - `snippet_text`
  - `page_locator`
  - `sector`/`subsector` (if known from document classification)

### 3. Match Candidates to Questions

```bash
python tools/match_candidates_to_questions.py [candidate_id1] [candidate_id2] ...
```

**Process**:
1. Loads question matcher index
2. For each candidate:
   - Performs UNIVERSAL matching (all questions)
   - Performs CONTEXT matching (if sector/subsector known)
   - Stores matches in `ofc_candidate_targets`
   - Updates `best_universal_target` and `best_context_target`

### 4. Review Candidates

- Admin UI: `/admin/ofc-candidates`
- Shows candidates with their question matches
- Reviewer can:
  - View all matches (universal + context)
  - Select final target
  - Promote to OFC library (with citations)

### 5. Coverage Analysis

- Admin UI: `/admin/question-coverage`
- Shows coverage per question:
  - Candidate counts (universal + context)
  - Promoted OFC counts
  - Highlights gaps (zero coverage)

## API Endpoints

### Candidates

- `GET /api/runtime/ofc-candidates` - List candidates with matches
  - Query params: `status`, `target_type`, `target_key`, `match_mode`

### Coverage

- `GET /api/runtime/question-coverage` - Get coverage summary
  - Query params: `target_type` (optional filter)

## Admin UI

### 1. OFC Candidates Page (`/admin/ofc-candidates`)

**Features**:
- List candidates with status filter
- Show universal and context matches per candidate
- Filter by target_type, target_key, match_mode
- Review modal with full details

### 2. Question Coverage Page (`/admin/question-coverage`)

**Features**:
- Summary stats (BASE count, EXPANSION count, zero coverage count)
- Coverage table per question:
  - Universal candidate count
  - Context candidate count
  - Best scores
  - Promoted OFC count
  - Status badge (Covered / NO COVERAGE)
- Highlights questions with zero coverage

## Guardrails

### 1. No Auto-Promotion

- Matching creates links only
- Promotion requires human review
- Citations required for promotion

### 2. Universal Matching Always Runs

- Never skip universal matching
- Context matching is additive, not replacement

### 3. Question Index Must Include All

- BASE: All 36 primary questions from ALT_SAFE
- EXPANSION: All active expansion questions from database
- Index rebuild required when questions change

## Acceptance Criteria

1. ✅ Index includes ALL current questions (BASE + EXPANSION)
2. ✅ Universal matching runs for all candidates
3. ✅ Context matching runs when sector/subsector known
4. ✅ Admin can filter by question and see supporting candidates
5. ✅ Coverage view shows which questions have zero coverage

## Related Documentation

- `docs/OFC_LIBRARY_EVIDENCE_MODEL.md` - OFC library and promotion
- `analytics/runtime/alt_safe_model_extracted.json` - BASE question keys
- `migrations/20260113_add_sector_expansion_infrastructure.sql` - EXPANSION questions

