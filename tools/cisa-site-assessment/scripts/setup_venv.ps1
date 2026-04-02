# Setup Python virtual environment for Windows
# Usage: .\scripts\setup_venv.ps1

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

Set-Location $ProjectRoot

Write-Host "=========================================="
Write-Host "Python Virtual Environment Setup"
Write-Host "=========================================="
Write-Host ""

# Check Python version
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "❌ python not found. Please install Python 3.11+"
    exit 1
}

$PythonVersion = python --version
Write-Host "Found Python: $PythonVersion"

# Create venv
if (Test-Path "venv") {
    Write-Host "⚠️  venv directory already exists. Remove it first to recreate:"
    Write-Host "   Remove-Item -Recurse -Force venv"
    $response = Read-Host "Continue with existing venv? (y/N)"
    if ($response -ne "y" -and $response -ne "Y") {
        exit 1
    }
} else {
    Write-Host "Creating virtual environment..."
    python -m venv venv
    Write-Host "✅ Virtual environment created"
}

# Activate venv
Write-Host "Activating virtual environment..."
& "venv\Scripts\Activate.ps1"

# Upgrade pip
Write-Host "Upgrading pip..."
python -m pip install --upgrade pip

# Install base dependencies
Write-Host ""
Write-Host "Installing base dependencies..."
pip install -r Dependencies\python\requirements-base.txt

# Install processor dependencies (if file exists)
if (Test-Path "Dependencies\python\requirements-processor.txt") {
    Write-Host "Installing processor dependencies..."
    pip install -r Dependencies\python\requirements-processor.txt
}

# Install engine dependencies (if file exists)
if (Test-Path "Dependencies\python\requirements-engine.txt") {
    Write-Host "Installing engine dependencies..."
    pip install -r Dependencies\python\requirements-engine.txt
}

# Install additional tool dependencies
if (Test-Path "tools\corpus\requirements_ocr.txt") {
    Write-Host "Installing OCR dependencies..."
    pip install -r tools\corpus\requirements_ocr.txt
}

if (Test-Path "tools\research\requirements.txt") {
    Write-Host "Installing research tool dependencies..."
    pip install -r tools\research\requirements.txt
}

if (Test-Path "tools\ist_ingest\requirements.txt") {
    Write-Host "Installing IST ingest dependencies..."
    pip install -r tools\ist_ingest\requirements.txt
}

# Install common utilities
Write-Host "Installing common utilities..."
pip install python-dotenv

Write-Host ""
Write-Host "=========================================="
Write-Host "✅ Setup Complete!"
Write-Host "=========================================="
Write-Host ""
Write-Host "To activate the virtual environment:"
Write-Host "  .\venv\Scripts\Activate.ps1"
Write-Host ""
Write-Host "To verify installation:"
Write-Host "  python --version"
Write-Host "  pip list"
Write-Host ""
Write-Host "To test scripts:"
Write-Host "  python tools\corpus\mine_ofc_candidates_from_chunks_v3.py --help"
Write-Host ""
