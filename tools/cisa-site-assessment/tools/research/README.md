# Module Research Downloader

Deterministic tool for discovering and downloading research sources for PSA modules.

## Overview

The `module_research_downloader.py` script:
1. **Discovers** candidate sources via seed URLs or search APIs (Bing, SerpAPI)
2. **Downloads** source documents (PDFs, HTML, etc.)
3. **Catalogs** downloads with SHA-256 hashes in a manifest

## Requirements

```bash
pip install requests
```

### Optional: JavaScript-Rendered HTML Support

For JavaScript-rendered HTML pages (e.g., React/SPA sites), install Playwright:

```bash
pip install playwright
playwright install chromium
```

Then use the `--render_html` flag when downloading to render pages before saving.

## Usage

### Seed URL Mode (No API Keys Required)

1. Create a seed URLs file:
   ```bash
   # analytics/research/ev_charging_seed_urls.txt
   https://www.fema.gov/sites/default/files/documents/fema_special-events-contingency-planning.pdf
   https://www.dhs.gov/publication/special-events-security-planning-guide
   ```

2. Run the downloader:
   ```bash
   python tools/research/module_research_downloader.py \
     --module_code MODULE_EV_CHARGING \
     --topic "Electric Vehicle Charging Stations physical security" \
     --seed_urls_file analytics/research/ev_charging_seed_urls.txt \
     --provider none
   ```

   For JavaScript-rendered HTML pages, add `--render_html`:
   ```bash
   python tools/research/module_research_downloader.py \
     --module_code MODULE_EV_PARKING \
     --topic "Electric Vehicle Parking physical security" \
     --seed_urls_file analytics/research/ev_parking_seed_urls.txt \
     --provider none \
     --render_html
   ```

### Bing Search Mode (Requires API Key)

1. Set environment variable:
   ```bash
   export BING_API_KEY=your_bing_api_key
   ```

2. Create queries file (optional):
   ```bash
   # analytics/research/ev_charging_queries.txt
   electric vehicle charging station physical security
   EV charger security vulnerabilities
   ```

3. Run the downloader:
   ```bash
   python tools/research/module_research_downloader.py \
     --module_code MODULE_EV_CHARGING \
     --topic "Electric Vehicle Charging Stations physical security" \
     --queries_file analytics/research/ev_charging_queries.txt \
     --provider bing \
     --max_results 10
   ```

### SerpAPI Mode (Requires API Key)

1. Set environment variable:
   ```bash
   export SERPAPI_API_KEY=your_serpapi_key
   ```

2. Run the downloader:
   ```bash
   python tools/research/module_research_downloader.py \
     --module_code MODULE_EV_CHARGING \
     --topic "Electric Vehicle Charging Stations physical security" \
     --queries_file analytics/research/ev_charging_queries.txt \
     --provider serpapi \
     --max_results 10
   ```

## Outputs

### Discovery JSON
**File**: `analytics/research/<module_code>_discovery.json`

Contains:
- Module code and topic
- Provider used
- Queries/seed URLs
- List of discovered candidate URLs with metadata

### Download Manifest
**File**: `analytics/research/<module_code>_download_manifest.json`

Contains:
- Module code and topic
- Download directory path
- List of successfully downloaded files (with SHA-256, content-type, HTTP status)
- List of failed downloads (with error details)

### Downloaded Files
**Directory**: `downloads/research/<module_code>/`

Files are named by SHA-256 hash:
- `{sha256}.pdf` - PDF documents
- `{sha256}.html` - HTML/web pages
- `{sha256}.txt` - Plain text
- `{sha256}.bin` - Other content types

## Ingestion

After downloading research sources, ingest them into the CORPUS database:

### Ingest Research Downloads

The `ingest_research_downloads.py` script:
1. **Creates/updates** source registry entries from URLs
2. **Ingests PDFs** using the existing PDF ingestion pipeline
3. **Ingests HTML** files (basic text extraction and chunking)
   - Automatically uses rendered HTML (`.rendered.html`) if present in manifest
   - Falls back to raw HTML if rendered version not available
   - Uses BeautifulSoup for better text extraction
4. **Links** everything via `source_registry_id`

**Usage:**
```bash
python tools/research/ingest_research_downloads.py \
  --manifest analytics/research/MODULE_EV_CHARGING_download_manifest.json \
  --authority_scope BASELINE_AUTHORITY \
  [--dry-run]
```

**Options:**
- `--manifest` - Path to download manifest JSON (required)
- `--authority_scope` - Authority scope: `BASELINE_AUTHORITY`, `SECTOR_AUTHORITY`, or `SUBSECTOR_AUTHORITY` (default: `BASELINE_AUTHORITY`)
- `--dry-run` - Preview what would be done without making database changes

**What it does:**
- Reads the download manifest JSON
- For each downloaded file:
  - Generates a deterministic `source_key` from URL/title
  - Creates/updates source registry entry
  - Ingests PDFs using `corpus_ingest_pdf.py` logic
  - Ingests HTML files with basic text extraction
  - Links documents to source registry via `source_registry_id`

**Outputs:**
- Source registry entries created/updated in CORPUS database
- Documents ingested into `corpus_documents` table
- Chunks created in `document_chunks` table
- Results JSON: `<module_code>_ingestion_results.json`

**Example:**
```bash
# First, download research sources
python tools/research/module_research_downloader.py \
  --module_code MODULE_EV_CHARGING \
  --topic "Electric Vehicle Charging Stations physical security" \
  --seed_urls_file analytics/research/ev_charging_seed_urls.txt \
  --provider none

# Then, ingest the downloaded files
python tools/research/ingest_research_downloads.py \
  --manifest analytics/research/MODULE_EV_CHARGING_download_manifest.json \
  --authority_scope BASELINE_AUTHORITY
```

## Next Steps

After ingesting research sources:

1. **Review** ingestion results JSON
2. **Extract** physical-risk statements from document chunks
3. **Synthesize** into module questions and OFCs using the four-phase research method
4. **Package** module import JSON with questions, OFCs, and risk drivers

## Examples

### Example: EV Charging Module (Seed Mode)

```bash
python tools/research/module_research_downloader.py \
  --module_code MODULE_EV_CHARGING \
  --topic "Electric Vehicle Charging Stations physical security" \
  --seed_urls_file analytics/research/ev_charging_seed_urls.txt \
  --provider none
```

### Example: Outdoor Event Security (Bing Search)

```bash
export BING_API_KEY=your_key_here

python tools/research/module_research_downloader.py \
  --module_code MODULE_OUTDOOR_EVENT_SECURITY \
  --topic "Outdoor event physical security" \
  --queries_file analytics/research/outdoor_event_queries.txt \
  --provider bing \
  --max_results 15
```

## Error Handling

- Individual URL failures are logged but don't stop the process
- Script fails if zero files are downloaded successfully
- Failed URLs are recorded in the manifest for review

## Notes

- Files are deduplicated by SHA-256 (same content = same filename)
- Existing files are not re-downloaded
- All timestamps are UTC
- User-Agent header identifies the downloader
