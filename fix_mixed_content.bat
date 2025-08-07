REM fix_mixed_content.bat
@echo off
echo ========================================
echo 🔧 Fixing Mixed Content และ Environment Issues
echo ========================================

cd /d %~dp0\frontend

REM Create favicon first
echo Creating favicon...
if not exist "public" mkdir public
cd public

REM Create simple favicon using echo (fallback method)
echo Creating favicon files...

REM Create simple HTML favicon (will be converted by browser)
(
echo ^<!DOCTYPE html^>
echo ^<html^>^<head^>
echo ^<style^>
echo body{margin:0;background:#1976D2;color:white;font:bold 20px Arial;display:flex;align-items:center;justify-content:center;width:32px;height:32px;}
echo ^</style^>
echo ^</head^>
echo ^<body^>T^</body^>^</html^>
) > temp.html

REM Use PowerShell to create proper favicon
powershell -Command "
try {
    Add-Type -AssemblyName System.Drawing
    $bitmap = New-Object System.Drawing.Bitmap(32, 32)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.Clear([System.Drawing.Color]::FromArgb(25, 118, 210))
    $font = New-Object System.Drawing.Font('Arial', 16, [System.Drawing.FontStyle]::Bold)
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $graphics.DrawString('T', $font, $brush, 8, 6)
    $bitmap.Save('favicon.ico', [System.Drawing.Imaging.ImageFormat]::Icon)
    Write-Host '✅ Favicon created successfully'
} catch {
    Write-Host '⚠️ Could not create favicon with PowerShell'
}
"

REM Create fallback favicon.ico as text (browsers will handle it)
if not exist "favicon.ico" (
    echo Creating fallback favicon...
    copy /b temp.html favicon.ico >nul 2>&1
)

if exist "temp.html" del temp.html

cd ..

echo ✅ Favicon setup complete

REM Fix environment variables
echo.
echo 🔧 Fixing environment variables...

REM Check current .env content
if exist ".env" (
    echo Current .env content:
    type .env
    echo.
)

REM Get backend URLs from user or detect them
echo Please provide your backend URLs:
echo.
echo Example URLs:
echo   Ngrok: https://abc123.ngrok-free.app
echo   LocalTunnel: https://truck-backend-name.loca.lt
echo   Local IP: http://192.168.1.100:8000
echo.

set /p BACKEND_URL="Enter your Backend URL (without /api): "

REM Validate URL
if "%BACKEND_URL%"=="" (
    echo ❌ No URL provided, using default localhost
    set BACKEND_URL=http://localhost:8000
)

REM Convert HTTP to HTTPS for tunnel services if needed
set WEBSOCKET_URL=%BACKEND_URL%
if "%BACKEND_URL:~0,7%"=="http://" (
    if not "%BACKEND_URL:ngrok=%"=="%BACKEND_URL%" (
        set BACKEND_URL=%BACKEND_URL:http://=https://%
        set WEBSOCKET_URL=%BACKEND_URL:https://=wss://%
    )
    if not "%BACKEND_URL:loca.lt=%"=="%BACKEND_URL%" (
        set BACKEND_URL=%BACKEND_URL:http://=https://%
        set WEBSOCKET_URL=%BACKEND_URL:https://=wss://%
    )
)

REM Handle HTTPS -> WSS conversion for WebSocket
if "%BACKEND_URL:~0,8%"=="https://" (
    set WEBSOCKET_URL=%BACKEND_URL:https://=wss://%
) else (
    set WEBSOCKET_URL=%BACKEND_URL:http://=ws://%
)

REM Create proper .env file
echo Creating .env file...
(
echo VITE_API_BASE_URL=%BACKEND_URL%
echo VITE_WS_URL=%WEBSOCKET_URL%/ws
) > .env

echo ✅ Environment file created:
type .env
echo.

REM Update vite.config.js for HTTPS compatibility
echo 🔧 Updating vite.config.js for HTTPS compatibility...

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
echo     https: false,
echo     allowedHosts: [
echo       'localhost',
echo       '127.0.0.1',
echo       '.ngrok-free.app',
echo       '.ngrok.io',
echo       '.loca.lt',
echo       '.localhost.run'
echo     ]
echo   ^},
echo   build: ^{
echo     rollupOptions: ^{
echo       output: ^{
echo         manualChunks: undefined
echo       ^}
echo     ^}
echo   ^}
echo ^}^)
) > vite.config.js

echo ✅ Vite config updated

echo.
echo ========================================
echo ✅ ALL FIXES APPLIED!
echo ========================================
echo.
echo 🔧 Fixed Issues:
echo   ✅ Favicon created (no more 404 errors)
echo   ✅ Environment variables configured
echo   ✅ Mixed content handling (HTTP/HTTPS)
echo   ✅ WebSocket URL conversion (WS/WSS)
echo   ✅ Vite config optimized
echo.
echo 📍 Configuration:
echo   Backend: %BACKEND_URL%
echo   WebSocket: %WEBSOCKET_URL%/ws
echo.
echo 🚀 Next Steps:
echo   1. Stop frontend server (Ctrl+C)
echo   2. Run: npm run dev
echo   3. Test login functionality
echo.
echo 💡 Tips:
echo   - HTTPS frontend will use HTTPS backend
echo   - HTTP frontend will use HTTP backend  
echo   - WebSocket auto-converts to WSS for HTTPS
echo.
pause