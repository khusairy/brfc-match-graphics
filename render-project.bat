@echo off
setlocal

if "%~1"=="" (
  echo Drag a BRFC render-project JSON file onto this file.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js LTS is required. Install it from https://nodejs.org/ then run this again.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing the renderer for the first time...
  call npm install
  if errorlevel 1 (
    echo Installation failed.
    pause
    exit /b 1
  )
)

call npm run render -- "%~1"
pause
