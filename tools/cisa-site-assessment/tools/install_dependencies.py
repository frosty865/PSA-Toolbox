#!/usr/bin/env python3
"""Install Python dependencies via PSA System venv.
DEPRECATED: Use D:\\PSA_System\\scripts\\python\\create_venv.ps1 instead
This script is kept for backward compatibility.
"""
import os
import subprocess
import sys
from pathlib import Path

def main():
    """Install dependencies."""
    print("WARNING: This script is deprecated.")
    print("Please use: D:\\PSA_System\\scripts\\python\\create_venv.ps1 -ServiceName processor")
    print("")
    print("For processor service dependencies, run:")
    print("  D:\\PSA_System\\scripts\\python\\create_venv.ps1 -ServiceName processor")
    print("")
    print("For engine service dependencies, run:")
    print("  D:\\PSA_System\\scripts\\python\\create_venv.ps1 -ServiceName engine")
    return 1
    
    # Upgrade pip
    if not run_command([str(venv_python), "-m", "pip", "install", "--upgrade", "pip"], "Upgrading pip"):
        return 1
    
    # Install requirements
    requirements_file = project_root / "requirements.txt"
    if not requirements_file.exists():
        print(f"ERROR: requirements.txt not found at {requirements_file}")
        return 1
    
    if not run_command([str(venv_python), "-m", "pip", "install", "-r", str(requirements_file)], "Installing dependencies"):
        return 1
    
    # Verify installations
    print("\nVerifying installations...")
    packages = [
        ("psycopg2", "psycopg2"),
        ("pdfplumber", "pdfplumber"),
        ("pypdf", "pypdf"),
    ]
    
    for module_name, display_name in packages:
        try:
            result = subprocess.run(
                [str(venv_python), "-c", f"import {module_name}; print('✓ {display_name}:', {module_name}.__version__)"],
                capture_output=True,
                text=True,
                check=True
            )
            print(result.stdout.strip())
        except:
            print(f"✗ {display_name}: Not installed")
    
    # Check optional OCR dependencies
    print("\nChecking OCR dependencies (optional)...")
    ocr_packages = [
        ("pdf2image", "pdf2image"),
        ("pytesseract", "pytesseract"),
    ]
    
    for module_name, display_name in ocr_packages:
        try:
            result = subprocess.run(
                [str(venv_python), "-c", f"import {module_name}; print('✓ {display_name}:', {module_name}.__version__)"],
                capture_output=True,
                text=True,
                check=True
            )
            print(result.stdout.strip())
        except:
            print(f"✗ {display_name}: Not installed (optional - requires system dependencies)")
    
    print("\nInstallation complete!")
    print("\nNote: OCR dependencies require system-level installation of:")
    print("  - Tesseract OCR: https://github.com/UB-Mannheim/tesseract/wiki")
    print("  - Poppler: https://github.com/oschwartz10612/poppler-windows/releases")
    print("See docs/DEPENDENCIES.md for complete installation instructions.")
    
    return 0

if __name__ == '__main__':
    sys.exit(main())
