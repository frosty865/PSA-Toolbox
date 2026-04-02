-- RUNTIME: Rename MODULE_PENDING to MODULE_UNASSIGNED.
-- Ingested-but-unassigned documents are "unassigned", not "pending".

UPDATE public.module_sources
SET module_code = 'MODULE_UNASSIGNED'
WHERE module_code = 'MODULE_PENDING';

UPDATE public.module_documents
SET module_code = 'MODULE_UNASSIGNED'
WHERE module_code = 'MODULE_PENDING';
