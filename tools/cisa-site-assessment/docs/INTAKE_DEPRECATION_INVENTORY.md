# Intake Deprecation Inventory

**Date:** 2026-01-24  
**Purpose:** List all legacy intake implementations to be deprecated and archived

---

## Legacy Intake Systems

### 1. API Upload Route (Direct Ingestion)
- **Path:** `psa_rebuild/app/api/admin/source-registry/upload/route.ts`
- **Status:** ⚠️ TO BE DEPRECATED
- **Purpose:** Directly ingests PDFs uploaded via web UI
- **Issue:** Bypasses deterministic routing, auto-ingests without human confirmation
- **Replacement:** New router + intake wizard workflow

### 2. Ingestion Library Functions
- **Path:** `psa_rebuild/app/lib/sourceRegistry/ingestion.ts`
- **Status:** ⚠️ TO BE DEPRECATED (functions: `ingestDocumentFromFile`, `ingestDocumentFromUrl`)
- **Purpose:** Direct ingestion functions called by upload route
- **Issue:** Auto-ingests without routing/metadata confirmation
- **Replacement:** New router service + intake wizard

### 3. Direct Ingestion Script
- **Path:** `psa_rebuild/tools/corpus_ingest_pdf.py`
- **Status:** ⚠️ TO BE DEPRECATED (as standalone intake entry point)
- **Purpose:** CLI script for direct PDF ingestion
- **Issue:** Can be called directly, bypassing routing
- **Note:** May still be used by ingestion pipeline AFTER routing, but should not be entry point
- **Replacement:** Router routes to sources/, ingestion pipeline consumes from there

---

## Watchers (NOT Intake - Keep)

The following watchers are for Phase 2.5 processing and library organization, NOT intake:
- `analytics/watcher/pipeline_watcher.py` - Coordinates Phase 2.5 processing (keep)
- Watcher scripts in `analytics/watcher/scripts/` - Service management (keep)

These do NOT directly ingest documents on file drop - they coordinate pipeline processing.

---

## Archive Plan

1. Create archive directory: `D:\psa-workspace\archive\intake_deprecated_20260124\`
2. Move deprecated files maintaining structure:
   - `psa_rebuild/app/api/admin/source-registry/upload/route.ts` → `archive/intake_deprecated_20260124/app/api/admin/source-registry/upload/route.ts`
   - `psa_rebuild/app/lib/sourceRegistry/ingestion.ts` → `archive/intake_deprecated_20260124/app/lib/sourceRegistry/ingestion.ts`
   - `psa_rebuild/tools/corpus_ingest_pdf.py` → `archive/intake_deprecated_20260124/tools/corpus_ingest_pdf.py`
3. Update references:
   - Remove/disable upload route
   - Update any scripts/docs that reference old intake paths
4. Add guard script to prevent reintroduction

---

## New System Architecture

### Router Service
- **Path:** `services/router/`
- **Purpose:** Deterministic routing based on sidecar JSON metadata
- **Behavior:** Never guesses, never calls Ollama, only routes using confirmed metadata

### Intake Wizard
- **Path:** `tools/intake/intake_wizard.py`
- **Purpose:** Human-confirmed metadata entry with optional Ollama suggestions
- **Behavior:** Requires human confirmation before writing metadata

### Ollama Suggestions (Advisory Only)
- **Path:** `tools/intake/ollama_suggest.py`
- **Purpose:** Propose metadata suggestions (never auto-routes)
- **Behavior:** PSA-scope only, filters out cyber/IT terms

---

**Last Updated:** 2026-01-24
