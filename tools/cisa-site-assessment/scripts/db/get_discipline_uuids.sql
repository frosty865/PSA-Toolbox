-- Query to get discipline UUIDs for IST mapping
-- Run this query and update ist_sheet_to_taxonomy_map.json with the results

-- Get all active disciplines
SELECT 
    id,
    name,
    code,
    category
FROM disciplines
WHERE is_active = true
ORDER BY name;

-- Example output format:
-- id                                   | name                          | code | category
-- ------------------------------------|-------------------------------|------|----------
-- 123e4567-e89b-12d3-a456-426614174000 | Access Control Systems        | ACC  | Physical
-- 223e4567-e89b-12d3-a456-426614174001 | Perimeter Security            | PER  | Physical
-- ...

-- To get subtypes for a specific discipline:
-- SELECT id, name, code, discipline_id
-- FROM discipline_subtypes
-- WHERE discipline_id = 'YOUR_DISCIPLINE_UUID'
--   AND is_active = true
-- ORDER BY name;

