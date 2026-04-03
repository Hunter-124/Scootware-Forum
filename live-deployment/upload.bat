@echo off
set "SCRIPT_PATH=%~dp0upload.ps1"
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_PATH%"
pause
