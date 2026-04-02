#!/usr/bin/env python3
"""
Deterministic parser for IST VOFC HTML viewer.
Extracts OFC entries with their source URLs from the HTML table structure.

FAIL if <200 OFCs extracted (indicates parsing issue).
Do NOT fail if OFC has zero sources (some OFCs legitimately have no sources).
"""
import os
import re
import json
from pathlib import Path
from collections import Counter
from typing import Any, Dict, List, Optional, Tuple

try:
    from bs4 import BeautifulSoup  # type: ignore
except Exception as e:
    raise SystemExit("Missing dependency: beautifulsoup4. Install with: pip install beautifulsoup4") from e

RE_NUM_DOT = re.compile(r"^\s*(\d+)\s*\.\s*$")
RE_REF_OFC = re.compile(r"\(Ref:\s*OFC\s*#\s*(\d+)\)", re.IGNORECASE)

def collapse_ws(s: str) -> str:
    """Collapse whitespace to single spaces."""
    return re.sub(r"\s+", " ", (s or "")).strip()

def find_html_path() -> Path:
    """Find the IST VOFC HTML viewer file."""
    env = os.environ.get("IST_VOFC_HTML_PATH")
    if env and Path(env).exists():
        return Path(env)
    for candidate in [
        Path("IST VOFC HTML VIEWER.html"),
        Path("/mnt/data/IST VOFC HTML VIEWER.html"),
        Path(r"temp/IST VOFC HTML VIEWER.html"),
    ]:
        if candidate.exists():
            return candidate
    raise SystemExit("HTML viewer file not found. Set IST_VOFC_HTML_PATH or place it at repo root/temp/.")

def extract_sources(node) -> Tuple[List[str], List[Optional[str]]]:
    """
    Extract ALL <a href> links from a node (tr or td).
    Returns (urls, labels) where labels are the link text or None.
    """
    urls: List[str] = []
    labels: List[Optional[str]] = []
    for a in node.find_all("a", href=True):
        href = collapse_ws(a.get("href", ""))
        if not href:
            continue
        urls.append(href)
        lbl = collapse_ws(a.get_text(" ", strip=True)) or None
        labels.append(lbl)
    return urls, labels

def best_text_from_row(tr) -> str:
    """
    Extract the best text content from a table row.
    Prefers the td with the most text, excluding the numeric cell (e.g., "64.").
    """
    tds = tr.find_all("td")
    if not tds:
        return ""
    # Find the td with the most text (skip numeric-only cells)
    best = ""
    for td in tds:
        txt = collapse_ws(td.get_text(" ", strip=True))
        if RE_NUM_DOT.match(txt):
            continue
        if len(txt) > len(best):
            best = txt
    # Clean common trailing "Source" tokens
    best = re.sub(r"\bSource(\s*\d+)?\b[, ]*$", "", best, flags=re.IGNORECASE).strip()
    return collapse_ws(best)

def main():
    html_path = find_html_path()
    soup = BeautifulSoup(html_path.read_text(encoding="utf-8", errors="replace"), "html.parser")

    ofcs: List[Dict[str, Any]] = []
    seen = set()

    # PRIMARY: Extract OFCs from <tr> rows that contain a td with text "N."
    for tr in soup.find_all("tr"):
        num_val = None

        # Find the numeric cell (e.g., "64.")
        for td in tr.find_all("td"):
            txt = collapse_ws(td.get_text(" ", strip=True))
            m = RE_NUM_DOT.match(txt)
            if m:
                num_val = int(m.group(1))
                break

        if num_val is None:
            continue

        # Extract OFC text (best text from the row, excluding the number)
        ofc_text = best_text_from_row(tr)
        if not ofc_text:
            continue

        # Extract ALL source URLs from <a href> tags within this <tr>
        source_urls, source_labels = extract_sources(tr)

        # Create OFC ID and de-duplicate exact repeats
        ofc_id = f"IST_OFC_{num_val:06d}"
        sig = (ofc_id, ofc_text, tuple(source_urls))
        if sig in seen:
            continue
        seen.add(sig)

        ofcs.append({
            "ofc_id": ofc_id,
            "ofc_num": num_val,
            "ofc_text": ofc_text,
            "source_urls": source_urls,
            "source_labels": source_labels,
            "ref_style": False
        })

    # SECONDARY: Extract "(Ref: OFC #N)" entries (keep them too)
    for td in soup.find_all("td"):
        txt = collapse_ws(td.get_text(" ", strip=True))
        m = RE_REF_OFC.search(txt)
        if not m:
            continue
        ref_num = int(m.group(1))
        cleaned = RE_REF_OFC.sub("", txt).strip()
        cleaned = re.sub(r"\bSource(\s*\d+)?\b[, ]*$", "", cleaned, flags=re.IGNORECASE).strip()
        cleaned = collapse_ws(cleaned)
        if not cleaned:
            continue

        source_urls, source_labels = extract_sources(td)
        ofc_id = f"IST_OFC_{ref_num:06d}"

        sig = (ofc_id, cleaned, tuple(source_urls))
        if sig in seen:
            continue
        seen.add(sig)

        ofcs.append({
            "ofc_id": ofc_id,
            "ofc_num": ref_num,
            "ofc_text": cleaned,
            "source_urls": source_urls,
            "source_labels": source_labels,
            "ref_style": True
        })

    # FAIL if <200 OFCs extracted (indicates parsing issue)
    if len(ofcs) < 200:
        raise SystemExit(f"FAIL: Extracted only {len(ofcs)} OFCs. You are still not matching the numbered library rows.")

    # Count statistics
    with_sources = sum(1 for o in ofcs if o["source_urls"])
    without_sources = len(ofcs) - with_sources

    # Domain analysis
    domains = Counter()
    for o in ofcs:
        for u in o["source_urls"]:
            dm = re.sub(r"^https?://", "", u, flags=re.IGNORECASE).split("/")[0].lower()
            if dm:
                domains[dm] += 1

    # Write output files
    Path("analytics/extracted").mkdir(parents=True, exist_ok=True)
    Path("analytics/reports").mkdir(parents=True, exist_ok=True)

    Path("analytics/extracted/ist_vofc_all.json").write_text(
        json.dumps({"ofcs": ofcs}, indent=2), encoding="utf-8"
    )
    Path("analytics/reports/ist_vofc_all_report.json").write_text(
        json.dumps({
            "input_file": str(html_path),
            "total_extracted": len(ofcs),
            "with_sources": with_sources,
            "without_sources": without_sources,
            "top_domains": domains.most_common(25)
        }, indent=2),
        encoding="utf-8"
    )

    print(f"[OK] Input: {html_path}")
    print(f"[OK] Total OFCs extracted: {len(ofcs)}")
    print(f"[OK] With sources: {with_sources} | Without sources: {without_sources}")
    print("[OK] Wrote analytics/extracted/ist_vofc_all.json")
    print("[OK] Wrote analytics/reports/ist_vofc_all_report.json")

if __name__ == "__main__":
    main()
