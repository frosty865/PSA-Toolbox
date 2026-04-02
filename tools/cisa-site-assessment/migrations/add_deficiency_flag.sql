ALTER TABLE public.source_statements
ADD COLUMN IF NOT EXISTS deficiency_flag BOOLEAN DEFAULT FALSE;

