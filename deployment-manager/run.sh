#!/bin/bash

# Scootware Deployment Manager - Quick Start Script for Unix/Linux/macOS

echo ""
echo "========================================"
echo "  Scootware Deployment Manager"
echo "========================================"
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python 3 is not installed"
    echo "Please install Python 3.10+ using your package manager"
    echo "  Ubuntu/Debian: sudo apt-get install python3.10"
    echo "  macOS: brew install python@3.10"
    read -p "Press Enter to exit..."
    exit 1
fi

# Check if requirements.txt exists
if [ ! -f "$SCRIPT_DIR/requirements.txt" ]; then
    echo "ERROR: requirements.txt not found"
    echo "Please ensure this script is in the deployment-manager directory"
    read -p "Press Enter to exit..."
    exit 1
fi

# Run pre-flight checks
echo "Running pre-flight checks..."
python3 "$SCRIPT_DIR/check_requirements.py"
if [ $? -ne 0 ]; then
    echo ""
    echo "Pre-flight checks revealed issues."
    echo "Attempting to install dependencies..."
    echo ""
fi

# Create virtual environment if it doesn't exist
if [ ! -d "$SCRIPT_DIR/venv" ]; then
    echo ""
    echo "Creating virtual environment..."
    python3 -m venv "$SCRIPT_DIR/venv" || {
        echo "ERROR: Failed to create virtual environment"
        echo "Try: sudo apt-get install python3-venv (Ubuntu/Debian)"
        read -p "Press Enter to exit..."
        exit 1
    }
fi

# Activate virtual environment
source "$SCRIPT_DIR/venv/bin/activate"

# Install dependencies
echo "Installing/updating dependencies..."
echo ""
pip install --upgrade pip > /dev/null 2>&1
pip install -q -r "$SCRIPT_DIR/requirements.txt"

if [ $? -ne 0 ]; then
    echo "ERROR: Failed to install dependencies"
    echo "Check your internet connection and try again"
    read -p "Press Enter to exit..."
    exit 1
fi

echo ""
echo "========================================"
echo "  Starting Deployment Manager..."
echo "========================================"
echo ""

# Run the GUI
python "$SCRIPT_DIR/gui.py"

