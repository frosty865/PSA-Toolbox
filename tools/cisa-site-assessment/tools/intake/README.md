# Intake Wizard

Human-confirmed metadata entry tool with optional Ollama suggestions. Requires operator confirmation before writing metadata files.

## Overview

The intake wizard provides an interactive CLI for classifying PDFs in the router staging directory:

1. Lists PDFs in `staging/unclassified/`
2. (Optional) Runs Ollama analysis to propose metadata
3. Presents suggestions as "PROPOSED" only (never auto-routes)
4. Requires human confirmation or override for each field
5. Writes `<filename>.meta.json` with confirmed metadata
6. Router service then routes based on confirmed metadata

## Features

- **Human Confirmation Required**: All metadata must be confirmed by operator
- **Optional Ollama Suggestions**: Can propose metadata, but never auto-routes
- **PSA Scope Only**: Filters out cyber/IT terms automatically
- **Bulk Mode**: Classify multiple files with same metadata
- **Validation**: Validates metadata before writing

## Usage

### Classify Files in Staging Directory
```powershell
.\scripts\run_intake_wizard.ps1
```

### Classify Specific Files
```powershell
.\scripts\run_intake_wizard.ps1 -Files "file1.pdf", "file2.pdf"
```

### Bulk Mode (Same Metadata for All Files)
```powershell
.\scripts\run_intake_wizard.ps1 -Bulk
```

### Disable Ollama Suggestions
```powershell
.\scripts\run_intake_wizard.ps1 -NoOllama
```

### Custom Staging Directory
```powershell
.\scripts\run_intake_wizard.ps1 -StagingDir "D:\PSA_System\psa_rebuild\services\router\staging\unclassified"
```

### Direct Python Execution
```bash
python tools/intake/intake_wizard.py
python tools/intake/intake_wizard.py --bulk
python tools/intake/intake_wizard.py --no-ollama
python tools/intake/intake_wizard.py file1.pdf file2.pdf
```

## Ollama Configuration

Set environment variables:

```powershell
$env:OLLAMA_URL = "http://localhost:11434"
$env:OLLAMA_MODEL = "llama3.2"
```

Or in `.env.local`:
```
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
```

## Workflow

1. **Drop PDFs** into `services/router/incoming/`
2. **Router stages** PDFs to `staging/unclassified/`
3. **Run intake wizard**:
   - Wizard lists PDFs in staging
   - (Optional) Ollama analyzes first few pages
   - Ollama proposes metadata (discipline, sector, etc.)
   - Operator confirms or overrides each field
   - Wizard writes `.meta.json` file
4. **Router routes** PDFs based on confirmed metadata
5. **Ingestion pipeline** consumes from `sources/`

## Ollama Suggestions (Advisory Only)

The Ollama suggestion module (`ollama_suggest.py`):

- Extracts text sample from first 5 pages
- Checks for cyber/IT indicators (CVE, NIST, patching, etc.)
- If cyber indicators found: Returns low confidence, null suggestions
- Otherwise: Calls Ollama API with PSA-scope prompt
- Returns proposed metadata with confidence score

**Important**: Suggestions are PROPOSALS only. The wizard requires human confirmation before writing metadata.

## PSA Scope Filtering

The Ollama prompt explicitly:
- Restricts to PSA scope: physical security, governance, planning, operations
- Excludes: cyber security, IT security, data security, network security
- Hard filters cyber indicators: CVE, NIST, patching, endpoints, segmentation, etc.

If cyber indicators are detected, confidence is set low (<0.3) and discipline_code is null.

## Metadata Fields

### Required Fields
- `source_type`: "corpus" or "module"
- `discipline_code`: One of ACS, COM, CPTED, EAP, EMR, FAC, ISC, INT, IDS, KEY, PER, SFO, SMG, VSS
- `confirmed_by`: Username/operator id
- `confirmed_at`: ISO8601 timestamp (auto-generated)

### Conditional Fields
- `module_id`: Required if `source_type == "module"`

### Optional Fields
- `sector_id`: Sector identifier
- `subsector_id`: Subsector identifier (requires `sector_id`)
- `source_key`: Source key
- `notes`: Notes

## Example Session

```
PS> .\scripts\run_intake_wizard.ps1

============================================================
Classifying: document.pdf
============================================================

[Optional] Getting Ollama suggestions...

PROPOSED METADATA (from Ollama):
  Discipline: ACS
  Source Type: corpus
  Sector: N/A
  Subsector: N/A
  Confidence: 0.85
  Rationale: Document focuses on access control systems for physical facilities

⚠️  These are PROPOSALS only - you must confirm or override each field.

------------------------------------------------------------
METADATA ENTRY (all fields require confirmation)
------------------------------------------------------------
Source Type [corpus]: 
Discipline Code [ACS]: 
Sector ID (optional): 
Subsector ID (optional): 
Source Key (optional): 
Notes (optional): 
Confirmed By (username) [operator]: 

------------------------------------------------------------
METADATA SUMMARY:
{
  "source_type": "corpus",
  "discipline_code": "ACS",
  "confirmed_by": "operator",
  "confirmed_at": "2026-01-24T12:00:00Z"
}
------------------------------------------------------------
Write metadata file? (y/n) [y]: y

✅ Metadata written: document.meta.json
```

## Non-Negotiables

- **Human Confirmation**: All metadata must be confirmed by operator
- **Advisory Only**: Ollama suggestions are proposals, never auto-routed
- **PSA Scope**: Only physical security, governance, planning, operations
- **No Cyber/IT**: Filters out cyber/IT terms automatically
- **Validation**: Metadata validated before writing

---

**Last Updated:** 2026-01-24
