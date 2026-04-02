# Infrastructure Dependency Tool (IDT)

Monorepo: schema, engine, web app (Next.js), Python DOCX reporter.

**Modes:** *Field* — static export `apps/web/out/` (`pnpm run build:web:field` or `pnpm run verify:field-bundle`), no Node on end users. *Dev/IT-hosted* — `next dev` / `next start` + Python for DOCX.

## Delivery models (choose per program)

| Path | Analyst machine | DOCX | Notes |
|------|-----------------|------|--------|
| **A — Hosted URL** | Browser only | Yes | Deploy full stack (Next + Python reporter); users open the HTTPS app. Same as internal `next start` + reporter. |
| **B — Static `out/`** | Browser only | No (default) | Ship `apps/web/out/` from an internal static host; final export is canonical JSON; draft ZIP and revision crypto stay in-browser. |
| **B + hybrid** | Browser only | Optional | Build field bundle with `NEXT_PUBLIC_FIELD_EXPORT_BASE_URL` pointing at a **trusted** hosted IDT that serves `/api/export/final`. Hosted app must set `FIELD_EXPORT_CORS_ORIGIN` or `FIELD_EXPORT_CORS_ORIGINS` to the static site origin. **Security / ATO required** before sending assessment JSON cross-origin. |

Release CI builds the field bundle on version tags and uploads `apps/web/out` as a workflow artifact (see `.github/workflows/field-bundle-release.yml`).

### Assessment data flow (ATO / network)

- **Hosted (A):** The browser talks only to the same IT-hosted origin; assessment and report payload stay within that trust zone (TLS as configured).
- **Static JSON (B):** No assessment POST to your servers for final export; data remains in the browser until the user saves JSON or encrypted packages locally.
- **Hybrid (B + hybrid):** Final export POSTs the assessment (and energy/dependency sections as today) to the configured export base URL. Document encryption in transit, retention, who may operate the export service, and whether outbound access from the static host is permitted under your authorization boundary.

### Container deploy (Railway / internal)

From `asset-dependency-tool/`: `docker build -t idt .` then run with `IDT_APP_ROOT=/app` and a production template at `ADA/report template.docx` (bake or volume). `railway.toml` uses this Dockerfile when the Railway service root is this directory. Python runs from `/app/.venv` with `apps/reporter/requirements.txt`.

## Dev rules (quick)

- No DB; session mostly in-memory; optional encrypted revision export/import.
- Purge on export/startup where applicable; deterministic report outputs.
- DOCX from the template in `assets/templates/`.

## Layout

- `apps/web` — Next.js app  
- `apps/reporter` — Python → DOCX  
- `packages/schema`, `engine`, `ui`, `security` — shared libraries  

## Quick start (Windows)

1. `pnpm install` (npm blocked by `preinstall`).
2. `.\scripts\dev\bootstrap.ps1` — deps, dirs, template check, Python hint.
3. `.\scripts\dev\start.ps1` — dev server, `ADA_WORK_ROOT` / `ADA_TEMPLATE_PATH`.
4. http://localhost:3000 — New Assessment → export.

Assets: `assets/templates/Asset Dependency Assessment Report_BLANK.docx`; optional workbook under `assets/workbooks/`. VOFC library: `assets/data/VOFC_Library.xlsx` (or `VOFC_LIBRARY_PATH`).

## Scripts (root)

- `pnpm run verify:field-bundle` — full web build + static `out/` for field.
- `pnpm run build:web:field` — static `out/` only (packages must already be built).
- `pnpm run check:field-drift` — client `/api/` drift vs `scripts/field-drift-baseline.json`.
- `pnpm run build:web` — production Next build.
- `pnpm template:check` — template anchors.
- `pnpm run template:write-manifest` — writes `apps/web/public/template-anchor-manifest.json` for field static (also runs automatically before field static `next build`).

## Field users

Ship `apps/web/out/` from an internal HTTPS static host. Do not set `FIELD_STATIC_EXPORT=1` for a normal IT `next build` unless you intend static export. Field bundle uses in-browser JSON export unless you set **`NEXT_PUBLIC_FIELD_EXPORT_BASE_URL`** at field build time (hybrid DOCX; see table above).

**Field personnel (end users):** plain-language steps ship in the bundle as `apps/web/public/FIELD_PERSONNEL_INSTRUCTIONS.txt` (copied to `out/`). IT can hand out the zip or a copy of that file with the artifact.

Field builds run **`pnpm run template:write-manifest`** (via `build-field-static`) to emit `template-anchor-manifest.json` into `apps/web/public/`. If no DOCX template is present at build time, the manifest is **unverified** and template readiness stays permissive; with a template present, anchors must match `REQUIRED_TEMPLATE_ANCHORS` exactly once or the build fails.

### Field bundle troubleshooting (“blank page” / “nothing works”)

1. **Field static output is built for `file://`:** after `next export`, `rewrite-field-static-for-file.mjs` rewrites root-absolute `/_next/...` URLs to relative paths, patches the Turbopack runtime, and injects `data-idt-out-depth` on `<html>`. Open **`apps/web/out/index.html`** from disk (double-click or File → Open) — **no Python, Node, or web server** is required for end users. See `FIELD_DEPLOY_README.txt` inside `out/`.
2. **Subpath HTTPS hosting** (e.g. `https://intranet/sites/idt/`): rebuild with `FIELD_STATIC_BASE_PATH=/sites/idt` (leading slash; no trailing slash). Disk (`file://`) use normally stays on the default build without a base path.
3. **Strict Content-Security-Policy** on a reverse proxy can block Next.js inline hydration scripts. Allow `script-src` `'unsafe-inline'` for these files, or omit CSP for this static tree.
4. **Do not keep another process holding files under `apps/web/out` open** while rebuilding on Windows — the folder can be locked (`EBUSY`) during export.

`pnpm run verify:field-bundle` runs a **smoke check** (Node-only local HTTP server + asserts relative chunk paths in `index.html`).

## Reporter (Python)

`cd apps/reporter` → `pip install -r requirements.txt`. Export calls `main.py` by default. Optional: `ADA_REPORTER_EXE` for a signed exe.

## Workspaces

pnpm workspaces — use **pnpm** only.
