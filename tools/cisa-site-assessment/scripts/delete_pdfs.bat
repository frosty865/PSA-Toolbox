@echo off
REM Delete specific PDF files from PSA System incoming directory
setlocal

REM Resolve PSA System root
if "%PSA_SYSTEM_ROOT%"=="" set PSA_SYSTEM_ROOT=D:\PSA_System

set PDF_DIR=%PSA_SYSTEM_ROOT%\data\incoming

cd /d "%PDF_DIR%"
if exist "FAA_FAA_TFR_DECISION_MATRIX_SLTT_LAW_ENFORCEMENT_GUIDE.pdf" del "FAA_FAA_TFR_DECISION_MATRIX_SLTT_LAW_ENFORCEMENT_GUIDE.pdf"
if exist "workbook.pdf" del "workbook.pdf"
echo Done.
