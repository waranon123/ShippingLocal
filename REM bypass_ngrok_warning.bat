REM bypass_ngrok_warning.bat
@echo off
echo ========================================
echo 🚨 FIXING NGROK BROWSER WARNING ISSUE
echo ========================================

echo 🔍 Diagnosing the problem...
echo.
echo The issue: Ngrok shows a browser warning page instead of API responses
echo This causes the frontend to receive HTML instead of JSON data
echo.

REM Test current backend accessibility
echo 📡 Testing backend accessibility...
set /p BACKEND_URL="Enter your backend ngrok URL (e.g., https://abc123.ngrok-free.app): "

if "%BACKEND_URL%"=="" (
    echo ❌ No backend URL provided
    pause
    exit /b
)

echo Testing backend URL: %BACKEND_URL%
echo.

REM Test with curl if available
curl --version >nul 2>&1
if %ERRORLEVEL% == 0 (
    echo 🧪 Testing API with curl...
    curl -H "ngrok-skip-browser-warning: true" -H "User-Agent: TruckManagementSystem/1.0" %BACKEND_URL%/health
    echo.
) else (
    echo ⚠️ curl not available, testing with PowerShell...
    powershell -Command "
    try {
        $headers = @{
            'ngrok-skip-browser-warning' = 'true'
            'User-Agent' = 'TruckManagementSystem/1.0'
        }
        $response = Invoke-RestMethod -Uri '%BACKEND_URL%/health' -Headers $headers
        Write-Host '✅ Backend accessible with bypass headers'
        $response | ConvertTo-Json
    } catch {
        Write-Host '❌ Backend not accessible:' $_.Exception.Message
    }
    "
)

echo.
echo 🔧 Applying fixes to frontend...

cd /d %~dp0\frontend

REM Update .env with proper backend URL
echo Creating/updating .env file...
(
echo # Ngrok Backend Configuration
echo VITE_API_BASE_URL=%BACKEND_URL%
echo VITE_WS_URL=%BACKEND_URL:https://=wss://%/ws
echo.
echo # Development settings
echo VITE_DEV_MODE=true
echo VITE_BYPASS_NGROK_WARNING=true
) > .env

echo ✅ Environment file updated

REM Create axios configuration file
echo Creating axios configuration...
if not exist "src\utils" mkdir "src\utils"

(
echo // src/utils/axios-config.js
echo // Axios configuration with ngrok bypass
echo import axios from 'axios'
echo.
echo // Configure axios defaults
echo const setupAxios = ^(^) =^> {
echo   // Get API base URL
echo   const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ^|^| 'http://localhost:8000'
echo   
echo   axios.defaults.baseURL = API_BASE_URL
echo   axios.defaults.timeout = 15000
echo   
echo   // Add ngrok bypass headers to all requests
echo   axios.defaults.headers.common['ngrok-skip-browser-warning'] = 'true'
echo   axios.defaults.headers.common['User-Agent'] = 'TruckManagementSystem/1.0'
echo   axios.defaults.headers.common['Accept'] = 'application/json'
echo   
echo   // Request interceptor
echo   axios.interceptors.request.use^(
echo     ^(config^) =^> {
echo       console.log^('📤 API Request:', config.method?.toUpperCase^(^), config.url^)
echo       // Ensure bypass headers are always present
echo       config.headers['ngrok-skip-browser-warning'] = 'true'
echo       config.headers['User-Agent'] = 'TruckManagementSystem/1.0'
echo       return config
echo     },
echo     ^(error^) =^> {
echo       console.error^('📤 Request Error:', error^)
echo       return Promise.reject^(error^)
echo     }
echo   ^)
echo   
echo   // Response interceptor with HTML detection
echo   axios.interceptors.response.use^(
echo     ^(response^) =^> {
echo       console.log^('📥 API Response:', response.status, response.config.url^)
echo       
echo       // Check if response is HTML ^(ngrok warning page^)
echo       if ^(typeof response.data === 'string' ^&^& response.data.includes^('<!DOCTYPE html>'^)^) {
echo         console.error^('🚨 Ngrok Browser Warning Detected!'^)
echo         throw new Error^('Ngrok browser warning detected. API not accessible.'^)
echo       }
echo       
echo       return response
echo     },
echo     ^(error^) =^> {
echo       console.error^('📥 Response Error:', error.response?.status, error.config?.url, error.message^)
echo       return Promise.reject^(error^)
echo     }
echo   ^)
echo   
echo   console.log^('🔧 Axios configured for ngrok bypass'^)
echo   console.log^('🌐 API Base URL:', API_BASE_URL^)
echo }
echo.
echo export default setupAxios
) > "src\utils\axios-config.js"

echo ✅ Axios configuration created

REM Update main.js to use axios configuration
echo Updating main.js...
if exist "src\main.js" (
    REM Backup original
    copy "src\main.js" "src\main.js.backup" >nul
    
    REM Create new main.js with axios setup
    (
    echo import { createApp } from 'vue'
    echo import { createPinia } from 'pinia'
    echo import App from './App.vue'
    echo import router from './router'
    echo import vuetify from './plugins/vuetify'
    echo import '@mdi/font/css/materialdesignicons.css'
    echo import setupAxios from './utils/axios-config'
    echo.
    echo // Setup axios with ngrok bypass
    echo setupAxios^(^)
    echo.
    echo const app = createApp^(App^)
    echo.
    echo app.use^(createPinia^(^)^)
    echo app.use^(router^)
    echo app.use^(vuetify^)
    echo.
    echo app.mount^('#app'^)
    ) > "src\main.js"
    
    echo ✅ main.js updated with axios configuration
)

echo.
echo 🔧 Testing the fixes...

REM Test if node modules exist
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    call npm install
)

echo.
echo ========================================
echo ✅ NGROK BYPASS FIXES APPLIED!
echo ========================================
echo.
echo 🔧 Applied Fixes:
echo   ✅ Environment variables updated
echo   ✅ Axios bypass headers configured
echo   ✅ HTML response detection added
echo   ✅ Error handling improved
echo   ✅ Debug logging enabled
echo.
echo 📍 Configuration:
echo   Backend: %BACKEND_URL%
echo   WebSocket: %BACKEND_URL:https://=wss://%/ws
echo.
echo 🚀 Next Steps:
echo   1. Stop current frontend server ^(Ctrl+C^)
echo   2. Run: npm run dev
echo   3. Check browser console for connection logs
echo   4. Try logging in
echo.
echo 💡 What was fixed:
echo   - Added ngrok-skip-browser-warning header
echo   - Added proper User-Agent header
echo   - Added HTML response detection
echo   - Improved error messages
echo.
echo 🔍 If still having issues:
echo   1. Check browser console for errors
echo   2. Verify backend ngrok tunnel is running
echo   3. Test backend URL directly in browser
echo   4. Ensure backend allows CORS for your domain
echo.
pause