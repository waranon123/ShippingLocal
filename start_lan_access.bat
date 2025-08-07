REM start_lan_access.bat
@echo off
color 0B
echo ========================================
echo 🌐 TRUCK SYSTEM - LAN NETWORK ACCESS
echo ========================================

REM Get local IP address
echo 🔍 Detecting network configuration...
for /f "tokens=2 delims=:" %%i in ('ipconfig ^| findstr "IPv4"') do (
    for /f "tokens=1" %%j in ("%%i") do set LOCAL_IP=%%j
)

REM Remove leading space
set LOCAL_IP=%LOCAL_IP: =%

echo ✅ Local IP detected: %LOCAL_IP%

REM Check if IP is valid
if "%LOCAL_IP%"=="" (
    echo ❌ Could not detect IP address
    echo Please check your network connection
    pause
    exit /b
)

REM Setup Windows Firewall rule
echo.
echo 🔥 Setting up Windows Firewall...
netsh advfirewall firewall show rule name="Truck Management API" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Adding firewall rule for port 8000...
    netsh advfirewall firewall add rule name="Truck Management API" dir=in action=allow protocol=TCP localport=8000
    echo ✅ Firewall rule added
) else (
    echo ✅ Firewall rule already exists
)

REM Setup backend for network access
echo.
echo 📦 Setting up Backend for LAN access...
cd /d %~dp0\backend

REM Create network-ready .env
(
echo JWT_SECRET_KEY=truck-system-lan-secret-key-2024
echo JWT_ALGORITHM=HS256
echo JWT_EXPIRATION_MINUTES=60
echo DATABASE_URL=sqlite:///./data/truck_management.db
echo LOCAL_IP=%LOCAL_IP%
echo ALLOW_CORS=true
) > .env

if not exist "data" mkdir data

REM Setup frontend for LAN access
echo.
echo 🎨 Setting up Frontend for LAN access...
cd /d %~dp0\frontend

REM Create LAN-ready .env
(
echo VITE_API_BASE_URL=http://%LOCAL_IP%:8000
echo VITE_WS_URL=ws://%LOCAL_IP%:8000/ws
) > .env

echo ✅ Frontend configured for LAN access

REM Update vite.config.js for network access
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
echo     allowedHosts: [
echo       'localhost',
echo       '127.0.0.1', 
echo       '%LOCAL_IP%',
echo       '.ngrok-free.app',
echo       '.ngrok.io',
echo       '.loca.lt'
echo     ]
echo   ^}
echo ^}^)
) > vite.config.js

echo ✅ Vite configured for network access

REM Start services
echo.
echo 🚀 Starting services...

REM Start Backend with network binding
echo Starting Backend...
start "🔧 Backend-LAN" cmd /k "title Backend LAN Server && echo 🔧 Backend Server - LAN Ready && echo 📍 Access: http://%LOCAL_IP%:8000 && cd /d %~dp0\backend && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

timeout /t 8

REM Start Frontend with network binding
echo Starting Frontend...
start "🎨 Frontend-LAN" cmd /k "title Frontend LAN Server && echo 🎨 Frontend Server - LAN Ready && echo 📍 Access: http://%LOCAL_IP%:3000 && cd /d %~dp0\frontend && npm run dev -- --host 0.0.0.0 --port 3000"

echo.
echo ========================================
echo ✅ LAN ACCESS CONFIGURED SUCCESSFULLY!
echo ========================================
echo.
echo 🌐 Network Information:
echo   Server IP: %LOCAL_IP%
echo   Backend API: http://%LOCAL_IP%:8000
echo   Frontend: http://%LOCAL_IP%:3000
echo   API Docs: http://%LOCAL_IP%:8000/docs
echo.
echo 📱 Other devices can access:
echo   1. Connect to same WiFi/Network
echo   2. Open browser and go to: http://%LOCAL_IP%:3000
echo   3. Mobile, tablets, other PCs can use this URL
echo.
echo 🔐 Default Login:
echo   Username: admin
echo   Password: admin123
echo.
echo 🔥 Firewall: Port 8000 is now open
echo 🌐 CORS: All origins allowed
echo 📱 Mobile-friendly: Responsive design
echo.
echo 💡 Share this URL with team: http://%LOCAL_IP%:3000
echo.
pause