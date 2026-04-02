# Archived Admin API Routes

Routes here are **deprecated** and no longer served by the app. They are kept for reference or possible future restoration.

| Route | Reason | Replacement |
|-------|--------|-------------|
| `GET /api/admin/status` | Proxied to Flask backend; app is consolidated and no longer uses Flask for status | `GET /api/runtime/assessments` (filter/aggregate by status in client) |

**Restore:** Move the `route.ts` from the corresponding subfolder back to `app/api/admin/<path>/route.ts`.
