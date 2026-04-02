#!/bin/bash
# Setup Python virtual environment for Linux/Mac
# Usage: ./scripts/setup_venv.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

echo "=========================================="
echo "Python Virtual Environment Setup"
echo "=========================================="
echo ""

# Check Python version
if ! command -v python3 &> /dev/null; then
    echo "❌ python3 not found. Please install Python 3.11+"
    exit 1
fi

PYTHON_VERSION=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1,2)
echo "Found Python: $(python3 --version)"

# Check if Python 3.11+
if python3 -c "import sys; exit(0 if sys.version_info >= (3, 11) else 1)"; then
    echo "✅ Python version OK (3.11+)"
else
    echo "⚠️  Warning: Python 3.11+ recommended. Current: $PYTHON_VERSION"
fi

# Create venv
if [ -d "venv" ]; then
    echo "⚠️  venv directory already exists. Remove it first to recreate:"
    echo "   rm -rf venv"
    read -p "Continue with existing venv? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo "Creating virtual environment..."
    python3 -m venv venv
    echo "✅ Virtual environment created"
fi

# Activate venv
echo "Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo "Upgrading pip..."
pip install --upgrade pip

# Install base dependencies
echo ""
echo "Installing base dependencies..."
pip install -r Dependencies/python/requirements-base.txt

# Install processor dependencies (if file exists)
if [ -f "Dependencies/python/requirements-processor.txt" ]; then
    echo "Installing processor dependencies..."
    pip install -r Dependencies/python/requirements-processor.txt
fi

# Install engine dependencies (if file exists)
if [ -f "Dependencies/python/requirements-engine.txt" ]; then
    echo "Installing engine dependencies..."
    pip install -r Dependencies/python/requirements-engine.txt
fi

# Install additional tool dependencies
if [ -f "tools/corpus/requirements_ocr.txt" ]; then
    echo "Installing OCR dependencies..."
    pip install -r tools/corpus/requirements_ocr.txt
fi

if [ -f "tools/research/requirements.txt" ]; then
    echo "Installing research tool dependencies..."
    pip install -r tools/research/requirements.txt
fi

if [ -f "tools/ist_ingest/requirements.txt" ]; then
    echo "Installing IST ingest dependencies..."
    pip install -r tools/ist_ingest/requirements.txt
fi

# Install common utilities
echo "Installing common utilities..."
pip install python-dotenv

echo ""
echo "=========================================="
echo "✅ Setup Complete!"
echo "=========================================="
echo ""
echo "To activate the virtual environment:"
echo "  source venv/bin/activate"
echo ""
echo "To verify installation:"
echo "  python --version"
echo "  pip list"
echo ""
echo "To test scripts:"
echo "  python tools/corpus/mine_ofc_candidates_from_chunks_v3.py --help"
echo ""
