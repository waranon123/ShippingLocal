REM complete_ngrok_setup.bat
@echo off
echo ========================================
echo 🔧 Complete Ngrok Setup for Truck System
echo ========================================

REM Kill existing processes
echo Stopping existing processes...
taskkill /f /im node.exe 2>nul
taskkill /f /im python.exe 2>nul  
taskkill /f /im ngrok.exe 2>nul

REM Update Vite config
echo Updating Vite configuration...
cd /d %~dp0\frontend

REM Create ngrok-compatible vite.config.js
(
echo import { defineConfig } from 'vite'
echo import vue from '@vitejs/plugin-vue'
echo import path from 'path'
echo.
echo export default defineConfig^(^{
echo   plugins: [vue^(^)],
echo   resolve: ^{
echo     alias: ^{
echo       '@': path.resolve^(__dirname, 'src'^)
echo     ^}
echo   ^},
echo   server: ^{
echo     port: 3000,
echo     host: '0.0.0.0',
echo     allowedHosts: [
echo       'localhost',
echo       '.ngrok-free.app',
echo       '.ngrok.io', 
echo       '.loca.lt'
echo     ]
echo   ^}
echo ^}^)
) > vite.config.js

echo ✅ Vite config updated for tunnel services

REM Create ngrok config if not exists
echo Creating ngrok configuration...
set NGROK_CONFIG_DIR=%USERPROFILE%\.ngrok2
if not exist "%NGROK_CONFIG_DIR%" mkdir "%NGROK_CONFIG_DIR%"

REM Get authtoken (user needs to fill this)
echo.
echo ⚠️  Please get your authtoken from: https://dashboard.ngrok.com/get-started/your-authtoken
set /p AUTHTOKEN="Enter your ngrok authtoken: "

(
echo version: "2"
echo authtoken: %AUTHTOKEN%
echo.
echo tunnels:
echo   frontend:
echo     addr: 3000
echo     proto: http
echo     bind_tls: true
echo   backend:
echo     addr: 8000
echo     proto: http
echo     bind_tls: true
) > "%NGROK_CONFIG_DIR%\ngrok.yml"

echo ✅ Ngrok config created

REM Start Backend
echo Starting Backend...
cd /d %~dp0\backend
start "Backend" cmd /k "python -m uvicorn app.main:app --host 0.0.0.0 --port 8000"

timeout /t 5

REM Start Frontend with proper config
echo Starting Frontend...
cd /d %~dp0\frontend
start "Frontend" cmd /k "npm run dev -- --host 0.0.0.0 --port 3000"

timeout /t 10

REM Start ngrok tunnels
echo Starting Ngrok tunnels...
start "Ngrok" cmd /k "ngrok start --all"

echo.
echo ========================================
echo 🚀 System Started Successfully!
echo ========================================
echo.
echo 📍 Check the "Ngrok" window for your URLs:
echo   - Frontend:  https://80d05594b31c.ngrok-free.app
echo   - Backend:  https://YYYYYY.ngrok-free.app
echo.
echo 🔧 After getting URLs, update frontend/.env:
echo   VITE_API_BASE_URL=https://YYYYYY.ngrok-free.app
echo   VITE_WS_URL=wss://YYYYYY.ngrok-free.app/ws
echo.
echo 🔄 Then restart frontend for changes to take effect
echo.
echo 🔐 Default Login:
echo   Username: admin
echo   Password: admin123
echo.
pause