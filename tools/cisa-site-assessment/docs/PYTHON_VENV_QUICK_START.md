# Python Venv Quick Start

## Linux/Mac Setup

```bash
# 1. Create and setup venv
./scripts/setup_venv.sh

# 2. Activate venv
source venv/bin/activate

# 3. Verify
python --version
pip list
```

## Windows Setup

```powershell
# 1. Create and setup venv
.\scripts\setup_venv.ps1

# 2. Activate venv
.\venv\Scripts\Activate.ps1

# 3. Verify
python --version
pip list
```

## Running Python Scripts

### Via npm scripts (cross-platform)
```bash
npm run guard:ofc-text
npm run report:ofc-coverage
npm run report:ofc-audit
```

### Direct execution (Linux/Mac)
```bash
source venv/bin/activate
python tools/corpus/mine_ofc_candidates_from_chunks_v3.py --help
```

### Direct execution (Windows)
```powershell
.\venv\Scripts\Activate.ps1
python tools\corpus\mine_ofc_candidates_from_chunks_v3.py --help
```

### Using wrapper scripts
```bash
# Linux/Mac
./scripts/run_python.sh tools/corpus/mine_ofc_candidates_from_chunks_v3.py --help

# Windows
.\scripts\run_python.ps1 tools\corpus\mine_ofc_candidates_from_chunks_v3.py --help
```

## Common Commands

```bash
# Activate venv
source venv/bin/activate  # Linux/Mac
.\venv\Scripts\Activate.ps1  # Windows

# Deactivate venv
deactivate

# Install new package
pip install <package>

# Update requirements
pip freeze > requirements.txt

# Install from requirements
pip install -r requirements.txt
```

## Troubleshooting

### "python3: command not found"
Install Python 3.11+:
```bash
# Ubuntu/Debian
sudo apt-get install python3 python3-pip python3-venv

# CentOS/RHEL
sudo yum install python3 python3-pip
```

### "psycopg2 installation failed"
Install PostgreSQL development libraries:
```bash
# Ubuntu/Debian
sudo apt-get install python3-dev libpq-dev

# CentOS/RHEL
sudo yum install python3-devel postgresql-devel
```

### "Permission denied" on scripts
Make scripts executable:
```bash
chmod +x scripts/*.sh
```

## Migration Checklist

- [ ] Python 3.11+ installed
- [ ] Virtual environment created
- [ ] Dependencies installed
- [ ] Scripts run successfully
- [ ] npm scripts work (`npm run guard:ofc-text`)
- [ ] Mining script works (`python tools/corpus/mine_ofc_candidates_from_chunks_v3.py --help`)
