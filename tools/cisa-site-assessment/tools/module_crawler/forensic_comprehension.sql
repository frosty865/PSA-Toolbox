-- Forensic: why is module_chunk_comprehension empty?
-- Run against the SAME DBs where comprehension runs (RUNTIME for A1; CORPUS for A2/A4).
-- Usage: use from Python or run manually with psql (set CORPUS_* and RUNTIME_* URLs).

-- ========== RUNTIME (where module_chunk_comprehension lives) ==========

-- A1) Is the table truly empty?
-- SELECT COUNT(*) AS comprehension_rows FROM public.module_chunk_comprehension;

-- A1b) Per-module breakdown
-- SELECT module_code, COUNT(*) AS n FROM public.module_chunk_comprehension GROUP BY module_code ORDER BY n DESC;


-- ========== CORPUS (where chunks come from) ==========

-- A2) Do we have eligible chunks for modules? (Adjust module_code filter as needed.)
-- SELECT
--   (sr.scope_tags->>'module_code') AS module_code,
--   COUNT(dc.chunk_id) AS chunk_rows,
--   COUNT(DISTINCT dc.document_id) AS docs
-- FROM public.document_chunks dc
-- JOIN public.corpus_documents cd ON cd.id = dc.document_id
-- JOIN public.source_registry sr ON sr.id = cd.source_registry_id
-- WHERE (sr.scope_tags->>'module_code') IS NOT NULL
--   AND (sr.scope_tags->>'module_code') LIKE 'MODULE_%'
-- GROUP BY (sr.scope_tags->>'module_code')
-- ORDER BY chunk_rows DESC;

-- A3) (Skip if no module_chunk_packets/windows tables.)

-- A4) Any source_registry rows for modules with zero chunks?
-- SELECT
--   sr.id,
--   sr.title,
--   (sr.scope_tags->>'module_code') AS module_code,
--   COUNT(dc.chunk_id) AS chunk_count
-- FROM public.source_registry sr
-- LEFT JOIN public.corpus_documents cd ON cd.source_registry_id = sr.id
-- LEFT JOIN public.document_chunks dc ON dc.document_id = cd.id
-- WHERE (sr.scope_tags->>'module_code') LIKE 'MODULE_%'
-- GROUP BY sr.id, sr.title, (sr.scope_tags->>'module_code')
-- HAVING COUNT(dc.chunk_id) = 0;

-- Interpretation:
-- If A2 chunk_rows = 0 for your module -> no inputs (fix tagging/ingestion).
-- If A2 > 0 and A1 comprehension_rows = 0 -> persistence path missing/disabled/failing (run with --apply, check logs).
