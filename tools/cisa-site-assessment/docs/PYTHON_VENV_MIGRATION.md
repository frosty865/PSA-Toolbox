# Python Virtual Environment Migration Guide

## Overview
This guide helps migrate the Python virtual environment from Windows to a new Linux distribution.

## Current Setup
- **Windows venv path**: `venv\Scripts\python.exe`
- **Requirements**: Multiple files in `Dependencies/python/`
- **Usage**: Referenced in `package.json` scripts

## Migration Steps

### 1. Export Current Dependencies (if venv still accessible)

If you still have access to the old venv, export dependencies:

```bash
# On old system (Windows)
venv\Scripts\python.exe -m pip freeze > requirements-all.txt
```

### 2. Create New Virtual Environment (Linux)

```bash
# Navigate to project root
cd psa_rebuild

# Create new venv (Python 3.11+ recommended)
python3 -m venv venv

# Or specify Python version explicitly
python3.11 -m venv venv

# Activate venv (Linux/Mac)
source venv/bin/activate

# Verify Python version
python --version
```

### 3. Install Dependencies

```bash
# Activate venv first
source venv/bin/activate

# Install base dependencies
pip install --upgrade pip
pip install -r Dependencies/python/requirements-base.txt

# Install processor dependencies (if needed)
pip install -r Dependencies/python/requirements-processor.txt

# Install engine dependencies (if needed)
pip install -r Dependencies/python/requirements-engine.txt

# Install corpus tools dependencies
pip install -r tools/corpus/requirements_ocr.txt  # if exists

# Install research tools dependencies
pip install -r tools/research/requirements.txt  # if exists

# Install IST ingest dependencies
pip install -r tools/ist_ingest/requirements.txt  # if exists
```

### 4. Verify Installation

```bash
# Check installed packages
pip list

# Test Python scripts
python tools/corpus/mine_ofc_candidates_from_chunks_v3.py --help
python scripts/guards/verify_ofc_text_rules.py --help
```

### 5. Update package.json Scripts

The `package.json` scripts have been updated to use cross-platform paths. The scripts now use:
- `venv/bin/python` (Linux/Mac)
- `venv\\Scripts\\python.exe` (Windows)

If you need to update manually, use `cross-env` or platform-specific scripts.

## Consolidated Requirements (Optional)

If you want a single requirements file, create `requirements.txt`:

```bash
# Combine all requirements
cat Dependencies/python/requirements-base.txt \
    Dependencies/python/requirements-processor.txt \
    Dependencies/python/requirements-engine.txt \
    > requirements.txt

# Remove duplicates and install
pip install -r requirements.txt
```

## Common Issues

### Issue: Python version mismatch
**Solution**: Ensure Python 3.11+ is installed and used for venv creation.

### Issue: Missing system dependencies
**Solution**: Install system packages:
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install python3-dev python3-pip postgresql-dev

# CentOS/RHEL
sudo yum install python3-devel python3-pip postgresql-devel
```

### Issue: psycopg2 compilation errors
**Solution**: Install PostgreSQL development libraries (see above) or use `psycopg2-binary`:
```bash
pip install psycopg2-binary
```

### Issue: Permission errors
**Solution**: Ensure venv directory is writable:
```bash
chmod -R u+w venv
```

## Verification Checklist

- [ ] Venv created successfully
- [ ] All dependencies installed without errors
- [ ] Python scripts run successfully
- [ ] `npm run guard:ofc-text` works
- [ ] `npm run report:ofc-coverage` works
- [ ] Mining script runs: `python tools/corpus/mine_ofc_candidates_from_chunks_v3.py --help`

## Next Steps

After migration:
1. Test all Python scripts
2. Run `npm run build` to verify guards work
3. Test corpus mining: `python tools/corpus/mine_ofc_candidates_from_chunks_v3.py --apply --max-chunks 10`

## Notes

- **Do NOT** copy the venv directory between systems - it contains platform-specific binaries
- Always create a fresh venv on the new system
- Keep requirements files in version control
- Document any additional system dependencies needed
