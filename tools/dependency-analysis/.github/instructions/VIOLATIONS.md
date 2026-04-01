# Forbidden Terms Cleanup - Violations Found

**Execution date:** February 14, 2026  
**Script:** `scripts/guard-terms.ps1`  
**Status:** ❌ VIOLATIONS DETECTED (10 files, 25+ instances)

---

## Violations by File

### 1. `/ADA/NARRATIVE_REPORT_IMPLEMENTATION.md`
- **Line 101**: `✅ **Offline/Standalone** - No external APIs required`
- **Line 212**: `- ✅ All data embedded (offline/standalone compatible)`
- **Action**: Remove/rewrite; this is legacy architecture doc for abandoned product

### 2. `/ADA/asset-dependency-tool/apps/web/REVIEW_EXPORT_IMPLEMENTATION.md`
- **Line 188**: `| Offline/standalone compatible | ✅ | No external dependencies required |`
- **Action**: Remove row from table; WEB-ONLY has no offline mode

### 3. `/ADA/asset-dependency-tool/scripts/export_dependency_vofc_to_sheet.ts`
- **Line 4**: `* Creates data/DEPENDENCY_VOFC_LOCAL.xlsx (standalone workbook) for import into`
- **Line 65**: `'  OR keep data/DEPENDENCY_VOFC_LOCAL.xlsx as standalone; seed script reads from it.'`
- **Action**: These are OK (referring to data workbooks, not app architecture). Update comments to remove "standalone" language, say "local xlsx file" instead.

### 4. `/ADA/asset-dependency-tool/scripts/seed_dependency_vofc_from_xlsm.ts`
- **Line 5**: `*         OR: data/DEPENDENCY_VOFC_LOCAL.xlsx (standalone sheet workbook)`
- **Line 24**: `const STANDALONE_XLSX_PATH = path.join(REPO_ROOT, 'data', 'DEPENDENCY_VOFC_LOCAL.xlsx');`
- **Lines 164, 166, 222**: `loadFromStandaloneXlsx()` function
- **Action**: Rename function/variable from `standalone` to `local` (e.g., `loadFromLocalXlsx`, `LOCAL_XLSX_PATH`). Update comments.

### 5. `/ADA/asset-dependency-tool/apps/web/lib/platform/runtime.ts`
- **Line 3**: `* Safe to call in browser and in SSR (returns false for standalone when window is undefined).`
- **Line 13**: `* Legacy standalone check. Always returns false now that the desktop shell has been removed,`
- **Line 16**: `export function isStandalone(): boolean {`
- **Line 23**: `return !isStandalone();`
- **Action**: DELETE entire file or comment out export. This is legacy desktop app code. The `isStandalone()` function should not exist in WEB-ONLY app.

### 6. `/ADA/asset-dependency-tool/apps/web/lib/platform/apiBase.ts`
- **Line 3**: `* web and standalone stay in parity (same-origin in both; override via env if needed).`
- **Line 9**: `* - Standalone: '' when loading from the same Next server; or set NEXT_PUBLIC_API_BASE for a different origin.`
- **Action**: Rewrite these comments. Remove all references to "standalone". Say "WEB-ONLY: uses same-origin API by default."

### 7. `/ADA/asset-dependency-tool/apps/web/app/lib/report/graphics.ts`
- **Line 4**: `* All graphics are generated as standalone SVG strings for offline use.`
- **Action**: Rewrite comment. "SVG strings" is OK; remove "standalone" and "offline use". Say "SVG strings for embedded rendering in reports."

### 8. `/ADA/asset-dependency-tool/apps/web/app/assessment/dependencies/energy/EnergyQuestionnaireSection.tsx`
- **Line 280**: `* - Q17: PRA/SLA when embedded; E-11 Yes/No when standalone.`
- **Action**: Remove or rewrite. If Q17 vs E-11 is conditionalbased on context, explain the context (not "standalone").

### 9. `/ADA/asset-dependency-tool/apps/web/lib/dependencies/dependency_vofc_repo_file.ts`
- **Line 4**: `* For web: use this until DB is available. For standalone: use DependencyVofcRepoEmbedded.`
- **Action**: DELETE or rewrite. Reference to `DependencyVofcRepoEmbedded` suggests alternate code path for offline app. Remove. If multiple implementations exist, consolidate to one WEB-ONLY version.

---

## Summary of Actions

| File | Violating Instances | Action |
|------|---------------------|--------|
| NARRATIVE_REPORT_IMPLEMENTATION.md | 2 | 🔴 DELETE — Legacy doc for abandoned product |
| REVIEW_EXPORT_IMPLEMENTATION.md | 1 | 🟡 EDIT — Remove table row |
| export_dependency_vofc_to_sheet.ts | 2 | 🟡 EDIT — Rename comments from "standalone" to "local workbook" |
| seed_dependency_vofc_from_xlsm.ts | 5 | 🟡 REFACTOR — Rename `STANDALONE_XLSX_PATH` → `LOCAL_XLSX_PATH`, function to `loadFromLocalXlsx()` |
| runtime.ts | 4 | 🔴 DELETE — Entire file (legacy desktop app code) |
| apiBase.ts | 2 | 🟡 EDIT — Rewrite comments, remove "standalone" |
| graphics.ts | 1 | 🟡 EDIT — Rewrite comment, remove "offline use" |
| EnergyQuestionnaireSection.tsx | 1 | 🟡 EDIT — Rewrite or remove comment |
| dependency_vofc_repo_file.ts | 1 | 🔴 DELETE or EDIT — Remove reference to non-existent DependencyVofcRepoEmbedded |

---

## Competing Instruction Sources (To Disable)

**Current state:** `.github/instructions/ENGINEERING.md` is the authoritative source.

**Competing sources found:**
- `.cursorrules` (root level)  — **DISABLE**: Contains legacy Windows/PowerShell guidance; subsumed by ENGINEERING.md
- No `.claude/*` directory detected in repo ✅
- No `~/.claude/*` user-level overrides in workspace ✅
- No `.github/agents/Plan.agent.md` found ✅

**Action:** Update root `.cursorrules` to defer to `.github/instructions/ENGINEERING.md` or remove entirely. VS Code is already configured to use `.vscode/settings.json` which patches out competing agents.

---

## Next Commands

After cleanup apply:

```powershell
# Verify all violations resolved
cd D:\ADA\asset-dependency-tool
& ./scripts/guard-terms.ps1
# Expected exit code: 0
```

---

**Generated by:** Engineering setup process  
**Guard script location:** `./scripts/guard-terms.ps1`
