-- Governance OFC Workflow Migration
-- Creates canonical OFC registry, nominations, decisions, and citations
-- Date: 2025-12-22

-- ============================================================================
-- 1) Canonical OFC registry (approved corpus)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.canonical_ofcs (
  canonical_ofc_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_code text NOT NULL UNIQUE,             -- stable machine ID (e.g., "OFC_V1_<DISCIPLINE>_<SUBTYPE>_<HASH8>")
  title text NOT NULL,                              -- short human label
  ofc_text text NOT NULL,                           -- "WHAT" capability (no "how")
  discipline_id uuid NOT NULL,
  discipline_subtype_id uuid NOT NULL,

  -- governance metadata
  status text NOT NULL CHECK (status IN ('ACTIVE','DEPRECATED')),
  version_major int NOT NULL DEFAULT 1,
  version_minor int NOT NULL DEFAULT 0,
  supersedes_canonical_ofc_id uuid NULL REFERENCES public.canonical_ofcs(canonical_ofc_id),

  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL,
  approved_at timestamptz NOT NULL DEFAULT now(),
  approved_by text NOT NULL,

  -- guard rails
  forbid_how_impl boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_canonical_ofcs_disc_subtype
  ON public.canonical_ofcs(discipline_id, discipline_subtype_id);

CREATE INDEX IF NOT EXISTS idx_canonical_ofcs_status
  ON public.canonical_ofcs(status);

CREATE INDEX IF NOT EXISTS idx_canonical_ofcs_canonical_code
  ON public.canonical_ofcs(canonical_code);

-- ============================================================================
-- 2) Canonical OFC evidence citations (must be >= 1 per canonical)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.canonical_ofc_citations (
  citation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_ofc_id uuid NOT NULL REFERENCES public.canonical_ofcs(canonical_ofc_id) ON DELETE CASCADE,
  document_id uuid NULL,                     -- if you have a documents table; allow NULL for now
  page int NULL,
  excerpt text NOT NULL,                     -- citable excerpt (short)
  source_label text NULL,                    -- optional (title/agency)
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_canonical_ofc_citations_ofc
  ON public.canonical_ofc_citations(canonical_ofc_id);

-- ============================================================================
-- 3) OFC nominations (field/PSA submits; not canonical)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ofc_nominations (
  nomination_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- linkage to what the nomination is about (assessment-scoped)
  assessment_id uuid NULL,                   -- keep nullable if assessment system not fully wired
  finding_id text NULL,                      -- allow string ID from pipeline output for now
  document_id uuid NULL,
  page int NULL,

  discipline_id uuid NULL,
  discipline_subtype_id uuid NULL,

  proposed_title text NOT NULL,
  proposed_ofc_text text NOT NULL,

  -- evidence required (at least 1 excerpt)
  evidence_excerpt text NOT NULL,
  evidence_page int NULL,

  -- submitter
  submitted_by text NOT NULL,
  submitted_role text NOT NULL CHECK (submitted_role IN ('FIELD','ENGINEER','GOVERNANCE')),
  submitted_at timestamptz NOT NULL DEFAULT now(),

  -- workflow state
  status text NOT NULL CHECK (status IN ('SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED','WITHDRAWN')),
  status_reason text NULL,

  -- immutability controls
  locked boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_ofc_nominations_status
  ON public.ofc_nominations(status);

CREATE INDEX IF NOT EXISTS idx_ofc_nominations_submitted_at
  ON public.ofc_nominations(submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_ofc_nominations_discipline_subtype
  ON public.ofc_nominations(discipline_id, discipline_subtype_id);

-- ============================================================================
-- 4) Nomination decisions (immutable audit trail)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ofc_nomination_decisions (
  decision_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nomination_id uuid NOT NULL REFERENCES public.ofc_nominations(nomination_id) ON DELETE CASCADE,

  decision text NOT NULL CHECK (decision IN ('APPROVE_TO_CANONICAL','REJECT','REQUEST_CHANGES')),
  decision_notes text NOT NULL,

  decided_by text NOT NULL,
  decided_role text NOT NULL CHECK (decided_role IN ('ENGINEER','GOVERNANCE')),
  decided_at timestamptz NOT NULL DEFAULT now(),

  -- if approved, store created canonical id
  canonical_ofc_id uuid NULL REFERENCES public.canonical_ofcs(canonical_ofc_id)
);

CREATE INDEX IF NOT EXISTS idx_ofc_nom_decisions_nom
  ON public.ofc_nomination_decisions(nomination_id);

CREATE INDEX IF NOT EXISTS idx_ofc_nom_decisions_canonical
  ON public.ofc_nomination_decisions(canonical_ofc_id);

-- ============================================================================
-- 5) Applied OFCs should reference canonical (bridge)
-- ============================================================================
-- If public.assessment_applied_ofcs exists, alter it to include canonical_ofc_id.
-- Do not break existing rows: make nullable then backfill later.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='assessment_applied_ofcs'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='assessment_applied_ofcs' AND column_name='canonical_ofc_id'
    ) THEN
      ALTER TABLE public.assessment_applied_ofcs
        ADD COLUMN canonical_ofc_id uuid NULL REFERENCES public.canonical_ofcs(canonical_ofc_id);
      CREATE INDEX IF NOT EXISTS idx_assessment_applied_ofcs_canonical
        ON public.assessment_applied_ofcs(canonical_ofc_id);
    END IF;
  END IF;
END $$;

-- ============================================================================
-- A2) Add a hard validation view (publish-ready canonical OFCs)
-- ============================================================================
CREATE OR REPLACE VIEW public.v_canonical_ofcs_publish_ready AS
SELECT
  o.*,
  (SELECT count(*) FROM public.canonical_ofc_citations c WHERE c.canonical_ofc_id = o.canonical_ofc_id) AS citation_count
FROM public.canonical_ofcs o
WHERE o.status = 'ACTIVE';

-- ============================================================================
-- A3) Add DB-level guards (no deletion of canonical; deprecate only)
-- ============================================================================
-- Prevent deletes from canonical_ofcs (force deprecate)
CREATE OR REPLACE FUNCTION public.block_canonical_ofc_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Canonical OFCs are immutable; deprecate instead.';
END;
$$;

DROP TRIGGER IF EXISTS trg_block_canonical_ofc_delete ON public.canonical_ofcs;
CREATE TRIGGER trg_block_canonical_ofc_delete
BEFORE DELETE ON public.canonical_ofcs
FOR EACH ROW EXECUTE FUNCTION public.block_canonical_ofc_delete();

-- ============================================================================
-- Audit Log Table (if not exists)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.audit_log (
  audit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  event_payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_log_event_type
  ON public.audit_log(event_type);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at
  ON public.audit_log(created_at DESC);

-- Comments
COMMENT ON TABLE public.canonical_ofcs IS 'Immutable, versioned canonical OFC registry. Only deprecation allowed, no deletion.';
COMMENT ON TABLE public.canonical_ofc_citations IS 'Evidence citations for canonical OFCs. At least one required per canonical OFC.';
COMMENT ON TABLE public.ofc_nominations IS 'Field/PSA submissions for new OFCs. Workflow: SUBMITTED -> UNDER_REVIEW -> APPROVED/REJECTED/WITHDRAWN.';
COMMENT ON TABLE public.ofc_nomination_decisions IS 'Immutable audit trail of all nomination decisions. Links to canonical_ofcs when approved.';
COMMENT ON TABLE public.audit_log IS 'System-wide audit log for governance events including OFC nominations and decisions.';

