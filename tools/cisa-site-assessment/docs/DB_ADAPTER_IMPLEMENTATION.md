# Database Adapter Implementation

## Overview

Standardized database connection system for the meaning pipeline and other scripts. Provides fail-fast configuration with Postgres (preferred) and Supabase REST (fallback) support.

## Architecture

### Components

1. **DB Configuration** (`model/db/db_config.py`)
   - Single source of truth for DB connection configuration
   - Auto-detects connection mode (Postgres vs REST)
   - Loads `.env.local` automatically
   - Provides clear error messages for missing configuration

2. **Postgres Client** (`model/db/pg_client.py`)
   - Uses psycopg2 (fallback to psycopg3 if available)
   - Fail-fast connection with clear error messages
   - Supports both pooler (6543) and direct (5432) ports
   - Provides `query()` and `execute()` methods

3. **Supabase REST Client** (`model/db/supabase_client.py`)
   - Fallback client using PostgREST API
   - Uses SERVICE_ROLE_KEY for authentication
   - Provides `query()` and `upsert()` methods
   - Handles PostgREST query syntax

4. **Unified Adapter** (`model/db/db.py`)
   - Single interface for all DB operations
   - Automatically selects Postgres or REST mode
   - Exposes `db_select()` and `db_upsert_question_meaning()`
   - No direct connection management needed

5. **Smoketest** (`tools/db/db_smoketest.py`)
   - Verifies database connectivity
   - Checks required tables/views exist
   - Provides actionable error messages

## Configuration Priority

The system selects connection mode in this order:

1. **Postgres Mode** (preferred):
   - `DATABASE_URL` (full PostgreSQL connection string)
   - OR `SUPABASE_RUNTIME_URL` + `SUPABASE_RUNTIME_DB_PASSWORD`

2. **Supabase REST Mode** (fallback):
   - `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`
   - OR `SUPABASE_RUNTIME_URL` + `SUPABASE_RUNTIME_SERVICE_ROLE_KEY`

## Usage

### In Scripts

```python
from model.db.db import db_select, db_upsert_question_meaning

# Query data
rows = db_select("SELECT * FROM public.corpus_documents LIMIT 10")

# Upsert question meaning
db_upsert_question_meaning(
    canon_id="BASE-ACS",
    discipline="ACS",
    meaning_text="...",
    citations=[...],
    model_name="llama2",
    warnings=[]
)
```

### Testing Configuration

```bash
# Run smoketest
python tools/db/db_smoketest.py
```

This verifies:
- Database connection works
- Required tables/views exist
- Configuration is correct

## Error Messages

The system provides clear, actionable error messages:

- **Missing configuration**: Lists exactly which env vars are missing
- **Authentication failures**: Points to password/key configuration
- **SSL errors**: Suggests adding `sslmode=require`
- **Connection timeouts**: Suggests checking network/firewall

## Integration

### Updated Modules

- `model/meaning/retrieve_evidence.py`: Uses `db_select()` for corpus queries
- `tools/meaning/build_core_14_meaning.py`: Uses `db_select()` and `db_upsert_question_meaning()`

### No Direct Connections

All database access now goes through `model/db/db.py`. No scripts should create direct `psycopg2.connect()` calls.

## Environment Variables

### Required (choose one option)

**Option 1 - Direct Postgres (preferred):**
```
DATABASE_URL=postgresql://postgres:password@host:port/postgres?sslmode=require
```

**Option 2 - Supabase Postgres:**
```
SUPABASE_RUNTIME_URL=https://xxxxx.supabase.co
SUPABASE_RUNTIME_DB_PASSWORD=your_password
```

**Option 3 - Supabase REST (fallback):**
```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Troubleshooting

### Connection Timeout

- Check firewall rules
- Verify database is accessible from your network
- Try direct port (5432) instead of pooler (6543)

### Authentication Failed

- Verify password/key is correct
- Check for extra spaces/quotes in env vars
- Ensure SERVICE_ROLE_KEY (not ANON_KEY) for REST mode

### Table Not Found

- Run migrations: `db/migrations/20260118_create_question_meaning.sql`
- Create views: `db/sql/create_citation_ready_statements_view.sql`
- Verify you're connecting to correct database
