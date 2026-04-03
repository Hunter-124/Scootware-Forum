# WinSCP Upload Script for Scootware.us

$REMOTE_HOST = "[VPS_IP]"
$WinSCPPath  = "C:\Program Files (x86)\WinSCP\WinSCP.com"

# Discover paths relative to this script location.
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ScriptPath = Join-Path $ScriptDir "upload-winscp.txt"
$LocalRoot = Resolve-Path (Join-Path $ScriptDir "..")

Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "   SCOOTWARE WINSCP DEPLOYMENT SYSTEM         " -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

# Check WinSCP
if (-not (Test-Path $WinSCPPath)) {
    Write-Host "[ERROR] WinSCP not found at $WinSCPPath" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit
}

# Check Script
if (-not (Test-Path $ScriptPath)) {
    Write-Host "[ERROR] Script file not found at $ScriptPath" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit
}

Write-Host "Connecting to admin@[VPS_IP]..." -ForegroundColor Yellow
Write-Host "Uploading from: $LocalRoot"

# Run WinSCP
& $WinSCPPath /script=$ScriptPath /parameter // $LocalRoot

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n[SUCCESS] Files synchronized successfully!" -ForegroundColor Green
} else {
    Write-Host "`n[ERROR] WinSCP failed with exit code $LASTEXITCODE" -ForegroundColor Red
}

Write-Host "`n=============================================="
Read-Host "Press Enter to close this window"
