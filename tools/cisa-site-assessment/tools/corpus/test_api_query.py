#!/usr/bin/env python3
import os, psycopg2, json

def load_env_file(filepath: str):
    if not os.path.exists(filepath):
        return
    with open(filepath, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip().strip('"').strip("'")

load_env_file('.env.local')
dsn = os.environ.get('CORPUS_DATABASE_URL') or os.environ.get('DATABASE_URL')
conn = psycopg2.connect(dsn)
cur = conn.cursor()

# Test the exact query from the API
query = """
  SELECT 
    ocq.candidate_id::text as id,
    ocq.snippet_text as ofc_text,
    ocq.title,
    1 as version,
    ocq.status,
    NULL as status_reason,
    CASE 
      WHEN cs.title ILIKE '%IST%VOFC%' OR cs.citation_text ILIKE '%IST%VOFC%' THEN 'IST_IMPORT'
      ELSE 'MINED'
    END as submitted_by,
    ocq.created_at as submitted_at,
    false as reference_unresolved,
    ocq.excerpt as evidence_excerpt,
    NULL as discipline,
    NULL as discipline_id,
    NULL as subtype,
    NULL as subtype_id,
    ocq.document_chunk_id,
    ocq.source_id,
    cs.title as source_title,
    cs.citation_text,
    cs.publisher as source_publisher,
    cs.published_date as source_published_date,
    cs.source_type,
    cs.uri as source_uri,
    dc.document_id,
    d.title as document_title,
    dc.locator_type,
    dc.locator,
    dc.page_number
  FROM public.ofc_candidate_queue ocq
  LEFT JOIN public.document_chunks dc ON ocq.document_chunk_id = dc.chunk_id
  LEFT JOIN public.documents d ON dc.document_id = d.document_id
  LEFT JOIN public.canonical_sources cs ON ocq.source_id = cs.source_id
  WHERE ocq.status = 'PENDING'
  ORDER BY ocq.created_at DESC
  LIMIT 5
"""

cur.execute(query)
rows = cur.fetchall()
cols = [desc[0] for desc in cur.description]

print(f'Found {len(rows)} rows')
print('\nFirst row:')
if rows:
    row_dict = dict(zip(cols, rows[0]))
    print(json.dumps({k: str(v) for k, v in row_dict.items()}, indent=2))
    print('\nCitation fields:')
    print(f'  source_id: {row_dict.get("source_id")}')
    print(f'  source_title: {row_dict.get("source_title")}')
    print(f'  citation_text: {row_dict.get("citation_text")}')
    print(f'  source_publisher: {row_dict.get("source_publisher")}')

cur.close()
conn.close()
