# PHX - Phonex Coin System

A comprehensive blockchain-based monetary system featuring a central bank console, client wallet, and trading terminal for the PHX stablecoin.

## Prerequisites

### System Requirements

- Node.js (v18 or higher)
- Python (v3.8 or higher)
- Git
- MetaMask browser extension
- Ganache GUI (for local blockchain)

### Recommended Hardware

- 4GB RAM minimum, 8GB recommended
- 2GB free disk space
- Stable internet connection

## Quick Start

### 1. Clone Repository
```bash
git clone https://github.com/aam-007/PHX.git
cd PHX
```

### 2. Environment Setup

Install Node.js Dependencies:
```bash
npm install
```

Install Python Dependencies:
```bash
pip install matplotlib pandas numpy scipy
```

### 3. Blockchain Network Setup

Using Ganache GUI:

1. Download and install Ganache from [trufflesuite.com/ganache](https://trufflesuite.com/ganache)
2. Launch Ganache GUI
3. Create a new workspace or quickstart
4. Configure the workspace:
   - Port Number: 7545
   - Network ID: 1337
   - Gas Limit: 10000000
5. Save and start the workspace

The default accounts will be automatically created with test ETH.

### 4. Smart Contract Deployment
```bash


# Compile contracts
npx hardhat compile

# Deploy to local network
npx hardhat run scripts/deploy.js --network localhost
```

Expected Output:
```
PhonexCoin deployed to: 0x6652bfFF72971c548Fb70247abEA69A45427dB50
PhonexCentralBank deployed to: 0x7DB0be542A76eBCA2eE2AB13DCB7809E15C12A04
```

### 5. Configure Applications

Update configuration files with deployed contract addresses:

Central Bank Console (central-bank-console/config.js):
```javascript
const CONFIG = {
  PHX_TOKEN_ADDRESS: "0x6652bfFF72971c548Fb70247abEA69A45427dB50",
  CENTRAL_BANK_ADDRESS: "0x7DB0be542A76eBCA2eE2AB13DCB7809E15C12A04",
  NETWORK: "localhost",
  SHARED_DATA_FILE: "./phx_price.json"
};
```

Client Wallet (client-wallet/config.js):
```javascript
const CONFIG = {
  PHX_TOKEN_ADDRESS: "0x6652bfFF72971c548Fb70247abEA69A45427dB50",
  NETWORK: "localhost",
  SHARED_DATA_FILE: "./phx_price.json"
};
```

## Running the System

### 1. Start Central Bank Console
```bash

node phx-central-bank-enhanced.js
```

Features:

- Treasury management
- Quantitative Easing/Tightening operations
- Inflation control
- Market analytics dashboard
- Transaction ledger

### 2. Start Client Wallet
```bash

node phxClientWallet.ui.js
```

Features:

- PHX balance management
- Token transfers
- Real-time price tracking
- Transaction history
- Market data visualization

### 3. Start Trading Terminal
```bash

python phx_price_terminal.py
```

Features:

- Professional price charts
- Technical analysis (MA, Bollinger Bands)
- Interactive zoom and pan
- Risk assessment metrics
- Real-time statistics

## Advanced Configuration

### Network Configuration

For Ganache GUI:

- RPC URL: http://127.0.0.1:8545
- Chain ID: 1337
- Currency: ETH

### MetaMask Configuration

1. Open MetaMask
2. Add Custom Network:
   - Network Name: PHX Local
   - RPC URL: http://127.0.0.1:7545
   - Chain ID: 1337
   - Currency: ETH
3. Import Accounts:
   - Click on account icon
   - Select "Import Account"
   - Copy private keys from Ganache GUI (click the key icon next to each account)
   - Paste into MetaMask

## Initial Setup and Testing

### 1. Fund Test Accounts

After deploying contracts, the treasury receives initial supply. Fund test accounts using the Hardhat console or deployment script.

### 2. Test Monetary Operations

Quantitative Easing:

1. Open Central Bank Console
2. Select "Quantitative Easing (QE)"
3. Choose recipient and amount
4. Confirm operation

User Transactions:

1. Open Client Wallet
2. Select account
3. Choose "Transfer PHX"
4. Enter recipient and amount
5. Confirm transaction

## Monitoring and Analytics

### Real-time Metrics

The system provides comprehensive monitoring:

- Price Stability: Track PHX price around $100 peg
- Market Risk: Concentration, velocity, and large transfer risks
- Transaction Volume: Real-time network activity
- Central Bank Operations: QE/QT impact analysis

### Data Persistence

All applications share data through:

- phx_price.json: Price history and market data
- Blockchain: Immutable transaction records
- Local storage: User preferences and session data


## Troubleshooting

### Common Issues

**Connection Refused**
```
Error: cannot connect to http://127.0.0.1:7545
```

Solution: Ensure Ganache GUI is running and the workspace is started on port 7545

**Insufficient Funds**
```
Error: insufficient funds for gas
```

Solution: Import accounts from Ganache GUI into MetaMask or use the default funded accounts

**Contract Not Deployed**
```
Error: contract address not set
```

Solution: Deploy contracts first and update configuration files with the correct addresses

**Module Not Found**
```
Error: Cannot find module 'ethers'
```

Solution: Run npm install in the respective directory

### Debug Mode

Enable verbose logging:
```bash
DEBUG=phx* node phx-central-bank-enhanced.js
```



