#!/usr/bin/env python3
import argparse, json, os, re, sys
from pathlib import Path
from typing import Any, Dict, List, Tuple, Optional
from urllib.parse import urlparse

# Try to import pandas for VOFC reference mapping
try:
    import pandas as pd
    HAS_PANDAS = True
except ImportError:
    HAS_PANDAS = False

def load_env_file(filepath: str):
    """Load environment variables from .env.local file."""
    if not os.path.exists(filepath):
        return
    with open(filepath, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key.strip()] = value.strip().strip('"').strip("'")

def die(msg: str):
    print(f"[FAIL] {msg}", file=sys.stderr)
    sys.exit(1)

def get_db():
    import psycopg2  # type: ignore
    load_env_file('.env.local')
    
    dsn = os.environ.get("CORPUS_DATABASE_URL") or os.environ.get("DATABASE_URL")
    if dsn:
        return psycopg2.connect(dsn)
    
    corpus_url = os.getenv('SUPABASE_CORPUS_URL')
    corpus_password = os.getenv('SUPABASE_CORPUS_DB_PASSWORD')
    
    if corpus_url and corpus_password:
        clean_password = corpus_password.strip().strip('"').strip("'").replace('\\', '')
        clean_url = corpus_url.strip().strip('"').strip("'").replace('\\', '').replace(' ', '')
        url = urlparse(clean_url)
        project_ref = url.hostname.split('.')[0] if url.hostname else None
        if not project_ref:
            die(f"Could not parse project_ref from CORPUS_URL: {corpus_url}")
        connection_string = f'postgresql://postgres:{clean_password}@db.{project_ref}.supabase.co:6543/postgres?sslmode=require'
        try:
            return psycopg2.connect(connection_string)
        except Exception:
            connection_string = f'postgresql://postgres:{clean_password}@db.{project_ref}.supabase.co:5432/postgres?sslmode=require'
            return psycopg2.connect(connection_string)
    
    die("Missing CORPUS_DATABASE_URL (or DATABASE_URL) or SUPABASE_CORPUS_URL + SUPABASE_CORPUS_DB_PASSWORD.")

def q(cur, sql: str, params: Tuple[Any,...]=()):
    cur.execute(sql, params)
    if cur.description:
        cols = [d[0] for d in cur.description]
        rows = cur.fetchall()
    else:
        cols = []
        rows = []
    return cols, rows

def table_cols(cur, table: str) -> List[str]:
    _, rows = q(cur, """
      SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name=%s
      ORDER BY ordinal_position
    """, (table,))
    return [r[0] for r in rows]

def table_exists(cur, table: str) -> bool:
    _, rows = q(cur, """
      SELECT 1 FROM information_schema.tables
      WHERE table_schema='public' AND table_name=%s
    """, (table,))
    return bool(rows)

def find_candidates_table(cur) -> Tuple[str, Dict[str,str]]:
    """
    Prefer ofc_candidate_queue. Otherwise find a table containing 'ofc' and with a usable text column.
    Returns (qualified_table, colmap)
    """
    if table_exists(cur, "ofc_candidate_queue"):
        cols = table_cols(cur, "ofc_candidate_queue")
        colmap = {}
        # Try multiple common ID column names
        colmap["id"] = ("id" if "id" in cols else 
                       "candidate_id" if "candidate_id" in cols else
                       "ofc_candidate_id" if "ofc_candidate_id" in cols else
                       "ofc_id" if "ofc_id" in cols else
                       die("ofc_candidate_queue missing id column (checked: id, candidate_id, ofc_candidate_id, ofc_id)"))
        colmap["text"] = ("candidate_text" if "candidate_text" in cols else 
                         "ofc_text" if "ofc_text" in cols else 
                         "snippet_text" if "snippet_text" in cols else 
                         die("No candidate_text/ofc_text/snippet_text"))
        colmap["status"] = "status" if "status" in cols else None
        colmap["submitted_by"] = "submitted_by" if "submitted_by" in cols else None
        colmap["title"] = "title" if "title" in cols else None
        colmap["subtype_id"] = "discipline_subtype_id" if "discipline_subtype_id" in cols else None
        colmap["source_tag"] = "source_tag" if "source_tag" in cols else None  # optional
        return "public.ofc_candidate_queue", colmap

    # fallback search
    _, rows = q(cur, """
      SELECT table_name FROM information_schema.tables
      WHERE table_schema='public' AND table_name ILIKE '%ofc%'
      ORDER BY table_name
    """)
    for (t,) in rows:
        cols = table_cols(cur, t)
        id_col = ("id" if "id" in cols else
                 "candidate_id" if "candidate_id" in cols else
                 "ofc_candidate_id" if "ofc_candidate_id" in cols else
                 "ofc_id" if "ofc_id" in cols else None)
        if not id_col:
            continue
        text_col = ("candidate_text" if "candidate_text" in cols else 
                   "ofc_text" if "ofc_text" in cols else 
                   "snippet_text" if "snippet_text" in cols else None)
        if not text_col:
            continue
        colmap = {"id": id_col, "text": text_col,
                  "status":"status" if "status" in cols else None,
                  "submitted_by":"submitted_by" if "submitted_by" in cols else None,
                  "title":"title" if "title" in cols else None,
                  "subtype_id":"discipline_subtype_id" if "discipline_subtype_id" in cols else None,
                  "source_tag":"source_tag" if "source_tag" in cols else None}
        return f"public.{t}", colmap

    die("No OFC candidate table found.")

def find_citations_table(cur) -> Tuple[str, Dict[str,str]]:
    """
    Prefer ofc_library_citations with (ofc_id or candidate_id) and document_chunk_id.
    Also check if candidate table has direct document_chunk_id FK.
    """
    # Check if candidate table itself has document_chunk_id (direct FK approach)
    cand_table, cand_cols = find_candidates_table(cur)
    if "document_chunk_id" in table_cols(cur, cand_table.replace("public.", "")):
        # Direct FK - citations are embedded in candidate table
        return cand_table, {"ofc_fk": cand_cols["id"], "chunk_fk": "document_chunk_id", "use_direct_fk": True}
    
    if table_exists(cur, "ofc_library_citations"):
        cols = table_cols(cur, "ofc_library_citations")
        ofc_fk = "ofc_id" if "ofc_id" in cols else ("candidate_id" if "candidate_id" in cols else None)
        chunk_fk = "document_chunk_id" if "document_chunk_id" in cols else ("chunk_id" if "chunk_id" in cols else None)
        if not ofc_fk or not chunk_fk:
            die("ofc_library_citations exists but missing ofc/candidate fk or chunk fk.")
        return "public.ofc_library_citations", {"ofc_fk": ofc_fk, "chunk_fk": chunk_fk, "use_direct_fk": False}

    # fallback search
    _, rows = q(cur, """
      SELECT table_name FROM information_schema.tables
      WHERE table_schema='public' AND table_name ILIKE '%citation%'
      ORDER BY table_name
    """)
    for (t,) in rows:
        cols = table_cols(cur, t)
        chunk_fk = "document_chunk_id" if "document_chunk_id" in cols else None
        ofc_fk = "ofc_id" if "ofc_id" in cols else ("candidate_id" if "candidate_id" in cols else None)
        if chunk_fk and ofc_fk:
            return f"public.{t}", {"ofc_fk": ofc_fk, "chunk_fk": chunk_fk, "use_direct_fk": False}

    die("No citations table found.")

def find_link_table(cur) -> Optional[str]:
    # optional; only used to delete links referencing mined OFCs
    if table_exists(cur, "ofc_question_links"):
        return "public.ofc_question_links"
    return None

def load_vofc_reference_mapping() -> Dict[int, Dict[str, str]]:
    """Load VOFC Library spreadsheet and return mapping of OFC # -> reference info."""
    if not HAS_PANDAS:
        return {}
    
    xlsx_path = Path("docs/reference/VOFC_Library.xlsx")
    if not xlsx_path.exists():
        return {}
    
    try:
        df = pd.read_excel(xlsx_path, header=0)
        df.columns = ['Parent Question', 'Child Question', 'V #', 'Vulnerability', 'OFC #', 'Option for Consideration', 'Reference']
        
        # Filter to rows with both OFC # and Reference
        df = df[df['OFC #'].notna()]
        df = df[df['Reference'].notna()]
        df = df[df['OFC #'] != 'OFC #']  # Remove header row if present
        
        mapping = {}
        
        for _, row in df.iterrows():
            ofc_num = row['OFC #']
            reference = str(row['Reference']).strip()
            
            if not reference or reference == 'Reference':
                continue
            
            # Convert OFC # to int if possible
            try:
                ofc_num = int(float(ofc_num))
            except (ValueError, TypeError):
                continue
            
            # Extract URL from reference
            url_match = re.search(r'https?://[^\s,)]+', reference)
            url = url_match.group(0) if url_match else None
            
            # Extract publisher (usually first word before comma)
            publisher_match = re.match(r'^([^,]+),', reference)
            publisher = publisher_match.group(1).strip() if publisher_match else None
            
            # Extract title (look for text after em-dash or between commas)
            title_match = re.search(r'[–-]\s*([^,]+?)(?:\s*\([^)]+\))?,', reference)
            if not title_match:
                # Try finding text between publisher and year
                title_match = re.search(r',\s*([^,]+?)(?:\s*\([^)]+\))?,\s*\d{4}', reference)
            title = title_match.group(1).strip() if title_match else None
            
            # Clean up title
            if title:
                title = re.sub(r'\s+', ' ', title).strip()
            
            # Generate citation_text (use full reference, or create from parts)
            if publisher and title:
                citation_text = f"{publisher}, {title}"
            elif publisher:
                citation_text = publisher
            else:
                citation_text = reference[:200]  # Truncate if too long
            
            mapping[ofc_num] = {
                'citation_text': reference[:500],  # Use full reference
                'url': url,
                'publisher': publisher,
                'title': title or publisher or "Unknown"
            }
        
        return mapping
    except Exception as e:
        print(f"[WARN] Could not load VOFC reference mapping: {e}")
        return {}

def get_or_create_source_from_url(cur, conn, url: str, label: str = None, vofc_ref: Dict[str, str] = None) -> Tuple[Optional[str], bool]:
    """
    Get or create a source in canonical_sources from a URL.
    Returns (source_id UUID, was_created: bool), or (None, False) if URL is invalid/empty.
    """
    if not url or not url.strip() or url == "#":
        return None, False
    
    url = url.strip()
    
    # Check if source with this URI already exists
    cur.execute("""
        SELECT source_id FROM public.canonical_sources
        WHERE uri = %s
        LIMIT 1
    """, (url,))
    row = cur.fetchone()
    
    if row:
        return str(row[0]), False
    
    # Extract domain/publisher from URL
    parsed = urlparse(url)
    domain = parsed.netloc or parsed.path.split('/')[0] if parsed.path else None
    
    # Initialize title and citation_text
    title = None
    citation_text = None
    
    # Determine publisher from domain
    publisher = None
    if domain:
        if 'dhs.gov' in domain.lower():
            publisher = 'DHS'
        elif 'fema.gov' in domain.lower():
            publisher = 'FEMA'
        elif 'nist.gov' in domain.lower():
            publisher = 'NIST'
        elif 'asisonline.org' in domain.lower():
            publisher = 'ASIS'
        elif 'nfpa.org' in domain.lower():
            publisher = 'NFPA'
        elif 'iso.org' in domain.lower():
            publisher = 'ISO'
        elif 'bsigroup.com' in domain.lower():
            publisher = 'BSI'
        elif 'ready.gov' in domain.lower():
            publisher = 'Ready.gov'
        elif 'fbi.gov' in domain.lower():
            publisher = 'FBI'
        elif 'cdc.gov' in domain.lower():
            publisher = 'CDC'
        else:
            # Use domain as publisher
            publisher = domain.replace('www.', '').split('.')[0].upper()
    
    # Use VOFC reference if provided (from spreadsheet)
    if vofc_ref:
        title = vofc_ref.get('title') or title
        publisher = vofc_ref.get('publisher') or publisher
        citation_text = vofc_ref.get('citation_text') or citation_text
    
    # Generate title from URL or label if not from VOFC ref
    if not title or title == "Unknown":
        # Skip bad labels like "here", "Source", URLs, etc.
        if label and label.strip() and label not in ["Source", "here", "Here"] and not label.startswith("http"):
            title = label.strip()
        else:
            # Extract title from URL path - make it more readable
            path_parts = [p for p in parsed.path.split('/') if p]
            if path_parts:
                # Take the last meaningful part of the path
                last_part = path_parts[-1]
                # Decode URL encoding
                import urllib.parse
                last_part = urllib.parse.unquote(last_part)
                
                # Remove common URL suffixes first
                for suffix in ['.html', '.htm', '.pdf', '.aspx', '.php']:
                    if last_part.lower().endswith(suffix):
                        last_part = last_part[:-len(suffix)]
                
                # For NIST PDFs, extract document number (e.g., SP800-84, NIST.SP.800-53r4)
                if 'nist.gov' in domain.lower() and last_part:
                    # Try to extract document identifier
                    doc_match = re.search(r'(SP|NIST\.SP|NISTIR|FIPS)[\s\-\.]?(\d+[a-z]?[\-\.]?\d*[a-z]?[r]?\d*)', last_part, re.IGNORECASE)
                    if doc_match:
                        doc_type = doc_match.group(1).upper()
                        doc_num = doc_match.group(2).upper()
                        title = f"{doc_type} {doc_num}"
                    else:
                        # Use filename without extension
                        title = last_part.replace('-', ' ').replace('_', ' ').replace('%20', ' ')
                        # Capitalize properly
                        title = ' '.join(word.capitalize() for word in title.split())
                else:
                    # Clean up the title for other sources
                    title = last_part.replace('-', ' ').replace('_', ' ').replace('%20', ' ')
                    # Capitalize properly
                    title = ' '.join(word.capitalize() for word in title.split())
            else:
                # Use domain name as fallback
                if domain:
                    title = domain.replace('www.', '').split('.')[0].replace('-', ' ').title()
                else:
                    title = "Web Source"
    
    # Generate citation_text if not from VOFC ref
    if not citation_text or citation_text == title:
        if publisher:
            citation_text = f"{publisher}, {title}"
        else:
            citation_text = title
    
    # Determine source_type
    source_type = 'WEB'
    if url.lower().endswith('.pdf'):
        source_type = 'PDF'
    elif 'pdf' in url.lower():
        source_type = 'PDF'
    
    # Create source
    cur.execute("""
        INSERT INTO public.canonical_sources
        (title, publisher, source_type, uri, citation_text)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING source_id
    """, (
        title[:200],  # Limit title length
        publisher[:100] if publisher else None,  # Limit publisher length
        source_type,
        url[:500],  # Limit URI length
        citation_text[:300]  # Limit citation_text length
    ))
    
    source_id = cur.fetchone()[0]
    conn.commit()
    return str(source_id), True

def get_or_create_ist_source(cur, conn) -> str:
    """Get or create generic IST source in canonical_sources. Returns source_id UUID."""
    # Check if IST source exists (by citation_text or title) - but avoid the bad "Downloading" title
    cur.execute("""
        SELECT source_id FROM public.canonical_sources
        WHERE (title ILIKE '%IST%VOFC%' OR citation_text ILIKE '%IST%VOFC%')
        AND title NOT ILIKE '%Downloading%'
        LIMIT 1
    """)
    row = cur.fetchone()
    
    if row:
        return str(row[0])
    
    # Create IST source in canonical_sources with proper title
    citation_text = "DHS, IST VOFC (Options for Consideration)"
    cur.execute("""
        INSERT INTO public.canonical_sources
        (title, publisher, source_type, uri, citation_text)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING source_id
    """, (
        'IST VOFC (Options for Consideration)',
        'DHS',
        'WEB',
        'https://www.dhs.gov/publication/ist-vofc',
        citation_text
    ))
    
    source_id = cur.fetchone()[0]
    conn.commit()
    return str(source_id)

def load_ist_json() -> List[Dict[str,Any]]:
    p = Path("analytics/extracted/ist_vofc_all.json")
    if not p.exists():
        die("Missing analytics/extracted/ist_vofc_all.json (run IST extractor first).")
    data = json.loads(p.read_text(encoding="utf-8"))
    ofcs = data.get("ofcs", [])
    if not isinstance(ofcs, list) or not ofcs:
        die("ist_vofc_all.json missing ofcs[]")
    return ofcs

def norm_ws(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "")).strip()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--purge-only", action="store_true")
    ap.add_argument("--import-only", action="store_true")
    ap.add_argument("--submitted-by-mined", type=str, default="MINED")
    ap.add_argument("--submitted-by-ist", type=str, default="IST_IMPORT")
    ap.add_argument("--status-pending", type=str, default="PENDING")
    args = ap.parse_args()

    if args.purge_only and args.import_only:
        die("Choose --purge-only or --import-only, not both.")

    conn = get_db()
    cur = conn.cursor()

    cand_table, cand_cols = find_candidates_table(cur)
    cite_table, cite_cols = find_citations_table(cur)
    link_table = find_link_table(cur)

    # Identify mined candidate ids to purge
    mined_ids: List[Any] = []
    where = []
    params: List[Any] = []
    if cand_cols["submitted_by"]:
        where.append(f"{cand_cols['submitted_by']}=%s")
        params.append(args.submitted_by_mined)
    if cand_cols["status"]:
        where.append(f"{cand_cols['status']}=%s")
        params.append(args.status_pending)

    if where:
        sql = f"SELECT {cand_cols['id']} AS id FROM {cand_table} WHERE " + " AND ".join(where)
    else:
        # If table lacks these columns, do NOT risk wiping everything.
        die(f"Candidate table {cand_table} lacks submitted_by/status columns; refusing to auto-purge.")
    _, rows = q(cur, sql, tuple(params))
    mined_ids = [r[0] for r in rows]

    # Stats
    print(f"[INFO] Candidate table: {cand_table}")
    print(f"[INFO] Citations table: {cite_table}")
    print(f"[INFO] Link table: {link_table or 'NONE'}")
    print(f"[INFO] Mined PENDING candidates to purge: {len(mined_ids)}")

    # Purge phase
    if not args.import_only:
        if mined_ids:
            if args.apply:
                # delete citations first (if separate table)
                if not cite_cols.get("use_direct_fk", False):
                    cur.execute(f"DELETE FROM {cite_table} WHERE {cite_cols['ofc_fk']} = ANY(%s);", (mined_ids,))
                # delete links (if any reference these ids as ofc_id uuid; may not match if ids aren't uuid)
                if link_table:
                    # best-effort: attempt delete where ofc_id in mined_ids; if type mismatch, DB will error
                    try:
                        cur.execute(f"DELETE FROM {link_table} WHERE ofc_id = ANY(%s::uuid[]);", (mined_ids,))
                    except Exception as e:
                        conn.rollback()
                        cur = conn.cursor()
                        print(f"[WARN] Could not delete from {link_table} (type mismatch likely). Skipping link purge.")
                # delete candidates - cast array to UUID if needed
                try:
                    cur.execute(f"DELETE FROM {cand_table} WHERE {cand_cols['id']} = ANY(%s::uuid[]);", (mined_ids,))
                except Exception as e:
                    # If UUID cast fails, try without cast (might be text or integer)
                    cur.execute(f"DELETE FROM {cand_table} WHERE {cand_cols['id']} = ANY(%s);", (mined_ids,))
                conn.commit()
                print("[OK] Purged mined candidates + citations.")
            else:
                print("[DRY RUN] Would delete mined candidates + citations (use --apply).")
        else:
            print("[OK] No mined candidates found to purge.")

    # Import phase (IST word-for-word)
    if not args.purge_only:
        # Load VOFC reference mapping from spreadsheet
        vofc_refs = load_vofc_reference_mapping()
        print(f"[INFO] Loaded {len(vofc_refs)} VOFC references from spreadsheet")
        
        # Get fallback IST source_id (used if OFC has no source_urls)
        fallback_ist_source_id = get_or_create_ist_source(cur, conn)
        print(f"[INFO] Fallback IST source_id: {fallback_ist_source_id}")
        
        ist = load_ist_json()
        text_col = cand_cols["text"]
        ins_cols = [text_col]
        
        # Check if source_id column exists and is required
        if "source_id" in table_cols(cur, cand_table.replace("public.", "")):
            ins_cols.append("source_id")
        
        if cand_cols["submitted_by"]:
            ins_cols.append(cand_cols["submitted_by"])
        if cand_cols["status"]:
            ins_cols.append(cand_cols["status"])
        if cand_cols["title"]:
            ins_cols.append(cand_cols["title"])
        if cand_cols["source_tag"]:
            ins_cols.append(cand_cols["source_tag"])

        inserted = 0
        skipped_dupe = 0
        sources_created = 0
        sources_reused = 0
        seen_source_urls = set()  # Track URLs we've seen to count new vs reused

        # Build a set of existing texts to avoid duplicates (word-for-word)
        _, existing_rows = q(cur, f"SELECT {text_col} FROM {cand_table};")
        existing_texts = set(norm_ws(r[0]) for r in existing_rows if r and r[0])

        for o in ist:
            txt = norm_ws(o.get("ofc_text","") or o.get("text",""))
            if not txt:
                continue

            # WORD-FOR-WORD: no rewriting, no prefix insertion
            if txt in existing_texts:
                skipped_dupe += 1
                continue

            vals = [txt]
            
            # Determine source_id from source_urls
            source_urls = o.get("source_urls", [])
            source_labels = o.get("source_labels", [])
            ofc_num = o.get("ofc_num") or o.get("number")
            
            # Check if we have a VOFC reference mapping for this OFC number
            vofc_ref = None
            if ofc_num:
                try:
                    ofc_num_int = int(float(ofc_num))
                    vofc_ref = vofc_refs.get(ofc_num_int)
                except (ValueError, TypeError):
                    pass
            
            source_id = None
            if source_urls and len(source_urls) > 0:
                # Use first valid source URL
                for i, url in enumerate(source_urls):
                    if not url or url.strip() == "#":
                        continue
                    url = url.strip()
                    label = source_labels[i] if i < len(source_labels) else None
                    created_source_id, was_created = get_or_create_source_from_url(cur, conn, url, label, vofc_ref)
                    if created_source_id:
                        if was_created:
                            sources_created += 1
                        else:
                            sources_reused += 1
                        source_id = created_source_id
                        break
            
            # Fallback to generic IST source if no URL found
            if not source_id:
                source_id = fallback_ist_source_id
            
            # Add source_id if column exists
            if "source_id" in ins_cols:
                vals.append(source_id)
            
            if cand_cols["submitted_by"]:
                vals.append(args.submitted_by_ist)
            if cand_cols["status"]:
                vals.append(args.status_pending)
            if cand_cols["title"]:
                # deterministic title: use IST ofc_num if present; else blank
                n = o.get("ofc_num") or o.get("number")
                vals.append(f"IST OFC {int(n)}" if isinstance(n, (int, str)) and str(n).isdigit() else None)
            if cand_cols["source_tag"]:
                vals.append("IST")

            placeholders = ", ".join(["%s"]*len(vals))
            collist = ", ".join(ins_cols)

            if args.apply:
                cur.execute(f"INSERT INTO {cand_table} ({collist}) VALUES ({placeholders}) RETURNING {cand_cols['id']};", tuple(vals))
                new_id = cur.fetchone()[0]

                # Bind citations ONLY if you have resolvable chunk bindings.
                # IST URLs are web/PDF links, not document_chunks. Do NOT fabricate chunk citations here.
                # (You will ingest PDFs/web sources separately and then bind citations deterministically.)
                inserted += 1
            else:
                inserted += 1

            existing_texts.add(txt)

        if args.apply:
            conn.commit()
            print(f"[OK] Imported IST OFCs word-for-word: {inserted} (skipped duplicates: {skipped_dupe})")
            print(f"[INFO] Sources: {sources_created} created, {sources_reused} reused")
        else:
            print(f"[DRY RUN] Would import IST OFCs word-for-word: {inserted} (skipped duplicates: {skipped_dupe})")
            print(f"[INFO] Sources: {sources_created} created, {sources_reused} reused")

    cur.close()
    conn.close()

if __name__ == "__main__":
    main()
