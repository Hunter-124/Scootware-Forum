#!/bin/bash

# Scootware Forum - AWS Ubuntu Setup Script
# Run as root: sudo bash setup-aws.sh

set -e

echo "--- Starting Scootware Forum Server Setup ---"

# 1. Update & Base Dependencies
apt-get update
apt-get install -y curl git nginx postgresql postgresql-contrib build-essential

# 2. Install Node.js 20 (LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# 3. Install pnpm & PM2
npm install -g pnpm pm2

# 4. Configure PostgreSQL
echo "Configuring PostgreSQL..."
sudo -u postgres psql -c "CREATE DATABASE scootware;"
sudo -u postgres psql -c "CREATE USER scootadmin WITH PASSWORD '${POSTGRES_PASSWORD}';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE scootware TO scootadmin;"
# For Postgres 15+, we need to grant schema permissions
sudo -u postgres psql -d scootware -c "GRANT ALL ON SCHEMA public TO scootadmin;"

# 5. Nginx Configuration Placeholder
echo "Updating Nginx configuration..."
cat > /etc/nginx/sites-available/scootware <<EOF
server {
    listen 80;
    server_name scootware.us www.scootware.us;

    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_cache_bypass \$http_upgrade;
    }

    location / {
        root /home/admin/Scootware-Forum/artifacts/forum/dist/public;
        try_files \$uri \$uri/ /index.html;
    }

    location /uploads {
        alias /home/admin/Scootware-Forum/artifacts/api-server/uploads;
    }
}
EOF

ln -sf /etc/nginx/sites-available/scootware /etc/nginx/sites-enabled/default

# 6. Create App Directory
mkdir -p /home/admin/Scootware-Forum
chown -R admin:admin /home/admin/Scootware-Forum

# 7. Add Migration & Seeding Instruction
echo "--- Setup Complete ---"
echo "Final Deployment Commands (Run these after uploading code):"
echo "1. cd /home/admin/Scootware-Forum"
echo "2. pnpm install"
echo "3. Update .env (DATABASE_URL=postgres://scootadmin:${POSTGRES_PASSWORD}@localhost:5432/scootware)"
echo "4. Run Migrations: pnpm --filter @workspace/db run push"
echo "5. pnpm run build"
echo "6. pm2 start artifacts/api-server/dist/index.mjs --name 'scootware-api'"
echo "7. sudo systemctl restart nginx"
