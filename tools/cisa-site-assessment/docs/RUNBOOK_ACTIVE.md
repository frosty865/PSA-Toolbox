# PSA Rebuild Active Runbook

**Last Updated**: 2026-01-18

## Overview

PSA Rebuild is the Next.js frontend application for conducting and reviewing security assessments. This runbook covers active development workflows, tools, and maintenance procedures.

## Quick Start

### Prerequisites

- Node.js 20+
- npm (or yarn/pnpm)
- PostgreSQL database access (Supabase RUNTIME project)
- Environment variables configured (see below)

### Installation

```bash
npm ci
```

### Development Server

```bash
npm run dev
```

Server starts on `http://localhost:3000` and redirects to `/assessments` by default.

### Production Build

```bash
npm run build
```

This runs:
1. Doctrine validation checks (`npm run doctrine:check`)
2. Baseline guards (`npm run guard:baseline`)
3. Next.js production build

### Start Production Server

```bash
npm start
```

## Required Environment Variables

Create `.env.local` in the repo root:

```bash
# RUNTIME Database (wivohgbuuwxoyfyzntsd)
SUPABASE_RUNTIME_URL="https://wivohgbuuwxoyfyzntsd.supabase.co"
SUPABASE_RUNTIME_DB_PASSWORD="<database-password>"

# CORPUS Database (yylslokiaovdythzrbgt) - Optional
SUPABASE_CORPUS_URL="https://yylslokiaovdythzrbgt.supabase.co"
SUPABASE_CORPUS_DB_PASSWORD="<database-password>"

# Optional: Backend API
NEXT_PUBLIC_API_BASE="http://localhost:8000"
```

**Note**: Get database passwords from Supabase Dashboard > Project Settings > Database > Connection string.

## Canonical Database Clients

### Runtime Client

**File**: `app/lib/db/runtime_client.ts`

**Usage**: All assessment, OFC library, and runtime data

```typescript
import { getRuntimePool } from '@/app/lib/db/runtime_client';

const pool = getRuntimePool();
// Use for: assessments, ofc_library, expansion_questions, etc.
```

**Environment Variables**:
- `SUPABASE_RUNTIME_URL`
- `SUPABASE_RUNTIME_DB_PASSWORD`

**Tables**: `assessments`, `assessment_instances`, `assessment_responses`, `ofc_library`, `baseline_spines_runtime`, `overlay_spines_runtime`

### Corpus Client

**File**: `app/lib/db/corpus_client.ts`

**Usage**: Document corpus, ingestion, candidate discovery

```typescript
import { getCorpusPool } from '@/app/lib/db/corpus_client';

const pool = getCorpusPool();
// Use for: canonical_sources, documents, ofc_candidate_queue, etc.
```

**Environment Variables**:
- `SUPABASE_CORPUS_URL`
- `SUPABASE_CORPUS_DB_PASSWORD`

**Tables**: `canonical_sources`, `documents`, `document_chunks`, `ingestion_runs`, `ofc_candidate_queue`

## Active Tools

### Baseline & Doctrine Tools

```bash
# Generate baseline coverage report
npm run baseline:coverage

# Validate subtype guidance
npm run validate:subtype-guidance
npm run validate:guidance:threshold  # 95% threshold
npm run validate:guidance:strict     # 98% threshold
npm run validate:guidance:explicit   # Explicit mode

# Apply guidance required flags
npm run apply:guidance-required
```

### Intent Objects

```bash
# Generate intent objects
npm run generate:intent

# Validate intent objects
npm run validate:intent

# CI pipeline (generate + validate)
npm run ci:intent
```

### Baseline Guards

```bash
# Check for legacy baseline references
npm run guard:baseline

# Freeze baseline text (snapshot)
npm run snapshot:baseline-text

# Guard: depth2 questions require intent
npm run guard:depth2-intent

# Full CI baseline pipeline
npm run ci:baseline
```

### Checklists & Branching

```bash
# Generate subtype checklists
npm run generate:checklists

# Validate checklists
npm run validate:checklists

# Tag depth2 questions
npm run generate:depth2-tags

# Validate depth2 tags
npm run validate:depth2-tags

# Full branching build
npm run build:branching
```

### Documentation & Reports

```bash
# Generate questions by discipline/subtype doc
npm run generate:questions-doc

# Build subtype interaction map
npm run build:interaction-map

# Check overlay wiring
npm run check:overlay-wiring
```

### Database Migrations

```bash
# Run SQL script
npm run db:overlay-spines:migrate
# Or use: npx tsx tools/run_sql.ts <path-to-sql>
```

### Workspace Cleanup

```bash
# Dry-run cleanup
npm run workspace:cleanup:dry

# Apply cleanup
npm run workspace:cleanup:apply
```

## Artifact Locations

### Generated Reports

- `tools/reports/baseline_coverage_report.json` - Machine-readable coverage report
- `tools/reports/baseline_coverage_report.md` - Human-readable coverage report

### Generated Outputs

- `tools/outputs/` - Generated artifacts (JSON, markdown, etc.)
  - `baseline_depth2_questions.json`
  - `intent_objects.v1.md`
  - `questions_by_discipline_subtype.md`
  - `subtype_guidance_validation.md`

### SQL Scripts

- `tools/sql/` - Active SQL migration and utility scripts

## Project Structure

```
psa_rebuild/
├── app/                    # Next.js app directory
│   ├── admin/              # Admin interface pages
│   ├── api/                # API route handlers
│   │   ├── runtime/        # Runtime API (uses runtime_client)
│   │   └── reference/      # Reference data API
│   ├── assessments/        # Assessment pages
│   ├── components/         # React components
│   └── lib/                # Shared utilities
│       └── db/             # Database clients
│           ├── runtime_client.ts
│           └── corpus_client.ts
├── taxonomy/               # Taxonomy JSON files
├── tools/                  # Active Node.js tools
│   ├── sql/               # SQL scripts
│   ├── outputs/           # Generated artifacts
│   └── reports/           # Generated reports
├── docs/                   # Documentation
└── scripts/                # Shell/PowerShell scripts
```

## API Endpoints

### Runtime Endpoints

- `GET /api/runtime/assessments` - List assessments
- `GET /api/runtime/assessments/[id]/questions` - Get assessment questions
- `GET /api/runtime/assessments/[id]/responses` - Get assessment responses
- `GET /api/runtime/ofc-library` - Get OFC library

### Reference Endpoints

- `GET /api/reference/disciplines` - Get disciplines
- `GET /api/reference/baseline-questions` - Get baseline questions

## Troubleshooting

### Database Connection Issues

1. Verify environment variables are set correctly
2. Check Supabase project is active (not paused)
3. Verify database password is correct (from Supabase Dashboard)
4. Check network connectivity to Supabase

### Build Failures

1. Run `npm ci` to ensure clean install
2. Check for TypeScript errors: `npm run typecheck`
3. Check for linting errors: `npm run lint`
4. Verify doctrine checks pass: `npm run doctrine:check`

### Import Errors

- Ensure using correct database client (`getRuntimePool()` vs `getCorpusPool()`)
- Check import paths use `@/app/lib/db/runtime_client` or `@/app/lib/db/corpus_client`
- Never use legacy `getPool()` from `@/app/lib/db`

## Maintenance

### Regular Tasks

1. **Weekly**: Run `npm run baseline:coverage` to check coverage
2. **Before releases**: Run `npm run ci:baseline` to ensure baseline integrity
3. **After schema changes**: Update database clients if needed

### Workspace Cleanup

Run workspace cleanup periodically to archive deprecated files:

```bash
npm run workspace:cleanup:dry   # Review first
npm run workspace:cleanup:apply # Then apply
```

Check archive: `D:\PSA_System\archive\CLEANUP_<timestamp>/`
