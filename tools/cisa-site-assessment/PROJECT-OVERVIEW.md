# PSA Rebuild Project Overview

## Project Description

**PSA Rebuild** is the frontend user interface for the Protective Security Assessment (PSA) system. It provides a Next.js-based web application for conducting security assessments, analyzing document coverage, and managing assessment workflows.

## System Architecture

PSA Rebuild is part of a three-project architecture:

1. **psa-web** (this project): UI layer - workflows, presentation, components
2. **psa-engine**: Business logic layer - doctrine, taxonomy, scoring, coverage computation
3. **psa-backend**: Data layer - ingestion, persistence, backend APIs

### Authority Boundaries

- **psa-web owns**: UI workflows, presentation logic, component architecture
- **psa-engine owns**: Doctrine content, taxonomy, scoring rules, coverage computation
- **psa-backend owns**: Data ingestion, database schema, persistence

See `docs/AUTHORITY.md` for complete authority boundaries.

## Key Components

### Assessment System

- **Assessment Execution**: `/assessments/[assessmentId]` - Answer assessment questions
- **Results Viewer**: `/assessments/[assessmentId]/results` - View scored results
- **Assessment List**: `/assessments` - Manage assessments

### Coverage Analysis

- **Coverage List**: `/coverage` - Browse document coverage
- **Coverage Detail**: `/coverage/[documentId]` - Detailed coverage analysis

### Taxonomy Reference

- **Sectors**: `/sectors` - DHS Critical Infrastructure Sectors
- **Disciplines**: `/disciplines` - Security disciplines and subtypes

### Analytics & Question Generation

The `analytics/` directory provides tools for generating and managing assessment questions:

- **Baseline Questions Registry**: `analytics/runtime/baseline_questions_registry.json`
  - Source of truth for baseline questions
  - Frozen baseline questions (Baseline_Questions_v1)
  
- **Sector/Subsector Question Generation**: `analytics/tools/generate_sector_subsector_questions.py`
  - Generates additive sector- and subsector-specific questions
  - Uses capability-based templates (SYSTEMS, PLANS_PROCEDURES, MAINTENANCE_ASSURANCE, PERSONNEL_RESPONSIBILITY)
  - Validates against baseline to prevent duplicates and restatements
  - Outputs to `analytics/questions/sector/` and `analytics/questions/subsector/`
  
- **Question Structure**: Questions are file-authoritative (no database writes)
  - Sector questions: `analytics/questions/sector/<sector>/<discipline>/<subtype>.json`
  - Subsector questions: `analytics/questions/subsector/<sector>/<subsector>/<discipline>/<subtype>.json`

See `analytics/tools/README_SECTOR_SUBSECTOR_QUESTIONS.md` for detailed documentation.

### Admin Interface

The admin interface is organized into 5 domains, each with specific tools:

#### Doctrine Domain (`/admin/doctrine`)
- **Doctrine Validation** (`/admin/doctrine/validation`) - Run validation checks on doctrine integrity
- **Freeze Status** (`/admin/doctrine/freeze`) - Check baseline freeze readiness and status

#### Data & Ingestion Domain (`/admin/data`)
- **Coverage Analysis** (`/admin/data/coverage`) - View canonical coverage statistics and history
- **Coverage Dashboard** (`/admin/data/coverage-dashboard`) - Baseline coverage index and discipline completion status
- **Gap Analysis** (`/admin/data/gap-analysis`) - Identify missing questions, vulnerabilities, and OFCs by subtype
- **Canonical Content Dashboard** (`/admin/data/canonical-content`) - View canonical content coverage by discipline and subtype
- **Candidate Packages** (`/admin/data/candidates`) - View and manage candidate canonical packages

#### Analysis & Review Domain (`/admin/analysis`)
- **Assessment Status** (`/admin/analysis/assessments`) - View assessment counts, status breakdown, and doctrine versions
- **Gap Detection** (`/admin/analysis/gap-detection`) - View gap detection reports and candidate suggestions by subtype
- **Review Statements** (`/admin/review-statements`) - Review and approve/reject ingested source statements

#### System State Domain (`/admin/system`)
- **Coverage Status** (`/admin/system/coverage`) - View coverage system status and latest runs

#### Utilities Domain (`/admin/utilities`)
- Utility tools and maintenance functions

All admin tools are registered in `src/admin/adminToolRegistry.ts` and organized by domain for easy navigation.

## OFC UI Rendering — Frozen

OFC (Outcome-Focused Criteria) rendering logic is complete and frozen.

**Status**: STABLE - Changes prohibited unless driven by:
- Doctrine contract changes, or
- Backend response schema changes

### Key Files (Stable)

- `lib/groupOfcsByDepth.ts` - Single source of truth for OFC grouping logic
- `app/components/OfcDisplay.tsx` - Assessment UI OFC rendering component
- `app/components/ReportOFCs.tsx` - Report/PDF OFC rendering component

All three files are marked with stability comments and should not be modified during baseline burn-down.

## System Status

**Current State**: LOCKED, PRODUCTION-STABLE

- UI consumes backend scoring API output exactly as provided
- No recomputation or reinterpretation of scores
- Backend-calculated percentages preserved
- Separate baseline and sector display maintained

See `docs/STATUS.md` for detailed status information.

## Technology Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript 5
- **UI**: React 19, USWDS 3.13
- **Styling**: Tailwind CSS 4
- **Database**: PostgreSQL (via psa-backend APIs)

## Documentation Structure

- `docs/doctrine/` - Read-only references to psa-engine doctrine
- `docs/process/` - psa-rebuild-specific process documentation
  - `docs/process/workflows/` - User workflow processes
  - `docs/process/presentation/` - Presentation logic
  - `docs/process/ui/` - UI component processes
- `docs/decisions/` - Decision rationale and tradeoffs
- `docs/artifacts/` - Generated/temporary outputs
- `analytics/tools/` - Analytics tool documentation
  - `analytics/tools/README_SECTOR_SUBSECTOR_QUESTIONS.md` - Question generation guide

## Key Routes

### Public Routes
- `/` - Home (redirects to `/assessments`)
- `/assessments` - Assessment list
- `/assessments/[assessmentId]` - Assessment execution
- `/assessments/[assessmentId]/results` - Assessment results
- `/coverage` - Coverage list
- `/coverage/[documentId]` - Coverage detail
- `/sectors` - Sectors reference
- `/disciplines` - Disciplines reference

### Admin Routes
- `/admin` - Admin console root (dashboard with 5 domains)
- `/admin/doctrine` - Doctrine domain (validation, freeze)
- `/admin/data` - Data & Ingestion domain (coverage, gaps, candidates)
- `/admin/analysis` - Analysis & Review domain (assessments, gap detection, review)
- `/admin/system` - System State domain (coverage status)
- `/admin/utilities` - Utilities domain (maintenance tools)

See `SITE_MAP.md` and `ROUTE_MAP.md` for complete admin route documentation.

See `SITE_MAP.md` and `ROUTE_MAP.md` for complete route documentation.

## Development Guidelines

1. **Do Not Redefine Doctrine**: All doctrine content comes from psa_engine
2. **Display, Don't Compute**: UI displays backend results, does not recompute
3. **Respect Authority Boundaries**: See `docs/AUTHORITY.md`
4. **OFC Rendering**: Frozen - changes only for contract/schema changes

## Related Documentation

- `README.md` - Setup and getting started
- `SITE_MAP.md` - Complete site navigation
- `ROUTE_MAP.md` - Route and API mapping
- `docs/STATUS.md` - System status
- `docs/AUTHORITY.md` - Authority boundaries

