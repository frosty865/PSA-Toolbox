# Packaging Plan (Web Deployment)

This document captures the proposed packaging workflow for delivering the Asset Dependency Assessment Tool as a web-only solution. Do not implement changes without product approval.

## Goals

- Provide a reproducible build of the Next.js application suitable for deployment in controlled networks.
- Bundle the Python reporter tool as a compiled executable so report generation functions on the server without a Python installation dependency.
- Ship a single archive that contains everything required to run the web server and reporter on an endpoint with Node.js 18+.

## Next.js bundle

1. Install dependencies from the repository root: `pnpm install`.
2. Build production assets: `pnpm run build:web`.
3. Collect required files for distribution:
   - `apps/web/.next/`
   - `apps/web/public/`
   - Root-level `package.json`, `pnpm-lock.yaml`, and `.npmrc` (if present) to guarantee deterministic installs.
4. Package these files into `asset-dependency-tool_web_<version>.zip` for distribution.

## Reporter executable

- Build the reporter with PyInstaller (`apps/reporter/build.ps1`).
- Output artifact: `reporter.exe` located under `apps/reporter/dist/`.
- Include `reporter.exe` in the release zip and document the expected directory layout (`resources/reporter.exe`).

## Combined distribution layout

```
asset-dependency-tool_web_<version>/
  package.json
  pnpm-lock.yaml
  apps/
    web/
      .next/
      public/
      package.json
  resources/
    reporter.exe
    template.docx
```

## Installation outline

1. Unzip release contents to the target directory.
2. Run `pnpm install --prod` from the repository root.
3. Launch the app with `pnpm --filter web start` (suggest wrapping with a service or scheduled task for resilience).
4. Reporter usage is driven by the web application; keep `resources/` colocated with the server process.

## Standalone ADT (no installs, path-agnostic)

A separate **ADT** (Asset Dependency Tool) project provides a standalone layout for Federal Government laptops: no user installs or admin rights, and the tool runs from any folder (e.g. `C:\ADT` or `D:\Tools\ADT`).

- **App root**: Set `ADT_APP_ROOT` (or `ADT_ROOT`) to the ADT folder; the app resolves `resources/`, `data/`, template, reporter, and VOFC paths from that root.
- **Layout**: `ADT/app/` (built Next.js + node_modules), `ADT/resources/` (reporter.exe, template, VOFC_Library.xlsx), `ADT/data/`, and launchers `Start-ADT.ps1` / `Start-ADT.bat`.
- **Packaging**: From this repo run `scripts/package-adt.ps1` (optionally with `-AdtPath` or `ADT_PACKAGE_PATH`) to copy build artifacts into the ADT folder. Then run `npm install --production` in `ADT/app/`. Optionally add portable Node under `ADT/runtime/node` for zero-install.

See the ADT folder (e.g. `C:\ADT`) README and DEPLOYMENT.md for run and build steps.

## Open questions

- Should the distribution include a preconfigured process manager (e.g., NSSM script or systemd unit)?
- Do we need a signed installer wrapper, or is the zip sufficient for internal deployment?
- Is a Docker image preferred for certain environments?
