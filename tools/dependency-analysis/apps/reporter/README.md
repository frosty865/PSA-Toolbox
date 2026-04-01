# Reporter (DOCX export)

Python CLI that reads assessment JSON from stdin and produces the final DOCX report (template + charts + tables). Used by the web app’s export flow.

## CISA / field deployment: use Python, not the exe

To avoid network security and software-approval issues with custom executables:

- **Do not** build or ship `reporter.exe` for field or locked-down environments.
- Use **agency-approved Python** and install dependencies with pip (see below). The web app uses `main.py` by default when it exists.

## One-time setup (Python)

From repo root:

```powershell
# Optional: dedicated venv (recommended)
python -m venv .venv-reporter
.\.venv-reporter\Scripts\Activate.ps1   # Windows
# source .venv-reporter/bin/activate     # Linux/macOS

pip install -r apps/reporter/requirements.txt
```

Or from this directory:

```powershell
cd apps/reporter
pip install -r requirements.txt
```

Required: `python-docx`, `matplotlib`, `Pillow`. The web app will use `python main.py` (or the venv’s Python when `.venv-reporter` exists).

## Optional: build reporter.exe

Only if your environment approves a custom executable and you have a signing/approval process:

```powershell
.\apps\reporter\build.ps1
```

Produces `apps/reporter/dist/reporter.exe`. To force the app to use it, set `ADA_REPORTER_EXE` to the full path of the exe.
