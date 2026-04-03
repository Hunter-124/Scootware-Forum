@echo off
REM Scootware Deployment Manager - Quick Start Script for Windows

echo.
echo ========================================
echo  Scootware Deployment Manager
echo ========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH
    echo Please install Python 3.10+ from https://www.python.org/
    echo Download from: https://www.python.org/downloads/
    pause
    exit /b 1
)

REM Get the directory where this script is located
set SCRIPT_DIR=%~dp0

REM Check if requirements.txt exists
if not exist "%SCRIPT_DIR%requirements.txt" (
    echo ERROR: requirements.txt not found
    echo Please ensure this script is in the deployment-manager directory
    pause
    exit /b 1
)

REM Run pre-flight checks
echo Running pre-flight checks...
python "%SCRIPT_DIR%check_requirements.py"
if errorlevel 1 (
    echo.
    echo Pre-flight checks failed. Attempting to install dependencies...
    echo.
)

REM Install or upgrade dependencies
echo Installing/updating dependencies...
echo.
python -m pip install --upgrade pip >nul 2>&1
python -m pip install -q -r "%SCRIPT_DIR%requirements.txt"

if errorlevel 1 (
    echo ERROR: Failed to install dependencies
    echo Please run as Administrator or check your internet connection
    pause
    exit /b 1
)

echo.
echo ========================================
echo  Starting Deployment Manager...
echo ========================================
echo.

REM Run the GUI
python "%SCRIPT_DIR%gui.py"

pause
