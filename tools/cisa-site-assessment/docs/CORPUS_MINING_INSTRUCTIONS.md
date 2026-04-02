# CORPUS Mining Instructions

## Overview

To populate CORPUS candidates (`ofc_origin='CORPUS'`) from existing corpus chunks/PDFs, you need to run the mining script.

## Prerequisites

- ✅ CORPUS database has document chunks (2047 chunks found)
- ✅ CORPUS database has corpus documents (76 documents found)
- ✅ `ofc_origin` column is locked (NOT NULL + CHECK constraint)
- ⚠️ Python 3.x installed and in PATH

## Step 1: Run Corpus Mining

### Option A: Using Python directly

```bash
cd psa_rebuild

# Set environment variable to allow mining
export ALLOW_MINER_APPLY=YES  # Linux/Mac
# OR
set ALLOW_MINER_APPLY=YES     # Windows CMD
# OR
$env:ALLOW_MINER_APPLY="YES"  # Windows PowerShell

# Run mining script
python tools/corpus/mine_ofc_candidates_from_chunks_v3.py --apply --max-chunks 500
```

### Option B: Using the wrapper script (if Python is available)

```bash
cd psa_rebuild
node tools/run_corpus_mining_and_targets.js
```

## Step 2: Verify Mining Results

After mining completes, verify CORPUS candidates were created:

```bash
node tools/check_corpus_prereqs.js
```

Expected output:
```
🎯 Existing candidates:
   CORPUS: >0
   MODULE: 17
```

## Step 3: Rebuild Candidate Targets

After mining creates CORPUS candidates, rebuild the targets to link them to baseline questions:

```bash
npm run targets:baseline
```

This will:
- Match CORPUS candidates to baseline questions by subtype
- Score matches using keyword overlap
- Store top 4 candidates per question
- Update `ofc_candidate_targets` table

## Step 4: Verify Coverage

Check how many questions now have candidates:

```bash
node tools/verify_target_coverage.js
```

## Mining Script Options

The `mine_ofc_candidates_from_chunks_v3.py` script supports:

- `--apply`: Actually write candidates to database (required)
- `--max-chunks N`: Limit number of chunks to process (default: all)
- `--limit-docs N`: Limit number of documents to process
- `--source-set NAME`: Only process chunks from specific source set
- `--document-id UUID`: Only process specific document
- `--assign-subtype`: Assign discipline_subtype_id during mining (default: true)
- `--subtype-min-score FLOAT`: Minimum score for subtype assignment (default: 0.35)
- `--subtype-margin FLOAT`: Margin ratio for subtype assignment (default: 1.35)

## Troubleshooting

### Error: "Miner --apply blocked"

Set the environment variable:
```bash
export ALLOW_MINER_APPLY=YES
```

### Error: "Python not found"

Install Python 3.x and ensure it's in your PATH, or use an alternative method to run the script.

### No CORPUS candidates created

1. Check that chunks exist: `SELECT count(*) FROM public.document_chunks;`
2. Check that chunks have `document_role = 'OFC_SOURCE'`:
   ```sql
   SELECT document_role, count(*) 
   FROM public.corpus_documents 
   GROUP BY document_role;
   ```
3. Verify mining script ran successfully (check output for errors)

### Low target coverage

If coverage is low after mining:
1. Check if candidates have `discipline_subtype_id` assigned
2. Verify baseline questions have matching `discipline_subtype_id`
3. Check match scores - may need to adjust scoring algorithm

## Current Status

- ✅ Targets built with MODULE candidates (12 targets, 3 questions covered)
- ⚠️ Need CORPUS candidates for better coverage
- ✅ Mining script ready (requires Python + ALLOW_MINER_APPLY=YES)

## Next Steps

1. Run corpus mining to create CORPUS candidates
2. Rebuild targets: `npm run targets:baseline`
3. Verify coverage: `node tools/verify_target_coverage.js`
4. Test in assessment UI - answer NO to questions and verify candidates appear
