# Schema Mismatch Review - Assessment Creation Process

## Critical Mismatches Found

### 1. FACILITIES TABLE
**Schema:**
- `id`: TEXT (NOT NULL) - **NOT UUID!**
- `name`: TEXT (NOT NULL)

**Code Issue:**
- Currently generating UUID for `facilities.id` - **WRONG!**
- Should generate TEXT ID

### 2. ASSESSMENTS TABLE
**Schema:**
- `sector_id`: UUID (nullable)
- `subsector_id`: UUID (nullable)
- `facility_name`: TEXT (NOT NULL)

**Code Status:**
- ✅ Correctly using UUIDs for sector_id/subsector_id (from id_uuid)
- ✅ Using assessment_name for facility_name

### 3. ASSESSMENT_DEFINITIONS TABLE
**Schema:**
- `facility_id`: UUID (nullable)
- `assessment_id`: UUID (NOT NULL)

**Code Issue:**
- Inserting TEXT `facility_id` (from facilities.id) into UUID column - **WRONG!**
- Need to use UUID for facility_id, but facilities table doesn't have UUID!
- **PROBLEM**: Facilities table has TEXT id, but assessment_definitions expects UUID facility_id

### 4. ASSESSMENT_INSTANCES TABLE
**Schema:**
- `id`: TEXT (NOT NULL) - **NOT UUID!**
- `template_id`: TEXT (NOT NULL) - **NOT UUID!**
- `facility_id`: TEXT (nullable) - **NOT UUID!**

**Code Issues:**
- Using `gen_random_uuid()` for `id` - **WRONG!** Should be TEXT
- Using UUID for `template_id` - **WRONG!** Should be TEXT
- Using UUID `assessment_id` for `facility_id` - **WRONG!** Should be TEXT

## Summary of Required Fixes

1. **Facilities ID**: Generate TEXT ID, not UUID
2. **Assessment Definitions facility_id**: Need to resolve - facilities table has TEXT id but assessment_definitions expects UUID
3. **Assessment Instances**: 
   - Generate TEXT id, not UUID
   - Use TEXT template_id
   - Use TEXT facility_id (not UUID assessment_id)
