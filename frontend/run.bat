REM fix_vite_ngrok.bat
@echo off
echo Fixing Vite configuration for Ngrok...

cd /d %~dp0\frontend

REM Backup current config
if exist vite.config.js (
    copy vite.config.js vite.config.js.backup
    echo ✅ Backed up existing vite.config.js
)

REM Create updated vite.config.js
echo Creating Ngrok-compatible vite.config.js...

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
echo       '.loca.lt',
echo       '.localhost.run',
echo     ],
echo     proxy: ^{
echo       '/api': ^{
echo         target: 'http://localhost:8000',
echo         changeOrigin: true
echo       ^},
echo       '/ws': ^{
echo         target: 'ws://localhost:8000',
echo         ws: true,
echo         changeOrigin: true
echo       ^}
echo     ^}
echo   ^},
echo   preview: ^{
echo     host: '0.0.0.0',
echo     port: 3000,
echo     allowedHosts: [
echo       'localhost',
echo       '.ngrok-free.app',
echo       '.ngrok.io',
echo       '.loca.lt',
echo       '.localhost.run',
echo     ]
echo   ^}
echo ^}^)
) > vite.config.js

echo ✅ Updated vite.config.js for tunnel services
echo.
echo Now restart your frontend server:
echo   1. Stop current frontend (Ctrl+C)
echo   2. Run: npm run dev -- --host 0.0.0.0 --port 3000
echo   3. Your ngrok tunnel should work now!
echo.
pause