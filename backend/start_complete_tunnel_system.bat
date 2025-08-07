REM start_complete_tunnel_system.bat
@echo off
color 0A
echo ========================================
echo 🚛 TRUCK MANAGEMENT SYSTEM - ONLINE
echo ========================================
echo.

REM Clean up existing processes
echo 🧹 Cleaning up existing processes...
taskkill /f /im node.exe 2>nul
taskkill /f /im python.exe 2>nul
taskkill /f /im ngrok.exe 2>nul
timeout /t 2

REM Check requirements
echo 🔍 Checking requirements...
where python >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Python not found! Please install Python first.
    pause
    exit /b
)

where node >nul 2>&1  
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js not found! Please install Node.js first.
    pause
    exit /b
)

where ngrok >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Ngrok not found! Please install ngrok first.
    echo Download from: https://ngrok.com/download
    pause
    exit /b
)

echo ✅ All requirements found

REM Setup backend
echo.
echo 📦 Setting up Backend...
cd /d %~dp0\backend

REM Create .env for tunnel setup
(
echo JWT_SECRET_KEY=truck-system-secret-key-tunnel-2024-super-secure
echo JWT_ALGORITHM=HS256  
echo JWT_EXPIRATION_MINUTES=60
echo DATABASE_URL=sqlite:///./data/truck_management.db
) > .env

REM Create data directory
if not exist "data" mkdir data

echo ✅ Backend configured

REM Setup frontend  
echo.
echo 🎨 Setting up Frontend...
cd /d %~dp0\frontend

REM Create tunnel-compatible vite.config.js
(
echo import { defineConfig } from 'vite'
echo import vue from '@vitejs/plugin-vue'
echo import path from 'path'
echo.
echo export default defineConfig^(^{
echo   plugins: [vue^(^)],
echo   resolve: ^{
echo     alias: ^{ '@': path.resolve^(__dirname, 'src'^) ^}
echo   ^},
echo   server: ^{
echo     port: 3000,
echo     host: '0.0.0.0',
echo     allowedHosts: ['localhost', '.ngrok-free.app', '.ngrok.io', '.loca.lt']
echo   ^}
echo ^}^)
) > vite.config.js

echo ✅ Frontend configured

REM Get ngrok authtoken if not configured
echo.
echo 🔐 Checking ngrok authentication...
ngrok config check >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ⚠️  Ngrok not authenticated!
    echo Please visit: https://dashboard.ngrok.com/get-started/your-authtoken
    set /p AUTHTOKEN="Enter your authtoken: "
    ngrok config add-authtoken %AUTHTOKEN%
    echo ✅ Ngrok authenticated
)

REM Start services
echo.
echo 🚀 Starting services...

REM Start Backend
echo Starting Backend...
cd /d %~dp0\backend
start "🔧 Backend" cmd /k "title Backend Server && echo 🔧 Backend Server Running && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
timeout /t 8

REM Start Frontend  
echo Starting Frontend...
cd /d %~dp0\frontend
start "🎨 Frontend" cmd /k "title Frontend Server && echo 🎨 Frontend Server Running && npm run dev -- --host 0.0.0.0 --port 3000"
timeout /t 15

REM Start tunnels
echo Starting Ngrok tunnels...
start "🌐 Frontend Tunnel" cmd /k "title Frontend Tunnel && echo 🌐 Frontend Tunnel && ngrok http 3000"
timeout /t 3
start "🔗 Backend Tunnel" cmd /k "title Backend Tunnel && echo 🔗 Backend Tunnel && ngrok http 8000"

echo.
echo ========================================
echo ✅ SYSTEM STARTED SUCCESSFULLY!
echo ========================================
echo.
echo 📋 Check the tunnel windows for your URLs:
echo   🌐 Frontend: https://XXXXXX.ngrok-free.app  
echo   🔗 Backend:  REM start_complete_tunnel_system.bat
@echo off
color 0A
echo ========================================
echo 🚛 TRUCK MANAGEMENT SYSTEM - ONLINE
echo ========================================
echo.

REM Clean up existing processes
echo 🧹 Cleaning up existing processes...
taskkill /f /im node.exe 2>nul
taskkill /f /im python.exe 2>nul
taskkill /f /im ngrok.exe 2>nul
timeout /t 2

REM Check requirements
echo 🔍 Checking requirements...
where python >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Python not found! Please install Python first.
    pause
    exit /b
)

where node >nul 2>&1  
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js not found! Please install Node.js first.
    pause
    exit /b
)

where ngrok >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Ngrok not found! Please install ngrok first.
    echo Download from: https://ngrok.com/download
    pause
    exit /b
)

echo ✅ All requirements found

REM Setup backend
echo.
echo 📦 Setting up Backend...
cd /d %~dp0\backend

REM Create .env for tunnel setup
(
echo JWT_SECRET_KEY=truck-system-secret-key-tunnel-2024-super-secure
echo JWT_ALGORITHM=HS256  
echo JWT_EXPIRATION_MINUTES=60
echo DATABASE_URL=sqlite:///./data/truck_management.db
) > .env

REM Create data directory
if not exist "data" mkdir data

echo ✅ Backend configured

REM Setup frontend  
echo.
echo 🎨 Setting up Frontend...
cd /d %~dp0\frontend

REM Create tunnel-compatible vite.config.js
(
echo import { defineConfig } from 'vite'
echo import vue from '@vitejs/plugin-vue'
echo import path from 'path'
echo.
echo export default defineConfig^(^{
echo   plugins: [vue^(^)],
echo   resolve: ^{
echo     alias: ^{ '@': path.resolve^(__dirname, 'src'^) ^}
echo   ^},
echo   server: ^{
echo     port: 3000,
echo     host: '0.0.0.0',
echo     allowedHosts: ['localhost', '.ngrok-free.app', '.ngrok.io', '.loca.lt']
echo   ^}
echo ^}^)
) > vite.config.js

echo ✅ Frontend configured

REM Get ngrok authtoken if not configured
echo.
echo 🔐 Checking ngrok authentication...
ngrok config check >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ⚠️  Ngrok not authenticated!
    echo Please visit: https://dashboard.ngrok.com/get-started/your-authtoken
    set /p AUTHTOKEN="Enter your authtoken: "
    ngrok config add-authtoken %AUTHTOKEN%
    echo ✅ Ngrok authenticated
)

REM Start services
echo.
echo 🚀 Starting services...

REM Start Backend
echo Starting Backend...
cd /d %~dp0\backend
start "🔧 Backend" cmd /k "title Backend Server && echo 🔧 Backend Server Running && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
timeout /t 8

REM Start Frontend  
echo Starting Frontend...
cd /d %~dp0\frontend
start "🎨 Frontend" cmd /k "title Frontend Server && echo 🎨 Frontend Server Running && npm run dev -- --host 0.0.0.0 --port 3000"
timeout /t 15

REM Start tunnels
echo Starting Ngrok tunnels...
start "🌐 Frontend Tunnel" cmd /k "title Frontend Tunnel && echo 🌐 Frontend Tunnel && ngrok http 3000"
timeout /t 3
start "🔗 Backend Tunnel" cmd /k "title Backend Tunnel && echo 🔗 Backend Tunnel && ngrok http 8000"

echo.
echo ========================================
echo ✅ SYSTEM STARTED SUCCESSFULLY!
echo ========================================
echo.
echo 📋 Check the tunnel windows for your URLs:
echo   🌐 Frontend: https://XXXXXX.ngrok-free.app  
echo   🔗 Backend:  https://YYYYYY.ngrok-free.app
echo.
echo 🔧 NEXT STEPS:
echo 1. Copy the Backend URL from "Backend Tunnel" window
echo 2. Update frontend/.env with:
echo    VITE_API_BASE_URL=https://YYYYYY.ngrok-free.app
echo    VITE_WS_URL=wss://YYYYYY.ngrok-free.app/ws
echo 3. Restart Frontend (Ctrl+C then npm run dev)
echo 4. Share Frontend URL with others!
echo.
echo 🔐 Default Login:
echo   Username: admin
echo   Password: admin123  
echo.
echo 💡 Keep all windows open for system to work
echo.
pause
echo.
echo 🔧 NEXT STEPS:
echo 1. Copy the Backend URL from "Backend Tunnel" window
echo 2. Update frontend/.env with:
echo    VITE_API_BASE_URL=https://YYYYYY.ngrok-free.app
echo    VITE_WS_URL=wss://YYYYYY.ngrok-free.app/ws
echo 3. Restart Frontend (Ctrl+C then npm run dev)
echo 4. Share Frontend URL with others!
echo.
echo 🔐 Default Login:
echo   Username: admin
echo   Password: admin123  
echo.
echo 💡 Keep all windows open for system to work
echo.
pause