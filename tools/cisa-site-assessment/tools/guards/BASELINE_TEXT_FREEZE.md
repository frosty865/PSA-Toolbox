# Baseline Text Freeze Guard

## Purpose

Ensures baseline question text remains stable unless explicitly overridden. This guard is about **stability**, not correctness.

## How It Works

1. **Snapshot Creation**: Creates a hash snapshot of `canon_id -> question_text` for:
   - Depth-1: Active questions from `baseline_spines_runtime_rows.json`
   - Depth-2: Questions from `baseline_depth2_questions.json`

2. **Comparison**: On subsequent runs, compares current snapshot to saved snapshot:
   - **Changes**: If any `canon_id` exists in both snapshots and `question_text` differs:
     - With `BASELINE_TEXT_OVERRIDE=true`: WARN only
     - Without override: FAIL (exit 1) and print diffs
   - **New Questions**: Acceptable (no error)
   - **Removed Questions**: Warning only

3. **Validation**: Also fails if:
   - Any `question_text` is empty
   - Duplicate `canon_id` found

## Usage

### Initial Setup (One-Time)

Create initial snapshots:

```bash
npm run snapshot:baseline-text
```

### Normal CI Usage

```bash
npm run guard:baseline-text
```

### Manual Override

When you intentionally change wording:

```bash
BASELINE_TEXT_OVERRIDE=true npm run guard:baseline-text
```

## Files

- **Inputs**:
  - `baseline_spines_runtime_rows.json` (Depth-1)
  - `tools/outputs/baseline_depth2_questions.json` (Depth-2)

- **Outputs**:
  - `tools/outputs/baseline_text_snapshot.depth1.json`
  - `tools/outputs/baseline_text_snapshot.depth2.json`

## Notes

- New `canon_id`s are acceptable; only changes to existing texts are blocked
- This guard ensures stability for production assessments
- Override should only be used when intentional changes are made
