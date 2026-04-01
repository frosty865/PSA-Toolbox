# Asset Dependency Assessment Tool — Release

## Supported environment

- **OS**: Windows 10 / Windows 11
- **Mode**: Offline only. No telemetry, no network calls except local file operations where applicable.
- **Runtime**: Deploy the production Next.js build (Node.js 18+). Serve via `pnpm --filter web start` or an equivalent process manager.

## No persistence

- The tool **does not store assessment data or revision packages on disk** beyond the current session.
- All session state is in-memory. Closing the app discards it.
- **Temp files** are used only during export (reporter working directory). They are deleted immediately after each export and again on purge.

## Temp file location

- **Primary temp area**: `data/temp` under the application directory (or repo root in dev). Each export uses a new subdirectory (UUID); the directory is removed in a `finally` block after the export response.
- **OS temp**: If the app or reporter uses the system temp dir, any directories or files with the prefix **`PSA-IDA-`** are treated as crash leftovers and are removed by the purge sweep.

## Purge behavior

- **On startup**: A full purge runs (delete all under `data/temp`, and any `PSA-IDA-*` under the OS temp directory).
- **After every export**: The export route deletes its own work directory; then a full purge runs to clear any remaining temp and crash leftovers.
- **On import failure**: After a failed revision package import, a full purge runs so no partial or stale temp data remains.

Purge **only** touches:

1. The configured `data/temp` path.
2. OS temp entries whose name starts with `PSA-IDA-`.

No other paths are modified.

## Revision package handling

- **Export (draft)**: User enters a passphrase (min 12 characters). The app produces a ZIP containing the report DOCX and an encrypted revision package. The revision package is not written to disk by the tool; the user saves the ZIP via the save dialog.
- **Import**: User selects a revision package file (or a ZIP containing it) and enters the passphrase. The app decrypts, validates, and loads the assessment into memory. The file is read once and not retained. On success or failure, purge runs.

## Update procedure

- **Replace the app folder**: To update, replace the entire application directory (e.g. the folder containing `AssetDependencyTool.exe` and `resources/`) with the new build. There is no in-app updater; no persistent update state.

## Release artifact layout

After running `pnpm run build:web`, the production bundle resides in `apps/web/.next` and static assets remain under `apps/web/public`. Install production dependencies in the deployment environment from the repository root (`pnpm install --prod`) and start the server with `pnpm --filter web start`.

## Template anchor placement policy

Required anchors must be placed **intentionally** in the production DOCX template at the correct sections. We do **not** rely on dev-injected anchors for production.

**Placement:**

- **[[TABLE_SUMMARY]]** — under the "Summary" section header
- **[[CHART_ELECTRIC_POWER]]** — under "Electric Power"
- **[[CHART_COMMUNICATIONS]]** — under "Communications"
- **[[CHART_INFORMATION_TECHNOLOGY]]** — under "Information Technology"
- **[[CHART_WATER]]** — under "Water"
- **[[CHART_WASTEWATER]]** — under "Wastewater"
- **[[TABLE_VOFC]]** — under "Vulnerabilities / Options for Consideration" (or equivalent) section

**Rules for each anchor:**

- On its **own paragraph** (no other text on the same line)
- **Not** in header, footer, or text box
- **Not** surrounded by other text
- **Unique** — exactly one occurrence in the document

Validate before release: `pnpm template:check`

## Build / version

- **TOOL_VERSION**: From schema (or env `TOOL_VERSION`) at build time.
- **TEMPLATE_VERSION**: Fixed in code (e.g. `v1`).
- **BUILD_ID**: Git short SHA when building from source; otherwise `dev`.
