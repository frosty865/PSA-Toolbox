# Host V3

This directory is the **local workspace for the Host V3 tool** — its own product line, separate from [dependency analysis](../dependency-analysis/).

## Source repository

Host V3 should live in **its own Git repository**. Typical setup:

1. Create or use your Host V3 remote (for example `https://github.com/frosty865/Host-V3`).
2. Clone it **into this folder** (replace the placeholder content), or add it as a **submodule** from the PSA Toolbox repo root:

   ```powershell
   cd "D:\PSA Toolbox"
   git submodule add https://github.com/YOUR_ORG/YOUR-host-v3-repo.git tools/host-v3
   ```

3. Add or adjust the `host-v3` entry in [`../../tools-manifest.json`](../../tools-manifest.json): set **`entryPath`** (if this app is served by the same Next server) and/or **`externalUrl`** (if it runs on another port or host), then restart the dev server.

## After clone

- Install and run using that repo’s README (Node, .NET, etc.).
- Ensure the toolbox landing page lists Host V3 via `tools-manifest.json` (already stubbed).
