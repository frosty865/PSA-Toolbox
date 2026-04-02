#!/usr/bin/env python3
"""
Deterministic Module Research Downloader

Discovers candidate sources for a module topic and downloads/catalogs them locally.
Supports seed URL mode (no API keys) or search providers (Bing, SerpAPI) if keys are configured.
"""

import argparse
import hashlib
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

try:
    import requests
except ImportError:
    raise SystemExit(
        "ERROR: 'requests' library not found. Install with: pip install requests"
    )


def utc_now_iso() -> str:
    """Get current UTC time as ISO string."""
    return datetime.now(timezone.utc).isoformat()


def sha256_bytes(b: bytes) -> str:
    """Compute SHA256 hash of bytes."""
    h = hashlib.sha256()
    h.update(b)
    return h.hexdigest()


def read_lines(p: Optional[str]) -> List[str]:
    """Read lines from file, skipping empty lines and comments."""
    if not p:
        return []
    path = Path(p)
    if not path.exists():
        return []
    out = []
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        s = line.strip()
        if not s or s.startswith("#"):
            continue
        out.append(s)
    return out


def safe_filename(s: str) -> str:
    """Sanitize filename."""
    s = re.sub(r"[^a-zA-Z0-9._-]+", "_", s).strip("_")
    return s[:120] if len(s) > 120 else s


def discover_seed(seed_urls: List[str]) -> List[Dict[str, Any]]:
    """Discover candidates from seed URLs (no API required)."""
    return [
        {
            "url": u,
            "title": None,
            "publisher": None,
            "published_date": None,
            "source": "seed",
        }
        for u in seed_urls
    ]


def discover_bing(topic: str, queries: List[str], max_results: int) -> List[Dict[str, Any]]:
    """Discover candidates using Bing Web Search API."""
    key = os.environ.get("BING_API_KEY")
    if not key:
        raise SystemExit("provider=bing requires BING_API_KEY env var")
    endpoint = os.environ.get(
        "BING_ENDPOINT", "https://api.bing.microsoft.com/v7.0/search"
    )
    headers = {"Ocp-Apim-Subscription-Key": key}
    candidates: List[Dict[str, Any]] = []
    for q in queries or [topic]:
        params = {"q": q, "count": max_results}
        r = requests.get(endpoint, headers=headers, params=params, timeout=30)
        r.raise_for_status()
        data = r.json()
        for item in (data.get("webPages", {}) or {}).get("value", [])[:max_results]:
            candidates.append(
                {
                    "url": item.get("url"),
                    "title": item.get("name"),
                    "publisher": None,
                    "published_date": None,
                    "source": "bing",
                }
            )
    # De-dupe by URL
    seen = set()
    out = []
    for c in candidates:
        u = (c.get("url") or "").strip()
        if not u or u in seen:
            continue
        seen.add(u)
        out.append(c)
    return out


def discover_serpapi(topic: str, queries: List[str], max_results: int) -> List[Dict[str, Any]]:
    """Discover candidates using SerpAPI (Google search)."""
    key = os.environ.get("SERPAPI_API_KEY")
    if not key:
        raise SystemExit("provider=serpapi requires SERPAPI_API_KEY env var")
    candidates: List[Dict[str, Any]] = []
    for q in queries or [topic]:
        params = {"engine": "google", "q": q, "api_key": key, "num": max_results}
        r = requests.get("https://serpapi.com/search.json", params=params, timeout=30)
        r.raise_for_status()
        data = r.json()
        for item in data.get("organic_results", [])[:max_results]:
            candidates.append(
                {
                    "url": item.get("link"),
                    "title": item.get("title"),
                    "publisher": None,
                    "published_date": None,
                    "source": "serpapi",
                }
            )
    # De-dupe by URL
    seen = set()
    out = []
    for c in candidates:
        u = (c.get("url") or "").strip()
        if not u or u in seen:
            continue
        seen.add(u)
        out.append(c)
    return out


def fetch_url(url: str) -> Tuple[int, Optional[str], bytes]:
    """Fetch URL content with appropriate headers."""
    headers = {"User-Agent": "psa-module-research-downloader/1.0"}
    r = requests.get(url, headers=headers, timeout=45, allow_redirects=True)
    ct = r.headers.get("content-type")
    return r.status_code, ct, r.content


def ext_for_content_type(ct: Optional[str]) -> str:
    """Determine file extension from content-type."""
    if not ct:
        return "bin"
    c = ct.lower()
    if "application/pdf" in c:
        return "pdf"
    if "text/html" in c or "application/xhtml+xml" in c:
        return "html"
    if "text/plain" in c:
        return "txt"
    return "bin"


def main():
    ap = argparse.ArgumentParser(
        description="Download research sources for a PSA module topic"
    )
    ap.add_argument("--module_code", required=True, help="Module code (e.g., MODULE_EV_CHARGING)")
    ap.add_argument("--topic", required=True, help="Topic description for search")
    ap.add_argument("--queries_file", help="Path to queries file (one per line)")
    ap.add_argument("--seed_urls_file", help="Path to seed URLs file (one per line)")
    ap.add_argument(
        "--provider",
        choices=["none", "bing", "serpapi"],
        default="none",
        help="Search provider (none = seed URLs only)",
    )
    ap.add_argument(
        "--max_results", type=int, default=10, help="Max results per query (search providers only)"
    )
    ap.add_argument(
        "--download_dir", help="Download directory (default: downloads/research/<module_code>)"
    )
    ap.add_argument(
        "--render_html",
        action="store_true",
        help="Render JavaScript-rendered HTML pages using Playwright (requires playwright installed)"
    )
    args = ap.parse_args()

    module_code = args.module_code.strip()
    topic = args.topic.strip()
    queries = read_lines(args.queries_file)
    seed_urls = read_lines(args.seed_urls_file)

    # Validate inputs
    # Note: seed_urls can be generated from queries in the API layer
    # So we allow provider="none" with queries (which will be converted to seed URLs)
    if args.provider == "none" and not seed_urls and not queries:
        raise SystemExit(
            "ERROR: provider=none requires either --seed_urls_file or --queries_file"
        )

    out_dir = Path(args.download_dir or f"downloads/research/{module_code}")
    out_dir.mkdir(parents=True, exist_ok=True)

    # DISCOVERY
    print(f"[DISCOVERY] Provider: {args.provider}")
    if args.provider == "none":
        candidates = discover_seed(seed_urls)
        print(f"[DISCOVERY] Found {len(candidates)} seed URLs")
    elif args.provider == "bing":
        candidates = discover_bing(topic, queries, args.max_results)
        print(f"[DISCOVERY] Found {len(candidates)} candidates via Bing")
    else:
        candidates = discover_serpapi(topic, queries, args.max_results)
        print(f"[DISCOVERY] Found {len(candidates)} candidates via SerpAPI")

    discovery = {
        "module_code": module_code,
        "topic": topic,
        "provider": args.provider,
        "queries": queries,
        "seed_urls_count": len(seed_urls),
        "candidates": candidates,
        "generated_at_utc": utc_now_iso(),
    }

    Path("analytics/research").mkdir(parents=True, exist_ok=True)
    disc_path = Path(f"analytics/research/{module_code}_discovery.json")
    disc_path.write_text(json.dumps(discovery, indent=2), encoding="utf-8")
    print(f"[OK] Wrote discovery: {disc_path}")

    # DOWNLOAD
    manifest: Dict[str, Any] = {
        "module_code": module_code,
        "topic": topic,
        "download_dir": str(out_dir),
        "downloaded": [],
        "failed": [],
        "generated_at_utc": utc_now_iso(),
    }

    ok_count = 0
    print(f"[DOWNLOAD] Processing {len(candidates)} candidates...")
    for idx, c in enumerate(candidates, 1):
        url = (c.get("url") or "").strip()
        if not url:
            continue
        print(f"[{idx}/{len(candidates)}] Fetching: {url[:80]}...")
        try:
            status, ct, body = fetch_url(url)
            if status < 200 or status >= 300 or not body:
                manifest["failed"].append(
                    {
                        "url": url,
                        "status": status,
                        "content_type": ct,
                        "error": "non-2xx or empty body",
                    }
                )
                print(f"  [FAIL] HTTP {status}")
                continue
            h = sha256_bytes(body)
            ext = ext_for_content_type(ct)
            save_path = out_dir / f"{h}.{ext}"
            if not save_path.exists():
                save_path.write_bytes(body)
                print(f"  [OK] Saved: {save_path.name} ({len(body)} bytes)")
            else:
                print(f"  [SKIP] Already exists: {save_path.name}")
            
            # Handle JS-rendered HTML if requested
            rendered_path = None
            is_js_rendered = False
            if ext == "html" and args.render_html:
                rendered_path_obj = out_dir / f"{h}.rendered.html"
                if not rendered_path_obj.exists():
                    try:
                        # Call fetch_rendered_html.py to render the page
                        import subprocess
                        import sys
                        script_path = Path(__file__).parent / "fetch_rendered_html.py"
                        result = subprocess.run(
                            [
                                sys.executable,  # Use the same Python interpreter as this script
                                str(script_path),
                                "--url", url,
                                "--out", str(rendered_path_obj),
                                "--timeout_ms", "45000"
                            ],
                            capture_output=True,
                            text=True,
                            timeout=60  # Safety timeout
                        )
                        if result.returncode == 0:
                            rendered_path = str(rendered_path_obj)
                            is_js_rendered = True
                            print(f"  [OK] Rendered HTML saved: {rendered_path_obj.name}")
                        else:
                            print(f"  [WARN] Failed to render HTML: {result.stderr}")
                    except Exception as e:
                        print(f"  [WARN] Failed to render HTML: {e}")
                else:
                    rendered_path = str(rendered_path_obj)
                    is_js_rendered = True
                    print(f"  [SKIP] Rendered HTML already exists: {rendered_path_obj.name}")
            
            download_entry = {
                "url": url,
                "saved_path": str(save_path),
                "sha256": h,
                "content_type": ct,
                "http_status": status,
                "fetched_at_utc": utc_now_iso(),
            }
            
            if rendered_path:
                download_entry["rendered_path"] = rendered_path
                download_entry["is_js_rendered"] = is_js_rendered
            
            manifest["downloaded"].append(download_entry)
            ok_count += 1
        except Exception as e:
            manifest["failed"].append({"url": url, "error": str(e)})
            print(f"  [FAIL] {str(e)}")

    if ok_count == 0:
        raise SystemExit(
            "FAIL: downloaded 0 files successfully. Provide seed URLs or configure provider API keys."
        )

    man_path = Path(f"analytics/research/{module_code}_download_manifest.json")
    man_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    print(f"\n[SUMMARY]")
    print(f"  Discovery: {disc_path}")
    print(f"  Manifest: {man_path}")
    print(f"  Downloaded: {ok_count} files into {out_dir}")
    if manifest["failed"]:
        print(f"  Failed: {len(manifest['failed'])} URLs")


if __name__ == "__main__":
    main()
