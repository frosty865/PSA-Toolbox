# Performance Test Plan

This document describes how performance is measured for the export pipeline and reporter. **Performance gates are observational until baselines are agreed.**

## Test profiles

| Profile   | Description |
|----------|-------------|
| **small**  | One category (ELECTRIC_POWER), minimal VOFC. Fastest run. |
| **typical**| Full 6 categories, 2 critical products. Matches export smoke fixture. |
| **stress** | All categories with service/backup, 5 critical products. Heavier VOFC and charts. |

## Run counts

- **perfExport.ts**: `--runs N` (default 3). Each run is a full export (engine + reporter + verifier).
- **perf_reporter.py**: Optional argument `N` (default 5). Reporter-only, no Node.

## Metrics collected

### Full export (perfExport.ts)

- **engine_ms** — Time for VOFC generation, summary build, assert, template validation.
- **reporter_ms** — Time for Python reporter (stdin → output.docx).
- **verifier_ms** — Time for verify_output.py on the DOCX.
- **total_ms** — Wall-clock for the full run.
- **output_docx_bytes** — Size of the generated DOCX.

Results written to: `data/exports/_perf/<timestamp>/metrics.json`.

### Reporter-only (perf_reporter.py)

- **times_ms** — Wall-clock time per run (ms).
- **average_ms** — Average of the runs.
- **max_rss_kb** — Max resident set size (if available; skipped on Windows).

Results written to: `data/exports/_perf/<timestamp>/reporter_metrics.json`.

## Initial target expectations (not enforced yet)

- **typical** full export: total_ms under 15 s on a normal dev machine.
- **reporter** average: under 5 s per run for the fixed fixture.
- DOCX size for typical: on the order of 1–2 MB (template + charts + tables).

These are for discussion and baseline-setting only. No CI gate or failure is applied until the team agrees on baselines.

## How to run

From repo root:

- Full export: `pnpm --filter web run perf:export -- --profile typical --runs 3`
- Reporter-only: `python apps/reporter/perf_reporter.py 5`

Outputs and metrics are kept under `data/exports/_perf/<timestamp>/`.
