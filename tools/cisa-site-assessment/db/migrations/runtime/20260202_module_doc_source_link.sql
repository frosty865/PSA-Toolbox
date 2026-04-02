-- RUNTIME: Bridge table linking module documents (by doc_sha256) to CORPUS source_registry.
-- Enables standard/generate to attach authoritative citations (source_registry_id) for module chunks.
-- Populate via: npx tsx tools/corpus/backfill_module_sources_to_corpus.ts <module_code>

CREATE TABLE IF NOT EXISTS public.module_doc_source_link (
  module_code text NOT NULL,
  doc_sha256 text NOT NULL,
  source_registry_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (module_code, doc_sha256)
);

COMMENT ON TABLE public.module_doc_source_link IS
'Links RUNTIME module documents (by sha256) to CORPUS source_registry.id. No FK to CORPUS (cross-database). Populated by backfill_module_sources_to_corpus.';

COMMENT ON COLUMN public.module_doc_source_link.source_registry_id IS
'CORPUS source_registry.id (UUID). Used when exporting chunks so citations reference CORPUS evidence registry.';

CREATE INDEX IF NOT EXISTS idx_module_doc_source_link_module_code
  ON public.module_doc_source_link(module_code);
CREATE INDEX IF NOT EXISTS idx_module_doc_source_link_source_registry_id
  ON public.module_doc_source_link(source_registry_id);
