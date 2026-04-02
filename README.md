# PSA Toolbox

Monorepo umbrella for PSA tools: **one unified web app** (Next.js in [`tools/dependency-analysis/`](tools/dependency-analysis/)) serves the toolbox landing (`/`), **Dependency analysis** (`/assessment/…`), and **Hotel Analysis** (`/hotel-analysis/`) on **one port**. Product folders live under [`tools/`](tools/). The WinUI launcher reads [`tools-manifest.json`](tools-manifest.json).

| Tool | Web route | Product folder |
|------|-----------|----------------|
| Toolbox shell | `/` | *(layout in dependency-analysis app)* |
| Dependency analysis | `/assessment/…` | [`tools/dependency-analysis/`](tools/dependency-analysis/) |
| Hotel Analysis | `/hotel-analysis/` | [`tools/hotel-analysis/`](tools/hotel-analysis/) |

**Dev:** one command — `pnpm dev` from `tools/dependency-analysis`.

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

## Remote

[github.com/frosty865/PSA-Toolbox](https://github.com/frosty865/PSA-Toolbox)

## Local cleanup (optional)

- **Stale path:** If `tools/infrastructure-dependency-assessment/` still exists next to `tools/dependency-analysis/`, it is obsolete — stop dev servers/editors using it, then delete that folder.
- **Stray root folders:** Keep tools under **`tools/<tool-id>/`** only (e.g. `dependency-analysis`, `hotel-analysis`).
