@echo off
REM Ingest module sources from storage
REM Ingests files that are already in module_sources table with valid storage_relpath
REM Requires: --module-code (e.g. MODULE_EV_PARKING)

setlocal

set SCRIPT_DIR=%~dp0
set PROJECT_ROOT=%SCRIPT_DIR%..
cd /d "%PROJECT_ROOT%"

if "%PSA_SYSTEM_ROOT%"=="" set PSA_SYSTEM_ROOT=D:\PSA_System
set VENV_PYTHON=%PSA_SYSTEM_ROOT%\Dependencies\python\venvs\processor\Scripts\python.exe

if not exist "%VENV_PYTHON%" (
    echo ERROR: Processor venv not found: %VENV_PYTHON%
    echo Create it: D:\PSA_System\scripts\python\create_venv.ps1 -ServiceName processor
    exit /b 1
)

"%VENV_PYTHON%" tools\corpus\ingest_module_sources.py %*
exit /b %ERRORLEVEL%
