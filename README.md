# PSA Toolbox

Unified home for PSA tools: each product lives under `tools/<tool-id>/` as its **own workspace** (separate clone or submodule per tool is supported). The Windows launcher and the **dependency analysis** web app read [`tools-manifest.json`](tools-manifest.json) to list every tool.

**Tools tracked so far (see manifest):**

| Tool | Folder | Role |
|------|--------|------|
| Dependency analysis | [`tools/dependency-analysis/`](tools/dependency-analysis/) | Next.js monorepo (web UI + packages); serves the toolbox landing at `/` and the assessment app under `/assessment/…`. |
| Host V3 | [`tools/host-v3/`](tools/host-v3/) | Placeholder for the Host V3 **repository** — clone or submodule your Host V3 repo into this directory. |

If you still have an old `tools/infrastructure-dependency-assessment/` path on disk from a rename, close editors using it and delete that folder; the canonical path is `tools/dependency-analysis/`.

## Repository layout

| Path | Purpose |
|------|---------|
| `tools/` | One subfolder per tool (own build stack, README, dependencies, often its own Git remote) |
| `launcher/` | WinUI 3 app — browse tools, open folders, start documented entry points |
| `tools-manifest.json` | Machine-readable list of tools for the launcher and web root landing page (`entryPath` / `externalUrl`) |
| `docs/tools-manifest.schema.json` | JSON Schema for the manifest |
| [`shared/cisa_styles.css`](shared/cisa_styles.css) | DHS CISA house styles — import in every web tool’s global CSS entry after base tokens (e.g. `import '../../../../../shared/cisa_styles.css'` from `apps/web/app/layout.tsx`) |

## Requirements

- **Launcher:** Windows 10/11, [.NET](https://dotnet.microsoft.com/) with Windows App SDK (see `launcher/README.md`).
- **Individual tools:** See each tool’s `README.md` (e.g. Node.js, pnpm, optional Python).

## Clone and open the launcher

Requires a .NET SDK with WinUI support (see [`launcher/README.md`](launcher/README.md)).

```powershell
cd "D:\PSA Toolbox"
dotnet build .\launcher\PSA.Toolbox.Launcher\PSA.Toolbox.Launcher.csproj
dotnet run --project .\launcher\PSA.Toolbox.Launcher\PSA.Toolbox.Launcher.csproj
```

## Adding a tool

1. Create `tools/<tool-id>/` with your project.
2. Add an entry to `tools-manifest.json` (see schema in `docs/tools-manifest.schema.json`). For the web UI, set **`entryPath`** (path on this app, e.g. `/my-tool/`) and/or **`externalUrl`** if the tool runs on another origin.
3. Document setup in `tools/<tool-id>/README.md`.

## Remote

Source: [github.com/frosty865/PSA-Toolbox](https://github.com/frosty865/PSA-Toolbox)

## Legacy `PSA IDAT` folder

If you still see `PSA IDAT` at the repo root from an older layout, it is obsolete (tools now live under `tools/`). Close any editor or process using that path, then delete the `PSA IDAT` folder manually. It is listed in `.gitignore` so it will not be committed.
