# PSA Toolbox

Monorepo umbrella for PSA tools: **one unified web app** (Next.js in [`tools/dependency-analysis/`](tools/dependency-analysis/)) serves the toolbox landing (`/`), **Dependency analysis** (`/assessment/…`), **Hotel Analysis** (`/hotel-analysis/`), **SAFE 3.0** (`/safe-3-0/`), and proxied **Modular Site Assessment** (`/cisa-site-assessment/`) on **one port** (where configured). Product folders live under [`tools/`](tools/). The WinUI launcher reads [`tools-manifest.json`](tools-manifest.json).

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
| [`tools-manifest.json`](tools-manifest.json) | Tool list for launcher + web landing (`entryPath` / `externalUrl`) |
| [`tools-manifest.schema.json`](tools-manifest.schema.json) | JSON Schema for the manifest |
| [`shared/`](shared/) | **Branding & style guide** — [`psa-tokens.css`](shared/psa-tokens.css) (design tokens) and [`cisa_styles.css`](shared/cisa_styles.css) (house layout/components); see [`shared/README.md`](shared/README.md) |
| [`launcher/`](launcher/) | WinUI 3 launcher — open folders, run documented start scripts |
| [`LICENSE`](LICENSE) | License |

## Launcher (.NET / WinUI)

See [`launcher/README.md`](launcher/README.md).

```powershell
cd "D:\PSA Toolbox"
dotnet build .\launcher\PSA.Toolbox.Launcher\PSA.Toolbox.Launcher.csproj
dotnet run --project .\launcher\PSA.Toolbox.Launcher\PSA.Toolbox.Launcher.csproj
```

## Add a tool

1. Add `tools/<tool-id>/` (your project).
2. Register it in [`tools-manifest.json`](tools-manifest.json) (schema: [`tools-manifest.schema.json`](tools-manifest.schema.json)). Set **`entryPath`** and/or **`externalUrl`** for the web UI when applicable.
3. Add `tools/<tool-id>/README.md`.

## Remove or deprecate a tool

Keep **`tools-manifest.json`** and [`tools/dependency-analysis/pnpm-workspace.yaml`](tools/dependency-analysis/pnpm-workspace.yaml) in sync with folders on disk (see [`docs/removing-a-tool.md`](docs/removing-a-tool.md)). From the repo root, `pnpm verify:tools` checks that manifest paths and workspace entries exist.

## Remote

[github.com/frosty865/PSA-Toolbox](https://github.com/frosty865/PSA-Toolbox)

**Vercel:** Set the project **Root Directory** to **`tools/dependency-analysis`** (required). Config lives in [`tools/dependency-analysis/vercel.json`](tools/dependency-analysis/vercel.json). See [`docs/vercel.md`](docs/vercel.md).

## Local cleanup (optional)

- **Stale path:** If `tools/infrastructure-dependency-assessment/` still exists next to `tools/dependency-analysis/`, it is obsolete — stop dev servers/editors using it, then delete that folder.
- **Stray root folders:** Keep tools under **`tools/<tool-id>/`** only (e.g. `dependency-analysis`, `hotel-analysis`).
