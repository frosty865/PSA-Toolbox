-- CORPUS: One-off removal of "School Security Field Assessment Workbook".
-- Run AFTER clearing RUNTIME references to the source_registry id (module_sources,
-- module_corpus_links, module_ofc_citations, module_doc_source_link, module_chunk_comprehension).
--
-- To get the source_registry id first (for RUNTIME cleanup):
--   SELECT id FROM public.source_registry WHERE title ILIKE '%School Security Field Assessment Workbook%';
--
-- Preferred: use scripts/remove_school_security_workbook.ts which does CORPUS + RUNTIME + optional file delete.

DO $$
DECLARE
  doc_ids uuid[];
  chunk_ids text[];
BEGIN
  SELECT array_agg(id) INTO doc_ids
  FROM public.corpus_documents
  WHERE source_registry_id IN (
    SELECT id FROM public.source_registry WHERE title ILIKE '%School Security Field Assessment Workbook%'
  );

  IF doc_ids IS NULL OR array_length(doc_ids, 1) IS NULL THEN
    RAISE NOTICE 'No corpus_documents found for School Security Field Assessment Workbook.';
    DELETE FROM public.module_standard_citations WHERE source_registry_id IN (SELECT id FROM public.source_registry WHERE title ILIKE '%School Security Field Assessment Workbook%');
    UPDATE public.module_standard_references SET source_registry_id = NULL WHERE source_registry_id IN (SELECT id FROM public.source_registry WHERE title ILIKE '%School Security Field Assessment Workbook%');
    DELETE FROM public.source_registry WHERE title ILIKE '%School Security Field Assessment Workbook%';
    RAISE NOTICE 'Removed source_registry row(s) only.';
    RETURN;
  END IF;

  SELECT array_agg(chunk_id::text) INTO chunk_ids
  FROM public.document_chunks
  WHERE document_id = ANY(doc_ids);

  IF chunk_ids IS NOT NULL AND array_length(chunk_ids, 1) > 0 THEN
    DELETE FROM public.rag_chunks WHERE chunk_id = ANY(chunk_ids);
  END IF;

  DELETE FROM public.document_chunks WHERE document_id = ANY(doc_ids);
  DELETE FROM public.corpus_reprocess_queue WHERE corpus_document_id = ANY(doc_ids);
  DELETE FROM public.corpus_documents WHERE id = ANY(doc_ids);

  DELETE FROM public.module_standard_citations
  WHERE source_registry_id IN (SELECT id FROM public.source_registry WHERE title ILIKE '%School Security Field Assessment Workbook%');
  UPDATE public.module_standard_references
  SET source_registry_id = NULL
  WHERE source_registry_id IN (SELECT id FROM public.source_registry WHERE title ILIKE '%School Security Field Assessment Workbook%');

  DELETE FROM public.source_registry WHERE title ILIKE '%School Security Field Assessment Workbook%';

  RAISE NOTICE 'Removed School Security Field Assessment Workbook from CORPUS.';
END $$;
