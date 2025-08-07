REM create_favicon.bat
@echo off
echo Creating favicon for Truck Management System...

cd /d %~dp0\frontend\public

REM Create simple favicon using PowerShell
powershell -Command "
Add-Type -AssemblyName System.Drawing
$bitmap = New-Object System.Drawing.Bitmap(32, 32)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.Clear([System.Drawing.Color]::FromArgb(25, 118, 210))
$font = New-Object System.Drawing.Font('Arial', 16, [System.Drawing.FontStyle]::Bold)
$brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$graphics.DrawString('T', $font, $brush, 8, 6)
$bitmap.Save('favicon.ico', [System.Drawing.Imaging.ImageFormat]::Icon)
$graphics.Dispose()
$bitmap.Dispose()
"

REM Create 16x16 favicon
powershell -Command "
Add-Type -AssemblyName System.Drawing
$bitmap = New-Object System.Drawing.Bitmap(16, 16)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.Clear([System.Drawing.Color]::FromArgb(25, 118, 210))
$font = New-Object System.Drawing.Font('Arial', 10, [System.Drawing.FontStyle]::Bold)
$brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$graphics.DrawString('T', $font, $brush, 3, 1)
$bitmap.Save('favicon-16x16.png', [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bitmap.Dispose()
"

REM Create 32x32 favicon  
powershell -Command "
Add-Type -AssemblyName System.Drawing
$bitmap = New-Object System.Drawing.Bitmap(32, 32)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.Clear([System.Drawing.Color]::FromArgb(25, 118, 210))
$font = New-Object System.Drawing.Font('Arial', 18, [System.Drawing.FontStyle]::Bold)
$brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$graphics.DrawString('T', $font, $brush, 8, 5)
$bitmap.Save('favicon-32x32.png', [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bitmap.Dispose()
"

echo ✅ Favicon files created successfully!
echo Files created:
echo   - favicon.ico
echo   - favicon-16x16.png  
echo   - favicon-32x32.png
pause