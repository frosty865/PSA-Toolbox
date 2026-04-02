# Apply Migration: assessment_question_responses

## Method 1: Supabase SQL Editor (Recommended)

1. Open Supabase Dashboard: https://supabase.com/dashboard
2. Select the **RUNTIME** project (wivohgbuuwxoyfyzntsd)
3. Navigate to **SQL Editor**
4. Click **New Query**
5. Copy and paste the entire contents of `migrations/2026_01_14_assessment_question_responses.sql`
6. Click **Run** (or press Ctrl+Enter)
7. Verify success: You should see "Success. No rows returned"

## Method 2: Python Script (If Python is configured)

```bash
python tools/runtime/run_migration.py migrations/2026_01_14_assessment_question_responses.sql
```

## Verification

After applying, verify the tables exist:

```sql
-- Check assessment_question_responses table
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'assessment_question_responses'
ORDER BY ordinal_position;

-- Check assessment_status table
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'assessment_status'
ORDER BY ordinal_position;

-- Check indexes
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename IN ('assessment_question_responses', 'assessment_status');
```

Expected results:
- `assessment_question_responses` table with columns: id, assessment_id, question_code, response_enum, detail, updated_at
- `assessment_status` table with columns: assessment_id, status, updated_at
- Index `idx_aqr_assessment` on `assessment_question_responses(assessment_id)`

