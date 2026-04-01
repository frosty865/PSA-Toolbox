# Infrastructure Dependency Assessment — PSA local edition

**Infrastructure Dependency Assessment (IDA)** for structured dependency review, continuity conditions, and export artifacts. This tree is part of [PSA Toolbox](../../README.md) and is intended for **standard-user** laptops (no admin required for runtime when Node.js and optional Python are already approved).

## Setup

Install workspace dependencies:

```powershell
cd tools\infrastructure-dependency-assessment
pnpm install
```

### Optional: DOCX export (Python reporter)

Use a **user** virtual environment under this folder:

```powershell
cd tools\infrastructure-dependency-assessment
py -3 -m venv .venv
.\.venv\Scripts\pip install -r apps\reporter\requirements.txt
```

Prefer the Python reporter on locked-down hosts (see `apps/web/app/api/export/final/route.ts`); set `ADA_USE_PYTHON_REPORTER=1` if you want to force Python over a packaged executable.

## Development

```powershell
cd tools\infrastructure-dependency-assessment
pnpm dev
```

## Production build

```powershell
pnpm run build:web
```

## Run locally (production server)

After a successful `build:web`, start the app with the bundled launcher (sets **`ADT_ROOT`** / **`ADT_APP_ROOT`** to the monorepo root for template and reporter paths):

```powershell
cd tools\infrastructure-dependency-assessment
.\Start-PsaIda.ps1
```

Open **http://127.0.0.1:3000/** (override port with `$env:PORT="8080"` before running).

## Release artifacts

For internal distribution, follow [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md): version + changelog, zip of the built tree with `pnpm-lock.yaml`, SHA-256 manifest, optional SBOM.

## Provenance

Derived from the Infrastructure Dependency Assessment product codebase; rebranded for **PSA Toolbox** local use (see `apps/web` metadata, `public/psa-logo.svg`, and design tokens in `tsp-global.css` / `ida-design-system.css`).
