@echo off
title Music Studio - AI Music Creator
cd /d "%~dp0"
echo ============================================================
echo   Music Studio - starting...
echo   Install folder: %CD%
echo ============================================================
echo.
node.exe start-installer.mjs
if %ERRORLEVEL% NEQ 0 (
  echo.
  echo ============================================================
  echo   Startup FAILED with code: %ERRORLEVEL%
  echo   Please take a screenshot of this window and contact dev
  echo ============================================================
  echo.
  pause
)
