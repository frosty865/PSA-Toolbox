-- Runtime Taxonomy Tables Migration
-- Date: 2026-01-23
-- Purpose: Create public.disciplines and public.discipline_subtypes tables in RUNTIME database
--          Required for MODULE OFC creation/promotion flow
-- TARGET DB: RUNTIME

BEGIN;

-- -------------------------------------------------------------------
-- Create disciplines (if missing)
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.disciplines (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  description text NULL,
  category text NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  code text NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS disciplines_code_ux ON public.disciplines(code);

-- -------------------------------------------------------------------
-- Create discipline_subtypes (if missing)
-- -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.discipline_subtypes (
  id uuid PRIMARY KEY,
  discipline_id uuid NOT NULL REFERENCES public.disciplines(id) ON DELETE RESTRICT,
  name text NOT NULL,
  description text NULL,
  code text NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Extended narrative fields used by your subtype-driven prompts (optional but present in your seed)
  overview text NULL,
  indicators_of_risk text[] NULL,
  common_failures text[] NULL,
  assessment_questions text[] NULL,
  mitigation_guidance text[] NULL,
  standards_references text[] NULL,
  psa_notes text NULL
);

CREATE INDEX IF NOT EXISTS discipline_subtypes_discipline_id_ix ON public.discipline_subtypes(discipline_id);
CREATE INDEX IF NOT EXISTS discipline_subtypes_active_ix ON public.discipline_subtypes(is_active);

-- -------------------------------------------------------------------
-- Seed data (id-stable). Safe to re-run.
-- NOTE: These INSERTs MUST match your existing canonical UUIDs.
--       Use ON CONFLICT DO NOTHING to avoid duplicates.
-- -------------------------------------------------------------------

-- === SEED: disciplines ===
INSERT INTO public.disciplines (id, name, description, category, is_active, created_at, updated_at, code) VALUES
('18d45ffa-6a44-4817-becb-828231b9e1e7', 'Access Control Systems', NULL, 'Physical', true, now(), now(), 'ACS'),
('49c0275c-f511-4ab1-970c-097d00969a6e', 'Communications', NULL, 'Physical', true, now(), now(), 'COM'),
('b6e2ad14-2a0f-4009-9269-9a35d3599f55', 'CPTED', NULL, 'Physical', true, now(), now(), 'CPTED'),
('4b640641-12cf-4b58-98f9-ae4ff644ee3e', 'Emergency Action Planning', NULL, 'Physical', true, now(), now(), 'EAP'),
('a295aed8-a841-41b0-b893-a8a018867b83', 'Emergency Management & Resilience', NULL, 'Physical', true, now(), now(), 'EMR'),
('41d7fc06-a4e8-436b-bf70-4bdc6f68c0a7', 'Facility Hardening', NULL, 'Physical', true, now(), now(), 'FAC'),
('b5516924-2356-4639-9109-01b6f19f104c', 'Intrusion Detection Systems', NULL, 'Physical', true, now(), now(), 'IDS'),
('89debd5b-9fa6-41ad-8512-10df7424935a', 'Interior Security & Barriers', NULL, 'Physical', true, now(), now(), 'INT'),
('7aa8d7a5-68a8-4290-be4c-4eb654e61a29', 'Information Sharing & Coordination', NULL, 'Physical', true, now(), now(), 'ISC'),
('e4ffd95e-4fba-43e8-be9c-20a56aecc5db', 'Key Control', NULL, 'Physical', true, now(), now(), 'KEY'),
('69a28796-c8fe-42c1-88af-950a90d0a5e4', 'Perimeter Security', NULL, 'Physical', true, now(), now(), 'PER'),
('9ee649b0-3a04-4eba-9933-730caccff8c1', 'Security Force / Operations', NULL, 'Physical', true, now(), now(), 'SFO'),
('ecfc1d4f-873b-4645-93e5-a9812ed779c3', 'Security Management & Governance', NULL, 'Physical', true, now(), now(), 'SMG'),
('83d34bf8-b228-49ca-abb9-66168d4a8681', 'Video Surveillance Systems', NULL, 'Physical', true, now(), now(), 'VSS')
ON CONFLICT (id) DO NOTHING;

-- === SEED: discipline_subtypes ===
-- NOTE: Full seed data is generated from taxonomy/discipline_subtypes.json
--       Run: npx tsx tools/generate_runtime_taxonomy_seed.ts > seed_output.sql
--       Then append the INSERT statements below, or use tools/restore_discipline_subtypes.ts
--       For now, this migration creates the tables. Seeding should be done via the TypeScript tool.

COMMIT;
