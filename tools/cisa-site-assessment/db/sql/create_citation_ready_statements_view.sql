-- Citation Ready Statements View
-- Purpose: Provides citation-ready chunks from corpus_documents for RAG retrieval
-- TARGET DB: Supabase Postgres (psa-back)

-- Note: This view assumes chunks are stored somewhere accessible.
-- If chunks are in a separate CORPUS database, this view may need to be adapted
-- or chunks may need to be replicated to RUNTIME database.

-- For now, create a placeholder view that can be adapted based on actual schema

CREATE OR REPLACE VIEW public.citation_ready_statements AS
SELECT 
    -- Generate a chunk_id if chunks table exists, else use document id
    COALESCE(
        (SELECT chunk_id FROM public.document_chunks dc 
         WHERE dc.document_id = cd.id::text LIMIT 1),
        cd.id::text
    ) as chunk_id,
    cd.id::text as corpus_document_id,
    COALESCE(
        (SELECT page_number FROM public.document_chunks dc 
         WHERE dc.document_id = cd.id::text LIMIT 1),
        1
    ) as page_number,
    -- Use inferred_title or citation_full as chunk text if chunks don't exist
    COALESCE(
        (SELECT chunk_text FROM public.document_chunks dc 
         WHERE dc.document_id = cd.id::text LIMIT 1),
        COALESCE(cd.inferred_title, cd.citation_full, '')
    ) as chunk_text
FROM public.corpus_documents cd
WHERE cd.inferred_title IS NOT NULL OR cd.citation_full IS NOT NULL;

COMMENT ON VIEW public.citation_ready_statements IS
'Citation-ready statements from corpus for RAG retrieval. Provides chunk_id, corpus_document_id, page_number, and chunk_text.';
