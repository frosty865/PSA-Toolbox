# Release tooling

Placeholder for federally-compliant release artifacts. See [DEPLOYMENT.md](../../docs/DEPLOYMENT.md).

## Planned scripts

- **hash-manifest**: SHA-256 for every release artifact (MSIX, zip, SBOM).
- **sbom**: Generate CycloneDX SBOM for JS dependencies (include transitive).
- **release-manifest**: version, build timestamp, git commit, artifact hashes, SBOM filename.
- **sign**: Code-sign MSIX package (requires org certificate).

Run from repo root. Use `npm ci` / `pnpm install --frozen-lockfile` for deterministic builds.
