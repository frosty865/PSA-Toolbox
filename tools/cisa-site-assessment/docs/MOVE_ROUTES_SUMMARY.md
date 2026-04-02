# MOVE Routes Reintroduction Summary

**Date:** 2025-12-21  
**Status:** DOCUMENTATION COMPLETE - IMPLEMENTATION PENDING IN PSA-BACKEND

---

## Task Completion

### ✅ Completed in psa-web

1. **MOVE Routes Removed:** All 15 MOVE routes have been removed from psa-web
   - No route handlers exist in `app/api/**` for MOVE routes
   - No client calls found to removed routes (grep searches confirm)

2. **Documentation Created:**
   - `docs/MOVE_ROUTES_IMPLEMENTATION_PLAN.md` - Complete implementation plan
   - `docs/BACKEND_REFERENCE_PROVIDER_SPEC.md` - Reference provider module specification
   - `docs/BACKEND_ROUTES_IMPLEMENTATION.md` - Route implementation templates
   - `docs/STATUS.md` - Updated with MOVE routes section

3. **Verification:**
   - ✅ No filesystem reads in psa-web for MOVE routes
   - ✅ No route handlers for MOVE routes in psa-web
   - ✅ Documentation complete

---

## Pending Implementation in psa-backend

### Required Work

1. **Create Reference Provider Module**
   - Location: `psa-backend/src/reference_provider/`
   - See: `docs/BACKEND_REFERENCE_PROVIDER_SPEC.md`
   - Functions needed: taxonomy, candidates, analytics, library, coverage

2. **Implement 15 Backend Routes**
   - Location: `psa-backend/src/routes/` (or equivalent)
   - See: `docs/BACKEND_ROUTES_IMPLEMENTATION.md`
   - Routes:
     - 12 admin routes (filesystem access)
     - 3 review statement routes (database access)

3. **Update psa-web Client Calls** (when backend ready)
   - Update any frontend components that need MOVE route data
   - Use `BACKEND_BASE_URL` environment variable
   - No Next.js route proxies

---

## MOVE Routes List

### Admin Routes (12)

1. `GET /api/admin/coverage`
2. `GET /api/admin/candidates`
3. `GET /api/admin/candidates/[discipline]/[subtype]`
4. `GET /api/admin/analytics/coverage-dashboard`
5. `GET /api/admin/analytics/gap-analysis`
6. `GET /api/admin/analytics/gap-reports`
7. `GET /api/admin/analytics/gap-candidates`
8. `GET /api/admin/analytics/canonical-content`
9. `GET /api/admin/library-ingestion-status`
10. `GET /api/admin/ofc-evidence`
11. `GET /api/admin/taxonomy/disciplines`
12. `GET /api/admin/taxonomy/subtypes`

### Review Statements Routes (3)

13. `GET /api/review/statements`
14. `GET /api/review/statements/[id]` (also PATCH, DELETE)
15. `POST /api/review/statements/bulk`

---

## Key Constraints

### Locked Rules

1. ✅ **psa-web MUST NOT read filesystem** for doctrine/artifacts
2. ✅ **psa-web MUST NOT host MOVE routes** under `app/api/**`
3. ⏳ **psa-backend serves MOVE routes** via HTTP APIs (PENDING)
4. ⏳ **Admin endpoints are READ-ONLY** (no validators, no triggers) (PENDING)
5. ✅ **No required-elements / BASE-0xx concepts** anywhere
6. ⏳ **No placeholders** - implement actual functionality (PENDING)

---

## Implementation Checklist

### psa-backend Tasks

- [ ] Create `src/reference_provider/` module structure
- [ ] Implement `config.py` with path allowlist
- [ ] Implement `taxonomy.py` (disciplines, subtypes)
- [ ] Implement `candidates.py` (list, get package)
- [ ] Implement `analytics.py` (coverage, gap analysis, reports, candidates, canonical)
- [ ] Implement `library.py` (ingestion status, coverage, OFC evidence)
- [ ] Implement 12 admin routes using reference_provider
- [ ] Implement 3 review statement routes (database access)
- [ ] Register blueprints in main app
- [ ] Test all routes return proper JSON
- [ ] Verify no raw filesystem listings exposed
- [ ] Verify summary-level responses only

### psa-web Tasks (when backend ready)

- [ ] Identify frontend components that need MOVE route data
- [ ] Update client calls to use `BACKEND_BASE_URL`
- [ ] Remove any remaining references to local routes
- [ ] Test client calls to backend
- [ ] Verify no filesystem access in psa-web

---

## Next Steps

1. **Implement in psa-backend:**
   - Follow `docs/BACKEND_REFERENCE_PROVIDER_SPEC.md` for module structure
   - Follow `docs/BACKEND_ROUTES_IMPLEMENTATION.md` for route templates
   - Adjust paths based on actual psa-backend workspace structure

2. **Update psa-web client calls:**
   - When backend routes are ready, update frontend components
   - Use environment variable: `NEXT_PUBLIC_BACKEND_BASE_URL`
   - No Next.js route proxies

3. **Verify:**
   - All 15 routes accessible from psa-backend
   - psa-web can call backend routes successfully
   - No filesystem access in psa-web
   - Summary-level responses only (no raw artifacts)

---

## Documentation References

- **Implementation Plan:** `docs/MOVE_ROUTES_IMPLEMENTATION_PLAN.md`
- **Reference Provider Spec:** `docs/BACKEND_REFERENCE_PROVIDER_SPEC.md`
- **Route Implementation:** `docs/BACKEND_ROUTES_IMPLEMENTATION.md`
- **Triage Document:** `docs/API_TRIAGE_v2.md`
- **Status Update:** `docs/STATUS.md`

---

**END OF SUMMARY**

