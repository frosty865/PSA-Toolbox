@echo off
REM Start Pipeline Watcher (Windows Batch Script)

setlocal

set SCRIPT_DIR=%~dp0
set WATCHER_DIR=%SCRIPT_DIR%..
set REPO_ROOT=%WATCHER_DIR%..\..
set PIDFILE=%WATCHER_DIR%\watcher.pid
set LOGFILE=%WATCHER_DIR%\watcher.log

REM Check if already running
if exist "%PIDFILE%" (
    for /f %%i in (%PIDFILE%) do (
        tasklist /FI "PID eq %%i" 2>NUL | find /I /N "python.exe">NUL
        if "%%ERRORLEVEL%%"=="0" (
            echo Watcher is already running (PID: %%i)
            exit /b 0
        ) else (
            echo Stale PID file found, removing...
            del "%PIDFILE%"
        )
    )
)

REM Find Python
set PYTHON=
if exist "%REPO_ROOT%\venv\Scripts\python.exe" (
    set PYTHON=%REPO_ROOT%\venv\Scripts\python.exe
) else (
    where python.exe >nul 2>&1
    if %ERRORLEVEL%==0 (
        for /f "delims=" %%i in ('where python.exe') do set PYTHON=%%i
    )
)

if "%PYTHON%"=="" (
    echo Error: Python not found
    exit /b 1
)

REM Set environment
set PYTHONPATH=%REPO_ROOT%

REM Start watcher
echo Starting Pipeline Watcher...
cd /d "%WATCHER_DIR%"
start /B "" "%PYTHON%" pipeline_watcher.py > "%LOGFILE%" 2>&1

REM Get PID (approximate - Windows limitation)
timeout /t 2 /nobreak >nul
for /f "tokens=2" %%i in ('tasklist /FI "WINDOWTITLE eq pipeline_watcher.py*" /FO LIST ^| findstr /C:"PID:"') do (
    echo %%i > "%PIDFILE%"
    echo Watcher started (PID: %%i)
    echo Logs: %LOGFILE%
    exit /b 0
)

echo Error: Failed to start watcher
exit /b 1

