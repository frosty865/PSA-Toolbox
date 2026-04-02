# Fixing Stuck PROCESSING Documents

## Problem

Documents stuck in `PROCESSING` state that haven't completed. This typically happens when:
1. The reprocess worker crashed or was killed mid-processing
2. The Python processing script hung or timed out
3. Database connection issues (like the timeout we just fixed)
4. The worker process isn't running

## Symptoms

- Documents show `PROCESSING: 34` but haven't progressed
- Queue items exist but haven't been processed
- No recent activity in the reprocess queue

## Solution Steps

### 1. Diagnose the Issue

First, check the current state of the queue and stuck documents:

```bash
npx tsx tools/corpus/diagnose_reprocess_queue.ts
```

This will show:
- Document status counts (PROCESSED, REGISTERED, PROCESSING, FAILED)
- Queue status (pending, attempts, errors)
- List of stuck PROCESSING documents
- Recent queue activity
- Recommendations

### 2. Check if Worker is Running

The reprocess worker should be running continuously. Check if it's active:

```bash
# On Windows (PowerShell)
Get-Process | Where-Object {$_.ProcessName -like "*node*" -or $_.CommandLine -like "*reprocess_worker*"}

# Or check if there's a service/process manager running it
```

If the worker isn't running, start it:

```bash
npm run corpus:reprocess-worker
```

**Note:** The worker processes items in batches and exits. You may need to run it in a loop or use a process manager.

### 3. Reset Stuck Documents

If documents have been stuck for more than 24 hours (or your threshold), reset them:

```bash
# Preview what would be reset (dry run)
npx tsx tools/corpus/reset_stuck_processing.ts --dry-run

# Reset documents stuck for more than 24 hours (default)
npx tsx tools/corpus/reset_stuck_processing.ts

# Reset documents stuck for more than 1 hour
npx tsx tools/corpus/reset_stuck_processing.ts --threshold-hours=1
```

This will:
- Reset stuck `PROCESSING` documents back to `REGISTERED`
- Remove them from the reprocess queue
- Add a note to `last_error` indicating they were reset

### 4. Re-queue Documents for Processing

After resetting, re-queue them for processing:

```bash
# Via API (if you have the endpoint)
curl -X POST http://localhost:3000/api/admin/corpus/process-registered

# Or use the UI: /coverage page → "Process Registered" button
```

### 5. Monitor Progress

Keep the worker running and monitor progress:

```bash
# Run worker (processes a batch, then exits)
npm run corpus:reprocess-worker

# Or run in a loop (processes continuously)
while ($true) { npm run corpus:reprocess-worker; Start-Sleep -Seconds 5 }
```

Check status periodically:

```bash
npx tsx tools/corpus/diagnose_reprocess_queue.ts
```

## Improvements Made

### 1. Connection Timeout Fix
- Increased default timeout from 8s to 15s
- Added graceful timeout handling
- Prevents unhandled rejections that could crash workers

### 2. Python Script Timeout
- Added 30-minute timeout to Python reprocessing script
- Prevents indefinite hangs
- Configurable via `REPROCESS_TIMEOUT_MS` environment variable

### 3. Diagnostic Tools
- `diagnose_reprocess_queue.ts` - Comprehensive queue diagnostics
- `reset_stuck_processing.ts` - Reset stuck documents safely

## Prevention

To prevent documents from getting stuck:

1. **Keep Worker Running**: Use a process manager (PM2, systemd, NSSM) to keep the worker running
2. **Monitor Regularly**: Run diagnostics periodically to catch issues early
3. **Set Appropriate Timeouts**: Adjust `REPROCESS_TIMEOUT_MS` based on your document sizes
4. **Handle Errors Gracefully**: The worker now handles timeouts and connection errors better

## Environment Variables

- `REPROCESS_TIMEOUT_MS`: Timeout for Python processing script (default: 1800000 = 30 minutes)
- `REPROCESS_BATCH_SIZE`: Number of items to process per worker run (default: 10)
- `SUPABASE_CORPUS_CONNECT_TIMEOUT_MS`: Database connection timeout (default: 15000 = 15 seconds)

## Related Files

- `tools/corpus/reprocess_worker.ts` - Worker that processes queue items
- `app/lib/corpus/reprocess_document.ts` - Function that calls Python script
- `tools/corpus_ingest_pdf.py` - Python script that actually processes PDFs
- `app/api/admin/corpus/process-registered/route.ts` - API to queue documents
