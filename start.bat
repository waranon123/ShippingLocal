REM start_ngrok_system.bat
@echo off
echo Starting Truck Management System with Ngrok...

REM Kill existing ngrok processes
taskkill /f /im ngrok.exe 2>nul

REM Start Backend
echo Starting Backend...
cd /d %~dp0\backend
start "Backend" cmd /k "python -m uvicorn app.main:app --host 0.0.0.0 --port 8000"

REM Start Frontend
echo Starting Frontend...
cd /d %~dp0\frontend
start "Frontend" cmd /k "npm run dev -- --host 0.0.0.0 --port 3000"

REM Wait for services to start
echo Waiting for services to start...
timeout /t 15

REM Start ngrok tunnels (ทั้งหมดในคำสั่งเดียว)
echo Starting Ngrok tunnels...
start "Ngrok Tunnels" cmd /k "ngrok start --all"

echo.
echo ========================================
echo 🚀 Truck Management System Starting...
echo ========================================
echo.
echo 📍 Check Ngrok terminal for public URLs
echo 📍 Frontend: https://XXXXXX.ngrok-free.app
echo 📍 Backend: https://YYYYYY.ngrok-free.app
echo.
echo 🔐 Default Login:
echo    Username: admin
echo    Password: admin123
echo.
echo ⚠️  Don't forget to update frontend .env with backend URL!
echo.
pause