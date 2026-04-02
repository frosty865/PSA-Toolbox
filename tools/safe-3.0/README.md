# SAFE 3.0 (ALT SAFE)

**Security Assessment for Facilities and Environments** — comprehensive structured assessment UI (HTML/CSS/JSON), sourced from [github.com/frosty865/SAFE3.0](https://github.com/frosty865/SAFE3.0).

## Layout in PSA Toolbox

| Path | Role |
|------|------|
| [`web/`](web/) | **Source** for static files copied into the unified Next app. |
| `dependency-analysis/apps/web/public/safe-3-0/` | **Served** at **`/safe-3-0/`** (see `next.config.js` rewrites). |

Entry files: `index.html` (same content as `ALT_SAFE_Assessment.html`).

## Updating the deployed copy

After changing files under `web/`, copy into the web app public folder (from repo root):

```powershell
robocopy "tools\safe-3.0\web" "tools\dependency-analysis\apps\web\public\safe-3-0" /E
```

Or re-copy from a fresh clone of upstream SAFE3.0 into `web/`, then run the same `robocopy`.

## Registration

Listed in [`tools-manifest.json`](../../tools-manifest.json) as **`safe-3-0`** with `entryPath` **`/safe-3-0/`**.
