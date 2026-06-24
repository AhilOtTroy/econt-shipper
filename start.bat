@echo off
rem Double-click this to start the Econt shipper, then it opens in your browser.
cd /d "%~dp0"
start "" http://localhost:5005
node server.js
echo.
echo (Server stopped. You can close this window.)
pause
