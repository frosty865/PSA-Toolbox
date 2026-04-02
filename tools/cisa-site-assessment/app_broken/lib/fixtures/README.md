# Fixture Data for PSA Tool

## Purpose

Fixture data allows end-to-end testing of the PSA workflow without requiring a running backend server.

## Usage

Set `USE_FIXTURES=true` in `.env.local` to enable fixture mode.

## Fixture Files

- `assessments.json` - List of available assessments
- `assessment_detail_baseline.json` - Baseline-only assessment (5 questions)
- `assessment_detail_healthcare.json` - Healthcare sector assessment (5 questions: 3 baseline + 2 sector)
- `assessment_detail_aviation.json` - Aviation subsector assessment (5 questions: 2 baseline + 1 sector + 2 subsector)
- `scoring_result_baseline.json` - Scoring results for baseline assessment
- `scoring_result_healthcare.json` - Scoring results for healthcare assessment
- `scoring_result_aviation.json` - Scoring results for aviation assessment

## Assessment IDs

- `fixture-assessment-001` - Baseline only
- `fixture-assessment-002` - Healthcare sector
- `fixture-assessment-003` - Aviation subsector

## Data Shapes

All fixture files match the exact API contract shapes expected by the UI:
- No UI logic required
- No calculations in fixtures
- Exact backend response format

## In-Memory State

When `USE_FIXTURES=true`:
- Responses are saved to in-memory state
- State persists during the server process lifetime
- State resets on server restart (by design)
- Purpose is flow testing, not durability

## Removing Fixture Mode

To disable fixtures:
1. Set `USE_FIXTURES=false` in `.env.local`
2. Restart Next.js server
3. All API calls will route to real backend

The data provider adapter handles the switch transparently.
