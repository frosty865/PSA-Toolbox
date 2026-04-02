# IST Sheet to Taxonomy Mapping

This file maps IST workbook sheet names to discipline UUIDs in the database.

## How to Update

### Option 1: Use the Auto-Update Script (Recommended)

If you have Python available:

```bash
cd scripts/db
python update_ist_mapping.py
```

This script will:
- Connect to your database
- Query all active disciplines
- Automatically match sheet names to discipline names
- Update the mapping file with UUIDs

### Option 2: Query Database Directly

Run the SQL query in `get_discipline_uuids.sql`:

```bash
psql $DATABASE_URL -f get_discipline_uuids.sql
```

Or manually:

```sql
SELECT id, name, code, category
FROM disciplines
WHERE is_active = true
ORDER BY name;
```

Then manually update the JSON file with the UUIDs.

### Option 3: Use the API

Query the disciplines API endpoint:

```bash
curl http://localhost:3000/api/reference/disciplines?active=true
```

Then match sheet names to discipline names and update the UUIDs.

## Sheet Name Matching

Common mappings (you may need to adjust based on your actual sheet names):

- "Access Control" → "Access Control Systems"
- "Perimeter Security" → "Perimeter Security"
- "Video Surveillance" → "Video Surveillance Systems"
- "Intrusion Detection" → "Intrusion Detection Systems"
- "Security Management" → "Security Management & Governance"
- "Emergency Management" → "Emergency Management & Resilience"
- "Security Operations" → "Security Force / Operations"

## Notes

- `discipline_subtype_id` can be `null` if the sheet is discipline-level only
- If a sheet maps to a specific subtype, set both `discipline_id` and `discipline_subtype_id`
- The importer will fail if a sheet name is missing from this mapping

