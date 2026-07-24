#!/bin/bash
set -e
echo "============================================="
echo "🚀 TVS-PED ZERO-DOWNTIME DEPLOYMENT STARTING"
echo "============================================="

# 1. Fetch and pull latest code from target repository
echo "📌 [1/5] Syncing latest code from GitHub repository..."
git remote set-url origin https://github.com/caldim-core-das/Client_Tvs_Ped.git 2>/dev/null || true
git fetch origin main
git reset --hard origin/main

# 2. Install dependencies for backend and frontend
echo "📌 [2/5] Installing updated dependencies..."
npm run install-all || { echo "❌ Dependencies installation failed! Exiting..."; exit 1; }

# 3. Non-disruptive Atomic Frontend Build
echo "📌 [3/5] Compiling React frontend with '/Tvs/' base path..."
cd frontend
rm -rf dist_tmp
VITE_BASE_URL=/Tvs/ VITE_API_BASE_URL=/Tvs npm run build -- --outDir dist_tmp || { echo "❌ Frontend build failed! Exiting..."; exit 1; }

# Synchronize physical subdirectory structure in staging build
echo "📌 [4/5] Syncing compiled assets to physical subdirectory '/Tvs'..."
mkdir -p dist_tmp/Tvs
cp -r dist_tmp/assets dist_tmp/trolleys dist_tmp/favicon.jpg dist_tmp/index.html dist_tmp/tvs_logo_clean.png dist_tmp/tvs_logo_white.png dist_tmp/tvslogo.jpg dist_tmp/vite.svg dist_tmp/Tvs/ 2>/dev/null || true

# Atomic swap into active dist directory so live clients encounter zero 404s
mkdir -p dist
rsync -a --delete dist_tmp/ dist/ 2>/dev/null || (rm -rf dist && cp -r dist_tmp dist)
rm -rf dist_tmp
cd ..

# 4. PM2 Process Auto-Detection & Zero-Downtime Reload
echo "📌 [5/5] Detecting and reloading PM2 backend process..."

# Attempt to find PM2 process by path or standard names
PM2_NAME=$(pm2 jlist 2>/dev/null | grep -o '"name":"[^"]*"' | grep -iE 'tvs|backend|api' | head -n 1 | cut -d'"' -f4 || true)

if [ -n "$PM2_NAME" ]; then
    echo "✔ Found active PM2 process: '$PM2_NAME'. Executing zero-downtime reload..."
    pm2 reload "$PM2_NAME" --update-env || pm2 restart "$PM2_NAME" --update-env
else
    echo "✔ Attempting default PM2 reloads..."
    pm2 reload tvs-ped-backend --update-env 2>/dev/null || pm2 reload tvs-ped-api --update-env 2>/dev/null || {
        echo "⚠️ PM2 process not running. Starting backend server under 'tvs-ped-backend'..."
        cd backend
        pm2 start server.js --name "tvs-ped-backend"
        pm2 save
        cd ..
    }
fi

echo "============================================="
echo "✅ TVS-PED PRODUCTION DEPLOYMENT COMPLETE!"
echo "👉 Portal live at: https://caldimproducts.com/Tvs"
echo "============================================="
