@echo off
setlocal
cd /d "%~dp0"
where pnpm >nul 2>nul
if errorlevel 1 (
  echo pnpm was not found. Install pnpm and run "pnpm setup" from this folder first.
  exit /b 1
)
if not exist "engine\deepseek-harness\apps\cli\lib\bin.js" (
  echo Patze Local Host is not built yet. Run "pnpm setup" from this folder first.
  exit /b 1
)
if "%~1"=="" (
  echo Usage: start-brother-agent.bat --workspace "^<existing folder^>"
  exit /b 2
)
call pnpm local %*
