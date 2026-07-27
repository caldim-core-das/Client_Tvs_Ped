#!/bin/bash
set -e
echo "============================================="
echo "🚀 TVS-PED SUBDIRECTORY DEPLOYMENT STARTING"
echo "============================================="

# 1. Pull the latest code from GitHub
echo "📌 [1/5] Pulling latest updates from git repository..."
git remote set-url origin https://github.com/caldim-core-das/Client_Tvs_Ped.git 2>/dev/null || true
git fetch origin main
git reset --hard origin/main

# 2. Install any root or module dependencies
echo "📌 [2/5] Installing updated dependencies..."
npm run install-all || { echo "❌ Dependencies installation failed! Exiting..."; exit 1; }

# 3. Clean and build the frontend with subdirectory context
echo "📌 [3/5] Compiling React frontend with '/Tvs/' base path..."
cd frontend
rm -rf dist

VITE_BASE_URL=/Tvs/ VITE_API_BASE_URL=/Tvs VITE_API_URL=/Tvs/api npm run build || { echo "❌ Frontend build failed! Exiting..."; exit 1; }

# 4. Synchronize physical subdirectory structure for Nginx root
echo "📌 [4/5] Syncing compiled assets to physical subdirectory '/Tvs'..."
mkdir -p dist/Tvs
cp -r dist/assets dist/index.html dist/*.png dist/*.jpg dist/*.svg dist/Tvs/ 2>/dev/null || true

cd ..

# 5. Reload backend service in PM2
echo "📌 [5/5] Reloading backend server via PM2..."
PM2_NAME=$(pm2 jlist 2>/dev/null | grep -o '"name":"[^"]*"' | grep -iE 'tvs|backend|api' | head -n 1 | cut -d'"' -f4 || true)

if [ -n "$PM2_NAME" ]; then
    echo "✔ Found active PM2 process: '$PM2_NAME'. Executing reload..."
    pm2 reload "$PM2_NAME" --update-env || pm2 restart "$PM2_NAME" --update-env
else
    echo "✔ Executing default PM2 reloads..."
    pm2 reload tvs-ped-backend --update-env 2>/dev/null || pm2 reload tvs-ped-api --update-env 2>/dev/null || {
        echo "⚠️ Backend not running in PM2. Attempting to start it..."
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
