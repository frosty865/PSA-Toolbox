#!/usr/bin/env python3
"""Check link_method distribution in ofc_question_links."""
import os
import psycopg2
import json

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
dsn = os.environ.get('RUNTIME_DATABASE_URL')
conn = psycopg2.connect(dsn)
cur = conn.cursor()

# Check link_method distribution
cur.execute("""
    SELECT link_method, COUNT(*) as count
    FROM public.ofc_question_links
    GROUP BY link_method
    ORDER BY count DESC
""")
print("Link methods:")
for row in cur.fetchall():
    print(f"  {row[0]}: {row[1]}")

# Check eligibility reasons
cur.execute("""
    SELECT 
        link_method,
        link_explanation::json->>'eligibility_reason' as reason,
        COUNT(*) as count
    FROM public.ofc_question_links
    WHERE link_explanation IS NOT NULL
    GROUP BY link_method, reason
    ORDER BY link_method, count DESC
""")
print("\nBy eligibility reason:")
for row in cur.fetchall():
    print(f"  {row[0]} / {row[1] or 'NULL'}: {row[2]}")

# Sample IST_VERIFIED links
cur.execute("""
    SELECT ofc_id, link_method, link_explanation::json->>'eligibility_reason' as reason
    FROM public.ofc_question_links
    WHERE link_method = 'IST_VERIFIED_LINK_V1'
    LIMIT 5
""")
ist_links = cur.fetchall()
if ist_links:
    print(f"\nSample IST_VERIFIED_LINK_V1 links ({len(ist_links)} shown):")
    for row in ist_links:
        print(f"  ofc_id={row[0]}, reason={row[2]}")

cur.close()
conn.close()
