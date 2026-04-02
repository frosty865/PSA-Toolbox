#!/usr/bin/env python3
import sys
sys.path.insert(0, 'tools/corpus')
from discover_linking_schema import get_corpus_db, pick_ofc_table, find_table_by_name

corpus_conn = get_corpus_db()
print("Checking CORPUS for ofc_candidate_queue...")
if find_table_by_name(corpus_conn, "ofc_candidate_queue"):
    print("Found ofc_candidate_queue!")
    oinfo = pick_ofc_table(corpus_conn, prefer_candidates=True)
    print(f"Selected table: {oinfo['name']}")
    print(f"ID col: {oinfo['ofc_id_col']}")
    print(f"Text col: {oinfo['ofc_text_col']}")
else:
    print("NOT found")

corpus_conn.close()
