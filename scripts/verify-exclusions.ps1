# Verify what files are being included/excluded in uploads
$exclusions = @(
    "node_modules",
    ".git",
    "__pycache__",
    "local-deployment",
    "live-deployment",
    "deployment-manager"
)

Write-Host "=== UPLOAD EXCLUSION VERIFICATION ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Current exclude patterns:" -ForegroundColor Yellow
$exclusions | ForEach-Object { Write-Host "  - $_" }
Write-Host ""

# Check if lib/db exists and should be included
Write-Host "Checking lib/db folder..." -ForegroundColor Yellow
if (Test-Path "lib/db") {
    Write-Host "  ✓ lib/db folder exists" -ForegroundColor Green
    
    # Count files in lib/db
    $dbFiles = Get-ChildItem -Path "lib/db" -Recurse -File | Measure-Object
    Write-Host "  ✓ Contains $($dbFiles.Count) files" -ForegroundColor Green
    
    # Check if drizzle.config.ts is there
    if (Test-Path "lib/db/drizzle.config.ts") {
        Write-Host "  ✓ drizzle.config.ts exists" -ForegroundColor Green
        $hash = Get-FileHash -Path "lib/db/drizzle.config.ts" -Algorithm MD5
        Write-Host "  ✓ MD5: $($hash.Hash)" -ForegroundColor Gray
    } else {
        Write-Host "  ✗ drizzle.config.ts NOT FOUND" -ForegroundColor Red
    }
} else {
    Write-Host "  ✗ lib/db folder NOT FOUND" -ForegroundColor Red
}

Write-Host ""
Write-Host "Files that SHOULD be excluded:" -ForegroundColor Yellow
Get-ChildItem -Force | Where-Object { $_.Name -in $exclusions } | ForEach-Object {
    Write-Host "  ✓ Excluded: $($_.Name)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "✓ Verification complete!" -ForegroundColor Green
Write-Host ""
Write-Host "To verify upload is working:" -ForegroundColor Yellow
Write-Host "  1. Ensure drizzle.config.ts is NOT in the exclude list above" -ForegroundColor Gray
Write-Host "  2. Click 'Clear HashCache & Full Upload'" -ForegroundColor Gray
Write-Host "  3. SSH to VPS and run: head -10 /home/admin/Scootware-Forum/lib/db/drizzle.config.ts" -ForegroundColor Gray
