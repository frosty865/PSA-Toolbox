@echo off
REM Stop Pipeline Watcher (Windows Batch Script)

setlocal

set SCRIPT_DIR=%~dp0
set WATCHER_DIR=%SCRIPT_DIR%..
set PIDFILE=%WATCHER_DIR%\watcher.pid

if not exist "%PIDFILE%" (
    echo Watcher is not running (no PID file found)
    exit /b 0
)

for /f %%i in (%PIDFILE%) do (
    tasklist /FI "PID eq %%i" 2>NUL | find /I "python.exe" >NUL
    if errorlevel 1 (
        echo Watcher is not running (stale PID file)
        del "%PIDFILE%"
        exit /b 0
    )
    
    echo Stopping Pipeline Watcher (PID: %%i)...
    taskkill /PID %%i /F >nul 2>&1
    del "%PIDFILE%"
    echo Watcher stopped
)

