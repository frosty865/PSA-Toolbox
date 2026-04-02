# Deprecated Routes Still Active

**Audit date:** 2026-01-31

---

## Deprecated but still serving real traffic

| Route | Methods | Status | Callers | Replacement |
|-------|---------|--------|---------|-------------|
| `/api/assessment/scoring` | GET | **Active** – returns real scoring | `app/assessments/[assessmentId]/results/page.tsx` calls `GET /api/assessment/scoring?documentId=${assessmentId}` | `/api/runtime/assessments/[assessmentId]/results` – but that route currently returns a **placeholder** for baseline (no scoring logic); it only fills expansion data. To fully migrate: either move scoring logic into the runtime results route or have it call the scoring module internally. |

**Details:** The route is marked DEPRECATED in comments (use `/api/runtime/assessments/[assessmentId]/results`). The runtime results endpoint exists but does not yet implement baseline scoring; it defers to this legacy route in comments. The assessment results UI still depends on this endpoint for scoring data.

---

## Deprecated / disabled (410 Gone or no-op)

These routes are still present but do not perform the old behavior:

| Route | Methods | Behavior |
|-------|---------|----------|
| `/api/admin/source-registry/upload` | POST | **410 Gone.** Returns JSON explaining legacy upload is disabled; use deterministic router + intake wizard. |
| `/api/admin/modules/[moduleCode]/sources/[moduleSourceId]/promote-to-corpus` | POST | **410 Gone.** Returns "Disabled: module uploads cannot be promoted to CORPUS". Hard segregation: CORPUS is read-only from modules. |
| `/api/admin/module-drafts/[draftId]/scenario-context` | POST | **No-op.** Returns `{ success: true, scenario_context_ready: false, deprecated: true }`. Scenario context is no longer used (template-first doctrine). |

---

## Not present (already removed or never in app)

- `/api/required-elements` – Referenced in API_TRIAGE_v2 as DEPRECATE (BASE-0xx). No `app/api/**/required-elements/route.ts` in codebase; not active.

---

## Recommendation

1. **`/api/assessment/scoring`** – Either:
   - **Option A:** Implement baseline scoring inside `GET /api/runtime/assessments/[assessmentId]/results` (or a shared scoring module called by it), then switch `app/assessments/[assessmentId]/results/page.tsx` to use that endpoint and deprecate/remove the legacy route.
   - **Option B:** Leave as-is until runtime results is fully implemented; keep the deprecation comment and document the dependency in this file.

2. **410 / no-op routes** – Safe to leave in place as stubs so old clients get a clear 410 or no-op response. Optionally remove the route files and rely on 404 if you prefer to drop them entirely.
