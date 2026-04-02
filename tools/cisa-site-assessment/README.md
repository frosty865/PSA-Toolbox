# PSA Rebuild

**Protective Security Assessment (PSA) Rebuild** - Next.js frontend application for conducting and reviewing security assessments.

## Overview

PSA Rebuild is the user interface component of the PSA system, providing:
- **Assessment Management**: Create, execute, and review security assessments
- **Coverage Analysis**: View document coverage and evidence
- **Taxonomy Reference**: Browse sectors, subsectors, and security disciplines
- **Admin Tools**: Doctrine validation, system status, and data management

This is a [Next.js](https://nextjs.org) 16 application built with TypeScript, React 19, and USWDS (U.S. Web Design System).

## Project Status

**Current State:** LOCKED, PRODUCTION-STABLE

- UI is locked and production-stable, consuming backend output exactly as provided
- OFC rendering logic is complete and frozen
- See `docs/STATUS.md` for detailed system status
- See `PROJECT-OVERVIEW.md` for project architecture overview

## Architecture

PSA Rebuild is part of a three-project system:

- **psa-web** (this project): UI workflows, presentation logic, and component architecture
- **psa-engine**: Doctrine content, taxonomy, scoring, and coverage computation
- **psa-backend**: Ingestion, persistence, and backend APIs

**Authority Boundaries:** See `docs/AUTHORITY.md` for what psa-rebuild is authoritative for and what it is not.

## Quick Start

### Prerequisites

- Node.js 20+ 
- npm, yarn, pnpm, or bun
- PostgreSQL database (for production)
- Backend API access (psa-backend)

### Environment Setup

Copy the environment template and add your values:

```bash
cp .env.example .env.local
```

Edit `.env.local`. **Required** variables:

| Variable | Description |
|----------|-------------|
| `RUNTIME_DATABASE_URL` | PostgreSQL connection string for RUNTIME (assessments, modules, OFCs). Use **direct** Postgres (port 5432), not PgBouncer. |
| `CORPUS_DATABASE_URL` | PostgreSQL connection string for CORPUS (document chunks, source registry, ingestion). |

Optional: `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `OLLAMA_HOST` / `OLLAMA_SCOPE_TAG_MODEL` (scope tags), `PYTHON_PATH` / `PSA_PYTHON_PROCESSOR_EXE` (module generation, reprocess worker), `PSA_SYSTEM_ROOT`, and others documented in `.env.example`. Do not commit `.env.local`; it is gitignored.

### Installation

```bash
npm install
# or
yarn install
# or
pnpm install
```

### Development

Run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. The app redirects to `/assessments` by default.

### Build

Build for production:

```bash
npm run build
```

This command runs guards (doctrine, baseline, corpus, etc.), contract tests, and then builds the Next.js application. See `package.json` script `"build"` for the full pipeline.

### Start Production Server

```bash
npm start
```

## Project Structure

```
psa-rebuild/
├── app/                    # Next.js app directory (routes & pages)
│   ├── admin/              # Admin interface pages
│   ├── api/                # API route handlers
│   ├── assessments/        # Assessment pages
│   ├── components/         # React components
│   ├── coverage/           # Coverage analysis pages
│   └── lib/                 # Shared utilities
├── analytics/              # Analytics and question generation
│   ├── runtime/            # Runtime data (baseline questions registry)
│   ├── questions/          # Generated sector/subsector questions
│   └── tools/              # Question generation and analysis tools
├── docs/                    # Documentation
│   ├── doctrine/           # Read-only doctrine references
│   ├── process/            # Process documentation (UI workflows, presentation)
│   ├── decisions/          # Decision rationale
│   └── artifacts/          # Generated artifacts
├── lib/                     # Shared libraries
├── migrations/              # Database migrations
├── orchestration/           # Python orchestration scripts
├── scripts/                 # Utility scripts
└── tools/                   # Review tools
```

## Document Intake (Deterministic)

PSA uses a deterministic intake pipeline with human-confirmed metadata. **See `docs/intake.md` for complete workflow documentation.**

**Quick Start:**
1. Drop PDFs into `services/router/incoming/`
2. Router stages to `staging/unclassified/` automatically
3. Run `.\scripts\run_intake_wizard.ps1` to confirm metadata
4. Router routes based on confirmed metadata
5. Ingestion consumes from `sources/` (corpus/modules separated)

**Key Principles:**
- Router is deterministic: only routes using confirmed metadata (sidecar JSON)
- Ollama analysis is advisory only: suggestions require human confirmation
- Hard separation: CORPUS sources vs MODULE sources
- PSA scope only: physical security, governance, planning, operations
- No cyber/IT classification fields or logic

**Documentation:**
- `docs/intake.md` - **Canonical intake workflow** (start here)
- `services/router/README.md` - Router service details
- `tools/intake/README.md` - Intake wizard details

## Key Features

### Assessment Management
- Create and manage security assessments
- Answer assessment questions (YES/NO/N/A)
- View assessment results with baseline and sector scoring
- Generate printable reports

### Coverage Analysis
- View document coverage statistics
- Browse evidence by discipline
- Analyze coverage gaps

### Taxonomy Reference
- Browse DHS Critical Infrastructure Sectors
- Explore security disciplines and subtypes
- Reference taxonomy structure

### Admin Tools
The admin interface is organized into 5 domains:
- **Doctrine**: Validation checks and freeze management
- **Data & Ingestion**: Coverage analysis, gap analysis, canonical content, and candidate packages
- **Analysis & Review**: Assessment status, gap detection, and statement review
- **System State**: Coverage system status monitoring
- **Utilities**: Maintenance and utility tools

See `SITE_MAP.md` for complete admin tool documentation.

### Analytics Tools
The `analytics/` directory contains tools for question generation and analysis:
- **Question Generation**: Generate sector- and subsector-specific questions that are additive to baseline
  - `analytics/tools/generate_sector_subsector_questions.py` - Main generation script
  - `analytics/runtime/baseline_questions_registry.json` - Baseline questions source of truth
  - Output: `analytics/questions/sector/` and `analytics/questions/subsector/`
- **Component Analysis**: Component capability question generation and validation
- **Coverage Reports**: Baseline coverage and gap analysis reports

See `analytics/tools/README_SECTOR_SUBSECTOR_QUESTIONS.md` for question generation documentation.

## Documentation

- **`PROJECT-OVERVIEW.md`** - Project architecture and key components
- **`SITE_MAP.md`** - Complete site navigation structure
- **`ROUTE_MAP.md`** - Comprehensive route and API mapping
- **`docs/STATUS.md`** - Current system status
- **`docs/AUTHORITY.md`** - Project authority boundaries
- **`docs/README.md`** - Documentation directory structure

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production (includes doctrine validation)
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run doctrine:check` - Validate doctrine mirrors
- `npm run workspace:cleanup:dry` / `workspace:cleanup:apply` - Archive deprecated code; uses `PSA_SYSTEM_ROOT` (see `.env.example`). On Unix, set `PSA_SYSTEM_ROOT` or run from `psa_rebuild` (defaults to parent dir).

**Python scripts** (`guard:ofc-text`, `report:ofc-coverage`, `report:ofc-audit`): use `PYTHON_PATH` or the path from `get_python_path.js`; a processor venv is recommended. See `.env.example` for `PYTHON_PATH`, `PSA_PYTHON_PROCESSOR_EXE`, and `PSA_SYSTEM_ROOT`.

## Technology Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript 5
- **UI Library**: React 19
- **Styling**: Tailwind CSS 4, USWDS 3.13
- **Database**: PostgreSQL (via psa-backend APIs)
- **Build Tool**: Next.js built-in bundler

## Important Notes

- **Doctrine Content**: psa-rebuild displays doctrine from `psa_engine` but does not define it
- **No Score Computation**: UI consumes backend-calculated scores, does not recompute
- **OFC Rendering**: Frozen and stable - changes only for doctrine contract or schema changes
- **Internal AI Usage**: Governed by `docs/decisions/INTERNAL_AI_USE_STATEMENT.md` (if exists)

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [USWDS Documentation](https://designsystem.digital.gov)

## Related Projects

- **psa-engine**: Doctrine, taxonomy, and computation engine
- **psa-backend**: Backend API and data persistence

---

**See `PROJECT-OVERVIEW.md` for detailed architecture information.**
