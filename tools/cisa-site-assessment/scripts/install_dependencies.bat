@echo off
REM Install Python Dependencies via PSA System venv
REM DEPRECATED: Use D:\PSA_System\scripts\python\create_venv.ps1 instead
REM This script is kept for backward compatibility

setlocal

echo WARNING: This script is deprecated.
echo Please use: D:\PSA_System\scripts\python\create_venv.ps1 -ServiceName processor
echo.
echo For processor service dependencies, run:
echo   D:\PSA_System\scripts\python\create_venv.ps1 -ServiceName processor
echo.
echo For engine service dependencies, run:
echo   D:\PSA_System\scripts\python\create_venv.ps1 -ServiceName engine
echo.
pause

exit /b 0
