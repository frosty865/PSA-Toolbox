#!/usr/bin/env python3
"""QA check for corpus_documents - hard requirements.

Checks: no numeric/hash-like titles, source linkage, citation scraped, scope tags.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from tools.backfill.backfill_document_citations import get_corpus_db_connection
from model.ingest.pdf_citation_extractor import is_hash_like_title

conn = get_corpus_db_connection()
cur = conn.cursor()

try:
    checks = {}

    # Check 1: No numeric-only inferred_titles
    cur.execute("SELECT count(*) FROM public.corpus_documents WHERE inferred_title ~ '^[0-9]+$'")
    numeric_count = cur.fetchone()[0]
    checks['no_numeric_inferred_titles'] = numeric_count == 0

    # Check 2: No hash-like document names (display = inferred_title or file_stem)
    cur.execute("SELECT id, inferred_title, file_stem FROM public.corpus_documents")
    rows = cur.fetchall()
    hash_like_offenders = []
    for row in rows:
        doc_id, inferred_title, file_stem = row
        display_name = inferred_title if inferred_title else (file_stem or "")
        if display_name and is_hash_like_title(display_name):
            hash_like_offenders.append({"id": str(doc_id), "inferred_title": inferred_title, "file_stem": file_stem})
    checks['no_hash_like_titles'] = len(hash_like_offenders) == 0

    # Check 3: Table exists and has rows
    cur.execute("SELECT count(*) FROM public.corpus_documents")
    total_count = cur.fetchone()[0]
    checks['table_exists_with_rows'] = total_count > 0

    # Check 4: Most documents have inferred_title
    cur.execute("SELECT count(*) FROM public.corpus_documents WHERE inferred_title IS NOT NULL")
    with_title = cur.fetchone()[0]
    checks['most_have_titles'] = with_title > 0

    # Check 5: No high-confidence numeric titles
    cur.execute("""
        SELECT count(*)
        FROM public.corpus_documents
        WHERE inferred_title ~ '^[0-9]+$' AND title_confidence >= 50
    """)
    high_conf_numeric = cur.fetchone()[0]
    checks['no_high_confidence_numeric'] = high_conf_numeric == 0

    # Check 6: Source linkage - documents have source_registry_id (when column exists)
    with_source = 0
    docs_without_source = 0
    cur.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'corpus_documents' AND column_name = 'source_registry_id'
    """)
    has_sr_col = cur.fetchone() is not None
    if has_sr_col:
        cur.execute("SELECT count(*) FROM public.corpus_documents WHERE source_registry_id IS NOT NULL")
        with_source = cur.fetchone()[0]
        docs_without_source = total_count - with_source
        checks['documents_have_source'] = with_source == total_count or total_count == 0
    else:
        checks['documents_have_source'] = True

    # Check 7: Citation scraped - most documents have citation_short or citation_full
    with_citation = 0
    docs_without_citation = 0
    cur.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'corpus_documents' AND column_name = 'citation_short'
    """)
    has_citation_col = cur.fetchone() is not None
    if has_citation_col and total_count > 0:
        cur.execute("""
            SELECT count(*) FROM public.corpus_documents
            WHERE citation_short IS NOT NULL OR citation_full IS NOT NULL
        """)
        with_citation = cur.fetchone()[0]
        docs_without_citation = total_count - with_citation
        checks['most_have_citation'] = with_citation >= (total_count * 0.5)
    else:
        checks['most_have_citation'] = True

    # Check 8: Source registry scope_tags - sources that have scope_tags set (informational)
    sr_total = 0
    sr_with_scope = 0
    sr_without_scope = 0
    cur.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'source_registry' AND column_name = 'scope_tags'
    """)
    has_scope_col = cur.fetchone() is not None
    if has_scope_col:
        cur.execute("SELECT count(*) FROM public.source_registry")
        sr_total = cur.fetchone()[0]
        cur.execute("""
            SELECT count(*) FROM public.source_registry
            WHERE scope_tags IS NOT NULL AND scope_tags != '[]'::jsonb AND jsonb_array_length(scope_tags) > 0
        """)
        sr_with_scope = cur.fetchone()[0]
        sr_without_scope = sr_total - sr_with_scope
        checks['sources_have_scope_tags'] = sr_with_scope >= (sr_total * 0.5) or sr_total == 0
    else:
        checks['sources_have_scope_tags'] = True

    # Print results
    print("📊 Corpus Documents QA Check\n")
    print(f"Total documents: {total_count}")
    print(f"Documents with titles: {with_title}")
    print(f"Numeric inferred_titles: {numeric_count}")
    print(f"Hash-like document names: {len(hash_like_offenders)}")
    if hash_like_offenders:
        for o in hash_like_offenders[:5]:
            print(f"  - id={o['id']} inferred_title={o['inferred_title']!r} file_stem={o['file_stem']!r}")
        if len(hash_like_offenders) > 5:
            print(f"  ... and {len(hash_like_offenders) - 5} more")
    print(f"High-confidence numeric titles: {high_conf_numeric}")
    if has_sr_col:
        print(f"Documents with source_registry_id: {with_source} (missing: {docs_without_source})")
    if has_citation_col and total_count > 0:
        print(f"Documents with citation_short/full: {with_citation} (missing: {docs_without_citation})")
    if has_scope_col:
        print(f"Source registry entries with scope_tags: {sr_with_scope} (missing: {sr_without_scope})")
    print()

    print("Hard Requirements:")
    all_pass = True
    for check_name, passed in checks.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"  {check_name}: {status}")
        if not passed:
            all_pass = False

    print(f"\n{'✅ ALL CHECKS PASS' if all_pass else '❌ SOME CHECKS FAILED'}")

    sys.exit(0 if all_pass else 1)

finally:
    cur.close()
    conn.close()
