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

# Load environment variables from .env if it exists
source_env_safe "$APP_PATH/.env"

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
    pnpm run build
    ;;
  restart)
    echo "--- Restarting PM2 Processes ---"
    cd $APP_PATH || exit 1

    # Remove stale/old processes and ensure ctl is clean.
    pm2 delete all || true
    pm2 kill || true

    # Verify ecosystem config exists
    if [ ! -f "$APP_PATH/ecosystem.config.cjs" ]; then
      echo "ERROR: ecosystem.config.cjs not found at $APP_PATH"
      exit 1
    fi

    # Start API from the correct directory using explicit absolute path.
    pm2 start "/home/admin/Scootware-Forum/ecosystem.config.cjs" --update-env --cwd "$APP_PATH" --only scootware-api || {
      echo "WARNING: PM2 start via ecosystem config failed; attempting direct boot.mjs start"
      pm2 start "/home/admin/Scootware-Forum/boot.mjs" --name scootware-api --cwd "$APP_PATH" --update-env || exit 1
    }

    # Ensure API process is kept
    pm2 save
    pm2 startup || true

    echo "✓ PM2 processes restarted successfully"
    echo "✓ API is now serving static files and API routes on port 3000"
    echo ""
    echo "✓ Restart completed successfully!"
    ;;

  setup)
    echo "--- Setting up VPS Environment (Swap, etc.) ---"
    chmod +x $APP_PATH/live-deployment/setup-swap.sh
    sudo $APP_PATH/live-deployment/setup-swap.sh
    ;;
  diagnose)
    echo "--- Diagnostic Report ---"
    echo "Current directory: $(pwd)"
    echo "Forum dist path: $APP_PATH/artifacts/forum/dist/public"
    echo ""
    echo "Forum dist contents:"
    if [ -d "$APP_PATH/artifacts/forum/dist/public" ]; then
      ls -lah "$APP_PATH/artifacts/forum/dist/public" | head -20
      echo "Total files: $(find $APP_PATH/artifacts/forum/dist/public -type f | wc -l)"
    else
      echo "❌ Directory does not exist!"
    fi
    echo ""
    echo "Boot file: $APP_PATH/boot.mjs"
    if [ -f "$APP_PATH/boot.mjs" ]; then
      ls -lh "$APP_PATH/boot.mjs"
    else
      echo "❌ File does not exist!"
    fi
    echo ""
    echo "PM2 status:"
    pm2 status
    echo ""
    echo "PM2 logs (last 50 lines):"
    pm2 logs scootware-api --lines 50 --nostream 2>/dev/null || echo "No logs available"

    echo "API health check (/api/healthz)"
    if command -v curl >/dev/null 2>&1; then
      curl -fsS --max-time 10 http://127.0.0.1:3000/api/healthz || {
        echo "API health endpoint failed ( /api/healthz not reachable )"
        echo "Trying root path http://127.0.0.1:3000/ ..."
        curl -fsS --max-time 10 http://127.0.0.1:3000/ || echo "Root service check failed"
      }
    else
      echo "curl not available for local API health check"
    fi

    echo "Checking local port 3000 listener"
    if command -v ss >/dev/null 2>&1; then
      ss -ltnp | grep ':3000' || echo 'No process listening on port 3000'
    elif command -v netstat >/dev/null 2>&1; then
      netstat -ltnp 2>/dev/null | grep ':3000' || echo 'No process listening on port 3000'
    else
      echo 'Neither ss nor netstat available to check port 3000'
    fi
    ;;
  fix)
    echo "--- Applying common 521 recovery steps ---"
    cd $APP_PATH || exit 1

    echo "1) Rebuild and restart app via PM2"
    pm2 delete all || true
    pm2 kill || true
    pm2 start "$APP_PATH/ecosystem.config.cjs" --update-env --cwd "$APP_PATH" --only scootware-api || {
      echo "WARNING: PM2 ecosystem start failed; trying direct boot.mjs"
      pm2 start "$APP_PATH/boot.mjs" --name scootware-api --cwd "$APP_PATH" --update-env || {
        echo "ERROR: PM2 start failed"; exit 1
      }
    }
    pm2 save
    pm2 startup || true

    echo "2) Reload and fix nginx configuration"
    if command -v nginx >/dev/null 2>&1; then
      sudo bash "$APP_PATH/live-deployment/apply-nginx-https.sh"
    else
      echo "nginx not installed on this node or command not found"
    fi

    echo "3) Re-check API health (local)"
    if command -v curl >/dev/null 2>&1; then
      curl -fsS --max-time 10 http://127.0.0.1:3000/api/healthz && echo "API reachable"
      echo "3.1) Check Nginx HTTP"
      curl -fsS --max-time 10 http://127.0.0.1/ && echo "Nginx HTTP reachable"
      echo "3.2) Check Nginx HTTPS (if configured)"
      curl -kfsS --max-time 10 https://127.0.0.1/ && echo "Nginx HTTPS reachable (self-signed OK)" || echo "Nginx HTTPS not reachable yet"
    else
      echo "curl not available"
    fi

    echo "521 recovery attempt complete. Check Cloudflare origin status after a few seconds."
    ;;
  all)
    bash $0 update
    bash $0 build
    bash $0 restart
    ;;
  *)
    echo "Usage: ./remote-manage.sh [update|build|restart|all|diagnose]"
    ;;
esac
