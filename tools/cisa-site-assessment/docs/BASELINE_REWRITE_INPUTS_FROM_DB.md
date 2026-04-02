# Baseline question rewrite: inputs from DB

Rewrites use **intent only** from the runtime DB. No source excerpts. No follow-up questions.

## Intent authority order (first non-empty wins)

1. **question_meaning.meaning_text** (when present for that `canon_id`)
2. **discipline_subtype_reference_impl.reference_impl.section1.baseline_existence_question.clarification** (YES / NO / N_A text combined)
3. **discipline_subtype_reference_impl.reference_impl.section2.what_right_looks_like** (array joined as text; or `section_2_right_looks_like_authoritative` in doctrine JSON)
4. **Fallback**: current `baseline_spines_runtime.question_text` (light normalization only)

## Source tables (RUNTIME)

| Input | DB source |
|-------|-----------|
| **question_code** | `baseline_spines_runtime.canon_id` |
| **current_question_text** | `baseline_spines_runtime.question_text` (active only) |
| **discipline** | `baseline_spines_runtime.discipline_code` |
| **subtype** | `baseline_spines_runtime.subtype_code` |
| **intent_text** | From authority order above only. No source excerpts. |

## Rewrite script (recommended)

```bash
npx tsx tools/rewrite_baseline_questions.ts
```

- **Default**: dry-run; writes `tools/outputs/baseline_rewrite_report.jsonl` and `tools/outputs/baseline_rewrite_patch.sql`.
- **Options**: `--out-report <path>`, `--out-sql <path>`, `--limit <n>`, `--apply` (run updates against runtime DB).

No schema changes. No follow-up questions. Intent is never inferred beyond what exists in DB.

## Export only (no rewrite)

To export baseline rows with intent fields for external use:

```bash
npx tsx tools/export_baseline_for_rewrite.ts
```

Uses the same intent authority order. Output: `tools/outputs/baseline_for_rewrite.json`.

## Reference implementation shape

- One row in `discipline_subtype_reference_impl` per `discipline_subtype_id`. Questions with that subtype share the same reference_impl.
- **section1**: `baseline_existence_question` with `clarification` (YES / NO / N_A; keys may be `yes_means` / `no_means` / `na_applies_only_if` in doctrine).
- **section2**: `what_right_looks_like` (array) or `section_2_right_looks_like_authoritative`.
