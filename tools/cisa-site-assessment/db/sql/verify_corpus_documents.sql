-- TARGET DB: Supabase Postgres (psa-back)
-- Schema: public
-- Purpose: Verify corpus_documents table exists and has expected structure

-- Check if table exists
SELECT to_regclass('public.corpus_documents') as corpus_documents_table;

-- List all columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema='public' AND table_name='corpus_documents'
ORDER BY ordinal_position;

-- Count rows (if table exists)
SELECT COUNT(*) as total_documents
FROM public.corpus_documents;

-- Check indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'corpus_documents';

-- Check trigger
SELECT trigger_name, event_manipulation, event_object_table, action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public' AND event_object_table = 'corpus_documents';
