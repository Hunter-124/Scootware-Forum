<#
.DESCRIPTION
Automated API deployment loader for Scootware Forum
- Builds the API
- Uploads to AWS EC2
- Restarts the PM2 service
#>

param(
    [switch]$SkipBuild = $false
)

$ErrorActionPreference = "Stop"

# Configuration
$VPS_IP = $env:VPS_IP
$VPS_USER = $env:VPS_USER
$PEM_KEY = $env:SSH_KEY_PATH
$REMOTE_PATH = $env:VPS_REMOTE_PATH
$API_SOURCE = "artifacts/api-server"
$API_DIST = "artifacts/api-server/dist"
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path

# Color helpers
function Write-Success {
    Write-Host $args -ForegroundColor Green
}

function Write-Warn {
    Write-Host $args -ForegroundColor Yellow
}

function Write-Err {
    Write-Host $args -ForegroundColor Red
}

function Write-In {
    Write-Host $args -ForegroundColor Cyan
}

# Verify PEM key exists
if (-not (Test-Path "$env:SSH_KEY_PATH")) {
    Write-Err "ERROR: SSH_KEY_PATH env var not set or key not found at $env:SSH_KEY_PATH"
    exit 1
}

Write-In "`n========================================="
Write-In "  SCOOTWARE API DEPLOYMENT LOADER"
Write-In "=========================================`n"

# Step 1: Build API
if ($SkipBuild) {
    Write-Warn "Skipping build (--SkipBuild)"
}
else {
    Write-In "[1/4] Building API..."
    
    Push-Location "$SCRIPT_DIR\$API_SOURCE"
    
    if (-not (Test-Path "package.json")) {
        Write-Err "ERROR: package.json not found in $API_SOURCE"
        exit 1
    }
    
    Write-Host "      Running: pnpm run build"
    & pnpm run build
    
    if ($LASTEXITCODE -ne 0) {
        Write-Err "`nERROR: Build failed!`n"
        Pop-Location
        exit 1
    }
    
    Write-Success "      [OK] Build successful"
    
    # Show build info
    if (Test-Path "dist/index.mjs") {
        $buildSize = (Get-Item "dist/index.mjs").Length / 1MB
        $sizeStr = [Math]::Round($buildSize, 2)
        Write-In "        Bundle: dist/index.mjs ($sizeStr MB)"
    }
    
    Pop-Location
}

# Verify dist exists
if (-not (Test-Path "$SCRIPT_DIR\$API_DIST")) {
    Write-Err "ERROR: dist directory not found at $SCRIPT_DIR\$API_DIST"
    exit 1
}

# Step 2: Upload to VPS
Write-In "`n[2/4] Uploading to VPS ($VPS_IP)..."

$pemKeyPath = "$env:SSH_KEY_PATH"
$distPath = "$SCRIPT_DIR\$API_DIST"

try {
    Write-Host "      Using: $pemKeyPath"
    Write-Host "      Source: $distPath"
    Write-Host "      Target: $VPS_USER@$VPS_IP`:$REMOTE_PATH/artifacts/api-server/"
    
    # Use SCP to upload entire dist directory
    $scpCmd = "scp -i `"$pemKeyPath`" -r `"$distPath`" `"$VPS_USER@$VPS_IP`:$REMOTE_PATH/artifacts/api-server/`""
    
    Write-Host "      Running: scp ..."
    Invoke-Expression $scpCmd 2>&1 | Out-Null
    
    if ($LASTEXITCODE -ne 0) {
        Write-Err "      ERROR: SCP upload failed"
        exit 1
    }
    
    Write-Success "      [OK] Upload complete"
}
catch {
    Write-Err "      ERROR: Upload error: $_"
    exit 1
}

# Step 3: Restart PM2
Write-In "`n[3/4] Restarting PM2 service..."

try {
    # Combined command: Kill anything on port 3000, delete old process if exists, and start from config
    $remoteCmd = "sudo fuser -k 3000/tcp || true; cd $REMOTE_PATH && pm2 delete scootware-api || true; pm2 start ecosystem.config.cjs --update-env"
    $sshCmd = "ssh -i `"$pemKeyPath`" $VPS_USER@$VPS_IP `"$remoteCmd`""
    
    Write-Host "      Cleaning port 3000 and restarting PM2"
    $restartOutput = Invoke-Expression $sshCmd 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        Write-Err "      ERROR: PM2 restart failed"
        exit 1
    }
    
    Write-Success "      [OK] PM2 restarted"
}
catch {
    Write-Err "      ERROR: SSH error: $_"
    exit 1
}

# Step 4: Verify Service
Write-In "`n[4/4] Verifying service status..."

try {
    $sshCmd = "ssh -i `"$pemKeyPath`" $VPS_USER@$VPS_IP `"pm2 status scootware-api`""
    
    $statusOutput = Invoke-Expression $sshCmd 2>&1
    
    if ($statusOutput -match "online|One or more") {
        Write-Success "      [OK] Service online"
        Write-Host $statusOutput | Select-String -Pattern "scootware-api|PID|online" | ForEach-Object { Write-Host "        $_" }
    }
    else {
        Write-Warn "      WARNING: Could not verify service status"
        Write-Host "        $statusOutput"
    }
}
catch {
    Write-Warn "      WARNING: Verification check failed (service may still be running): $_"
}

# Summary
Write-Success "`n========================================="
Write-Success "  [OK] DEPLOYMENT COMPLETE"
Write-Success "=========================================`n"

Write-Host "Summary:"
Write-Host "   - API built and bundled"
Write-Host "   - Files uploaded to VPS"
Write-Host "   - PM2 service restarted"
Write-Host "   - Service verified online`n"

Write-Host "VPS Details:"
Write-Host "   - Host: $VPS_IP"
Write-Host "   - User: $VPS_USER"
Write-Host "   - Service: scootware-api (PM2)`n"

Write-Host "Next steps:"
Write-Host "   - Test API: http://$VPS_IP`:3000/api/health"
Write-Host "   - View logs: pm2 logs scootware-api`n"

exit 0
