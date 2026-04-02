#!/usr/bin/env python3
"""Fix bad NIST source titles that say 'here'."""
import os, psycopg2, re
from urllib.parse import urlparse

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

# Find sources with bad "here" title
cur.execute("""
    SELECT source_id, title, uri, citation_text 
    FROM canonical_sources 
    WHERE (title = 'here' OR title = 'Here')
    AND (publisher = 'NIST' OR uri LIKE '%nist.gov%')
""")
bad_sources = cur.fetchall()

print(f"Found {len(bad_sources)} sources with bad 'here' title:")
for source_id, title, uri, citation_text in bad_sources[:5]:
    print(f"  {source_id}: {title} - {uri}")

# Fix each one
fixed = 0
for source_id, title, uri, citation_text in bad_sources:
    parsed = urlparse(uri)
    path_parts = [p for p in parsed.path.split('/') if p]
    
    if path_parts:
        last_part = path_parts[-1]
        # Remove PDF extension
        for suffix in ['.html', '.htm', '.pdf', '.aspx', '.php']:
            if last_part.lower().endswith(suffix):
                last_part = last_part[:-len(suffix)]
        
        # For NIST PDFs, extract document number
        new_title = None
        doc_match = re.search(r'(SP|NIST\.SP|NISTIR|FIPS)[\s\-\.]?(\d+[a-z]?[\-\.]?\d*[a-z]?[r]?\d*)', last_part, re.IGNORECASE)
        if doc_match:
            doc_type = doc_match.group(1).upper()
            doc_num = doc_match.group(2).upper()
            new_title = f"{doc_type} {doc_num}"
        else:
            # Use filename without extension, cleaned up
            new_title = last_part.replace('-', ' ').replace('_', ' ').replace('%20', ' ')
            new_title = ' '.join(word.capitalize() for word in new_title.split())
        
        if new_title and new_title != 'here' and new_title != 'Here':
            # Update citation_text too
            new_citation = f"NIST, {new_title}"
            
            cur.execute("""
                UPDATE canonical_sources
                SET title = %s, citation_text = %s
                WHERE source_id = %s
            """, (new_title[:200], new_citation[:300], source_id))
            fixed += 1
            print(f"  Fixed {source_id}: '{title}' -> '{new_title}'")

if fixed > 0:
    conn.commit()
    print(f"\nUpdated {fixed} sources")
else:
    print("\nNo sources to fix")

cur.close()
conn.close()
