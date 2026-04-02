# PSA Rebuild Implementation TODO

This checklist is ordered by risk reduction first, then maintainability.

## Phase 1 - Real Admin Authentication (Replace Token-Only Guard)

- [ ] Add session-backed auth for admin APIs in `proxy.ts`.
- [ ] Remove token-label-only actor attribution in `app/lib/admin/audit.ts`.
- [ ] Add authenticated user identity (user id/email/role) to admin audit context.
- [ ] Enforce role checks for all admin routes under:
- [ ] `app/api/admin/**`
- [ ] `app/api/runtime/admin/**`
- [ ] Keep `ADMIN_API_TOKEN` only as an emergency fallback and gate by environment.

Acceptance checks:
- [ ] Unauthenticated request to `/api/admin/*` returns `401`.
- [ ] Authenticated non-admin request to `/api/admin/*` returns `403`.
- [ ] Authenticated admin request succeeds.
- [ ] Audit log entries include real actor identity.

## Phase 2 - Centralized Admin Access + Audit Policy

Targets:
- `app/lib/admin/audit.ts`
- `app/lib/config/admin.ts`
- `proxy.ts`
- `app/api/admin/server-tools/run/route.ts`
- `app/api/admin/source-registry/route.ts`
- `app/api/runtime/admin/expansion-profiles/route.ts`

- [ ] Create one shared admin access helper for authn + authz checks.
- [ ] Standardize unauthorized/forbidden responses across admin routes.
- [ ] Standardize audit event naming and payload structure.
- [ ] Ensure every admin mutation route writes:
- [ ] actor
- [ ] auth mode
- [ ] request id
- [ ] resource identifier
- [ ] outcome (success/failure)

Acceptance checks:
- [ ] No route-specific auth logic drift in admin handlers.
- [ ] All mutation handlers emit consistent audit records.

## Phase 3 - Decompose Largest Route Handlers

### 3A - Runtime Assessments Route

Target:
- `app/api/runtime/assessments/route.ts`

- [ ] Split into:
- [ ] HTTP route adapter
- [ ] input/output validation
- [ ] service layer
- [ ] repository/query layer
- [ ] Move `information_schema` checks into shared helper usage.
- [ ] Add focused service tests for main flows.

Acceptance checks:
- [ ] Route file contains only request parsing + response mapping.
- [ ] Services are directly testable without HTTP wrappers.

### 3B - Module Standard Generation Route

Target:
- `app/api/admin/modules/[moduleCode]/standard/generate/route.ts`

- [ ] Extract generation orchestration into service module(s).
- [ ] Isolate DB access into repository module(s).
- [ ] Add validation boundary before orchestration.
- [ ] Add tests for generation success, validation errors, and upstream failures.

Acceptance checks:
- [ ] Route file size reduced significantly.
- [ ] Core logic covered by non-route tests.

## Phase 4 - Source Registry Route Cleanup

Targets:
- `app/api/admin/source-registry/route.ts`
- `app/api/admin/source-registry/[sourceKey]/route.ts`
- `app/api/admin/source-registry/purge-non-pdf/route.ts`
- `app/lib/sourceRegistry/*`
- `app/lib/db/table_exists.ts`

- [ ] Move duplicate-detection and preflight checks into shared source-registry service.
- [ ] Reuse `tableExists` and `columnExists` everywhere schema probing is needed.
- [ ] Remove repeated SQL snippets for table/column existence checks.
- [ ] Add integration-style tests for:
- [ ] create conflict paths
- [ ] update validation
- [ ] purge flow safety guards

Acceptance checks:
- [ ] No duplicated schema-probing SQL in source-registry routes.
- [ ] Duplicate rejection behavior is consistent across endpoints.

## Phase 5 - CI Coverage Expansion (Operational Code Included)

Targets:
- `package.json`
- `tsconfig.json`
- `tools/**`
- `services/**`

- [ ] Add lint/typecheck coverage for `tools` and `services`.
- [ ] Add dedicated scripts if needed (example: `lint:tools`, `typecheck:tools`).
- [ ] Keep `ci:fast-fail` fast but ensure critical operational scripts are validated.

Acceptance checks:
- [ ] CI fails on type/lint errors in operational code.
- [ ] Existing fast-fail flow remains within acceptable runtime.

## Phase 6 - Environment and Config Normalization

Targets:
- `app/lib/config/*`
- `app/api/runtime/metadata/route.ts`
- `app/api/runtime/questions/route.ts`
- `app/api/runtime/assessments/route.ts`
- `app/api/reference/disciplines/route.ts`
- `app/lib/baselineLoader.ts`

- [ ] Remove remaining legacy env-name references in errors/messages.
- [ ] Use one shared env parser + validation module.
- [ ] Fail fast on missing required env vars for runtime/corpus/admin paths.

Acceptance checks:
- [ ] No stale `SUPABASE_*` guidance remains where not actually used.
- [ ] Startup/runtime errors point to the correct env keys.

## Phase 7 - Repo Hygiene and Archive Isolation

Targets:
- `.gitignore`
- `tools/_archive/**` (or relocation target outside active workspace)

- [ ] Prevent deep archive recursion from affecting git/status scans.
- [ ] Keep generated/backup/temp files untracked.
- [ ] Ensure active engineering surface is clean for reviews.

Acceptance checks:
- [ ] `git status` does not warn on archive path depth.
- [ ] No generated artifacts are committed accidentally.

## Validation Command Set (Run Before Each Merge)

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run test:admin-security`
- [ ] `npm run test:routes-smoke`

## Suggested Commit Slices

- [ ] `feat(auth): add session-backed admin auth and RBAC`
- [ ] `refactor(admin): centralize admin access and audit policy`
- [ ] `refactor(runtime): split assessments route into services`
- [ ] `refactor(source-registry): consolidate validation and schema checks`
- [ ] `chore(ci): include tools/services in lint and typecheck`
- [ ] `chore(config): normalize env handling and error messaging`
