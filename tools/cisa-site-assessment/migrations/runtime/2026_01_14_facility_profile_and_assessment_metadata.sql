CREATE TABLE IF NOT EXISTS facilities (
  facility_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_name TEXT NOT NULL,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  poc_name TEXT,
  poc_email TEXT,
  poc_phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- If you already have assessment_definitions, add columns safely
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='assessment_definitions') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assessment_definitions' AND column_name='facility_id') THEN
      ALTER TABLE assessment_definitions ADD COLUMN facility_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assessment_definitions' AND column_name='sector_code') THEN
      ALTER TABLE assessment_definitions ADD COLUMN sector_code TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assessment_definitions' AND column_name='subsector_code') THEN
      ALTER TABLE assessment_definitions ADD COLUMN subsector_code TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='assessment_definitions' AND column_name='facility_snapshot') THEN
      ALTER TABLE assessment_definitions ADD COLUMN facility_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_assessment_definitions_facility_id ON assessment_definitions (facility_id);
