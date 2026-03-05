@echo off
REM process_all_levels.bat — Procesa TODOS los niveles que tienen imagen
REM Itera sobre tools/assets/puzzlesImg/*.png y ejecuta process_level.bat para cada uno

cd /d "%~dp0\.."

echo =======================================
echo   Procesando TODOS los niveles
echo =======================================
echo.

set COUNT=0
for %%F in (tools\assets\puzzlesImg\*.png) do (
    set /a COUNT+=1
    set "FNAME=%%~nF"
    call :process %%~nF
)

echo.
echo =======================================
echo   Terminado! %COUNT% niveles procesados
echo Compilando metadatos para el juego...
python tools\compile_meta.py

echo.
echo Proceso finalizado.
pause

goto :eof

:process
echo.
echo ── Procesando nivel %1 ──────────────────
python tools\process_level.py %1
goto :eof
