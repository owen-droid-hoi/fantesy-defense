@echo off
title Fantasy Defense - Launcher
color 0B
echo.
echo  ==========================================
echo    FANTASY DEFENSE - 3D Tower Defense
echo    Chest System / Loadout / 17 Tower Types
echo  ==========================================
echo.
echo  Starting local server on port 8000...
echo  The game will open in your browser.
echo  Keep this window open while playing!
echo.

:: Check if port 8000 is already in use and kill it
for /f "tokens=5" %%a in ('netstat -aon ^| find ":8000" ^| find "LISTENING" 2^>nul') do (
    echo  [INFO] Found existing process on port 8000, stopping it...
    taskkill /F /PID %%a >nul 2>&1
)

:: Small delay then open browser
timeout /t 1 /nobreak >nul
start "" "http://localhost:8000"

:: Start Python server
python -m http.server 8000
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  [ERROR] Could not start the server!
    echo  Make sure Python is installed: https://www.python.org
    echo.
    pause
)
