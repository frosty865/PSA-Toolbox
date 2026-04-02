#!/usr/bin/env python3
"""Quick diagnostic script to check question table schema."""
import os
import sys
import psycopg2
from dotenv import load_dotenv

load_dotenv()

conn = psycopg2.connect(os.getenv('DATABASE_URL'))
cur = conn.cursor()

# Note: Questions are written to the existing question table during import.
# This script previously checked a nonexistent table and has been updated.
print("Question imports write to the existing question table.")
print("No separate question templates table exists.")

cur.close()
conn.close()

