@echo off
REM Verify OFC Purge Status
REM This script checks if all OFC tables are empty
REM Uses venv Python directly

setlocal

set SCRIPT_DIR=%~dp0
set PROJECT_ROOT=%SCRIPT_DIR%..
cd /d "%PROJECT_ROOT%"

REM Check if venv exists and use venv Python directly
set VENV_PYTHON=%PROJECT_ROOT%\venv\Scripts\python.exe
if not exist "%VENV_PYTHON%" (
    echo ERROR: Virtual environment not found at venv\Scripts\python.exe
    echo Please create a virtual environment first:
    echo   python -m venv venv
    exit /b 1
)

"%VENV_PYTHON%" tools\corpus\verify_ofc_purge.py
set EXIT_CODE=%ERRORLEVEL%

exit /b %EXIT_CODE%
