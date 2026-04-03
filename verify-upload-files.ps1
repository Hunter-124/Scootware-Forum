# Verify that all necessary files are included in deployment
$ErrorActionPreference = "Stop"

Write-Host "=== DEPLOYMENT FILES VERIFICATION ===" -ForegroundColor Cyan
Write-Host ""

# Define all critical file patterns that must be included
$criticalPatterns = @(
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "package.json",
    "tsconfig.json",
    "tsconfig.base.json",
    "lib/",
    "artifacts/",
    "config/",
    "scripts/"
)

# Define patterns to exclude
$excludePatterns = @(
    "node_modules/",
    ".git/",
    ".pglite-data/",
    "dist/",
    ".venv/",
    ".next/",
    "build/",
    ".cache/",
    "*.log"
)

Write-Host "Checking critical files and directories..." -ForegroundColor Yellow
$missingFiles = @()
$presentFiles = @()

foreach ($pattern in $criticalPatterns) {
    if (Test-Path $pattern) {
        $presentFiles += $pattern
        Write-Host "  ✓ $pattern" -ForegroundColor Green
    } else {
        $missingFiles += $pattern
        Write-Host "  ✗ MISSING: $pattern" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Checking excluded patterns are excluded..." -ForegroundColor Yellow
foreach ($pattern in $excludePatterns) {
    if (Test-Path $pattern -ErrorAction SilentlyContinue) {
        Write-Host "  ✓ Will exclude: $pattern" -ForegroundColor Gray
    }
}

Write-Host ""
if ($missingFiles.Count -gt 0) {
    Write-Host "❌ MISSING FILES - Deployment may fail:" -ForegroundColor Red
    foreach ($file in $missingFiles) {
        Write-Host "   - $file" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "Current directory: $(Get-Location)" -ForegroundColor Yellow
    Write-Host "Directory contents:" -ForegroundColor Yellow
    Get-ChildItem | Select-Object -First 20 | Format-Table Name, Length, LastWriteTime
    exit 1
} else {
    Write-Host "✓ All critical files present!" -ForegroundColor Green
}

# Verify tarball integrity if it exists
$archive = "$env:TEMP\scoot-deploy.tar.gz"
if (Test-Path $archive) {
    Write-Host ""
    Write-Host "Checking archive contents..." -ForegroundColor Yellow
    
    $archiveContents = @()
    try {
        # List files in archive
        $output = tar -tzf $archive 2>&1
        $criticalFilesInArchive = $output | Where-Object { 
            $_ -match "(pnpm-lock|pnpm-workspace|package\.json|tsconfig|drizzle\.config)" 
        }
        
        if ($criticalFilesInArchive.Count -gt 0) {
            Write-Host "  ✓ Archive contains critical files:" -ForegroundColor Green
            foreach ($file in $criticalFilesInArchive | Select-Object -First 10) {
                Write-Host "     - $file" -ForegroundColor Gray
            }
        } else {
            Write-Host "  ⚠ WARNING: Archive may be missing critical files!" -ForegroundColor Red
            Write-Host "  First 20 files in archive:" -ForegroundColor Gray
            $output | Select-Object -First 20 | ForEach-Object { Write-Host "     - $_" -ForegroundColor Gray }
        }
    } catch {
        Write-Host "  ⚠ Could not verify archive: $($_)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "✓ Verification complete!" -ForegroundColor Green
