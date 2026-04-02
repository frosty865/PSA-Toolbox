@echo off
REM Process module PDFs from D:\PSA_System\data\incoming
REM Copies to module storage, ingests into CORPUS, links to module (module_sources, module_source_documents, module_chunk_links).
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

"%VENV_PYTHON%" tools\corpus\process_module_pdfs_from_incoming.py %*
exit /b %ERRORLEVEL%
