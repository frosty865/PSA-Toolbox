#!/usr/bin/env python3
"""Verify coverage_runs table exists."""

import os
from pathlib import Path
from dotenv import load_dotenv
import psycopg2

# Load environment
env_path = Path(__file__).parent.parent / "env.local"
if env_path.exists():
    load_dotenv(env_path)

try:
    conn = psycopg2.connect(os.getenv("DATABASE_URL"), sslmode='require')
    cur = conn.cursor()
    cur.execute("""
        SELECT COUNT(*) 
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'coverage_runs'
    """)
    exists = cur.fetchone()[0] > 0
    print(f"coverage_runs table exists: {exists}")
    
    if exists:
        cur.execute("SELECT COUNT(*) FROM public.coverage_runs")
        count = cur.fetchone()[0]
        print(f"Rows in coverage_runs: {count}")
    
    cur.close()
    conn.close()
except Exception as e:
    print(f"Error: {e}")

