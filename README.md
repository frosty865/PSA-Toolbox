# PSA Toolbox

Monorepo umbrella for PSA tools: each product is a **separate folder under [`tools/`](tools/)** (and typically its own Git history). The WinUI launcher and the dependency-analysis web app read [`tools-manifest.json`](tools-manifest.json) for the tool list and entry points.

| Tool | Location |
|------|----------|
| Dependency analysis | [`tools/dependency-analysis/`](tools/dependency-analysis/) — Next.js app (landing `/`, assessment under `/assessment/…`) |
| Host V3 | [`tools/host-v3/`](tools/host-v3/) — clone your Host V3 repository here (or use a submodule) |

## Root layout

| Item | Purpose |
|------|---------|
| [`tools-manifest.json`](tools-manifest.json) | Tool list for launcher + web landing (`entryPath` / `externalUrl`) |
| [`tools-manifest.schema.json`](tools-manifest.schema.json) | JSON Schema for the manifest |
| [`shared/cisa_styles.css`](shared/cisa_styles.css) | Shared CISA house styles (import from web tools after base CSS) |
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
- **Stray root folders:** Do not create tools under a second `Host V3` or `PSA IDAT` at repo root; use **`tools/host-v3/`** and **`tools/dependency-analysis/`** only.
