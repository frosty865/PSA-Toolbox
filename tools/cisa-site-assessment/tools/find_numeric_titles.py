#!/usr/bin/env python3
"""Find numeric inferred_title offenders."""

import sys
import json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from tools.backfill.backfill_document_citations import get_corpus_db_connection

conn = get_corpus_db_connection()
cur = conn.cursor()

try:
    cur.execute("""
        SELECT
          id,
          file_hash,
          original_filename,
          file_stem,
          inferred_title,
          title_confidence,
          pdf_meta_title,
          publisher,
          publication_date,
          canonical_path,
          ingestion_warnings
        FROM public.corpus_documents
        WHERE inferred_title ~ '^[0-9]+$'
    """)
    
    rows = cur.fetchall()
    colnames = [desc[0] for desc in cur.description]
    
    offenders = []
    for row in rows:
        offender = dict(zip(colnames, row))
        # Convert ingestion_warnings from JSONB to list
        if offender['ingestion_warnings']:
            offender['ingestion_warnings'] = offender['ingestion_warnings']
        offenders.append(offender)
    
    print(f"Found {len(offenders)} numeric inferred_title offenders:")
    for o in offenders:
        print(f"  - ID: {o['id']}, inferred_title: '{o['inferred_title']}', file_stem: '{o['file_stem']}', file: {o['canonical_path']}")
    
    # Save to JSON
    reports_dir = Path('analytics/reports')
    reports_dir.mkdir(parents=True, exist_ok=True)
    
    report_path = reports_dir / 'numeric_inferred_title_offenders.json'
    with open(report_path, 'w') as f:
        json.dump({
            'count': len(offenders),
            'offenders': offenders
        }, f, indent=2, default=str)
    
    print(f"\n✅ Report saved to: {report_path}")
    
finally:
    cur.close()
    conn.close()
