# Quick script to get your IP address for testing

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Finding your IP address for testing..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ipAddress = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.InterfaceAlias -notlike "*Loopback*" -and $_.IPAddress -notlike "169.254.*"} | Select-Object -First 1).IPAddress

if ($ipAddress) {
    Write-Host "Your IP Address: $ipAddress" -ForegroundColor Green
    Write-Host ""
    Write-Host "Share this URL with testers:" -ForegroundColor Yellow
    Write-Host "http://$ipAddress:8080" -ForegroundColor White -BackgroundColor DarkBlue
    Write-Host ""
    Write-Host "Make sure they're on the same network!" -ForegroundColor Yellow
} else {
    Write-Host "Could not find IP address. Try: ipconfig | findstr IPv4" -ForegroundColor Red
}

Write-Host ""
Write-Host "To start server, run: npm start" -ForegroundColor Cyan

