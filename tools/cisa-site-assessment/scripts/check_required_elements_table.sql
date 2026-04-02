-- Check if required_elements table exists and show related tables
SELECT 
    table_schema,
    table_name,
    table_type
FROM information_schema.tables
WHERE table_name LIKE '%required%' OR table_name LIKE '%element%'
ORDER BY table_schema, table_name;

-- Check current schema
SELECT current_schema();

-- List all schemas
SELECT schema_name FROM information_schema.schemata ORDER BY schema_name;

