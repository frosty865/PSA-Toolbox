@echo off
REM Run Source Registry Migration with PSA System venv
REM Uses processor venv from D:\PSA_System\Dependencies\python\venvs\processor

setlocal

set SCRIPT_DIR=%~dp0
set PROJECT_ROOT=%SCRIPT_DIR%..
cd /d "%PROJECT_ROOT%"

REM Resolve PSA System root
if "%PSA_SYSTEM_ROOT%"=="" set PSA_SYSTEM_ROOT=D:\PSA_System

REM Use processor venv for migration tasks
set VENV_PYTHON=%PSA_SYSTEM_ROOT%\Dependencies\python\venvs\processor\Scripts\python.exe

REM Check if venv exists
if not exist "%VENV_PYTHON%" (
    echo ERROR: PSA System processor venv not found at: %VENV_PYTHON%
    echo Please create the virtual environment first:
    echo   D:\PSA_System\scripts\python\create_venv.ps1 -ServiceName processor
    exit /b 1
)

REM Run migration using PSA System venv Python
"%VENV_PYTHON%" tools\run_source_registry_migration.py
set EXIT_CODE=%ERRORLEVEL%

exit /b %EXIT_CODE%
