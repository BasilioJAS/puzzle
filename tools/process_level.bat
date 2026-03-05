@echo off
REM process_level.bat — Procesa un nivel individual
REM Uso: process_level.bat <level_id>
REM Ejemplo: process_level.bat 1

if "%~1"=="" (
    echo Uso: process_level.bat ^<level_id^>
    echo Ejemplo: process_level.bat 1
    exit /b 1
)

cd /d "%~dp0\.."
python tools/process_level.py %1
