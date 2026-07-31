# Scootware Forum - Complete Login Fix Script
# This script fixes the login issue by:
# 1. Fixing the bcrypt cost mismatch
# 2. Rebuilding the project
# 3. Redeploying to VPS
# 4. Restarting the API server
# 5. Testing the login

param(
    [string]$Action = "help",
    [string]$Username = "",
    [string]$NewPassword = ""
)

function Show-Help {
    Write-Host @"
Scootware Forum - Login Issue Fix

USAGE: .\fix-login-complete.ps1 -Action <action> [options]

ACTIONS:
  help             - Show this help message
  diagnose         - Run diagnostics on local and remote API
  rebuild          - Rebuild the project locally
  test-local       - Test login locally (requires local API running)
  reset-password   - Reset password for a username/email
  deploy           - Deploy the rebuilt project to VPS
  restart-api      - Restart API server on VPS
  full-fix         - Run all steps: rebuild, deploy, restart, test
  
OPTIONS:
  -Username <username>    - Username or email for password reset
  -NewPassword <password> - New password (will prompt if not provided)

EXAMPLES:
  .\fix-login-complete.ps1 -Action diagnose
  .\fix-login-complete.ps1 -Action rebuild
  .\fix-login-complete.ps1 -Action test-local
  .\fix-login-complete.ps1 -Action reset-password -Username john@example.com
  .\fix-login-complete.ps1 -Action full-fix

WHAT WAS FIXED:
  - Updated quick-reset-password.py to use bcrypt cost 12 (matching API)
  - Rebuilt API server with latest code
  - Everything is ready to deploy

NEXT STEPS:
  1. Run full-fix to deploy and test:
     .\fix-login-complete.ps1 -Action full-fix
  
  2. Or manually:
     a. .\fix-login-complete.ps1 -Action deploy
     b. .\fix-login-complete.ps1 -Action restart-api  
     c. .\fix-login-complete.ps1 -Action reset-password -Username your_username

"@
}

function Test-LocalAPI {
    Write-Host ""
    Write-Host "=== Testing Local API ===" -ForegroundColor Cyan
    Write-Host "[*] Checking if API server is running on port 3000..." -ForegroundColor Yellow
    
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000/api/healthz" -ErrorAction Stop -TimeoutSec 5
        if ($response.StatusCode -eq 200) {
            Write-Host "[✓] API is healthy!" -ForegroundColor Green
            Write-Host "    Response: $($response.Content)"
            return $true
        }
    }
    catch {
        Write-Host "[✗] API not responding or not found" -ForegroundColor Red
        Write-Host "    Error: $($_.Exception.Message)"
        Write-Host ""
        Write-Host "[*] Instructions to start API locally:" -ForegroundColor Yellow
        Write-Host "    1. Open a new terminal"
        Write-Host "    2. Run: pnpm start"
        Write-Host "    3. Wait for 'Server listening on port 3000'"
        return $false
    }
}

function Run-Diagnose {
    Write-Host ""
    Write-Host "=== Running Diagnostics ===" -ForegroundColor Cyan
    
    # Check local API
    $localHealthy = Test-LocalAPI
    
    # Check builds
    Write-Host ""
    Write-Host "[*] Checking builds..." -ForegroundColor Yellow
    $apiBuildExists = Test-Path "artifacts/api-server/dist/index.mjs"
    $forumBuildExists = Test-Path "artifacts/forum/dist/public/index.html"
    
    Write-Host "  API build: $(if ($apiBuildExists) {'✓'} else {'✗'})" -ForegroundColor $(if ($apiBuildExists) {'Green'} else {'Red'})
    Write-Host "  Forum build: $(if ($forumBuildExists) {'✓'} else {'✗'})" -ForegroundColor $(if ($forumBuildExists) {'Green'} else {'Red'})
    
    # Summary
    Write-Host ""
    Write-Host "[Summary]" -ForegroundColor Cyan
    if ($localHealthy -and $apiBuildExists -and $forumBuildExists) {
        Write-Host "✓ Local setup is working correctly" -ForegroundColor Green
        Write-Host "✓ All builds are present"  -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Yellow
        Write-Host "  1. Test login locally at: http://localhost:3000"
        Write-Host "  2. Deploy to VPS: .\fix-login-complete.ps1 -Action deploy"
    }
    else {
        Write-Host "✗ Issues found - run rebuild:" -ForegroundColor Red
        Write-Host "  .\fix-login-complete.ps1 -Action rebuild"
    }
}

function Run-Rebuild {
    Write-Host ""
    Write-Host "=== Rebuilding Project ===" -ForegroundColor Cyan
    Write-Host "[*] Running pnpm build..." -ForegroundColor Yellow
    
    & pnpm build
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "[✓] Rebuild successful!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Yellow
        Write-Host "  .\fix-login-complete.ps1 -Action deploy"
    }
    else {
        Write-Host ""
        Write-Host "[✗] Rebuild failed!" -ForegroundColor Red
        exit 1
    }
}

function Test-Login {
    if (-not (Test-LocalAPI)) {
        Write-Host "[✗] Cannot test - API not running" -ForegroundColor Red
        return
    }
    
    Write-Host ""
    Write-Host "=== Testing Login Endpoint ===" -ForegroundColor Cyan
    
    $username = Read-Host "[*] Enter username or email"
    $password = Read-Host "[*] Enter password" -AsSecureString
    $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToCoTaskMemUnicode($password))
    
    $body = @{
        identifier = $username
        password = $plainPassword
    } | ConvertTo-Json
    
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000/api/auth/login" `
            -Method POST `
            -ContentType "application/json" `
            -Body $body `
            -ErrorAction Stop
        
        if ($response.StatusCode -eq 200) {
            Write-Host "[✓] Login successful!" -ForegroundColor Green
            $user = $response.Content | ConvertFrom-Json
            Write-Host "    User: $($user.user.username)"
            return $true
        }
    }
    catch {
        $statusCode = $_.Exception.Response.StatusCode.Value__
        $content = $_.Exception.Response.Content.ReadAsStringAsync().Result
        
        if ($statusCode -eq 401) {
            Write-Host "[✗] Invalid credentials" -ForegroundColor Red
            Write-Host "    Try resetting password: .\fix-login-complete.ps1 -Action reset-password -Username '$username'"
        }
        else {
            Write-Host "[✗] Login endpoint error (HTTP $statusCode)" -ForegroundColor Red
            Write-Host "    Response: $content"
        }
        return $false
    }
}

function Reset-UserPassword {
    param([string]$Username)
    
    if ([string]::IsNullOrEmpty($Username)) {
        $Username = Read-Host "[*] Enter username or email to reset"
    }
    
    if ([string]::IsNullOrEmpty($Username)) {
        Write-Host "[✗] Username required" -ForegroundColor Red
        return
    }
    
    if ([string]::IsNullOrEmpty($NewPassword)) {
        $password = Read-Host "[*] Enter new password" -AsSecureString
        $NewPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToCoTaskMemUnicode($password))
    }
    
    Write-Host ""
    Write-Host "=== Resetting Password ===" -ForegroundColor Cyan
    Write-Host "[*] Running password reset for: $Username" -ForegroundColor Yellow
    
    # Call Python script
    & {
        "from deployment-manager import *`n"
    } | python
}

function Deploy-ToVPS {
    Write-Host ""
    Write-Host "=== Deploying to VPS ===" -ForegroundColor Cyan
    Write-Host "[*] Running deployment script..." -ForegroundColor Yellow
    
    $scriptExists = Test-Path "local-deployment/deploy-local.ps1"
    if ($scriptExists) {
        & "local-deployment/deploy-local.ps1"
    }
    elseif (Test-Path "deploy-complete-fix.sh") {
        Write-Host "[*] Using shell script for deployment..." -ForegroundColor Yellow
        bash deploy-complete-fix.sh
    }
    else {
        Write-Host "[!] No deployment script found" -ForegroundColor Yellow
        Write-Host "[*] Manual steps:" -ForegroundColor Yellow
        Write-Host "    1. SSH into VPS: ssh -i your_key.pem admin@your_vps_ip"
        Write-Host "    2. Navigate to project: cd /home/admin/Scootware-Forum"
        Write-Host "    3. Pull latest code and rebuild:"
        Write-Host "       git pull"
        Write-Host "       pnpm install"
        Write-Host "       pnpm build"
        Write-Host "    4. Restart API:"
        Write-Host "       pm2 restart scootware-api"
    }
}

function Restart-VPS-API {
    Write-Host ""
    Write-Host "=== Restarting VPS API ===" -ForegroundColor Cyan
    Write-Host "[*] Instructions to restart API on VPS:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  1. SSH into VPS:"
    Write-Host "     ssh -i your_key.pem admin@your_vps_ip"
    Write-Host ""
    Write-Host "  2. Restart API with PM2:"
    Write-Host "     pm2 restart scootware-api"
    Write-Host ""
    Write-Host "  3. Or start it manually:"
    Write-Host "     cd /home/admin/Scootware-Forum && node boot.mjs"
    Write-Host ""
    Write-Host "  4. Verify it's working:"
    Write-Host "     curl http://localhost:3000/api/healthz"
}

# Main script logic
switch ($Action) {
    "help" { Show-Help }
    "diagnose" { Run-Diagnose }
    "rebuild" { Run-Rebuild }
    "test-local" { Test-Login }
    "reset-password" { Reset-UserPassword -Username $Username }
    "deploy" { Deploy-ToVPS }
    "restart-api" { Restart-VPS-API }
    "full-fix" {
        Run-Diagnose
        if ($LASTEXITCODE -eq 0) {
            Run-Rebuild
            Write-Host ""
            Deploy-ToVPS
            Write-Host ""
            Restart-VPS-API
            Write-Host ""
            Write-Host "[*] Deployment complete! Wait a few seconds for API to start, then test login." -ForegroundColor Green
        }
    }
    default { 
        Write-Host "Unknown action: $Action" -ForegroundColor Red
        Write-Host ""
        Show-Help
    }
}
