@echo off
setlocal
cd /d "%~dp0"

if "%PORT%"=="" set "PORT=5173"
set "URL=http://127.0.0.1:%PORT%"
set "HEALTH=%URL%/api/health"
set "READY=%URL%/api/trades"

echo.
echo Stock Review Notebook - launcher
echo Project: %cd%
echo URL: %URL%
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Please install Node.js or add node to PATH.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm was not found. Please install Node.js/npm or add npm to PATH.
  pause
  exit /b 1
)

node scripts\check-health.js "%HEALTH%" >nul 2>nul
if not errorlevel 1 (
  node scripts\check-health.js "%READY%" >nul 2>nul
  if not errorlevel 1 (
    echo Server is already running. Opening browser...
    start "" "%URL%"
    exit /b 0
  )
  echo An older server is already running on port %PORT%.
  echo Please close the old "Stock Review Notebook Server" window, then run start.bat again.
  pause
  exit /b 1
)

echo Building client and server...
call npm run build
if errorlevel 1 (
  echo.
  echo Build failed. Please check the message above.
  pause
  exit /b 1
)

echo.
echo Starting local server...
start "Stock Review Notebook Server" /min /d "%~dp0" cmd /k "node dist\server\server.js"

echo Waiting for server...
for /l %%i in (1,1,30) do (
  node scripts\check-health.js "%READY%" >nul 2>nul
  if not errorlevel 1 goto ready
  timeout /t 1 /nobreak >nul
)

echo.
echo Server startup timed out. Please check whether port %PORT% is already in use.
pause
exit /b 1

:ready
echo Server is ready: %URL%
echo Opening browser...
start "" "%URL%"
echo.
echo The server window is minimized. Close that window to stop the app.
echo You can close this launcher window now.

endlocal
