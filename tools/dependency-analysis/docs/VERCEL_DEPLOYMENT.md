# Vercel deployment (monorepo)

The Next.js app lives in **`apps/web`**. Use the **Root Directory** approach so Vercel finds **`.next`** in the app folder.

## Required: set Root Directory

1. In Vercel: **Project Settings → General → Root Directory**.
2. Set to **`apps/web`** (if your repo root is **`asset-dependency-tool`**) or **`asset-dependency-tool/apps/web`** (if your repo root is **`ADA`** or the parent of **`asset-dependency-tool`**).
3. Save. Vercel will use **`apps/web/vercel.json`**, which runs install and build from the monorepo root so workspace packages are built; output stays in **`apps/web/.next`** and Vercel finds it.

No need to change **Output Directory** (leave as `.next`).

## DOCX export on Beta (Vercel)

Vercel cannot run Python. To enable DOCX export on the deployed site:

1. Deploy the **Reporter API** to Railway or Render (see **`services/reporter-api/README.md`**).
2. In Vercel: **Settings → Environment Variables** → Add `REPORT_SERVICE_URL` = your Reporter API URL (e.g. `https://your-app.up.railway.app`).
3. Redeploy the web app.

## Optional

- **Include source files outside of the Root Directory**: Enable in Build Settings if the build must access files outside **`apps/web`**.
