# Asset Dependency Tool - Engineering Standards

**Authoritative instruction file. Last source of truth for all development work.**

---

## 1. Architecture: WEB-ONLY

**This is a web application only. No standalone, offline, or static-export builds.**

- ✅ Next.js server + React frontend
- ✅ External HTTP APIs and external data sources
- ✅ Dynamic rendering, form submission, file upload
- ❌ No `output: "export"` in next.config.js
- ❌ No static site generation as primary deliverable
- ❌ No IndexedDB-only runtime
- ❌ No "standalone executable" product

### Forbidden Terms in Code/Docs

The following words/phrases are **banned** everywhere (docs, code, configs, comments):
- "standalone"
- "static export"
- "output: export"
- "dist/"
- "IndexedDB (as offline runtime)"
- "no server required"

Use `scripts/guard-terms.ps1` to scan and enforce.

---

## 2. Development Environment

### Platform: Windows + PowerShell

All terminal commands assume **PowerShell 7+** on Windows.

```powershell
#❌ DO NOT use bash syntax
rm -rf node_modules     # WRONG

# ✅ DO use PowerShell syntax
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
```

### Node & Package Manager

- **Node.js**: 20+
- **Package Manager**: pnpm (not npm, not yarn)
- **Workspace**: pnpm monorepo (`pnpm-workspace.yaml`)

---

## 3. Repo Structure & Paths

**Canonical paths (no invented locations):**

```
asset-dependency-tool/
├── .github/instructions/        # ← This file (authoritative)
├── .vscode/settings.json        # ← Deterministic AI config
├── apps/
│   ├── web/                     # Next.js 14+, TypeScript, TailwindCSS
│   └── reporter/                # Python report generator
├── packages/
│   ├── engine/                  # Assessment logic, curves, vuln catalog
│   ├── schema/                  # TypeScript types, Zod validation
│   ├── security/                # RBAC, encryption
│   └── ui/                      # Shared React components
├── scripts/                     # DevOps, data import, verification
├── docs/                        # Architecture, runbooks
├── data/                        # XLSX workbooks, JSON exports
└── package.json                 # Workspace root
```

---

## 4. Code Quality & Determinism

### TypeScript

- **Strict mode enabled** in `tsconfig.json`
- **No `any` types** (use unknown + type guards, or generics)
- **No console.log in production** (use structured logging)
- **Line length**: ≤ 100 characters (enforced by formatter)

### File Exports & Imports

- **Named exports** preferred (easier tree-shaking, clearer intent)
- **No barrel exports** from utility directories (import directly: `import { fn } from '@lib/utils/fn'`)
- **Relative imports** within same package; absolute imports across packages

### Deterministic Outputs

- All exports (JSON, DOCX, PDF) must be **byte-for-byte identical** for identical inputs
- No timestamps in exports unless explicitly requested by spec
- No UUIDs without seeding
- Curves, findings, and considerations computed deterministically

---

## 5. Infrastructure & Service Separation

### Communications vs IT (Hard Separation)

**Communications (Comms):**
- Voice, radio, dispatch transport
- PSTN, cellular, private radio networks
- Question prefix: `CO-` (e.g., CO-1, CO-8)

**Information Technology (IT):**
- External data/internet transport only
- Cloud services, SaaS, ISP links
- Question prefix: `IT-` (e.g., IT-1, IT-8)

**Do NOT conflate these domains.** They have separate curves, separate vulnerabilities, separate considerations.

---

## 6. Data Schemas & Field Names

### Deprecated / Do NOT Use

- `VOFC_ID`, `VOFC_SCORE`, `VOFC_RATING` — removed, replaced by deterministic vulnerability triggers
- `vulnerability_index`, `rating_system` — legacy VOFC tables; use vulnerability catalogs instead
- `offline_storage`, `localStorage_fallback` — WEB-ONLY, no offline runtime
- `safe_` prefix in field names — removed in favor of explicit field semantics

### Active / Use These

- `VulnerabilityConfig` (type definition in `apps/web/app/lib/vuln/vulnerability_types.ts`)
- `AnalyticalConsideration` (citation-backed narrative)
- `TriggeredVulnerability` (runtime output)
- `ReportBlock` (narrative section in exported report)
- `InfraId` enum: `"ELECTRIC_POWER"` | `"WATER"` | `"WASTEWATER"` | `"COMMUNICATIONS"` | `"INFORMATION_TECHNOLOGY"` | `"CROSS_DEPENDENCY"`

---

## 7. Instruction Source Hierarchy (Disabled)

The following files are **deactivated** (legacy / conflicting):

- `~/.claude/rules/` — user-level Claude rules (repo rules take precedence)
- `~/.claude/instructions/` — user-level instructions (disabled)
- `.claude/` directory (if it exists in repo) — disabled
- Copilot plan agent (`Plan.agent.md` in VS Code) — disable in workspace settings
- Any root-level `.cursorrules` for conflicting content — prefer `.github/instructions/ENGINEERING.md`

**Authoritative source:** `.github/instructions/ENGINEERING.md` (this file)

---

## 8. VS Code Configuration

See `.vscode/settings.json` for:
- TypeScript server memory increased to 2GB
- node_modules, .next, dist excluded from watchers and search
- Linting and formatting rules
- AI code suggestions restricted to repo structure

---

## 9. CI/CD & Verification

### Before Commit

Run guard check script:

```powershell
# Check for forbidden terms anywhere in repo
./scripts/guard-terms.ps1
```

Exit code `0` = pass, `1` = fail (forbidden term found).

### Pre-commit Hook

(Optional; add to `.git/hooks/pre-commit` if enforced)

```powershell
& ./scripts/guard-terms.ps1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Forbidden terms detected. Commit blocked."
    exit 1
}
```

---

## 10. Questions & Escalation

For design questions or scope changes:
1. Search existing `apps/web/lib/dependencies/` infrastructure specs
2. Check `apps/web/app/lib/vuln/` vulnerability catalogs for trigger patterns
3. If not found, propose to the core team with rationale and affected domains

**Do NOT invent new question IDs.** Use existing ones.

---

**Last Updated:** February 14, 2026  
**Enforced By:** `scripts/guard-terms.ps1`
