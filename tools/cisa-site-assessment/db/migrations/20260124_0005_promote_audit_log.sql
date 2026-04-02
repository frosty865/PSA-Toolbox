BEGIN;

CREATE TABLE IF NOT EXISTS public.promote_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL,
  assessment_response_id uuid NOT NULL,
  candidate_id uuid NOT NULL,
  ofc_id uuid NOT NULL,
  actor text NULL,
  already_promoted boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_promote_audit_assessment_id
  ON public.promote_audit_log (assessment_id);

CREATE INDEX IF NOT EXISTS idx_promote_audit_response_id
  ON public.promote_audit_log (assessment_response_id);

CREATE INDEX IF NOT EXISTS idx_promote_audit_candidate_id
  ON public.promote_audit_log (candidate_id);

CREATE INDEX IF NOT EXISTS idx_promote_audit_created_at
  ON public.promote_audit_log (created_at DESC);

COMMENT ON TABLE public.promote_audit_log IS
'Audit trail for OFC candidate promotions. Records all promote actions including idempotent duplicates.';

COMMIT;
