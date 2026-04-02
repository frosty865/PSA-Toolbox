-- Migration: Create authoritative OFC-Question Links table
-- Purpose: Store high-confidence, auditable links between OFCs and questions
-- Date: 2026-02-01

CREATE TABLE IF NOT EXISTS public.ofc_question_links (
    question_canon_id TEXT NOT NULL,
    ofc_id UUID NOT NULL,
    link_score REAL NOT NULL,
    link_method TEXT NOT NULL,
    link_explanation JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT ofc_question_links_pk
        PRIMARY KEY (question_canon_id, ofc_id)
);

CREATE INDEX IF NOT EXISTS idx_ofc_question_links_ofc
    ON public.ofc_question_links (ofc_id);

CREATE INDEX IF NOT EXISTS idx_ofc_question_links_question
    ON public.ofc_question_links (question_canon_id);
