# Module System Audit - Current State Documentation

**Date:** 2026-01-27  
**Purpose:** Comprehensive documentation of the current module system for audit and UX improvement planning

---

## Table of Contents

1. [Overview](#overview)
2. [Core Concepts](#core-concepts)
3. [Database Schema](#database-schema)
4. [Module Creation Workflows](#module-creation-workflows)
5. [Module Import Process](#module-import-process)
6. [Module Drafts System](#module-drafts-system)
7. [Module Instances (Assessment Attachment)](#module-instances-assessment-attachment)
8. [Module OFCs](#module-ofcs)
9. [Module Research & Sources](#module-research--sources)
10. [API Endpoints](#api-endpoints)
11. [UI Pages & Components](#ui-pages--components)
12. [Complexity & Pain Points](#complexity--pain-points)

---

## Overview

The module system is designed to provide **additive content bundles** that extend baseline PSA assessments with technology-specific or situation-specific questions and recommendations. Modules are completely independent of baseline content and stored in module-owned tables.

### Key Principles

1. **Modules are additive**: Module questions and OFCs are NOT baseline. They are stored in module-owned tables and displayed only when the module is attached to an assessment.
2. **No baseline references**: Module content must NOT link to baseline question IDs (`BASE-*`) or baseline OFCs.
3. **Technology/situation dependent**: Module questions must be specific to a technology or situation, not generic "supports physical security" phrasing.
4. **PSA scope only**: Module content must focus on physical security. Cyber controls (encryption, 2FA, authentication) do NOT become module questions or OFCs—they are stored as risk drivers (context only).

---

## Core Concepts

### Module States

- **DRAFT**: Module metadata exists but no imported content (no questions/OFCs)
- **ACTIVE**: Module has imported questions/OFCs and can be attached to assessments

### Module Components

1. **Module Metadata** (`assessment_modules`)
   - `module_code`: Unique identifier (must match `MODULE_[A-Z0-9_]+`)
   - `module_name`: Human-readable name
   - `description`: Optional description
   - `status`: DRAFT or ACTIVE
   - `is_active`: Soft delete flag

2. **Module Questions** (`module_questions`)
   - Module-specific questions with `MODULEQ_*` IDs
   - Stored separately from baseline questions
   - Require discipline ownership, asset/location, event trigger

3. **Module OFCs** (`module_ofcs`)
   - Module-specific OFCs with `MOD_OFC_*` IDs
   - Stored separately from baseline OFCs
   - Can have sources attached

4. **Module Risk Drivers** (`module_risk_drivers`)
   - Read-only context about cyber/fraud vulnerabilities
   - Never become questions or OFCs

5. **Module Instances** (`assessment_module_instances`)
   - Links assessments to enabled modules
   - Many-to-many relationship
   - Supports automatic reconciliation via subsector policies

6. **Module Drafts** (`module_drafts`)
   - Staging area for automated source-driven module creation
   - Questions can be ACCEPTED/REJECTED before publishing
   - Publishing copies ACCEPTED questions to `module_questions`

---

## Database Schema

### RUNTIME Database Tables

#### Core Module Tables

**`assessment_modules`**
- Primary key: `module_code` (TEXT)
- Fields: `module_name`, `description`, `status`, `is_active`, `created_at`, `updated_at`, `created_by`
- Status: `DRAFT` | `ACTIVE`
- Intent fields: `intent_standard_key`, `intent_confidence`, `intent_locked`, `intent_explanation`

**`module_questions`**
- Primary key: `id` (UUID)
- Foreign key: `module_code` → `assessment_modules(module_code)`
- Fields: `module_question_id` (MODULEQ_*), `question_text`, `discipline_id`, `discipline_subtype_id`, `asset_or_location`, `event_trigger`, `order_index`, `response_enum`
- Unique: `(module_code, module_question_id)`

**`module_ofcs`**
- Primary key: `id` (UUID)
- Foreign key: `module_code` → `assessment_modules(module_code)`
- Fields: `ofc_id` (MOD_OFC_*), `ofc_text`, `order_index`, `batch_id`, `source_system`, `source_ofc_id`, `source_ofc_num`
- Unique: `(module_code, ofc_id)`

**`module_ofc_sources`**
- Links OFCs to sources
- Foreign keys: `module_ofc_id` → `module_ofcs(id)`, optional `module_instance_ofc_id` → `module_instance_ofcs(id)`
- Fields: `source_url`, `source_label`

**`module_risk_drivers`**
- Foreign key: `module_code` → `assessment_modules(module_code)`
- Fields: `driver_type` (CYBER_DRIVER | FRAUD_DRIVER), `driver_text`

**`module_import_batches`**
- Tracks import history
- Fields: `module_code`, `import_source`, `import_sha256`, `stats`, `raw_payload`

#### Module Instance Tables

**`assessment_module_instances`**
- Primary key: `(assessment_id, module_code)`
- Foreign keys: `assessment_id` → `assessments(id)`, `module_code` → `assessment_modules(module_code)`
- Fields: `status`, `attached_via` (USER | RECONCILE), `attached_at`, `is_locked`

**`assessment_module_question_responses`**
- Stores user responses to module questions for a specific assessment
- Primary key: `(assessment_id, module_code, module_question_id)`
- Fields: `question_text`, `response`, `order_index`

**`module_instances`** (Doctrine-generated)
- One instance per module_code
- Fields: `module_code`, `standard_key`, `standard_version`, `attributes_json`, `generated_at`

**`module_instance_criteria`**
- Criteria questions for doctrine-generated instances
- Foreign key: `module_instance_id` → `module_instances(id)`
- Fields: `criterion_key`, `title`, `question_text`, `discipline_subtype_id`, `applicability`, `order_index`

**`module_instance_criterion_responses`**
- User responses to instance criteria
- Foreign key: `module_instance_criterion_id` → `module_instance_criteria(id)`
- Fields: `response_enum` (YES | NO | N_A)

**`module_instance_ofcs`**
- Instantiated OFCs from doctrine templates
- Foreign key: `module_instance_id` → `module_instances(id)`
- Fields: `criterion_key`, `template_key`, `discipline_subtype_id`, `ofc_text`, `order_index`

#### Module Draft Tables

**`module_drafts`**
- Primary key: `id` (UUID)
- Fields: `module_code` (nullable), `title`, `summary`, `status` (DRAFT | PUBLISHED | ARCHIVED)
- Unique: `module_code` (where not null)

**`module_draft_sources`**
- Foreign key: `draft_id` → `module_drafts(id)`
- Fields: `source_id`, `source_label`, `source_url`

**`module_draft_questions`**
- Foreign key: `draft_id` → `module_drafts(id)`
- Fields: `question_text`, `discipline_id`, `discipline_subtype_id`, `confidence`, `rationale`, `status` (DRAFT | ACCEPTED | REJECTED)

#### Module Research Tables

**`module_sources`** (RUNTIME)
- Foreign key: `module_code` → `assessment_modules(module_code)`
- Fields: `source_id`, `source_label`, `source_url`, `upload_path`

**`module_source_documents`** (CORPUS)
- Links module_sources to corpus_documents
- Foreign key: `corpus_document_id` → `corpus_documents(id)`
- Fields: `module_code`, `module_source_id` (cross-database reference)

**`module_chunk_links`** (CORPUS)
- Links modules to document_chunks for fast retrieval
- Foreign key: `chunk_id` → `document_chunks(chunk_id)`
- Fields: `module_code` (cross-database reference)

**`module_evidence`** (RUNTIME)
- Evidence linking for modules
- Fields: `module_code`, `evidence_type`, `evidence_data`

**`module_standards`** (CORPUS)
- Standards associated with modules
- Fields: `module_code`, `standard_key`, `standard_version`

**`module_vofc_library`** (RUNTIME)
- Module-specific VOFC library entries
- Foreign key: `module_code` → `assessment_modules(module_code)`
- Fields: `vofc_id`, `vofc_text`, `discipline_subtype_id`, `order_index`

---

## Module Creation Workflows

### Workflow 1: Manual Creation via UI

**Path:** `/admin/modules` → "Create Module" button

**Steps:**
1. User clicks "Create Module" button
2. Modal opens with form:
   - Title (auto-generates module_code)
   - Module Code (read-only, auto-generated)
   - Description (optional)
   - Research Sources section (optional, can search for sources)
3. User submits → `POST /api/admin/modules/create`
4. Creates `assessment_modules` row with `status = 'DRAFT'`
5. Redirects to `/admin/modules/{module_code}` detail page
6. User must separately import content via `/admin/modules/import`

**Issues:**
- Two-step process (create metadata, then import)
- No clear indication of what to do next after creation
- Research sources feature is hidden in collapsible section

### Workflow 2: Import from JSON

**Path:** `/admin/modules/import`

**Steps:**
1. User navigates to import page
2. Uploads JSON file with module definition
3. System validates:
   - Structural validation (required fields, types)
   - Discipline ownership validation
   - Event trigger validation
   - Risk driver validation
4. If validation passes:
   - Creates/updates `assessment_modules` (sets status to ACTIVE)
   - Inserts `module_questions`
   - Inserts `module_ofcs` and `module_ofc_sources`
   - Inserts `module_risk_drivers`
   - Registers sources in `source_registry` (CORPUS)
   - Creates `module_import_batches` record
5. Returns import statistics

**JSON Structure:**
```json
{
  "module_code": "MODULE_EXAMPLE",
  "title": "Example Module",
  "description": "Optional description",
  "module_questions": [
    {
      "id": "MODULEQ_EXAMPLE_001",
      "text": "Question text",
      "order": 1,
      "discipline_id": "uuid",
      "discipline_subtype_id": "uuid",
      "asset_or_location": "Asset name",
      "event_trigger": "TAMPERING"
    }
  ],
  "module_ofcs": [
    {
      "ofc_id": "MOD_OFC_EXAMPLE_001",
      "ofc_text": "OFC text",
      "order_index": 1,
      "sources": [{"url": "...", "label": "..."}]
    }
  ],
  "risk_drivers": [
    {
      "driver_type": "CYBER_DRIVER",
      "driver_text": "Driver text"
    }
  ]
}
```

**Issues:**
- Requires manual JSON file creation
- Complex validation rules not obvious
- No visual feedback during validation
- Error messages may be technical

### Workflow 3: Module Builder (Legacy?)

**Path:** `/admin/modules/builder`

**Steps:**
1. Step 1: Create module metadata (code, name, description)
2. Step 2: Select questions from baseline questions
3. Step 3: Save to library
4. Step 4: Module ready

**Issues:**
- Appears to select from baseline questions (contradicts additive principle?)
- Not clear if this is still used
- Confusing workflow

### Workflow 4: Module Drafts (Automated)

**Path:** `/admin/module-drafts`

**Steps:**
1. Create draft from sources: `POST /api/admin/module-drafts`
   - Body: `{ title_hint?: string, source_ids: string[] }`
   - Creates `module_drafts` and `module_draft_sources` rows
2. Generate question suggestions: `POST /api/admin/module-drafts/{draftId}/generate`
   - Uses template-driven generation
   - Creates `module_draft_questions` with status DRAFT
3. Review and accept/reject questions: `/admin/module-drafts/{draftId}`
   - User can accept/reject each question
   - Updates `module_draft_questions.status`
4. Publish draft: `POST /api/admin/module-drafts/{draftId}/publish`
   - Body: `{ module_code: string, title: string }`
   - Copies ACCEPTED questions to `module_questions`
   - Creates/updates `assessment_modules` with status ACTIVE
   - Sets draft status to PUBLISHED

**Issues:**
- Multi-step process with unclear state transitions
- No OFC generation (only questions)
- Requires manual review of each question
- Draft status can be confusing

---

## Module Import Process

### Import Function: `importModule()` in `module_import_v2.ts`

**Process Flow:**

1. **Linter Validation** (`lintModuleImport`)
   - Structural checks
   - ID format validation
   - Required fields

2. **Module Code Validation**
   - Must start with `MODULE_`
   - Must match pattern `MODULE_[A-Z0-9_]+`

3. **Ensure Module Metadata Exists**
   - Calls `createModuleMetadata()` if needed
   - Creates with DRAFT status if new

4. **Mandatory Validators:**
   - **Discipline Ownership Validation**: Ensures questions assigned to correct disciplines based on semantic keywords
   - **Event Trigger Validation**: Ensures event triggers match question semantics
   - **Risk Driver Validation**: Normalizes and deduplicates risk drivers

5. **Source Registration** (CORPUS database)
   - Collects unique sources from OFCs
   - Calls `registerSources()` to register in `source_registry`
   - Continues even if registration fails (logs warning)

6. **Import Batch Deduplication**
   - Generates SHA256 hash of payload
   - Checks `module_import_batches` for duplicate
   - If duplicate, returns early with duplicate flag

7. **Transaction:**
   - BEGIN transaction
   - Create `module_import_batches` record
   - Handle questions (REPLACE or APPEND mode):
     - If REPLACE: Delete existing questions
     - Insert/update `module_questions`
   - Handle OFCs (REPLACE or APPEND mode):
     - If REPLACE: Delete sources first, then OFCs
     - Insert/update `module_ofcs`
     - Replace sources for each OFC
   - Handle risk drivers (REPLACE or APPEND mode)
   - Update module status to ACTIVE
   - COMMIT

**Issues:**
- Complex validation chain
- Multiple database transactions (RUNTIME + CORPUS)
- Error handling can be opaque
- REPLACE vs APPEND mode not clearly explained

---

## Module Drafts System

### Purpose

Module drafts provide a staging area for automated source-driven module creation. Questions are generated from templates and can be reviewed before publishing.

### Tables

- `module_drafts`: Draft shells
- `module_draft_sources`: Sources attached to draft
- `module_draft_questions`: Generated question stubs with status (DRAFT | ACCEPTED | REJECTED)

### Workflow

1. **Create Draft**
   - `POST /api/admin/module-drafts`
   - Requires `source_ids` array
   - Creates draft with status DRAFT

2. **Generate Questions**
   - `POST /api/admin/module-drafts/{draftId}/generate`
   - Template-driven question generation
   - Creates `module_draft_questions` with status DRAFT

3. **Review Questions**
   - UI: `/admin/module-drafts/{draftId}`
   - User can accept/reject each question
   - Updates question status via `PATCH /api/admin/module-drafts/{draftId}/questions/{questionId}`

4. **Publish**
   - `POST /api/admin/module-drafts/{draftId}/publish`
   - Requires `module_code` and `title`
   - Copies ACCEPTED questions to `module_questions`
   - Creates/updates `assessment_modules` with status ACTIVE
   - Sets draft status to PUBLISHED

**Issues:**
- No OFC generation (only questions)
- Requires manual review of each question
- Draft status transitions not clear
- No way to edit questions before accepting
- Publishing requires manual module_code entry

---

## Module Instances (Assessment Attachment)

### Purpose

Module instances link modules to assessments, enabling module questions and OFCs to appear in the assessment.

### Tables

- `assessment_module_instances`: Links assessments to modules
- `assessment_module_question_responses`: Stores user responses to module questions
- `module_instances`: Doctrine-generated instances (one per module_code)
- `module_instance_criteria`: Criteria questions for doctrine instances
- `module_instance_criterion_responses`: User responses to criteria
- `module_instance_ofcs`: Instantiated OFCs from doctrine templates

### Attachment Methods

#### Method 1: User Selection

**API:** `POST /api/runtime/assessments/{assessmentId}/modules`

**Process:**
1. User selects modules to attach
2. Creates `assessment_module_instances` rows with `attached_via = 'USER'`
3. Clones `module_questions` into `assessment_module_question_responses` with default response 'N_A'

#### Method 2: Automatic Reconciliation

**Function:** `reconcileModulesForAssessment()` in `reconcile_modules.ts`

**Process:**
1. Checks assessment's subsector
2. Looks up subsector module policies
3. Automatically attaches modules based on policy
4. Creates `assessment_module_instances` rows with `attached_via = 'RECONCILE'`
5. Can be locked to prevent user changes (`is_locked = true`)

#### Method 3: Direct Attach

**API:** `POST /api/runtime/assessments/{assessmentId}/modules/{moduleCode}/attach`

**Process:**
1. Verifies assessment and module exist
2. Creates/updates `assessment_module_instances`
3. Clones questions into responses

**Issues:**
- Multiple attachment methods can conflict
- Reconciliation can override user selections
- Locking mechanism not clearly exposed in UI
- Doctrine-generated instances add complexity

---

## Module OFCs

### Structure

Module OFCs are stored in `module_ofcs` with:
- `ofc_id`: Must start with `MOD_OFC_`
- `ofc_text`: Physical security focused (no cyber controls)
- Sources linked via `module_ofc_sources`

### VOFC Library

Modules can have VOFC (Validated OFC) library entries in `module_vofc_library`:
- Module-specific validated OFCs
- Linked to `module_code`
- Has discipline subtype ownership

### OFC Registration

**API:** `POST /api/admin/modules/{moduleCode}/ofcs/{moduleOfcId}/register`

Registers module OFCs into the VOFC library system.

**Issues:**
- Multiple OFC storage locations (module_ofcs, module_vofc_library, module_instance_ofcs)
- Registration process not clear
- Doctrine-generated OFCs vs imported OFCs

---

## Module Research & Sources

### Source Storage

**RUNTIME:**
- `module_sources`: URLs/files for module topic
- Links to `assessment_modules(module_code)`

**CORPUS:**
- `module_source_documents`: Links module_sources to corpus_documents
- `module_chunk_links`: Links modules to document_chunks for fast retrieval

### Research Workflow

1. **Import Download Manifest**
   - Script: `tools/research/import_download_manifest_to_module_sources.py`
   - Creates `module_sources` rows

2. **Link Documents**
   - Script: `tools/research/link_module_documents.py`
   - Links sources to corpus documents

3. **Process PDFs**
   - Script: `tools/corpus/process_module_pdfs_from_incoming.py`
   - Ingests PDFs into corpus

**Issues:**
- Complex multi-database workflow
- Manual script execution required
- No clear UI for research workflow
- Cross-database references without foreign keys

---

## API Endpoints

### Module Management

- `GET /api/admin/modules` - List all modules
- `GET /api/admin/modules/library` - Get module library with questions
- `POST /api/admin/modules/create` - Create module metadata (DRAFT)
- `POST /api/admin/modules/import` - Import module from JSON
- `GET /api/admin/modules/{moduleCode}` - Get module details
- `GET /api/admin/modules/{moduleCode}/questions` - Get module questions
- `GET /api/admin/modules/{moduleCode}/ofcs` - Get module OFCs
- `GET /api/admin/modules/{moduleCode}/export` - Export module as JSON

### Module Drafts

- `POST /api/admin/module-drafts` - Create draft from sources
- `GET /api/admin/module-drafts/{draftId}` - Get draft details
- `POST /api/admin/module-drafts/{draftId}/generate` - Generate question suggestions
- `PATCH /api/admin/module-drafts/{draftId}/questions/{questionId}` - Update question status
- `POST /api/admin/module-drafts/{draftId}/publish` - Publish draft

### Module Sources

- `GET /api/admin/modules/{moduleCode}/sources` - List module sources
- `POST /api/admin/modules/{moduleCode}/sources/upload` - Upload source file
- `POST /api/admin/modules/{moduleCode}/sources/add-from-url` - Add source from URL
- `POST /api/admin/modules/{moduleCode}/sources/attach-corpus` - Attach corpus document

### Module Research

- `POST /api/admin/modules/research` - Search for research sources

### Assessment Module Attachment

- `GET /api/runtime/assessments/{assessmentId}/modules` - List attached modules
- `POST /api/runtime/assessments/{assessmentId}/modules` - Attach module
- `POST /api/runtime/assessments/{assessmentId}/modules/{moduleCode}/attach` - Attach specific module
- `DELETE /api/runtime/assessments/{assessmentId}/modules/{moduleCode}` - Detach module

**Issues:**
- Many endpoints with overlapping functionality
- Inconsistent naming conventions
- Some endpoints not clearly documented
- Error responses vary in format

---

## UI Pages & Components

### Pages

1. **`/admin/modules`** - Module list/breakdown
   - Shows all modules with question counts
   - "Create Module" button
   - "Import Module" link
   - Links to module detail pages

2. **`/admin/modules/{moduleCode}`** - Module detail page
   - Shows module metadata
   - Lists questions and OFCs
   - Shows sources
   - Various action buttons

3. **`/admin/modules/import`** - Module import page
   - File upload for JSON import
   - Validation error display

4. **`/admin/modules/builder`** - Module builder (legacy?)
   - Multi-step wizard
   - Question selection from baseline

5. **`/admin/module-drafts`** - Draft list
   - Lists all drafts
   - Create draft button

6. **`/admin/module-drafts/{draftId}`** - Draft review page
   - Shows draft questions
   - Accept/reject interface
   - Publish form

### Components

- `AssessmentModuleList` - Shows modules for an assessment
- Module creation modal (in modules page)
- Various module detail components

**Issues:**
- Multiple entry points (confusing)
- No clear workflow guidance
- Inconsistent UI patterns
- Some pages appear unused/legacy

---

## Complexity & Pain Points

### 1. Multiple Creation Workflows

- Manual creation → separate import
- JSON import (all-in-one)
- Module builder (legacy?)
- Draft system (automated)

**Problem:** Users don't know which workflow to use.

### 2. Module States Not Clear

- DRAFT vs ACTIVE
- What makes a module "ready"?
- When can modules be attached to assessments?

### 3. Draft System Complexity

- Multi-step process
- No OFC generation
- Manual review required
- Publishing requires manual module_code entry

### 4. Module Instance Confusion

- Multiple attachment methods
- Reconciliation can override user choices
- Doctrine-generated instances vs regular instances
- Locking mechanism not clear

### 5. OFC Storage Complexity

- `module_ofcs` (imported)
- `module_vofc_library` (validated)
- `module_instance_ofcs` (doctrine-generated)
- Registration process unclear

### 6. Cross-Database Complexity

- RUNTIME: Modules, questions, OFCs
- CORPUS: Sources, documents, chunks
- Cross-database references without foreign keys
- Manual script execution required

### 7. Research Workflow

- No clear UI
- Requires script execution
- Complex multi-step process
- Not integrated with module creation

### 8. Validation Complexity

- Multiple validation layers
- Technical error messages
- Discipline ownership rules not obvious
- Event trigger rules not obvious

### 9. API Inconsistencies

- Many overlapping endpoints
- Inconsistent naming
- Varying error formats
- Some endpoints undocumented

### 10. UI/UX Issues

- Multiple entry points
- No workflow guidance
- Inconsistent patterns
- Legacy pages still accessible
- Hidden features (research in collapsible section)

---

## Recommendations for Improvement

1. **Consolidate Creation Workflows**
   - Single, clear entry point
   - Guided wizard for common cases
   - Advanced options for power users

2. **Clarify Module States**
   - Visual indicators
   - Clear status explanations
   - Block invalid actions

3. **Simplify Draft System**
   - Auto-generate module_code
   - Generate OFCs too
   - Better review interface
   - Clear publish workflow

4. **Unify Module Instances**
   - Single attachment method
   - Clear reconciliation UI
   - Visual locking indicators

5. **Consolidate OFC Storage**
   - Single source of truth
   - Clear registration process

6. **Integrate Research Workflow**
   - UI for research steps
   - Automated where possible
   - Clear progress indicators

7. **Improve Validation UX**
   - Inline validation
   - Helpful error messages
   - Rule explanations

8. **Standardize APIs**
   - Consistent naming
   - Unified error format
   - Clear documentation

9. **Improve UI Navigation**
   - Clear workflow paths
   - Remove legacy pages
   - Consistent patterns

10. **Add Onboarding**
    - Guided tour
    - Contextual help
    - Example modules

---

## Appendix: Key Files

### Core Library Files
- `app/lib/admin/module_creation.ts` - Create module metadata
- `app/lib/admin/module_import_v2.ts` - Import module from JSON
- `app/lib/admin/module_import.ts` - Legacy import (deprecated?)
- `app/lib/admin/moduleDraftBuilder.ts` - Draft question generation
- `app/lib/runtime/reconcile_modules.ts` - Automatic module reconciliation

### API Routes
- `app/api/admin/modules/**` - Module management APIs
- `app/api/admin/module-drafts/**` - Draft management APIs
- `app/api/runtime/assessments/**/modules/**` - Assessment module attachment

### UI Pages
- `app/admin/modules/page.tsx` - Module list
- `app/admin/modules/[moduleCode]/page.tsx` - Module detail
- `app/admin/modules/import/page.tsx` - Import page
- `app/admin/modules/builder/page.tsx` - Builder (legacy?)
- `app/admin/module-drafts/**` - Draft pages

### Database Migrations
- `db/migrations/20260121_create_assessment_modules.sql` - Core tables
- `db/migrations/20260121_modules_additive_*.sql` - Additive content tables
- `db/migrations/runtime/20260124_0014_module_draft_tables.sql` - Draft tables
- `db/migrations/runtime/20260126_1200_module_instances.sql` - Instance tables

---

**End of Document**
