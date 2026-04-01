# Host V3

Standalone **Vite + React** app (port **3001**, loopback only). Dependency analysis runs separately on port **3000**.

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) (`corepack enable pnpm` or install globally)

## Development

```powershell
cd tools\host-v3
pnpm install
pnpm dev
```

Open **http://127.0.0.1:3001/**

Or from repo root:

```powershell
.\tools\host-v3\Start-HostV3.ps1
```

## PSA Toolbox integration

- [`../../tools-manifest.json`](../../tools-manifest.json) lists Host V3 with **`externalUrl`** `http://127.0.0.1:3001/` so the toolbox landing page (dependency-analysis app on :3000) opens Host in a new tab — **only while this dev server is running**.
- WinUI launcher: **Start** runs `Start-HostV3.ps1`.

## Production build

```powershell
pnpm run build
pnpm run preview
```

Deploy **`dist/`** to any static host (S3, Azure Static Web Apps, etc.) or add a `vercel.json` / pipeline for this folder. Update **`externalUrl`** in `tools-manifest.json` to your production URL when known.

## Replacing this scaffold

Drop in your real Host V3 UI and routes under `src/`. Keep `vite.config.ts` port **3001** for local parity with the manifest, or change the port and update `tools-manifest.json` and this README.
