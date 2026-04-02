-- Runtime DB Reset Script
-- 
-- PURPOSE: Clean runtime DB by truncating runtime-only tables that should not be authoritative content.
-- This script is safe to run - it only truncates data, does not drop tables.
--
-- NOTE: If you must preserve assessments, comment out TRUNCATE assessments and only wipe responses.
--
-- USAGE:
--   psql "$DATABASE_URL" -f tools/runtime_db_reset.sql
--   Or for Supabase runtime:
--   psql "postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:6543/postgres" -f tools/runtime_db_reset.sql

BEGIN;

-- runtime artifacts (safe to wipe)
-- These tables store runtime assessment data that can be regenerated

-- Assessment responses and related runtime data
TRUNCATE TABLE public.assessment_question_responses RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.assessment_responses RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.assessment_expansion_responses RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.assessment_status RESTART IDENTITY CASCADE;

-- Assessment instances and related runtime artifacts
TRUNCATE TABLE public.assessment_question_universe RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.assessment_expansion_profiles RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.assessment_required_elements RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.assessment_technology_profiles RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.assessment_applied_ofcs RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.assessment_applied_vulnerabilities RESTART IDENTITY CASCADE;

-- Assessment definitions and instances (if you want to wipe assessments too)
-- UNCOMMENT THE NEXT TWO LINES IF YOU WANT TO WIPE ALL ASSESSMENTS:
-- TRUNCATE TABLE public.assessment_definitions RESTART IDENTITY CASCADE;
-- TRUNCATE TABLE public.assessments RESTART IDENTITY CASCADE;

-- spine table is authoritative runtime content; wipe to guarantee clean reseed
TRUNCATE TABLE public.baseline_spines_runtime RESTART IDENTITY CASCADE;

COMMIT;
