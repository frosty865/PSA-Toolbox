# IST Input Directory

Place `VOFC_Library.xlsx` in this directory before running the extraction script.

## Instructions

1. Copy the workbook file to this directory:
   ```
   cp /path/to/VOFC_Library.xlsx tools/ist_ingest/input/
   ```

2. Verify the file is present:
   ```
   ls tools/ist_ingest/input/VOFC_Library.xlsx
   ```

3. Proceed with Step 1 of the runbook (extract_ist_workbook.py)

## Expected Workbook Format

The workbook should have:
- Multiple sheets (tabs), one per discipline
- Headers in one of the rows (detected automatically):
  - "Parent Question"
  - "Child Question/Answer(s)"
  - "Vulnerability"
  - "Option for Consideration"
  - "Reference"

The extractor handles variations in column names and title rows automatically.

