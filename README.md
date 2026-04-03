# PSA Toolbox

Monorepo umbrella for PSA tools: **one unified web app** (Next.js in [`tools/dependency-analysis/`](tools/dependency-analysis/)) serves the toolbox landing (`/`), **Dependency analysis** (`/assessment/…`), **Hotel Analysis** (`/hotel-analysis/`), **SAFE 3.0** (`/safe-3-0/`), and proxied **Modular Site Assessment** (`/cisa-site-assessment/`) on **one port** (where configured). Product folders live under [`tools/`](tools/). The web landing reads [`tools-manifest.json`](tools-manifest.json).

| Tool | Web route | Product folder |
|------|-----------|----------------|
| Toolbox shell | `/` | *(layout in dependency-analysis app)* |
| Dependency analysis | `/assessment/…` | [`tools/dependency-analysis/`](tools/dependency-analysis/) |
| Hotel Analysis | `/hotel-analysis/` | [`tools/hotel-analysis/`](tools/hotel-analysis/) |
| SAFE 3.0 | `/safe-3-0/` | [`tools/safe-3.0/`](tools/safe-3.0/) |

**Dev:** from the repo root (`D:\PSA Toolbox`), run `pnpm dev` (or `pnpm install:web` then `pnpm dev`). Same commands work from `tools/dependency-analysis` if you prefer.

## Root layout

| Item | Purpose |
|------|---------|
| [`tools-manifest.json`](tools-manifest.json) | Tool list for the web landing (`entryPath` / `externalUrl`) |
| [`tools-manifest.schema.json`](tools-manifest.schema.json) | JSON Schema for the manifest |
| [`shared/`](shared/) | **Branding & style guide** — [`psa-tokens.css`](shared/psa-tokens.css) (design tokens) and [`cisa_styles.css`](shared/cisa_styles.css) (house layout/components); see [`shared/README.md`](shared/README.md) |
| [`LICENSE`](LICENSE) | License |

## Add a tool

1. Add `tools/<tool-id>/` (your project).
2. Register it in [`tools-manifest.json`](tools-manifest.json) (schema: [`tools-manifest.schema.json`](tools-manifest.schema.json)). Set **`entryPath`** and/or **`externalUrl`** for the web UI when applicable.
3. Add `tools/<tool-id>/README.md`.

## Remove or deprecate a tool

Other tools under **`tools/`** are optional: they are **not** part of the `dependency-analysis` pnpm workspace, so removing a folder does not break the Next.js install/build. Update **`tools-manifest.json`** and run `pnpm sync:manifest` (see [`docs/removing-a-tool.md`](docs/removing-a-tool.md)). `pnpm verify:tools` checks manifest paths exist on disk.

## Remote

[github.com/frosty865/PSA-Toolbox](https://github.com/frosty865/PSA-Toolbox)

**Vercel:** Set the project **Root Directory** to **`tools/dependency-analysis/apps/web`** (required — that is where `next.config.js` lives). Config: [`tools/dependency-analysis/apps/web/vercel.json`](tools/dependency-analysis/apps/web/vercel.json). For **Modular Site Assessment** behind `/cisa-site-assessment/`, deploy `tools/cisa-site-assessment` separately and set **`PSA_SITE_ASSESSMENT_ORIGIN`** on the toolbox project. See [`docs/vercel.md`](docs/vercel.md).

**Hosted DOCX print service:** The production reporter now lives in the standalone repo [`https://github.com/frosty865/PSA-report-service`](https://github.com/frosty865/PSA-report-service). Set `REPORT_SERVICE_URL` in Vercel to the Railway public URL for that repo.

## Local cleanup (optional)

- **Stale path:** If `tools/infrastructure-dependency-assessment/` still exists next to `tools/dependency-analysis/`, it is obsolete — stop dev servers/editors using it, then delete that folder.
- **Stray root folders:** Keep tools under **`tools/<tool-id>/`** only (e.g. `dependency-analysis`, `hotel-analysis`).
