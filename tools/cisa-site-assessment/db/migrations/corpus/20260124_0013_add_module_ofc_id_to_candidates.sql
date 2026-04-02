-- Migration: Add module_ofc_id to ofc_candidate_queue for register bridge (idempotency)
-- Date: 2026-01-24
-- Purpose: Support "Register in Module Data queue" from RUNTIME.module_ofcs → CORPUS.ofc_candidate_queue.
--          module_ofc_id stores the RUNTIME module_ofcs.id (UUID as TEXT; no FK across DBs).
--          Partial unique index prevents duplicate registrations of the same module OFC.
--
-- Target: CORPUS database only (ofc_candidate_queue)

-- 1. Add module_ofc_id column (TEXT; RUNTIME module_ofcs.id as string, no cross-DB FK)
ALTER TABLE public.ofc_candidate_queue
  ADD COLUMN IF NOT EXISTS module_ofc_id TEXT NULL;

COMMENT ON COLUMN public.ofc_candidate_queue.module_ofc_id IS
  'When ofc_origin=MODULE: RUNTIME module_ofcs.id (as text). Links this candidate to the authoritative module OFC. Prevents duplicate registration.';

-- 2. Partial unique index: one candidate per (ofc_origin, module_ofc_id) when module_ofc_id is set
CREATE UNIQUE INDEX IF NOT EXISTS uq_ofc_candidate_queue_module_ofc
  ON public.ofc_candidate_queue (ofc_origin, module_ofc_id)
  WHERE module_ofc_id IS NOT NULL;

COMMENT ON INDEX public.uq_ofc_candidate_queue_module_ofc IS
  'Ensures a module OFC from RUNTIME.module_ofcs is registered at most once in the candidate queue.';
