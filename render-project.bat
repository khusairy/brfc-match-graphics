@echo off
setlocal
cd /d "%~dp0"

if "%~1"=="" (
  echo Drag a BRFC render-project JSON file onto this file.
  pause
  exit /b 1
)

echo %~nx1 | findstr /i /c:"-render-project.json" >nul
if errorlevel 1 (
  echo This is not a BRFC render-project JSON file.
  echo Go back to the Match Graphics website, click "Download render project",
  echo then drag that downloaded file onto this batch file.
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
