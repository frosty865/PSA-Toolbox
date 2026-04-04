# Run reporter parity tests. Use a venv that has pytest + python-docx + matplotlib.
# From repo: .\apps\reporter\run_parity_test.ps1
$ErrorActionPreference = "Stop"
$ReporterDir = $PSScriptRoot

$py = $null
if (Test-Path "$ReporterDir\.venv-reporter\Scripts\python.exe") { $py = "$ReporterDir\.venv-reporter\Scripts\python.exe" }
elseif (Test-Path "$ReporterDir\.venv\Scripts\python.exe")       { $py = "$ReporterDir\.venv\Scripts\python.exe" }
elseif (Test-Path "$ReporterDir\.venv-win\Scripts\python.exe")   { $py = "$ReporterDir\.venv-win\Scripts\python.exe" }
else { $py = "python" }

& $py -m pip install -r "$ReporterDir\requirements.txt" -q
& $py -m pytest "$ReporterDir\tests\test_report_parity.py" -v
exit $LASTEXITCODE
