# API Endpoint Audit Report

**Date:** 2026-01-16  
**Status:** ✅ **COMPLETE**

---

## Summary

Audited all API endpoints in the codebase and removed unused endpoints to reduce maintenance burden and improve code clarity.

---

## Removed Endpoints

### 1. `/api/admin/pipeline-logs`
- **File:** `app/api/admin/pipeline-logs/route.ts`
- **Reason:** Removed from admin page UI. Pipeline log viewing functionality was removed from the admin dashboard.
- **Status:** ✅ **REMOVED**

### 2. `/api/debug/schema`
- **File:** `app/api/debug/schema/route.ts`
- **Reason:** Debug-only endpoint not used in production code. Provides database schema information for debugging purposes.
- **Status:** ✅ **REMOVED**

### 3. `/api/ofc/applied`
- **File:** `app/api/ofc/applied/route.ts`
- **Reason:** Not referenced anywhere in the application codebase. Endpoint for applying canonical OFCs to assessments appears to be unused.
- **Status:** ✅ **REMOVED**

---

## Retained Endpoints

### Active Endpoints (Used in Application)

**Assessment Management:**
- `/api/runtime/assessments` - List/create assessments
- `/api/runtime/assessments/[assessmentId]` - Get/update assessment
- `/api/runtime/assessments/[assessmentId]/ofcs` - Get OFCs for assessment
- `/api/runtime/assessments/[assessmentId]/results` - Get assessment results
- `/api/assessment/scoring` - Calculate assessment scores

**Questions & Content:**
- `/api/runtime/questions` - List questions (BASE and EXPANSION)
- `/api/reference/baseline-questions` - Baseline questions reference
- `/api/reference/question-focus` - Question focus pages

**OFC Management:**
- `/api/runtime/ofc-library` - OFC library browsing
- `/api/runtime/ofc-library/[ofcId]/citations` - OFC citations
- `/api/ofc/canonical` - List canonical OFCs
- `/api/ofc/canonical/[canonical_ofc_id]` - Get canonical OFC details
- `/api/ofc/nominations` - Submit/list OFC nominations
- `/api/ofc/nominations/[nomination_id]/status` - Update nomination status
- `/api/ofc/nominations/[nomination_id]/decide` - Make nomination decision
- `/api/admin/ofcs/review-queue` - Admin OFC review queue

**Taxonomy:**
- `/api/reference/sectors` - List sectors
- `/api/reference/subsectors` - List subsectors
- `/api/reference/disciplines` - List disciplines
- `/api/reference/discipline-subtypes` - List discipline subtypes

**Review & Governance:**
- `/api/review/quarantined` - List quarantined chunks
- `/api/review/[chunk_id]` - Submit review decision for chunk

**Admin:**
- ~~`/api/admin/status`~~ - **ARCHIVED** (Flask proxy; use `GET /api/runtime/assessments` for status)
- `/api/admin/ofcs/review-queue` - OFC review queue
- `/api/admin/health/dbs` - Database health check (used in docs/testing)

**System:**
- `/api/system/security-mode` - Security mode management
- `/api/gate-metadata` - Gate metadata for baseline questions

**Other:**
- `/api/vulnerabilities` - List vulnerabilities (used in OFC page)
- `/api/runtime/metadata` - Runtime metadata
- `/api/runtime/expansion-profiles` - Expansion profiles
- `/api/runtime/ofc-candidates` - OFC candidates
- `/api/runtime/question-coverage` - Question coverage stats
- `/api/runtime/technology-types-catalog` - Technology types catalog
- `/api/runtime/admin/purge-test-assessments` - Purge test assessments
- `/api/runtime/admin/expansion-profiles` - Admin expansion profiles management

---

## Impact

### Removed Features
- ❌ Pipeline log viewing via admin UI (removed from admin page)
- ❌ Debug schema endpoint (debug-only, not needed in production)
- ❌ OFC application endpoint (unused functionality)

### Preserved Features
- ✅ All assessment management functionality
- ✅ All OFC management and review functionality
- ✅ All taxonomy and reference endpoints
- ✅ Review and governance endpoints
- ✅ Admin endpoints (except pipeline logs)

---

## Verification

### Endpoints Removed
- ✅ `/api/admin/pipeline-logs` - File deleted
- ✅ `/api/debug/schema` - File deleted
- ✅ `/api/ofc/applied` - File deleted

### No Broken References
- ✅ No imports of removed endpoints found
- ✅ No fetch calls to removed endpoints found
- ✅ All active endpoints verified as used

---

## Recommendations

1. **Monitor Usage:** Continue to monitor endpoint usage to identify future cleanup opportunities
2. **Documentation:** Keep API documentation updated as endpoints are added/removed
3. **Testing:** Ensure all remaining endpoints have proper error handling and validation

---

**END OF AUDIT**
