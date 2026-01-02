@echo off
echo ========================================
echo Distributed Communication System
echo Testing Server Startup
echo ========================================
echo.

REM Get IP address
echo Finding your IP address...
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    set IP=%%a
    set IP=!IP:~1!
    goto :found
)
:found

echo.
echo Your IP Address: %IP%
echo.
echo ========================================
echo Server starting...
echo ========================================
echo.
echo Access URLs:
echo   - Local:  http://localhost:8080
echo   - Network: http://%IP%:8080
echo.
echo Share this URL with testers: http://%IP%:8080
echo.
echo IMPORTANT: Make sure firewall allows port 8080!
echo (Run as Admin: New-NetFirewallRule -DisplayName "Node.js Server" -Direction Inbound -LocalPort 8080 -Protocol TCP -Action Allow)
echo.
echo Press Ctrl+C to stop the server
echo ========================================
echo.

node server.js

pause

