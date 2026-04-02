# Processor service: Module parser (Ollama Phase-1)

Dedicated Ollama Phase-1 prompts for **MODULE** generation (not baseline). Output is segregated from baseline/OFC panel logic.

- **MODULE_OBJECT**: asset/system/area modules (e.g. EV Parking, Magnetometer, Vehicle Ramming).
- **MODULE_PLAN**: plan/checklist modules (e.g. EAP, ERP, COOP, Family Reunification, Shelter-in-Place).

---

## Walkthrough (project uses venv)

### 1. Choose a venv

The project uses one of two venv patterns:

| Venv | Location | When to use |
|------|----------|-------------|
| **Processor venv** | `D:\PSA_System\Dependencies\python\venvs\processor\` | Shared processor/corpus/ingestion scripts (recommended for this service). |
| **Local venv** | `psa_rebuild\venv\` | If you prefer a venv inside the app repo. |

**Create processor venv (from PSA_System root):**

```powershell
D:\PSA_System\scripts\python\create_venv.ps1 -ServiceName processor
```

This installs `requirements-processor.txt` (which includes base: `requests`, etc.). The processor module only needs `requests` and the standard library.

**Or create local venv (from psa_rebuild):**

```powershell
cd D:\PSA_System\psa_rebuild
.\scripts\setup_venv.ps1
```

---

### 2. Activate the venv

**Processor venv (Windows):**

```powershell
& "D:\PSA_System\Dependencies\python\venvs\processor\Scripts\Activate.ps1"
```

**Local venv (Windows):**

```powershell
cd D:\PSA_System\psa_rebuild
.\venv\Scripts\Activate.ps1
```

**Linux/Mac (processor-style path):**

```bash
source "$PSA_SYSTEM_ROOT/Dependencies/python/venvs/processor/bin/activate"
```

**Linux/Mac (local venv):**

```bash
cd psa_rebuild && source venv/bin/activate
```

---

### 3. Set working directory and PYTHONPATH

The processor package lives under **psa_rebuild**: `psa_rebuild/services/processor/`.  
Imports are `from services.processor...`, so **psa_rebuild** must be on `PYTHONPATH` (or `sys.path`).

**Option A – Run from psa_rebuild and add current dir to path:**

```powershell
cd D:\PSA_System\psa_rebuild
$env:PYTHONPATH = "D:\PSA_System\psa_rebuild"
# venv already activated
python -c "from services.processor.pipeline import generate_module_items_from_chunks; print('OK')"
```

**Option B – Use a script that adds project root to sys.path (no PYTHONPATH):**

Any script under psa_rebuild that does `sys.path.insert(0, str(project_root))` (e.g. `tools/corpus/process_module_pdfs_from_incoming.py`) can then import the processor; run that script with **current directory = psa_rebuild** and the venv’s Python.

---

### 4. Run the module parser

**Prerequisites:**

- Ollama running locally (e.g. `ollama serve`).
- A model pulled (e.g. `ollama pull llama3.2:3b`).
- Optional: `OLLAMA_HOST` set if not using default `http://127.0.0.1:11434`.

**One-chunk example (OBJECT mode):**

```powershell
cd D:\PSA_System\psa_rebuild
$env:PYTHONPATH = "D:\PSA_System\psa_rebuild"
python -c @"
import sys
sys.path.insert(0, '.')
from services.processor.pipeline import generate_module_items_from_chunks

chunks = [{
    'chunk_id': 'test-1',
    'chunk_text': 'EV charging stations should be in well-lit areas with clear sight lines. Access control and CCTV are recommended.',
    'page_range': '1-2',
    'source_file': 'ev_guide.pdf'
}]
out = generate_module_items_from_chunks(
    model='llama3.2:3b',
    module_code='MODULE_EV_PARKING',
    module_title='EV Parking',
    module_kind='OBJECT',
    chunks=chunks
)
print(out)
"@
```

**PLAN mode:** use `module_kind='PLAN'` for EAP/ERP/COOP-style modules.

**Deterministic packet pipeline (router + packetizer + combined-packet prompts):**

- Route chunks with lexical gates: OBJECT (physical), PLAN (governance), IGNORE.
- Packetize into same-topic packets (2–5 chunks) to reduce duplicates.
- Use `generate_module_from_chunks` from `services.processor.pipeline` with `model_object`, `model_plan`, `in_scope_terms`, `out_of_scope_terms`, and `chunks`. Output items include multi-citation and `source_chunk_id` (first citation) for API compatibility.
- From CLI: `python tools/modules/run_module_parser_from_db.py --module-code MODULE_EV_PARKING --use-packet-pipeline` (optional `--model-plan qwen2.5:14b` for PLAN packets).

**Using processor venv without activating (direct python.exe):**

```powershell
cd D:\PSA_System\psa_rebuild
$env:PYTHONPATH = "D:\PSA_System\psa_rebuild"
& "D:\PSA_System\Dependencies\python\venvs\processor\Scripts\python.exe" -c "from services.processor.pipeline import generate_module_items_from_chunks; print('OK')"
```

---

### 5. Summary

| Step | Action |
|------|--------|
| 1 | Create processor venv: `.\scripts\python\create_venv.ps1 -ServiceName processor` (from PSA_System root). |
| 2 | Activate: `& "D:\…\venvs\processor\Scripts\Activate.ps1"`. |
| 3 | `cd psa_rebuild` and set `PYTHONPATH=psa_rebuild` (or run a script that adds psa_rebuild to `sys.path`). |
| 4 | Run Python that imports `services.processor.pipeline.generate_module_items_from_chunks` and call it with `model`, `module_code`, `module_title`, `module_kind` (`OBJECT` or `PLAN`), and `chunks`. |

Module data stays in module tables/tabs; persistence is handled elsewhere. This service only **generates** questions and OFCs from chunks.
