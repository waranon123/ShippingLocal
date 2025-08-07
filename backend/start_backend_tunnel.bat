REM start_backend_tunnel.bat
@echo off
echo ========================================
echo 🚀 Starting Backend for Tunnel Services
echo ========================================

cd /d %~dp0\backend

echo Setting up environment...
REM Create .env if not exists
if not exist ".env" (
    echo Creating .env file...
    (
        echo JWT_SECRET_KEY=your-super-secret-jwt-key-production-tunnel-2024
        echo JWT_ALGORITHM=HS256
        echo JWT_EXPIRATION_MINUTES=60
        echo DATABASE_URL=sqlite:///./data/truck_management.db
    ) > .env
    echo ✅ Created .env file
)

REM Create data directory
if not exist "data" mkdir data
echo ✅ Data directory ready

echo Starting FastAPI server...
echo 📍 Backend will be available at: http://0.0.0.0:8000
echo 📍 API Documentation: http://0.0.0.0:8000/docs
echo 📍 Health Check: http://0.0.0.0:8000/health
echo.
echo 🔐 Default Login:
echo   Username: admin
echo   Password: admin123
echo.
echo 🌐 CORS enabled for:
echo   - localhost, 127.0.0.1
echo   - *.ngrok-free.app, *.ngrok.io
echo   - *.loca.lt, *.localhost.run
echo.
echo ⚠️  Keep this terminal open for backend to run
echo.

REM Start with proper host binding for external access
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

pause