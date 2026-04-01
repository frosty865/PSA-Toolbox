# Reporter API

HTTP service for DOCX report generation. Deploy to Railway, Render, or any Python host to enable DOCX export on the Beta site (Vercel).

## Deploy to Railway (recommended)

1. Go to [railway.app](https://railway.app) and create a project.
2. Connect your GitHub repo.
3. **Root Directory**: Set to `asset-dependency-tool` (or the folder containing `apps/reporter` and `ADA/`).
4. **Build**: Railway auto-detects Python. Ensure `services/reporter-api/requirements.txt` is used:
   - Add build command: `pip install -r services/reporter-api/requirements.txt`
   - Or add a `nixpacks.toml` at repo root if needed.
5. **Start Command**: `cd services/reporter-api && gunicorn -w 1 -b 0.0.0.0:$PORT --timeout 120 app:app`
6. Deploy. Copy the public URL (e.g. `https://your-app.up.railway.app`).
7. In Vercel (Beta site): **Settings → Environment Variables** → Add:
   - `REPORT_SERVICE_URL` = `https://your-app.up.railway.app` (no trailing slash)
   - Redeploy the web app.

**Template updates**: The DOCX template is `ADA/report template.docx` in the repo. After changing it, redeploy the Reporter API (Railway/Render) so the service picks up the new file; the Vercel app only forwards the payload and does not serve the template.

## Deploy to Render

1. Create a new Web Service.
2. Connect repo, set **Root Directory** to `asset-dependency-tool`.
3. **Build Command**: `pip install -r services/reporter-api/requirements.txt`
4. **Start Command**: `cd services/reporter-api && gunicorn -w 1 -b 0.0.0.0:$PORT --timeout 120 app:app`
5. Add `REPORT_SERVICE_URL` to Vercel as above.

## API

- `GET /` — quick ok
- `GET /health` — health check
- `GET /warmup` — preload reporter module (call after deploy or on a cron so first `/render` is fast)
- `POST /render` — JSON payload (same as `export/final`), returns DOCX bytes

## Timeouts and cold start

If the container is killed a few seconds after start (e.g. "Handling signal: term"), the **host request timeout** is likely too short. The first `/render` loads the reporter (large Python module) and can take 5–15s; if the host (Render/Railway) has a 5–15s request limit, it will close the connection and the container may be terminated.

- **Fix**: In Render or Railway, increase the **request timeout** (e.g. to 120 seconds) in the service settings.
- **Warmup**: The app preloads the reporter in a background thread at startup. You can also call `GET /warmup` after deploy (or on a cron) so the first real export is fast.

## Local test

```bash
cd asset-dependency-tool
pip install -r services/reporter-api/requirements.txt
cd services/reporter-api && python app.py
# POST http://localhost:8080/render with export payload
```
