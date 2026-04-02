-- Create coverage_runs table for Phase 2 coverage data
-- This table stores raw Phase 2 coverage payloads verbatim
-- Matches schema used by psaback ingestion

CREATE TABLE IF NOT EXISTS public.coverage_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id TEXT NOT NULL,
    schema_version TEXT,
    generated_at TIMESTAMPTZ,
    coverage_percent REAL,
    raw_payload JSONB NOT NULL,
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_coverage_runs_document_id 
        FOREIGN KEY (document_id) 
        REFERENCES public.documents(document_id) 
        ON DELETE CASCADE
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_coverage_runs_document_id ON public.coverage_runs(document_id);
CREATE INDEX IF NOT EXISTS idx_coverage_runs_schema_version ON public.coverage_runs(schema_version);
CREATE INDEX IF NOT EXISTS idx_coverage_runs_generated_at ON public.coverage_runs(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_coverage_runs_ingested_at ON public.coverage_runs(ingested_at DESC);
CREATE INDEX IF NOT EXISTS idx_coverage_runs_raw_payload ON public.coverage_runs USING GIN (raw_payload);

-- Add comment
COMMENT ON TABLE public.coverage_runs IS 'Phase 2 coverage outputs - stores raw coverage data verbatim';

