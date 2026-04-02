# API Routes Audit

**Date:** 2026-01-31  
**Source:** `app/api/**/route.ts` (Next.js App Router)  
**Total routes:** 158  
**Method detection:** Inferred from exported `GET` / `POST` / `PUT` / `PATCH` / `DELETE` in each `route.ts`.

---

## Summary by area

| Area | Count | Description |
|------|-------|-------------|
| `/api/admin/*` | 78 | Admin UI: source registry, modules, module-drafts, corpus, OFCs, diagnostics, health, server-tools, triage |
| `/api/runtime/*` | 48 | Runtime: assessments, questions, OFCs, expansion, tech profiles, health, metadata, intent |
| `/api/reference/*` | 9 | Reference: disciplines, subtypes, sectors, subsectors, baseline-questions, question-focus, reference-impl |
| `/api/ofc/*` + `/api/ofcs/*` | 7 | OFC canonical, nominations, for-question, list, link |
| `/api/assessment/*` | 1 | Legacy scoring (GET) |
| `/api/baseline/*` | 1 | Baseline spines |
| `/api/review/*` | 2 | Review chunk, quarantined |
| `/api/system/*` | 1 | Security mode (GET, POST) |
| `/api/gate-metadata` | 1 | Gate metadata |
| `/api/vulnerabilities` | 1 | Vulnerabilities list (GET) |

---

## Admin (`/api/admin/*`)

### Citations
| Path | Methods |
|------|---------|
| `/api/admin/citations/integrity-audit` | GET |

### Corpus (zero-chunk, untraceable, reprocess)
| Path | Methods |
|------|---------|
| `/api/admin/corpus/process-registered` | POST |
| `/api/admin/corpus/purge-untraceable` | POST |
| `/api/admin/corpus/purge-zero-chunk` | POST |
| `/api/admin/corpus/quarantine-untraceable` | POST |
| `/api/admin/corpus/reprocess-zero-chunk` | POST |
| `/api/admin/corpus/sync-chunk-counts` | POST |
| `/api/admin/corpus/untraceable` | GET |
| `/api/admin/corpus/zero-chunk` | GET |

### Coverage
| Path | Methods |
|------|---------|
| `/api/admin/coverage/corpus` | GET |

### Diagnostics
| Path | Methods |
|------|---------|
| `/api/admin/diagnostics/candidates/source-type-counts` | GET |
| `/api/admin/diagnostics/corpus/candidate/[candidateId]` | GET |
| `/api/admin/diagnostics/db-audit` | GET |
| `/api/admin/diagnostics/ownership` | GET |
| `/api/admin/diagnostics/pool-identity` | GET |
| `/api/admin/diagnostics/runtime/nominations/by-response/[responseId]` | GET |
| `/api/admin/diagnostics/source-registry-location` | GET |

### Doctrine
| Path | Methods |
|------|---------|
| `/api/admin/doctrine/selftest` | GET |

### Documents
| Path | Methods |
|------|---------|
| `/api/admin/documents/[id]/role` | GET, PATCH |
| `/api/admin/documents/[id]/source` | GET |

### Health
| Path | Methods |
|------|---------|
| `/api/admin/health/dbs` | GET |

### Module drafts
| Path | Methods |
|------|---------|
| `/api/admin/module-drafts` | POST |
| `/api/admin/module-drafts/[draftId]` | GET, PATCH |
| `/api/admin/module-drafts/[draftId]/generate` | POST |
| `/api/admin/module-drafts/[draftId]/publish` | POST |
| `/api/admin/module-drafts/[draftId]/questions/[draftQuestionId]` | POST |
| `/api/admin/module-drafts/[draftId]/scenario-context` | POST |

### Module OFCs
| Path | Methods |
|------|---------|
| `/api/admin/module-ofcs/create` | POST |
| `/api/admin/module-ofcs/list` | GET |
| `/api/admin/module-ofcs/update/[id]` | PATCH |

### Module sources
| Path | Methods |
|------|---------|
| `/api/admin/module-sources` | GET |

### Module standards
| Path | Methods |
|------|---------|
| `/api/admin/module-standards` | GET |
| `/api/admin/module-standards/[standardKey]` | GET |

### Modules
| Path | Methods |
|------|---------|
| `/api/admin/modules` | GET, POST |
| `/api/admin/modules/[moduleCode]` | GET, DELETE |
| `/api/admin/modules/[moduleCode]/corpus-links` | GET, POST |
| `/api/admin/modules/[moduleCode]/export` | GET |
| `/api/admin/modules/[moduleCode]/instance/criteria/[criterionId]` | PATCH |
| `/api/admin/modules/[moduleCode]/instance/ofcs/[ofcId]` | PATCH |
| `/api/admin/modules/[moduleCode]/ofcs` | POST |
| `/api/admin/modules/[moduleCode]/ofcs/[moduleOfcId]/register` | POST |
| `/api/admin/modules/[moduleCode]/ofcs/registrations` | GET |
| `/api/admin/modules/[moduleCode]/process-incoming-pdfs` | POST |
| `/api/admin/modules/[moduleCode]/questions` | POST |
| `/api/admin/modules/[moduleCode]/sources` | GET |
| `/api/admin/modules/[moduleCode]/sources/[moduleSourceId]` | PATCH, DELETE |
| `/api/admin/modules/[moduleCode]/sources/[moduleSourceId]/file` | GET |
| `/api/admin/modules/[moduleCode]/sources/[moduleSourceId]/promote-to-corpus` | POST |
| `/api/admin/modules/[moduleCode]/sources/add-from-url` | POST |
| `/api/admin/modules/[moduleCode]/sources/attach-corpus` | POST |
| `/api/admin/modules/[moduleCode]/sources/report` | GET |
| `/api/admin/modules/[moduleCode]/sources/upload` | POST |
| `/api/admin/modules/[moduleCode]/standard/generate` | POST |
| `/api/admin/modules/[moduleCode]/template` | GET |
| `/api/admin/modules/[moduleCode]/vofcs` | GET |
| `/api/admin/modules/breakdown` | GET |
| `/api/admin/modules/create` | POST |
| `/api/admin/modules/import` | POST |
| `/api/admin/modules/library` | GET, DELETE |
| `/api/admin/modules/research` | POST |
| `/api/admin/modules/wizard/create` | POST |
| `/api/admin/modules/wizard/generate` | POST |
| `/api/admin/modules/wizard/publish` | POST |
| `/api/admin/modules/wizard/sources/add-existing` | POST |
| `/api/admin/modules/wizard/sources/add-url` | POST |
| `/api/admin/modules/wizard/sources/upload` | POST |

### OFC library & candidates
| Path | Methods |
|------|---------|
| `/api/admin/ofc-library` | POST |
| `/api/admin/ofcs/candidates/[candidate_id]` | GET, PATCH |
| `/api/admin/ofcs/review-queue` | GET |

### Problem candidates
| Path | Methods |
|------|---------|
| `/api/admin/problem-candidates` | GET |
| `/api/admin/problem-candidates/[id]` | PATCH |
| `/api/admin/problem-candidates/[id]/promote` | POST |

### Reports
| Path | Methods |
|------|---------|
| `/api/admin/reports/subtype-coverage` | GET |

### Server tools
| Path | Methods |
|------|---------|
| `/api/admin/server-tools/run` | POST |
| `/api/admin/server-tools/status` | GET |

### Source registry
| Path | Methods |
|------|---------|
| `/api/admin/source-registry` | GET, POST |
| `/api/admin/source-registry/[sourceKey]` | GET, PUT, PATCH, DELETE |
| `/api/admin/source-registry/[sourceKey]/ingest` | POST |
| `/api/admin/source-registry/active` | GET |
| `/api/admin/source-registry/download-to-incoming` | POST |
| `/api/admin/source-registry/extract-pdf-metadata` | POST |
| `/api/admin/source-registry/fetch-metadata` | POST |
| `/api/admin/source-registry/purge-non-pdf` | POST |
| `/api/admin/source-registry/report` | GET |
| `/api/admin/source-registry/rerun-scope-tags` | POST |
| `/api/admin/source-registry/scope-tag-options` | GET |
| `/api/admin/source-registry/upload` | POST |

### Triage
| Path | Methods |
|------|---------|
| `/api/admin/triage/run` | POST |

---

## Runtime (`/api/runtime/*`)

### Admin (runtime-scoped)
| Path | Methods |
|------|---------|
| `/api/runtime/admin/expansion-profiles` | POST |
| `/api/runtime/admin/purge-test-assessments` | POST |

### Assessments
| Path | Methods |
|------|---------|
| `/api/runtime/assessments` | GET, POST |
| `/api/runtime/assessments/[assessmentId]` | GET |
| `/api/runtime/assessments/[assessmentId]/component-capability/questions` | GET |
| `/api/runtime/assessments/[assessmentId]/component-capability/responses` | GET, POST |
| `/api/runtime/assessments/[assessmentId]/expansion-profiles` | GET, POST |
| `/api/runtime/assessments/[assessmentId]/expansion-questions` | GET |
| `/api/runtime/assessments/[assessmentId]/expansion-responses` | GET, PUT |
| `/api/runtime/assessments/[assessmentId]/followups` | GET, POST |
| `/api/runtime/assessments/[assessmentId]/intent-objects` | GET |
| `/api/runtime/assessments/[assessmentId]/modules` | GET, POST, DELETE |
| `/api/runtime/assessments/[assessmentId]/modules/[moduleCode]/attach` | POST |
| `/api/runtime/assessments/[assessmentId]/modules/[moduleCode]/questions` | GET |
| `/api/runtime/assessments/[assessmentId]/modules/[moduleCode]/questions/[moduleQuestionId]` | PUT |
| `/api/runtime/assessments/[assessmentId]/modules/reconcile` | POST |
| `/api/runtime/assessments/[assessmentId]/ofcs` | GET |
| `/api/runtime/assessments/[assessmentId]/ofcs/promote` | POST |
| `/api/runtime/assessments/[assessmentId]/question-universe` | GET |
| `/api/runtime/assessments/[assessmentId]/questions` | GET |
| `/api/runtime/assessments/[assessmentId]/reference-impl` | GET |
| `/api/runtime/assessments/[assessmentId]/required_elements` | GET |
| `/api/runtime/assessments/[assessmentId]/responses` | GET, PUT |
| `/api/runtime/assessments/[assessmentId]/responses/[responseId]/ofc-candidates` | GET |
| `/api/runtime/assessments/[assessmentId]/results` | GET |
| `/api/runtime/assessments/[assessmentId]/status` | GET, PUT |
| `/api/runtime/assessments/[assessmentId]/subsector` | PUT |
| `/api/runtime/assessments/[assessmentId]/tech-overlay-questions` | GET |
| `/api/runtime/assessments/[assessmentId]/tech-overlay-questions/responses` | PUT |
| `/api/runtime/assessments/[assessmentId]/tech-profiles` | GET, PUT, DELETE |
| `/api/runtime/assessments/[assessmentId]/technology-profiles` | GET, PUT |

### Runtime catalog / metadata
| Path | Methods |
|------|---------|
| `/api/runtime/depth2-question-tags` | GET |
| `/api/runtime/expansion-profiles` | GET |
| `/api/runtime/health` | GET |
| `/api/runtime/intent-for-question` | GET |
| `/api/runtime/intent-objects` | GET |
| `/api/runtime/metadata` | GET |
| `/api/runtime/ofc-candidates` | GET |
| `/api/runtime/ofc-library` | GET |
| `/api/runtime/ofc-library/[ofcId]/citations` | GET |
| `/api/runtime/question-coverage` | GET |
| `/api/runtime/question-meaning/[canonId]` | GET |
| `/api/runtime/questions` | GET |
| `/api/runtime/subtype-checklists` | GET |
| `/api/runtime/technology-types-catalog` | GET |
| `/api/runtime/test-assessments` | POST |

---

## Reference (`/api/reference/*`)

| Path | Methods |
|------|---------|
| `/api/reference/baseline-questions` | GET |
| `/api/reference/discipline-subtypes` | GET |
| `/api/reference/discipline-subtypes/[subtypeId]/reference-impl` | GET |
| `/api/reference/disciplines` | GET |
| `/api/reference/question-focus` | GET |
| `/api/reference/question-focus/[discipline]/[subtype]` | GET |
| `/api/reference/reference-impl` | GET |
| `/api/reference/sectors` | GET |
| `/api/reference/subsectors` | GET |

---

## OFC (`/api/ofc/*`, `/api/ofcs/*`)

| Path | Methods |
|------|---------|
| `/api/ofc/canonical` | GET |
| `/api/ofc/canonical/[canonical_ofc_id]` | GET |
| `/api/ofc/nominations` | GET, POST |
| `/api/ofc/nominations/[nomination_id]/decide` | POST |
| `/api/ofc/nominations/[nomination_id]/status` | POST |
| `/api/ofcs/for-question` | GET |
| `/api/ofcs/link` | POST |
| `/api/ofcs/list` | GET |

---

## Other

| Path | Methods |
|------|---------|
| `/api/assessment/scoring` | GET |
| `/api/baseline/spines` | GET |
| `/api/gate-metadata` | GET |
| `/api/review/[chunk_id]` | POST |
| `/api/review/quarantined` | GET |
| `/api/system/security-mode` | GET, POST |
| `/api/vulnerabilities` | GET |

---

## How to regenerate

From `psa_rebuild/`:

```bash
node scripts/audit_api_routes.js > .lint/api_routes_audit.json
```

Methods are inferred by grepping each `route.ts` for `export (async )?function (GET|POST|PUT|PATCH|DELETE)`.
