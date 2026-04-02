#!/usr/bin/env python3
import json, re, hashlib
from pathlib import Path
from collections import defaultdict, Counter
from typing import Dict, Any, List, Tuple

PDF_RE = re.compile(r"\.pdf(\?|#|$)", re.IGNORECASE)

def sha8(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()[:8].upper()

def norm_url(u: str) -> str:
    return (u or "").strip()

def domain_of(url: str) -> str:
    u = re.sub(r"^https?://", "", url, flags=re.IGNORECASE)
    return u.split("/")[0].lower()

def is_pdf(url: str) -> bool:
    return bool(PDF_RE.search(url))

def main():
    inp = Path("analytics/extracted/ist_vofc_all.json")
    if not inp.exists():
        raise SystemExit(f"Missing input: {inp}")

    data = json.loads(inp.read_text(encoding="utf-8"))
    ofcs = data.get("ofcs", [])
    if not isinstance(ofcs, list) or not ofcs:
        raise SystemExit("No ofcs[] found in input")

    # Collect URLs
    domain_counts = Counter()
    pdf_urls = set()
    web_urls = set()

    ofc_pdf_bindings: List[Dict[str, Any]] = []
    ofc_web_only = 0
    ofc_any = 0

    for o in ofcs:
        ofc_any += 1
        ofc_id = o.get("ofc_id")
        urls = o.get("source_urls") or []
        urls = [norm_url(u) for u in urls if norm_url(u)]
        if not urls:
            continue

        # Track domains and bucket
        pdfs = [u for u in urls if is_pdf(u)]
        webs = [u for u in urls if not is_pdf(u)]
        for u in urls:
            domain_counts[domain_of(u)] += 1
        for u in pdfs:
            pdf_urls.add(u)
        for u in webs:
            web_urls.add(u)

        if pdfs:
            ofc_pdf_bindings.append({
                "ofc_key": ofc_id,
                "citations": [
                    {
                        "document_key": f"EXTDOC_{sha8(u)}",
                        "url": u,
                        "locator_type": "PDF",
                        "locator": "REPLACE_ME_Page_N",
                        "quote": None
                    } for u in pdfs
                ]
            })
        else:
            ofc_web_only += 1

    # Build sources (domain keyed)
    sources = []
    for dom, cnt in domain_counts.most_common():
        sources.append({
            "source_key": f"DOMAIN_{sha8(dom)}",
            "domain": dom,
            "publisher": "REPLACE_ME",
            "title": "REPLACE_ME",
            "authority_tier": "BASELINE_AUTHORITY",
            "status": "ACTIVE",
            "notes": f"Auto-generated from IST viewer; seen {cnt} citation links"
        })

    # Build external documents (PDF only)
    documents = []
    for u in sorted(pdf_urls):
        dom = domain_of(u)
        documents.append({
            "document_key": f"EXTDOC_{sha8(u)}",
            "source_key": f"DOMAIN_{sha8(dom)}",
            "url": u,
            "file_path": "REPLACE_ME_LOCAL_PATH_TO_DOWNLOADED_PDF",
            "mime_type": "application/pdf",
            "source_set": "BASELINE_DOCS",
            "chunking": { "mode": "pdf_pages" }
        })

    Path("tools/corpus").mkdir(parents=True, exist_ok=True)
    Path("analytics/reports").mkdir(parents=True, exist_ok=True)

    Path("tools/corpus/external_sources.generated.json").write_text(
        json.dumps({ "sources": sources }, indent=2),
        encoding="utf-8"
    )
    Path("tools/corpus/external_documents.generated.json").write_text(
        json.dumps({ "documents": documents }, indent=2),
        encoding="utf-8"
    )
    Path("tools/corpus/ofc_citation_map.pdf_only.generated.json").write_text(
        json.dumps({ "bindings": ofc_pdf_bindings }, indent=2),
        encoding="utf-8"
    )

    report = {
        "total_ofcs_input": len(ofcs),
        "ofcs_with_any_sources": sum(1 for o in ofcs if o.get("source_urls")),
        "ofcs_with_pdf_citations": len(ofc_pdf_bindings),
        "ofcs_web_only": ofc_web_only,
        "unique_pdf_urls": len(pdf_urls),
        "unique_web_urls": len(web_urls),
        "top_domains": domain_counts.most_common(25),
        "outputs": {
            "sources": "tools/corpus/external_sources.generated.json",
            "documents": "tools/corpus/external_documents.generated.json",
            "pdf_bindings": "tools/corpus/ofc_citation_map.pdf_only.generated.json"
        }
    }

    Path("analytics/reports/ist_vofc_import_packaging_report.json").write_text(
        json.dumps(report, indent=2),
        encoding="utf-8"
    )

    print("[OK] Wrote import packaging artifacts.")
    print(json.dumps(report, indent=2))

if __name__ == "__main__":
    main()
