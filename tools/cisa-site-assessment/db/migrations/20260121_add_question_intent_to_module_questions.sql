-- Add question_intent column to module_questions if missing
-- This column was in the old schema but missing from the new migration

BEGIN;

-- Add question_intent column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'module_questions' 
    AND column_name = 'question_intent'
  ) THEN
    ALTER TABLE public.module_questions
      ADD COLUMN question_intent TEXT NOT NULL DEFAULT 'PHYSICAL_CONTROL'
      CHECK (question_intent IN (
        'PHYSICAL_CONTROL',
        'GOVERNANCE_INTERFACE',
        'CONTINUITY_OPERATIONS',
        'DETECTION_ALERTING_PHYSICAL'
      ));
    
    CREATE INDEX IF NOT EXISTS idx_module_questions_intent 
      ON public.module_questions(question_intent);
  END IF;
END $$;

COMMIT;
