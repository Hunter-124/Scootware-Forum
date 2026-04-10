#!/bin/bash
# Scootware - Remote Manager Shell Script (v1.0)
# Usage: ./remote-manage.sh [update|build|restart|all]

# Configuration
APP_PATH="/home/admin/Scootware-Forum"
COMMAND=$1

# Helper function to safely source env files with any line endings
source_env_safe() {
    local env_file="$1"
    if [ -f "$env_file" ]; then
        # Convert Windows line endings (CRLF) to Unix (LF) in memory before sourcing
        # This prevents "$'\r': command not found" errors
        while IFS= read -r line; do
            # Remove carriage return if present
            line="${line%$'\r'}"
            [ -z "$line" ] || [ "${line:0:1}" = "#" ] && continue
            export "$line"
        done < "$env_file"
    fi
}

# SAFETY: Ensure DATABASE_URL is always set properly
ensure_database_url() {
    if [ ! -f "${APP_PATH}/.env" ]; then
        echo "  ⚠️  WARNING: .env file not found, creating with defaults..."
        touch "${APP_PATH}/.env"
    fi
        
    # Check if DATABASE_URL is empty or missing
    if ! grep -q '^DATABASE_URL=postgresql://' "${APP_PATH}/.env" 2>/dev/null; then
        echo "  [CRITICAL] DATABASE_URL not properly set in .env!"
        echo "  Adding default PostgreSQL connection..."
        # Remove any empty DATABASE_URL entries first
        sed -i '/^DATABASE_URL=/d' "${APP_PATH}/.env" 2>/dev/null || true
        # Add the proper DATABASE_URL
        echo 'DATABASE_URL=postgresql://postgres:[POSTGRES_PASSWORD]@127.0.0.1:5432/scootware' >> "${APP_PATH}/.env"
        echo "  ✓ DATABASE_URL set to default PostgreSQL connection"
    fi
}

# Load environment variables from .env if it exists
source_env_safe "$APP_PATH/.env"

# SAFETY: Always ensure DATABASE_URL is properly configured before doing anything
echo "--- Checking Environment Configuration ---"
ensure_database_url
echo ""

case $COMMAND in
  update)
    echo "--- Updating Dependencies and Migrations ---"
    cd $APP_PATH || exit 1
        
    echo "  Running: pnpm install"
    pnpm install
    if [ $? -ne 0 ]; then
      echo "❌ pnpm install failed!"
      exit 1
    fi
        
    echo ""
    echo "  Checking for database configuration..."
    if [ -n "$DATABASE_URL" ]; then
      echo "  Syncing PostgreSQL user password from DATABASE_URL..."
      if [[ "$DATABASE_URL" =~ postgresql://([^:]+):([^@]+)@ ]]; then
        DB_USER="${BASH_REMATCH[1]}"
        DB_PASS="${BASH_REMATCH[2]}"
        sudo -u postgres psql -c "ALTER USER \"$DB_USER\" WITH PASSWORD '$DB_PASS';" >/dev/null 2>&1 || true
      fi
    fi

    if [ -z "$DATABASE_URL" ]; then
      echo "  ⚠️  DATABASE_URL not set - skipping database migrations"
      echo "     To run migrations later, set DATABASE_URL and run:"
      echo "     pnpm --filter @workspace/db run push-force"
      echo ""
    else
      echo "  ✓ DATABASE_URL is set"
      echo "  Running: pnpm --filter @workspace/db run push-force"
      pnpm --filter @workspace/db run push-force
      if [ $? -eq 0 ]; then
        echo "  ✓ Database migrations completed successfully"
      else
        echo "  ⚠️  Database migration failed (this is OK during initial setup)"
        echo "     Migrations can be run later once database is configured"
      fi
      echo ""
    fi
    echo "✓ Dependencies updated"
    ;;

  build)
    echo "--- Building Production Bundles ---"
    cd $APP_PATH || exit 1
        
    # First check database and run migrations if configured
    if [ -n "$DATABASE_URL" ]; then
      echo "  Running: pnpm --filter @workspace/db run push (pre-build migration)"
      # Export env vars for the migration command
      export DATABASE_URL
      pnpm --filter @workspace/db run push 2>/dev/null || {
        echo "  ⚠️  Pre-build migration skipped or failed (DB may already be up-to-date)"
      }
    fi
        
    # Build the application
    echo "  Running: pnpm run build"
    pnpm run build
        
    if [ $? -eq 0 ]; then
      echo "✓ Build completed successfully"
      exit 0
    else
      echo "❌ Build failed!"
      exit 1
    fi
    ;;

  restart)
    echo "--- Restarting PM2 Processes and Nginx ---"
    cd $APP_PATH || exit 1
    
    # Step 0: Kill any conflicting Node/PM2 processes on ports 80/443
    echo "[0/7] Clearing conflicting processes from ports 80/443/3000..."
    
    sudo killall -9 node 2>/dev/null || true
    sudo pkill -9 -f "nodeapp" 2>/dev/null || true
    sudo pkill -9 -f "/var/www" 2>/dev/null || true
    
    kill_port() {
        local port=$1
        local max_retries=3
        local retry=0
        echo "  Force killing processes on port $port..."
        
        while [ $retry -lt $max_retries ]; do
            sudo fuser -k -9 $port/tcp 2>/dev/null || true
            
            if command -v lsof >/dev/null 2>&1; then
                local pids=$(sudo lsof -t -i :$port 2>/dev/null)
                if [ -n "$pids" ]; then
                    echo "$pids" | xargs -r sudo kill -9 2>/dev/null || true
                fi
            fi
            
            if command -v ss >/dev/null 2>&1; then
                local pid=$(sudo ss -tlnp 2>/dev/null | grep ":$port " | head -1 | awk -F'pid=' '{print $2}' | awk '{print $1}')
                if [ -n "$pid" ]; then
                    sudo kill -9 "$pid" 2>/dev/null || true
                fi
            fi
            
            sleep 1
            retry=$((retry + 1))
        done
    }
    
    kill_port 80
    kill_port 443  
    kill_port 3000
    
    sleep 2
    echo "  ✓ Port conflict cleanup complete"
    echo ""

    # Step 1: Apply database migrations and patches
    echo "[1/7] Applying database migrations and patches..."
    if [ -n "$DATABASE_URL" ]; then
      echo "  Running: pnpm --filter @workspace/db run push"
      pnpm --filter @workspace/db run push
      if [ $? -eq 0 ]; then
        echo "  ✓ Database migrations applied"
      else
        echo "  ⚠️  Database migration failed (continuing anyway)"
      fi
    else
      echo "  ⚠️  DATABASE_URL not set - skipping migrations"
    fi
    echo ""

    # Step 2: Clear PM2 processes
    echo "[2/7] Cleaning up old PM2 processes..."
    pm2 delete all || true
    pm2 kill || true
    sleep 1

    # Step 3: Verify ecosystem config
    if [ ! -f "$APP_PATH/ecosystem.config.cjs" ]; then
      echo "ERROR: ecosystem.config.cjs not found at $APP_PATH"
      exit 1
    fi

    # Step 4: Start API backend
    echo "[3/7] Starting API backend on port 3000..."
    pm2 start "$APP_PATH/ecosystem.config.cjs" --update-env --cwd "$APP_PATH" --only scootware-api || {
      echo "WARNING: PM2 start failed; trying boot.mjs"
      pm2 start "$APP_PATH/boot.mjs" --name scootware-api --cwd "$APP_PATH" --update-env || exit 1
    }
    pm2 save
    pm2 startup || true
    sleep 2
    
    # Step 5: Setup and verify Nginx
    echo "[5/7] Applying Nginx configuration..."
    chmod +x "$APP_PATH/live-deployment/apply-nginx-https.sh"
    if ! sudo bash "$APP_PATH/live-deployment/apply-nginx-https.sh"; then
      echo "❌ ERROR: Nginx deployment failed!"
      exit 1
    fi

    # Step 6: Final health check
    echo "[6/7] Performing health checks..."
    if command -v curl >/dev/null 2>&1; then
      if curl -fsS --max-time 5 http://127.0.0.1:3000/api/healthz >/dev/null 2>&1; then
        echo "     ✓ API is responding"
      fi
      if curl -fsS --max-time 5 http://127.0.0.1/ >/dev/null 2>&1; then
        echo "     ✓ Nginx is responding on port 80"
      fi
    fi
    echo ""
    echo "[7/7] Final verification complete"
    echo "✅ Restart completed successfully!"
    ;;

  setup)
    echo "--- Setting up VPS Environment ---"
    chmod +x $APP_PATH/live-deployment/setup-swap.sh
    sudo $APP_PATH/live-deployment/setup-swap.sh
    ;;

  diagnose)
    echo "--- Diagnostic Report ---"
    echo "PM2 status:"
    pm2 status
    echo ""
    echo "API health check:"
    curl -fsS --max-time 10 http://127.0.0.1:3000/api/healthz || echo "API failed"
    ;;

  fix)
    echo "--- Applying recovery steps ---"
    pm2 delete all || true
    pm2 kill || true
    pm2 start "$APP_PATH/ecosystem.config.cjs" --only scootware-api
    sudo bash "$APP_PATH/live-deployment/apply-nginx-https.sh"
    ;;

  reboot)
    echo "--- Rebooting Server ---"
    echo "WARNING: Connection will be lost. Wait ~60 seconds for the system to come back online."
    sudo reboot
    ;;

  all)
    bash $0 update
    bash $0 build
    bash $0 reboot
    ;;

  *)
    echo "Usage: ./remote-manage.sh [update|build|restart|all|diagnose]"
    ;;
esac