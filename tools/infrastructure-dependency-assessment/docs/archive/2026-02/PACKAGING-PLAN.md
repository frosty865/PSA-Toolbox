# Packaging Plan

Overview of packaging requirements for delivering the Asset Dependency Assessment Tool to customers or internal stakeholders.

## Objectives

- Ensure reproducible builds and releases.
- Provide tamper-evident artifacts.
- Minimize manual steps in the packaging process.

## Build inputs

- Git commit hash identifying the release.
- `pnpm-lock.yaml` for dependency reproducibility.
- `apps/web/.env.production` (or secure configuration secret).
- Documentation version tag.

## Build process

1. Fetch repository at tagged commit.
2. Run `pnpm install --frozen-lockfile`.
3. Execute `pnpm run build:web`.
4. Collect artifacts:
   - `apps/web/.next` build output.
   - `apps/web/public` static assets.
   - `apps/web/package.json` and `pnpm-lock.yaml`.

## Packaging formats

- **ZIP archive** — Single zip containing build output, static assets, and package metadata.
- **Executable bundle (optional)** — If distributing with embedded runtime, wrap with `pkg` or equivalent (not currently standard).
- **Docker image** — `FROM node:18-alpine`, copy repository, run build, expose port 3000.

## Verification

- Generate SHA-256 hashes for each artifact and store in `release-manifest.json`.
- Validate hashes post-transfer using PowerShell `Get-FileHash` (Windows) or `shasum -a 256` (macOS/Linux).
- Ensure SBOM generated via `pnpm exec cyclonedx-bom --output sbom.json`.

## Distribution

- Publish artifacts to internal release channel (SharePoint, S3, or artifact repository).
- Provide release notes referencing the commit hash and hash manifest.
- Notify stakeholders with installation instructions and validation steps.

## Operational checklist

- [ ] Verify build on clean environment.
- [ ] Confirm `.env` values injected in production runtime.
- [ ] Smoke-test deployed bundle before distribution.
- [ ] Archive packaging logs and manifests.
