# Security & Compliance

This document defines the security baseline for the Asset Dependency Assessment Tool in its federally-compliant web deployment.

## Offline by default

- **Web**: The application is built as a static site. No backend or server is required. It can be hosted on an internal web server or opened from the filesystem (`file://`). All assets (HTML, JS, CSS, fonts, data) are bundled or cached locally.

## No remote network calls

- The application does **not** initiate outbound HTTP/HTTPS requests to the internet or to internal APIs for application logic.
- No telemetry, analytics, update checks, or external font/CDN requests.

## No macros (XLSM unsupported)

- **Macros are not used.** Excel workbooks with VBA/macros (`.xlsm`) are not part of the supported workflow.
- Outputs are limited to formats that do not execute code: PDF, JSON, CSV, and optionally DOCX with **template fill only** (no fields/macros, no active content).

## Outputs

| Format | Role | Notes |
|--------|------|--------|
| **PDF** | Primary report | Generated via print CSS and browser print/export or client-side PDF library. No server. |
| **JSON** | Canonical data | Full assessment + computed outputs (curves, VOFCs). Export/import for backup and portability. |
| **CSV** | Optional | Vulnerability/OFC tables for downstream analysis. |
| **DOCX** | Optional | Client-side templated fill only. No macros, no active content. |

## Data handling

### Local storage

- Assessment data may be stored in `localStorage` for the session. Users can export canonical JSON and optionally clear local data.

### Wipe local data

- The app provides an explicit **“Wipe local data”** action that clears relevant `localStorage` keys.

### No sensitive content in logs

- Application logs must not contain assessment content, PII, or other sensitive data.
- **Export diagnostics** (if offered for support) must **redact** any sensitive or assessment-specific content before export.

## Deprecations (not in scope)

- XLSM/VBA or any “macro-required” workflow.
- Localhost API calls (Node/Next server routes for app logic).
- Python (or other) scripts used to generate reports/charts at runtime.
- External CDNs, fonts, analytics, or update checks.

## Summary

Federally-compliant posture: **deny by default**, minimal attack surface, offline-first, no macros, and auditable build artifacts (see [DEPLOYMENT.md](./DEPLOYMENT.md)).
