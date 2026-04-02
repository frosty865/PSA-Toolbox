-- STEP 1: Create canonical normalized tables

CREATE TABLE IF NOT EXISTS public.normalized_vulnerabilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    discipline TEXT NOT NULL,
    discipline_subtype TEXT NOT NULL,
    canonical_title TEXT NOT NULL,
    canonical_description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft','approved','deprecated')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (discipline, discipline_subtype, canonical_title)
);

CREATE TABLE IF NOT EXISTS public.normalized_ofcs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    discipline TEXT NOT NULL,
    discipline_subtype TEXT NOT NULL,
    canonical_text TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft','approved','deprecated')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (discipline, discipline_subtype, canonical_text)
);

-- STEP 2: Create traceability table (only if source_statements exists)

DO $$
BEGIN
    -- Check if source_statements table exists
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'source_statements'
    ) THEN
        -- Create normalized_evidence_links with foreign key
        CREATE TABLE IF NOT EXISTS public.normalized_evidence_links (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            source_statement_id UUID NOT NULL
                REFERENCES public.source_statements(id) ON DELETE CASCADE,
            vulnerability_id UUID NULL
                REFERENCES public.normalized_vulnerabilities(id) ON DELETE CASCADE,
            ofc_id UUID NULL
                REFERENCES public.normalized_ofcs(id) ON DELETE CASCADE,
            CHECK (
                (vulnerability_id IS NOT NULL AND ofc_id IS NULL) OR
                (vulnerability_id IS NULL AND ofc_id IS NOT NULL)
            )
        );

        CREATE INDEX IF NOT EXISTS idx_normalized_evidence_links_source_statement_id
            ON public.normalized_evidence_links(source_statement_id);
    ELSE
        -- Create normalized_evidence_links without foreign key to source_statements
        CREATE TABLE IF NOT EXISTS public.normalized_evidence_links (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            source_statement_id UUID NULL,
            vulnerability_id UUID NULL
                REFERENCES public.normalized_vulnerabilities(id) ON DELETE CASCADE,
            ofc_id UUID NULL
                REFERENCES public.normalized_ofcs(id) ON DELETE CASCADE,
            CHECK (
                (vulnerability_id IS NOT NULL AND ofc_id IS NULL) OR
                (vulnerability_id IS NULL AND ofc_id IS NOT NULL)
            )
        );
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_normalized_evidence_links_vulnerability_id
    ON public.normalized_evidence_links(vulnerability_id);

CREATE INDEX IF NOT EXISTS idx_normalized_evidence_links_ofc_id
    ON public.normalized_evidence_links(ofc_id);

-- STEP 3: Promotion rules (documented in comments)
-- Rules:
-- 1) Only source_statements with:
--    - review_status = 'approved'
--    - deficiency_flag = TRUE
--    may be linked.
-- 2) Multiple source_statements may link to the same normalized record.
-- 3) A normalized record may exist in 'draft' until explicitly approved.
-- 4) Deprecated records remain for historical traceability.

-- STEP 4: Helper views (only if source_statements exists)

DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'source_statements'
    ) THEN
        DROP VIEW IF EXISTS public.v_normalization_queue CASCADE;

        CREATE VIEW public.v_normalization_queue AS
        SELECT 
            ss.id AS statement_id,
            ss.raw_text,
            ss.document_filename,
            ss.page_ref,
            ss.assigned_discipline,
            ss.assigned_subtype
        FROM public.source_statements ss
        WHERE ss.review_status = 'approved'
          AND ss.deficiency_flag = TRUE
          AND NOT EXISTS (
              SELECT 1
              FROM public.normalized_evidence_links nel
              WHERE nel.source_statement_id = ss.id
          );
    END IF;
END $$;

DROP VIEW IF EXISTS public.v_normalized_summary CASCADE;

CREATE VIEW public.v_normalized_summary AS
SELECT 
    'vulnerability' AS record_type,
    discipline,
    discipline_subtype,
    status,
    COUNT(*) AS count
FROM public.normalized_vulnerabilities
GROUP BY discipline, discipline_subtype, status

UNION ALL

SELECT 
    'ofc' AS record_type,
    discipline,
    discipline_subtype,
    status,
    COUNT(*) AS count
FROM public.normalized_ofcs
GROUP BY discipline, discipline_subtype, status
ORDER BY record_type, discipline, discipline_subtype, status;




