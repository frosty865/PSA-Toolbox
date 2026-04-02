# Build Debugging Runbook

This document describes how to diagnose and fix build failures in the PSA rebuild project.

## Quick Start

### Windows (PowerShell)

Run from the repository root in Cursor's terminal:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/dev/diagnose_build.ps1
```

### Linux/macOS (Bash)

Run from the repository root:

```bash
bash scripts/dev/diagnose_build.sh
```

## What the Scripts Do

The diagnostic scripts perform the following checks in order:

1. **Print Node/NPM versions** - Ensures environment is set up correctly
2. **Clean build cache** - Removes `.next` directory to ensure fresh build
3. **Run doctrine:check** - Validates doctrine mirror files are present
4. **Run lint** - ESLint with `--max-warnings 0` (fails on any warnings)
5. **Run typecheck** - TypeScript type checking with `tsc --noEmit`
6. **Run build** - Full Next.js production build

All output (stdout and stderr) is captured to a timestamped log file.

## Log Files

Logs are written to: `analytics/reports/build/`

Each run creates a new log file with format: `build_YYYYMMDD_HHMMSS.log`

Example: `build_20260114_153045.log`

## Debugging Process

1. **Run the diagnostic script** using one of the commands above
2. **If it fails**, open the newest log file in `analytics/reports/build/`
3. **Find the first ERROR** in the log (search for "ERROR", "error TS", "Failed", etc.)
4. **Read the error context** - the error message will show:
   - File path and line number
   - Error type (TypeScript error, ESLint error, module not found, etc.)
   - Suggested fix (if available)
5. **Fix ONLY the first error** - don't try to fix multiple errors at once
6. **Re-run the diagnostic script** to verify the fix and find the next error
7. **Repeat** until the build succeeds

## Common Build Failures

### TypeScript Errors

- **Error**: `error TS2307: Cannot find module '...'`
- **Fix**: Check import paths, ensure dependencies are installed (`npm install`)

- **Error**: `error TS2322: Type 'X' is not assignable to type 'Y'`
- **Fix**: Check type definitions, may need to update types or add type assertions

### ESLint Errors

- **Error**: Warnings treated as errors (due to `--max-warnings 0`)
- **Fix**: Fix the linting issue or add appropriate ESLint disable comment if intentional

### Next.js Route Errors

- **Error**: `Export 'X' is not a valid Route export`
- **Fix**: Ensure route handlers export valid HTTP methods (GET, POST, etc.)

- **Error**: Edge runtime incompatible with Node.js modules
- **Fix**: Add `export const runtime = "nodejs";` to route files that use Node-only modules (fs, pg, child_process, etc.)

### Module Resolution Errors

- **Error**: `Module not found: Can't resolve '...'`
- **Fix**: Check import paths, ensure files exist, verify `tsconfig.json` paths configuration

## Build Hardening

All API route handlers in `app/api/runtime/assessments/` have been hardened with:

```typescript
export const runtime = "nodejs";
```

This ensures routes that use Node.js-only modules (PostgreSQL, filesystem, etc.) are not treated as Edge runtime routes, which would cause build failures.

## Client Component Safety

Client components (marked with `"use client"`) should not import server-only modules. If a client component needs server functionality, it should:

1. Make API calls to server routes instead
2. Keep server-only logic in API route handlers
3. Use React Server Components for server-side rendering when appropriate

## Next Steps After Fixing Errors

Once the diagnostic script passes:

1. **Verify the build works**: `npm run build`
2. **Test locally**: `npm run dev`
3. **Commit your fixes** with a clear message describing what was fixed

## Getting Help

If you're stuck on an error:

1. Check the error message carefully - it usually tells you what's wrong
2. Search the codebase for similar patterns
3. Check Next.js documentation for route handler requirements
4. Review TypeScript/ESLint configuration if errors seem incorrect
