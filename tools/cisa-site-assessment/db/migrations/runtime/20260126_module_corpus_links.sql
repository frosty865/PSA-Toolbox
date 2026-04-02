-- RUNTIME: Module CORPUS Links (Read-Only Pointers)
-- Modules can attach CORPUS sources by storing ONLY the CORPUS source_registry_id
-- No copying, no promotion, no cross-database writes

BEGIN;

CREATE TABLE IF NOT EXISTS public.module_corpus_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_code text NOT NULL,
  corpus_source_registry_id uuid NOT NULL, -- ID FROM CORPUS DB (read-only reference)
  label text NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_module_corpus_links
  ON public.module_corpus_links(module_code, corpus_source_registry_id);

CREATE INDEX IF NOT EXISTS idx_module_corpus_links_module_code
  ON public.module_corpus_links(module_code);

COMMENT ON TABLE public.module_corpus_links IS 'Read-only pointers to CORPUS sources. No copying, no promotion. CORPUS remains read-only from modules.';

COMMIT;
