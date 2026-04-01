# Deployment

This document covers deployment of the Asset Dependency Assessment Tool as a web-only, offline-capable Next.js application.

## PSA Toolbox local (standard user, loopback)

From this monorepo folder, use [`Start-PsaIda.ps1`](../Start-PsaIda.ps1) after `pnpm install` and `pnpm run build:web`. The script sets **`ADT_ROOT`** / **`ADT_APP_ROOT`** to the monorepo root so export and template paths resolve correctly. The server binds to **127.0.0.1** only. Release artifacts (hashes, SBOM) follow the **Release artifacts and hashes** section below.

## Production build workflow

1. Install dependencies from the repository root:
   - `pnpm install`
2. Generate the production bundle:
   - `pnpm run build:web`
3. Provide any required environment configuration (for example `.env.production` mirrored to `apps/web/.env.local`).
4. Start the production server with Node.js 18 or newer:
   - `pnpm --filter web start`

The build artifacts live in `apps/web/.next` and static assets ship from `apps/web/public`. The `start` script runs `next start`, which serves both the UI and the `/api/*` routes used for export, VOFC, and revision import.

## Hosting models

### Self-hosted Node runtime

- Use a process manager such as `pm2`, systemd, or Windows NSSM to run `pnpm --filter web start` under `NODE_ENV=production`.
- Keep `apps/web/.next`, `apps/web/public`, and `apps/web/package.json` together. The monorepo root `pnpm-lock.yaml` is required for reproducible installs.
- For containerized deployment, copy the repository root into the image, run `pnpm install --prod`, then `pnpm run build:web` followed by `pnpm --filter web start` in the container entrypoint.

## Vercel deployment

1. Link the repository (`vercel link`) and choose the project.
2. Set **Framework Preset** to **Other** so custom commands run.
3. Use the configuration in `vercel.json` at the repo root:
   - Install Command: `pnpm install`
   - Build Command: `pnpm run build`
   - Output Directory: `apps/web/.next`
4. If the repository is nested (e.g., `tools/dependency-analysis`), set the **Root Directory** accordingly in Project Settings.
5. Deploy with `vercel --prod` (or plain `vercel` for preview).

## Release artifacts and hashes

For internal distribution, publish:

| Artifact | Description |
|----------|-------------|
| **Release manifest** | Version, build timestamp, git commit, list of artifact filenames, SHA-256 hashes, and SBOM filename. |
| **SBOM** | CycloneDX (or equivalent) Software Bill of Materials for JavaScript dependencies. |
| **Hash manifest** | SHA-256 for each artifact (e.g., zipped Next.js build, SBOM). |

Example hash verification on Windows:

```powershell
Get-FileHash -Algorithm SHA256 .\asset-dependency-tool_web_1.0.0.zip
```

## Operational checks

- [ ] Runs with Node.js 18+ without administrative privileges.
- [ ] No outbound network connectivity required (verify under firewall restrictions).
- [ ] No macros or executable content in generated reports.
- [ ] Production bundle and release artifacts are signed/hashed per organizational policy.
- [ ] Works under constrained user profiles (limited write access to working directories only).
