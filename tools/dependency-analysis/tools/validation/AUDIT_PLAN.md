# ADA Repo Audit Script Plan

All scripts run from repo root (`C:\ADA\asset-dependency-tool`). Outputs go to `tools\validation\out\` unless noted.

---

## S1) find_duplicates.ps1

**Purpose:** Find duplicate implementations by keyword signatures.

**Keywords:** `VULNERABILITY_BLOCKS`, `computeSeverity`, `DriverCategory`, `anchor`, `template.docx`

**CLI:** `.\tools\validation\find_duplicates.ps1`  
Optional: `-RepoRoot "C:\ADA\asset-dependency-tool"`

**Outputs:** `tools\validation\out\duplicates_report.md`

**Exit codes:** 0 = report written (may list duplicates); 1 = script error.

**Example:**
```powershell
cd C:\ADA\asset-dependency-tool
.\tools\validation\find_duplicates.ps1
```

---

## S2) anchor_scan.ps1

**Purpose:** Scan template + exporter code for required anchors; verify no legacy anchors remain in template.

**Required Annex anchors (Part II) only:**  
`[[TABLE_DEPENDENCY_SUMMARY]]`, `[[STRUCTURAL_PROFILE_SUMMARY]]`, `[[VULNERABILITY_COUNT_SUMMARY]]`, `[[VULNERABILITY_BLOCKS]]`, `[[CROSS_INFRA_ANALYSIS]]`

**CLI:** `.\tools\validation\anchor_scan.ps1`  
Optional: `-TemplatePath "ADA\report template.docx"` (relative to repo root)

**Outputs:** `tools\validation\out\anchor_report.md`

**Exit codes:** 0 = all required present exactly once, no legacy in template; 1 = missing/duplicate/legacy found or error.

**Example:**
```powershell
cd C:\ADA\asset-dependency-tool
.\tools\validation\anchor_scan.ps1
```

---

## S3) style_scan.ps1

**Purpose:** Verify template contains required ADA paragraph styles and note Paragraph vs Character type.

**Required styles:**  
`ADA_Vuln_Header`, `ADA_Vuln_Severity`, `ADA_Vuln_Meta`, `ADA_Vuln_Label`, `ADA_Vuln_Body`, `ADA_Vuln_Bullets`, `ADA_Vuln_Numbered`

**CLI:** `.\tools\validation\style_scan.ps1`  
Optional: `-TemplatePath "ADA\report template.docx"`

**Outputs:** `tools\validation\out\style_report.md`

**Exit codes:** 0 = all required styles exist (prefer Paragraph); 1 = missing style or error.

**Example:**
```powershell
cd C:\ADA\asset-dependency-tool
.\tools\validation\style_scan.ps1
```

---

## S4) safe_scan.ps1

**Purpose:** Repo-wide scan for the string "SAFE" (case-insensitive) in active paths; exclude archive.

**CLI:** `.\tools\validation\safe_scan.ps1`  
Optional: `-RepoRoot "C:\ADA\asset-dependency-tool"`

**Outputs:** `tools\validation\out\safe_report.md`

**Exit codes:** 0 = no "SAFE" found in active paths; 1 = one or more hits (or script error).

**Example:**
```powershell
cd C:\ADA\asset-dependency-tool
.\tools\validation\safe_scan.ps1
```

---

## S5) export_smoke.ps1

**Purpose:** Run export for each fixture JSON under `ADA\_pilot_fixtures\inputs\`; capture logs.

**CLI:** `.\tools\validation\export_smoke.ps1`  
Optional: `-RepoRoot "C:\ADA\asset-dependency-tool"`

**Outputs:**  
- `tools\validation\out\export_logs\` (per-fixture stderr/stdout)  
- `tools\validation\out\export_smoke_summary.md`

**Exit codes:** 0 = all fixtures exported successfully; 1 = one or more failures or no fixtures.

**Example:**
```powershell
cd C:\ADA\asset-dependency-tool
.\tools\validation\export_smoke.ps1
```

---

## S6) parity_check.ps1 (plan only; implement after refactor)

**Purpose:** Compare vuln counts + severity distribution between web ReportVM JSON dump and reporter output metadata (from QC or log).

**Outputs:** `tools\validation\out\parity_report.md`

**Exit codes:** 0 = parity; 1 = mismatch or error.

**Example (when implemented):**
```powershell
.\tools\validation\parity_check.ps1
```

---

## Output artifacts summary

| Script           | Output path |
|-----------------|-------------|
| S1 find_duplicates | `tools\validation\out\duplicates_report.md` |
| S2 anchor_scan     | `tools\validation\out\anchor_report.md` |
| S3 style_scan      | `tools\validation\out\style_report.md` |
| S4 safe_scan       | `tools\validation\out\safe_report.md` |
| S5 export_smoke    | `tools\validation\out\export_smoke_summary.md` + `out\export_logs\` |
| S6 parity_check    | `tools\validation\out\parity_report.md` |
