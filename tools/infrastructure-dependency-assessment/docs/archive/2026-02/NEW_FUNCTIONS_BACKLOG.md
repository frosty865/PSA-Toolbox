# New Functions Backlog

Ticketed backlog for future function additions to the Asset Dependency Assessment Tool. Each entry should link to a tracked issue (Jira, GitHub, or linear equivalent) and include a short description with acceptance criteria.

---

## Function backlog

### VOFC Enhancements

- `VOFC-112` — Extend VOFC export schema to include `interdependencies` array for downstream impact analysis.
- `VOFC-118` — Add auto-generated summary sheet in Excel export with high-level statistics (count of assessed services, risk categories).

### Structured Exposure

- `EXP-201` — Introduce conditional fields for transportation services to capture weather-related disruptions.
- `EXP-209` — Add dependency template for multi-region utilities.

### Assessment UI

- `UI-305` — Provide quick filter UI for `InfrastructureRole` values in the web assessment dashboard.
- `UI-312` — Add inline help overlays for backup/contingency questions.

### Reporting

- `REP-410` — Generate machine-readable JSON report for QA/QC checks.
- `REP-421` — Localize report output to Spanish.

### Engine

- `ENG-515` — Support batched assessment imports from zipped archives.
- `ENG-522` — Add CLI flag to validate curve data against schema before import.

## Notes

- Keep backlog items synced with the canonical issue tracker.
- Remove completed items once merged and deployed.
- Archive deprecated ideas into `docs/archive` if they are no longer relevant.
