@echo off
echo PHX Monetary System Launcher
echo ============================
echo.
echo 1 - Launch Central Bank Console [legacy]
echo 2 - Launch Central Bank Console [enhanced]
echo 3 - Launch Client Wallet [enhanced]
echo 4 - Launch Client Wallet [legacy]
echo.
set /p choice="Select option (1-4): "

if "%choice%"=="1" (
    echo Starting PHX Central Bank Console [legacy]...
    npx hardhat run phx-central-bank.js --network ganache
) else if "%choice%"=="2" (
    echo Starting PHX Central Bank Console [enhanced]...
    npx hardhat run phx-central-bank-enhanced.js --network ganache
) else if "%choice%"=="3" (
    echo Starting PHX Client Wallet [enhanced]...
    npx hardhat run phx-client-wallet-enhanced.js --network ganache
) else if "%choice%"=="4" (
    echo Starting PHX Client Wallet [legacy]...
    npx hardhat run phx-client-wallet.js --network ganache
) else (
    echo Invalid choice!
)

pause
