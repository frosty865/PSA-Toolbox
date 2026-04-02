#!/usr/bin/env python3
"""
Rendered HTML Fetcher

Uses Playwright to fetch and render JavaScript-rendered HTML pages.
Saves the rendered HTML to disk for deterministic ingestion.

Usage:
    python tools/research/fetch_rendered_html.py --url <url> --out <output_path> [--timeout_ms <ms>]
"""

import argparse
from pathlib import Path
import sys


def main():
    ap = argparse.ArgumentParser(
        description="Fetch and render JavaScript-rendered HTML using Playwright"
    )
    ap.add_argument("--url", required=True, help="URL to fetch and render")
    ap.add_argument("--out", required=True, help="Output file path for rendered HTML")
    ap.add_argument("--timeout_ms", type=int, default=45000, help="Page load timeout in milliseconds")
    args = ap.parse_args()

    # Lazy import so non-HTML flows don't require Playwright
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("ERROR: Playwright not installed. Install with: pip install playwright", file=sys.stderr)
        print("Then run: playwright install chromium", file=sys.stderr)
        sys.exit(1)

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            
            # Navigate and wait for network to be idle
            page.goto(args.url, wait_until="networkidle", timeout=args.timeout_ms)
            
            # Some sites load content late; small deterministic wait
            page.wait_for_timeout(1500)
            
            # Get rendered HTML
            html = page.content()
            browser.close()

        out_path.write_text(html, encoding="utf-8")
        print(f"[OK] Rendered HTML saved: {out_path}")
        
    except Exception as e:
        print(f"ERROR: Failed to fetch rendered HTML: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
