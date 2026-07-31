@echo off
setlocal enabledelayedexpansion
echo.
echo ########################################################
echo #             Scootware Forum Local Preview            #
echo ########################################################
echo.

:: Save the project root directory
set PROJECT_ROOT=%cd%

:: Free up ports 3000 and 3001
echo [1/4] Checking ports 3000 and 3001...
powershell -Command "(Get-NetTCPConnection -LocalPort 3000,3001 -ErrorAction SilentlyContinue) | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

:: Build API Server
echo [2/4] Building API Server...
pushd artifacts\api-server
call pnpm run build
if errorlevel 1 (
  echo Error: Failed to build API Server
  popd
  exit /b 1
)
popd

:: Start API Server via boot loader (guaranteed .env loading for offline/local)
echo [2/4] Starting API Server on http://localhost:3001...
start "Scootware-API" /min cmd /k "cd /d %PROJECT_ROOT% && node boot.mjs"

:: Start Forum
echo [3/4] Starting Forum Frontend on http://localhost:3000...
start "Scootware-Forum" /min cmd /k "cd /d %PROJECT_ROOT%\artifacts\forum && pnpm run dev"

:: Wait a moment for servers to initialize
echo [4/4] Opening browser...
timeout /t 5 /nobreak >nul
start http://localhost:3000/

echo.
echo ========================================================
echo SYSTEM ONLINE: Scootware Forum is now running!
echo.
echo - Forum:  http://localhost:3000/
echo - API:    http://localhost:3001/
echo ========================================================
echo.
echo [!] KEEP THIS WINDOW OPEN while previewing.
echo [!] Press any key to [STOP] the servers and exit.
pause >nul

echo.
echo Terminating processes...
powershell -Command "(Get-NetTCPConnection -LocalPort 3000,3001 -ErrorAction SilentlyContinue) | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
echo.
echo Preview stopped. Transmission terminated.
timeout /t 2 /nobreak >nul
exit
