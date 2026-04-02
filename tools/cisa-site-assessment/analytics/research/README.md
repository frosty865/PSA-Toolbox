# Module Research Files

This directory contains research discovery and download manifests for PSA modules.

## File Naming Convention

- `<module_code>_discovery.json` - Discovery results (candidate URLs found)
- `<module_code>_download_manifest.json` - Download catalog (successful + failed downloads)
- `<module_code>_queries.txt` - Search queries (for Bing/SerpAPI providers)
- `<module_code>_seed_urls.txt` - Seed URLs (for provider=none mode)

## Usage

See `tools/research/README.md` for detailed usage instructions.

## Quick Start (Seed URL Mode)

1. Create seed URLs file:
   ```bash
   echo "https://example.com/research-source.pdf" > analytics/research/MODULE_EV_CHARGING_seed_urls.txt
   ```

2. Run downloader:
   ```bash
   python tools/research/module_research_downloader.py \
     --module_code MODULE_EV_CHARGING \
     --topic "Electric Vehicle Charging Stations physical security" \
     --seed_urls_file analytics/research/MODULE_EV_CHARGING_seed_urls.txt \
     --provider none
   ```

3. Review outputs:
   - `analytics/research/MODULE_EV_CHARGING_discovery.json` - What was found
   - `analytics/research/MODULE_EV_CHARGING_download_manifest.json` - What was downloaded
   - `downloads/research/MODULE_EV_CHARGING/*` - Downloaded files (SHA-256 named)

## Next Steps

After downloading research sources, use the four-phase research method:
1. **Topic Framing** - Define scope and physical assets
2. **Research Ingestion** - Summarize sources, extract physical-risk statements
3. **Synthesis** - Normalize vulnerabilities, generate module questions/OFCs
4. **Packaging** - Output module import JSON
