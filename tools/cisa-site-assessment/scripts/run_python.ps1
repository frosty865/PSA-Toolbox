# Cross-platform Python runner script for Windows
# Usage: .\scripts\run_python.ps1 <script_path> [args...]

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

# Determine Python path
if (Test-Path "$ProjectRoot\venv\Scripts\python.exe") {
    $Python = "$ProjectRoot\venv\Scripts\python.exe"
} elseif (Test-Path "$ProjectRoot\venv\Scripts\python3.exe") {
    $Python = "$ProjectRoot\venv\Scripts\python3.exe"
} else {
    $Python = "python"
}

# Run script with all arguments
& $Python $args
