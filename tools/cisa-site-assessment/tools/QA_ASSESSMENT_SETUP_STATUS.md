# QA Assessment Setup Status

## Current Status

✅ **Assessment Created Successfully**
- Assessment ID: Created with `[QA]` prefix in name
- Status: DRAFT
- QA Flag: Identified by name prefix `[QA]`

⚠️ **Responses Not Yet Inserted**
- Issue: `assessment_responses` table requires `assessment_instance_id` which references `assessment_instances` table
- `assessment_instances` requires `template_id` which references `assessment_templates` table
- Need to either:
  1. Create an `assessment_template` first, then create `assessment_instance` with that template_id
  2. Use an existing `assessment_template` if available
  3. Modify the database schema to allow NULL template_id (if business logic allows)

## Database Schema Discovered

### assessments table
- Columns: `id`, `facility_name`, `sector_id`, `sector_name`, `subsector_id`, `subsector_name`, `status`, `created_at`, `updated_at`, `created_by`, `submitted_by`, `submitted_at`, `locked_by`, `locked_at`, `baseline_version`, `sector_version`, `subsector_version`, `ofc_version`
- Status constraint: Must be one of: 'DRAFT', 'IN_PROGRESS', 'SUBMITTED', 'LOCKED' (uppercase)

### assessment_instances table
- Columns: `id`, `template_id`, `facility_id`, `facility_name`, `started_at`, `completed_at`, `status`, `metadata`, `created_by`
- Foreign key: `template_id` → `assessment_templates.id`

### assessment_responses table
- Columns: `id`, `assessment_instance_id`, `question_template_id`, `response`, `notes`, `responded_at`
- Foreign key: `assessment_instance_id` → `assessment_instances.id`

## Next Steps

1. **Create assessment_template** (if needed):
   ```sql
   INSERT INTO public.assessment_templates (id, name, ...)
   VALUES (gen_random_uuid(), 'Baseline v2 Template', ...);
   ```

2. **Create assessment_instance**:
   ```sql
   INSERT INTO public.assessment_instances (id, template_id)
   VALUES (gen_random_uuid(), '<template_id_from_step_1>');
   ```

3. **Insert responses** using the `assessment_instance_id`

## Alternative Approach

If the schema allows, we could modify the script to:
- Query for existing assessment_templates
- Use the first available template
- Or create a minimal template for QA purposes

## Questions for Resolution

1. Does `assessment_templates` table exist and what are its required columns?
2. Can we use an existing template for QA assessments?
3. Should QA assessments use a special template or can they use any baseline template?

