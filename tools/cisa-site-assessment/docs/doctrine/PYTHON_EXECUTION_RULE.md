# Python Execution Rule

**Status:** MANDATORY  
**Effective Date:** 2026-02-03

---

## Rule

**ALL Python scripts MUST be executed from the project's virtual environment (venv).**

Never run Python scripts directly using system Python. Always use venv Python.

---

## Rationale

1. **Dependency Isolation:** venv ensures correct package versions
2. **Reproducibility:** Same environment across all developers
3. **Safety:** Prevents conflicts with system Python packages
4. **Consistency:** All scripts use same Python interpreter and packages

---

## Methods

### Method 1: Use Wrapper Scripts (Recommended)

Wrapper scripts automatically use venv Python:

**Windows:**
```cmd
scripts\run_ofc_purge.bat
scripts\verify_ofc_purge.bat
scripts\run_source_registry_migration.bat
```

**Unix/Mac/Linux:**
```bash
./scripts/run_ofc_purge.sh
./scripts/verify_ofc_purge.sh
./scripts/run_source_registry_migration.sh
```

### Method 2: Activate venv Manually

**Windows:**
```cmd
venv\Scripts\activate
python tools\corpus\purge_all_ofcs.py
deactivate
```

**Unix/Mac/Linux:**
```bash
source venv/bin/activate
python tools/corpus/purge_all_ofcs.py
deactivate
```

### Method 3: Use venv Python Directly

**Windows:**
```cmd
venv\Scripts\python.exe tools\corpus\purge_all_ofcs.py
```

**Unix/Mac/Linux:**
```bash
venv/bin/python tools/corpus/purge_all_ofcs.py
```

---

## Setup

If venv doesn't exist, create it:

```bash
python -m venv venv
```

Then install dependencies:

```bash
# Windows
venv\Scripts\activate
pip install -r requirements.txt

# Unix/Mac/Linux
source venv/bin/activate
pip install -r requirements.txt
```

---

## Verification

To verify you're using venv Python:

**Windows:**
```cmd
venv\Scripts\python.exe --version
venv\Scripts\python.exe -c "import sys; print(sys.executable)"
```

**Unix/Mac/Linux:**
```bash
venv/bin/python --version
venv/bin/python -c "import sys; print(sys.executable)"
```

The executable path should point to `venv/` directory.

---

## Prohibited

❌ **DO NOT:**
- Run `python` without activating venv
- Use system Python directly
- Skip venv activation
- Assume system Python has required packages

✅ **DO:**
- Always use venv Python
- Use wrapper scripts when available
- Verify venv is active before running scripts
- Create venv if it doesn't exist

---

## Enforcement

- All wrapper scripts check for venv existence
- Scripts fail if venv is missing
- Documentation always shows venv usage
- Build processes use venv Python

---

**This rule applies to ALL Python scripts in the project.**
