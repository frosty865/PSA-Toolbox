# Module Source Storage Path Fix

## Problem

Module sources imported from research download manifests had incorrect `storage_relpath` values pointing to `downloads\research\MODULE_EV_PARKING\...` instead of proper module storage locations under `MODULE_SOURCES_ROOT/raw/<module_code>/...`. This caused `ENOENT` errors when the application tried to access files.

## Root Cause

The `import_download_manifest_to_module_sources.py` script was storing the original download path (`saved_path` from the manifest) directly into `file_path` and not setting `storage_relpath` correctly. Files were never copied to module storage.

## Solution

### 1. Fixed Import Script

**File:** `tools/research/import_download_manifest_to_module_sources.py`

**Changes:**
- Added `copy_to_module_storage()` function that copies files from research download directory to module storage
- Files are now stored at: `MODULE_SOURCES_ROOT/raw/<module_code_safe>/<uuid>_<name>`
- `storage_relpath` is now set correctly to the relative path under module storage root
- `source_type` is explicitly set to `'MODULE_UPLOAD'`
- Original download path is preserved in `file_path` for reference

**Usage:**
```bash
python tools/research/import_download_manifest_to_module_sources.py \
    --module_code MODULE_EV_PARKING \
    --manifest analytics/research/MODULE_EV_PARKING_download_manifest.json
```

### 2. Added File Existence Checking

**File:** `app/api/admin/modules/[moduleCode]/sources/route.ts`

**Changes:**
- Added file existence checking for `MODULE_UPLOAD` sources with `storage_relpath`
- Returns `file_exists` (boolean) and `file_error` (string) in the API response
- Gracefully handles missing files and invalid paths without crashing

### 3. Created Cleanup Script

**File:** `tools/fix_module_source_paths.py`

**Purpose:** Fix existing database records with invalid `storage_relpath` values.

**Features:**
- Finds records with invalid paths (not starting with `raw/` or containing `downloads/research`)
- Attempts to locate source files in common download locations
- Copies files to proper module storage locations
- Updates `storage_relpath` in the database
- Supports dry-run mode for testing

**Usage:**
```bash
# Dry run (see what would be fixed)
python tools/fix_module_source_paths.py --dry-run

# Fix all modules
python tools/fix_module_source_paths.py

# Fix specific module
python tools/fix_module_source_paths.py --module-code MODULE_EV_PARKING
```

### 4. Created Diagnostic Script

**File:** `tools/diagnose_missing_module_files.ts`

**Purpose:** Identify module sources with missing files.

**Usage:**
```bash
npx tsx tools/diagnose_missing_module_files.ts
```

## Storage Path Format

Module source files are stored at:
```
MODULE_SOURCES_ROOT/raw/<module_code_safe>/<uuid>_<sanitized_filename>
```

Where:
- `module_code_safe`: Module code with special characters replaced by `_`
- `uuid`: 12-character hex UUID prefix for uniqueness
- `sanitized_filename`: Original filename with special characters replaced by `_`

The `storage_relpath` stored in the database is:
```
raw/<module_code_safe>/<uuid>_<sanitized_filename>
```

## Next Steps

1. **Fix existing records:** Run `tools/fix_module_source_paths.py` to fix existing bad records
2. **Verify:** Use `tools/diagnose_missing_module_files.ts` to verify all files exist
3. **Future imports:** The updated import script will now correctly handle new imports

## Related Files

- `app/lib/storage/config.ts` - Storage configuration and path resolution
- `app/api/admin/modules/[moduleCode]/sources/route.ts` - Sources API with file existence checking
- `tools/research/import_download_manifest_to_module_sources.py` - Fixed import script
- `tools/fix_module_source_paths.py` - Cleanup script for existing records
- `tools/diagnose_missing_module_files.ts` - Diagnostic script
