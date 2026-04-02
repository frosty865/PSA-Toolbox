# PSA Toolbox — shared branding & style guide

All **cross-tool** visual branding and house-style rules live **here** at the repository root (`shared/`), not inside individual `tools/<name>/` folders.

| File | Role |
|------|------|
| [`psa-tokens.css`](psa-tokens.css) | **Design tokens** — `:root` CSS variables (palette, type, spacing, radii, shadows). Import before `cisa_styles.css`. |
| [`cisa_styles.css`](cisa_styles.css) | **CISA house style** — layout shells (e.g. `.site-security-header`, `.cisa-doc`), cards, callouts, tables, buttons. Uses the tokens above. |

## How tools should use this

1. Import **tokens**, then **house styles**, then any app-local CSS:

   ```text
   psa-tokens.css → cisa_styles.css → your/app.css
   ```

2. **Next.js (unified toolbox app):** loads `apps/web/public/tsp-global.css` in `<head>`; `cisa_styles.css` is imported from this folder in `app/layout.tsx`. Dependency analysis and the landing page use the same app and shared styles.

When you change tokens or house rules, edit files in **`shared/`** first, then align any duplicated token blocks in tool-specific bundles if needed.
