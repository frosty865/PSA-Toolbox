#!/usr/bin/env python3
import json, re, sys
from pathlib import Path
from typing import Dict, Any, List, Tuple
import hashlib

def die(msg: str):
    print(f"[FAIL] {msg}", file=sys.stderr)
    sys.exit(1)

def norm(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "")).strip()

def is_pdf_url(url: str) -> bool:
    return bool(re.search(r"\.pdf(\?|#|$)", url, flags=re.IGNORECASE))

def slug(s: str) -> str:
    s = re.sub(r"[^A-Za-z0-9]+", "_", s.strip())
    s = re.sub(r"_+", "_", s).strip("_")
    return s.upper()[:64] if s else "DOC"

def stable_doc_key_from_url(url: str) -> str:
    # Deterministic: DOC_<hash8>
    h = hashlib.sha256(url.encode("utf-8")).hexdigest()[:8].upper()
    return f"EXTDOC_{h}"

def main():
    inp = Path("analytics/extracted/ist_vofc_raw.json")
    if not inp.exists():
        die(f"Missing input file: {inp}")

    data = json.loads(inp.read_text(encoding="utf-8"))
    ofcs = data.get("ofcs")
    if not isinstance(ofcs, list):
        die("Input JSON missing 'ofcs' list")

    if len(ofcs) == 0:
        die("No OFCs present in extracted file")

    # Validate + dedupe
    by_ref: Dict[int, Dict[str, Any]] = {}
    errors: List[str] = []
    non_pdf: List[Tuple[int, str]] = []

    for o in ofcs:
        ref = o.get("ofc_ref_num")
        text = norm(o.get("ofc_text", ""))
        url = norm(o.get("source_url", ""))

        if not isinstance(ref, int):
            errors.append("OFC missing valid ofc_ref_num (int)")
            continue
        if not text:
            errors.append(f"OFC #{ref} missing ofc_text")
        if not url:
            errors.append(f"OFC #{ref} missing source_url")
        elif not is_pdf_url(url):
            non_pdf.append((ref, url))
            errors.append(f"OFC #{ref} citation is not a PDF URL: {url}")

        if ref in by_ref:
            prev = by_ref[ref]
            # Only error if URL differs (same ref_num must have same source document)
            # Different text with same URL is allowed (same OFC can appear in different contexts)
            if prev["source_url"] != url:
                errors.append(f"Duplicate OFC ref #{ref} has conflicting source_url: '{prev['source_url']}' vs '{url}'")
            # If URL matches, keep first entry (dedupe by ref_num)
        else:
            by_ref[ref] = {"ofc_ref_num": ref, "ofc_text": text, "source_url": url}

    if errors:
        # Write report before failing
        out = Path("analytics/reports")
        out.mkdir(parents=True, exist_ok=True)
        rep = out / "ist_vofc_extract_validation.json"
        rep.write_text(json.dumps({
            "status": "FAIL",
            "total_input": len(ofcs),
            "total_deduped": len(by_ref),
            "errors": errors,
        }, indent=2), encoding="utf-8")
        die(f"Validation failed. See {rep}")

    # Build external docs list (dedupe by URL)
    url_to_doc: Dict[str, Dict[str, Any]] = {}
    for ref, o in by_ref.items():
        url = o["source_url"]
        if url not in url_to_doc:
            url_to_doc[url] = {
                "document_key": stable_doc_key_from_url(url),
                "source_key": "REPLACE_ME_SOURCE_KEY",
                "file_path": "REPLACE_ME_LOCAL_PATH",
                "mime_type": "application/pdf",
                "source_set": "BASELINE_DOCS",
                "chunking": { "mode": "pdf_pages" }
            }

    # Skeletons
    sk_docs = {"documents": list(url_to_doc.values())}

    sk_sources = {
        "sources": [
            {
                "source_label": "REPLACE_ME_SOURCE_LABEL",
                "source_key": "REPLACE_ME_SOURCE_KEY",
                "document_key": d["document_key"],
                "locator_type": "PDF"
            } for d in sk_docs["documents"]
        ]
    }

    sk_bindings = {
        "bindings": [
            {
                "ofc_key": f"OFC_{ref}",
                "citations": [
                    {
                        "document_key": stable_doc_key_from_url(o["source_url"]),
                        "locator_type": "PDF",
                        "locator": "REPLACE_ME_Page_N",
                        "quote": None
                    }
                ]
            } for ref, o in sorted(by_ref.items())
        ]
    }

    # Write outputs
    Path("analytics/reports").mkdir(parents=True, exist_ok=True)
    Path("tools/corpus").mkdir(parents=True, exist_ok=True)

    Path("analytics/reports/ist_vofc_extract_validation.json").write_text(json.dumps({
        "status": "OK",
        "total_input": len(ofcs),
        "total_deduped": len(by_ref),
        "external_documents": len(sk_docs["documents"]),
    }, indent=2), encoding="utf-8")

    Path("tools/corpus/external_documents.skeleton.json").write_text(json.dumps(sk_docs, indent=2), encoding="utf-8")
    Path("tools/corpus/external_source_map.skeleton.json").write_text(json.dumps(sk_sources, indent=2), encoding="utf-8")
    Path("tools/corpus/ofc_citation_map.skeleton.json").write_text(json.dumps(sk_bindings, indent=2), encoding="utf-8")

    print("[OK] Validation passed.")
    print("[OK] Wrote analytics/reports/ist_vofc_extract_validation.json")
    print("[OK] Wrote tools/corpus/external_documents.skeleton.json")
    print("[OK] Wrote tools/corpus/external_source_map.skeleton.json")
    print("[OK] Wrote tools/corpus/ofc_citation_map.skeleton.json")

if __name__ == "__main__":
    main()
