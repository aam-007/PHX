// phxClientWallet.ui.js
// Formal PHX Client Wallet UI with Price Oracle and Crash Mechanisms
// npm install chalk@4 figlet ora@5 cli-table3
// NOTE: Use chalk v4 and ora v5 for CommonJS compatibility if needed.

const { ethers } = require("hardhat");
const readline = require("readline");
const chalk = require("chalk");
const figlet = require("figlet");
const ora = require("ora");
const Table = require("cli-table3");
const fs = require("fs");

const CONFIG = {
  PHX_TOKEN_ADDRESS: "0x6652bfFF72971c548Fb70247abEA69A45427dB50",
  NETWORK: "ganache",
  SHARED_DATA_FILE: "./phx_price.json"  // Changed to shared file
};

// Unified Price Oracle - Same as Central Bank
class PHXPriceOracle {
  constructor(phxContract, availableAccounts) {
    this.phx = phxContract;
    this.availableAccounts = availableAccounts;
    this.basePriceUSD = 100; // 1 PHX = 100 USD base peg
    this.transactionHistory = [];
    this.volume24h = 0;
    this.totalTransactions = 0;
    this.totalVolume = 0;
    this.lastPrice = 100;
    this.priceHistory = [];
    this.operationHistory = [];
    this.lastTransactionPrice = 100;
    this.dataFile = CONFIG.SHARED_DATA_FILE;  // Use shared file
  }

  async initialize() {
    await this.loadPersistedData();
    await this.loadTransactionHistory();
    this.calculateMetrics();
  }

  // Load persisted data from shared file
  async loadPersistedData() {
    try {
      if (fs.existsSync(this.dataFile)) {
        const data = JSON.parse(fs.readFileSync(this.dataFile, 'utf8'));
        this.priceHistory = data.priceHistory || [];
        this.operationHistory = data.operationHistory || [];
        this.lastPrice = data.lastPrice || 100;
        this.lastTransactionPrice = data.lastTransactionPrice || 100;
        console.log(chalk.green(`✓ Loaded ${this.priceHistory.length} price points from shared storage`));
      }
    } catch (error) {
      console.log(chalk.yellow("No existing shared data found, starting fresh..."));
    }
  }

  // Save data to shared file for persistence
  async persistData() {
    try {
      const data = {
        priceHistory: this.priceHistory,
        operationHistory: this.operationHistory,
        lastPrice: this.lastPrice,
        lastTransactionPrice: this.lastTransactionPrice,
        timestamp: new Date().toISOString()
      };
      fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error("Error persisting data to shared file:", error);
    }
  }

  async loadTransactionHistory() {
    try {
      const filter = this.phx.filters.Transfer();
      const events = await this.phx.queryFilter(filter, 0, "latest");
      
      this.transactionHistory = events.map(event => ({
        value: event.args.value || event.args[2],
        blockNumber: event.blockNumber,
        timestamp: Date.now()
      }));

      this.totalTransactions = this.transactionHistory.length;
    } catch (error) {
      console.error("Error loading transaction history:", error);
    }
  }

  calculateMetrics() {
    this.volume24h = this.transactionHistory
      .slice(-100)
      .reduce((sum, tx) => sum + parseFloat(ethers.formatUnits(tx.value, 18)), 0);

    this.totalVolume = this.transactionHistory
      .reduce((sum, tx) => sum + parseFloat(ethers.formatUnits(tx.value, 18)), 0);
  }

  async calculateConcentrationRisk() {
    try {
      if (!this.availableAccounts || this.availableAccounts.length === 0) return 0;

      const balances = [];
      const userAccounts = this.availableAccounts.slice(1);
      
      for (const account of userAccounts) {
        const balance = await this.phx.balanceOf(account.address);
        balances.push(parseFloat(ethers.formatUnits(balance, 18)));
      }

      if (balances.length === 0) return 0;

      const sortedBalances = balances.sort((a, b) => a - b);
      const total = sortedBalances.reduce((sum, val) => sum + val, 0);
      if (total === 0) return 0;

      let giniSum = 0;
      const n = sortedBalances.length;
      
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          giniSum += Math.abs(sortedBalances[i] - sortedBalances[j]);
        }
      }
      
      const gini = giniSum / (2 * n * n * (total / n));
      return Math.min(gini, 1);
    } catch (error) {
      return 0;
    }
  }

  calculateVelocityRisk() {
    if (this.totalTransactions === 0) return 0;
    try {
      const totalSupply = 10000000;
      const velocity = this.totalVolume / totalSupply;
      return Math.min(velocity * 0.1, 0.5);
    } catch (error) {
      return 0;
    }
  }

  detectLargeTransfers() {
    if (this.transactionHistory.length === 0) return 0;
    
    const largeTransferThreshold = 1000;
    let largeTransferCount = 0;
    
    for (const tx of this.transactionHistory.slice(-50)) {
      const amount = parseFloat(ethers.formatUnits(tx.value, 18));
      if (amount > largeTransferThreshold) largeTransferCount++;
    }
    
    return Math.min(largeTransferCount / 50, 0.3);
  }

  calculatePriceMomentum() {
    if (this.priceHistory.length < 2) return 0;
    
    const recentPrices = this.priceHistory.slice(-5);
    let declines = 0;
    
    for (let i = 1; i < recentPrices.length; i++) {
      if (recentPrices[i].price < recentPrices[i - 1].price) declines++;
    }
    
    return declines / recentPrices.length >= 0.6 ? -0.1 : 0;
  }

  async calculateCurrentPrice() {
    const basePrice = this.basePriceUSD;
    
    // Positive factors
    const volumeFactor = Math.log10(this.volume24h + 1) * 2;
    const transactionFactor = Math.log10(this.totalTransactions + 1) * 1.5;
    const networkHealth = Math.min(this.totalVolume / 10000, 2);
    
    // Crash risk factors
    const concentrationRisk = await this.calculateConcentrationRisk();
    const velocityRisk = this.calculateVelocityRisk();
    const largeTransferRisk = this.detectLargeTransfers();
    const priceMomentum = this.calculatePriceMomentum();
    
    let calculatedPrice = basePrice;
    
    // Apply positive factors
    calculatedPrice *= (1 + (volumeFactor * 0.01));
    calculatedPrice *= (1 + (transactionFactor * 0.005));
    calculatedPrice *= (1 + (networkHealth * 0.01));
    
    // Apply crash risks
    calculatedPrice *= (1 - (concentrationRisk * 0.1));
    calculatedPrice *= (1 - (velocityRisk * 0.05));
    calculatedPrice *= (1 - (largeTransferRisk * 0.15));
    calculatedPrice *= (1 + priceMomentum);

    // Market noise - increased for more volatility
    const marketNoise = (Math.random() - 0.5) * 0.08;
    calculatedPrice *= (1 + marketNoise);

    // Ensure minimum price (can crash up to 70%)
    calculatedPrice = Math.max(calculatedPrice, basePrice * 0.3);
    
    // Store price for momentum calculation and logging
    const priceData = {
      price: parseFloat(calculatedPrice.toFixed(2)),
      timestamp: new Date().toLocaleString(),
      volume24h: this.volume24h,
      totalTransactions: this.totalTransactions,
      marketConditions: {
        concentrationRisk: (concentrationRisk * 100).toFixed(1),
        velocityRisk: (velocityRisk * 100).toFixed(1),
        largeTransferRisk: (largeTransferRisk * 100).toFixed(1)
      }
    };
    
    this.priceHistory.push(priceData);
    if (this.priceHistory.length > 100) {
      this.priceHistory.shift();
    }
    
    this.lastPrice = priceData.price;
    
    // Persist after price update
    this.persistData().catch(console.error);
    
    return priceData.price;
  }

  // Update price after transaction
  async updatePriceAfterTransaction() {
    const previousPrice = this.lastPrice;
    await this.initialize(); // Reload metrics
    const newPrice = await this.calculateCurrentPrice();
    
    // Store the price at time of transaction for future comparison
    this.lastTransactionPrice = newPrice;
    
    // Persist after transaction
    await this.persistData();
    
    return {
      newPrice,
      previousPrice,
      priceChange: ((newPrice - previousPrice) / previousPrice * 100).toFixed(2),
      declined: newPrice < previousPrice
    };
  }

  getMarketDataSync() {
    return {
      price: this.lastPrice,
      volume24h: this.volume24h,
      totalTransactions: this.totalTransactions,
      totalVolume: this.totalVolume,
      priceChange: ((this.lastPrice - this.basePriceUSD) / this.basePriceUSD * 100).toFixed(2),
      concentrationRisk: "0.0",
      velocityRisk: "0.0",
      largeTransferRisk: "0.0",
      crashProbability: "0.0"
    };
  }

  async getMarketData() {
    const currentPrice = await this.calculateCurrentPrice();
    const concentrationRisk = await this.calculateConcentrationRisk();
    const velocityRisk = this.calculateVelocityRisk();
    const largeTransferRisk = this.detectLargeTransfers();
    
    return {
      price: currentPrice,
      volume24h: this.volume24h,
      totalTransactions: this.totalTransactions,
      totalVolume: this.totalVolume,
      priceChange: ((currentPrice - this.basePriceUSD) / this.basePriceUSD * 100).toFixed(2),
      concentrationRisk: (concentrationRisk * 100).toFixed(1),
      velocityRisk: (velocityRisk * 100).toFixed(1),
      largeTransferRisk: (largeTransferRisk * 100).toFixed(1),
      crashProbability: Math.min((concentrationRisk + velocityRisk + largeTransferRisk) * 50, 95).toFixed(1)
    };
  }

  async convertToUSD(phxAmount) {
    const marketData = await this.getMarketData();
    return parseFloat((phxAmount * marketData.price).toFixed(2));
  }

  async convertToPHX(usdAmount) {
    const marketData = await this.getMarketData();
    return parseFloat((usdAmount / marketData.price).toFixed(6));
  }

  getPriceHistory() {
    return this.priceHistory;
  }

  // Get price performance metrics
  getPricePerformance() {
    if (this.priceHistory.length < 2) return null;
    
    const firstPrice = this.priceHistory[this.priceHistory.length - 1].price;
    const currentPrice = this.lastPrice;
    const highestPrice = Math.max(...this.priceHistory.map(p => p.price));
    const lowestPrice = Math.min(...this.priceHistory.map(p => p.price));
    
    return {
      startPrice: firstPrice,
      currentPrice: currentPrice,
      highestPrice: highestPrice,
      lowestPrice: lowestPrice,
      totalChange: ((currentPrice - firstPrice) / firstPrice * 100).toFixed(2),
      fromATH: ((currentPrice - highestPrice) / highestPrice * 100).toFixed(2),
      volatility: this.calculateVolatility()
    };
  }

  calculateVolatility() {
    if (this.priceHistory.length < 2) return 0;
    
    const prices = this.priceHistory.map(p => p.price);
    const returns = [];
    
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i-1]) / prices[i-1]);
    }
    
    const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length;
    
    return (Math.sqrt(variance) * 100).toFixed(2);
  }
}

class PHXClientWallet {
  constructor() {
    this.phx = null;
    this.priceOracle = null;
    this.availableAccounts = [];
    this.userAccounts = [];
    this.currentUser = null;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    // color theme (formal)
    this.theme = {
      title: chalk.blueBright,
      section: chalk.cyanBright,
      label: chalk.yellow,
      value: chalk.white,
      ok: chalk.greenBright,
      warn: chalk.yellowBright,
      err: chalk.redBright,
      dim: chalk.gray
    };
  }

  // ---------- UI helpers ----------
  fancyTitle(text) {
    try {
      const fig = figlet.textSync(text, { font: "Small", horizontalLayout: "fitted" });
      console.log(this.theme.title(fig));
    } catch (e) {
      console.log(this.theme.title(`\n${text}\n`));
    }
  }

  section(title) {
    const border = "─".repeat(58);
    console.log("\n" + this.theme.title("┌" + border + "┐"));
    console.log(this.theme.title("│") + " " + this.theme.section.bold(title.padEnd(56)) + this.theme.title("│"));
    console.log(this.theme.title("└" + border + "┘") + "\n");
  }

  smallNote(msg) { console.log(this.theme.dim(`\n${msg}\n`)); }
  error(msg) { console.log(this.theme.err(`\nERROR: ${msg}\n`)); }
  success(msg) { console.log(this.theme.ok(`\n${msg}\n`)); }

  // ---------- initialization ----------
  async initialize() {
    console.clear();
    this.fancyTitle("PHX WALLET");
    console.log(this.theme.dim("=".repeat(64)));
    console.log(this.theme.value("Starting PHX Client Wallet"));
    console.log(this.theme.warn("Ensure Ganache/Hardhat is running at http://127.0.0.1:7545"));
    console.log(this.theme.err("Treasury account is restricted to Central Bank Console"));
    console.log(this.theme.dim("Using shared price data file: phx_price.json"));
    console.log(this.theme.dim("=".repeat(64) + "\n"));

    const spinner = ora("Connecting to local node and loading accounts...").start();
    try {
      this.availableAccounts = await ethers.getSigners();
      if (!this.availableAccounts || this.availableAccounts.length === 0) {
        spinner.fail("No signers available");
        this.error("No local accounts available from ethers.getSigners()");
        return false;
      }

      // exclude treasury (index 0)
      this.userAccounts = this.availableAccounts.slice(1);
      spinner.succeed("Accounts loaded");

      const PHX = await ethers.getContractFactory("PhonexCoin");
      this.phx = await PHX.attach(CONFIG.PHX_TOKEN_ADDRESS);

      // Initialize price oracle with same algorithm as Central Bank
      spinner.text = "Initializing unified price oracle...";
      this.priceOracle = new PHXPriceOracle(this.phx, this.availableAccounts);
      await this.priceOracle.initialize();

      this.success("Client Wallet connected successfully");
      console.log(this.theme.label("PHX Token Address: ") + this.theme.value(CONFIG.PHX_TOKEN_ADDRESS));
      
      const marketData = await this.priceOracle.getMarketData();
      console.log(this.theme.label("Current PHX Price: ") + this.theme.ok(`$${marketData.price} USD`));
      console.log(this.theme.label("Base Peg: ") + this.theme.value("1 PHX = $100 USD"));
      
      // Show risk indicators
      if (parseFloat(marketData.crashProbability) > 30) {
        console.log(this.theme.err(`Market Risk: ${marketData.crashProbability}% crash probability`));
      }
      
      this.smallNote("Treasury account hidden for security");
      this.smallNote("Using shared price data file: phx_price.json");

      await this.selectUser();
      return true;
    } catch (error) {
      spinner.fail("Initialization failed");
      this.error(error?.message || String(error));
      return false;
    }
  }

  // ---------- input helpers ----------
  question(prompt) {
    return new Promise((resolve) => { this.rl.question(prompt, resolve); });
  }

  async getAddressFromUser(prompt) {
    while (true) {
      const input = (await this.question(prompt)).trim();

      // numeric index
      if (input !== "" && !isNaN(input)) {
        const idx = parseInt(input);
        if (idx >= 0 && idx < this.userAccounts.length) {
          return this.userAccounts[idx].address;
        }
      }

      // address string
      try {
        if (ethers.isAddress(input)) {
          const treasuryAddress = this.availableAccounts[0].address.toLowerCase();
          if (input.toLowerCase() === treasuryAddress) {
            this.error("Treasury account cannot be accessed.");
            continue;
          }
          return input;
        }
      } catch (e) {
        // ignore
      }

      this.error(`Invalid address/index. Valid index: 0-${this.userAccounts.length - 1}.`);
    }
  }

  async getAmountFromUser(prompt) {
    while (true) {
      const input = (await this.question(prompt)).trim();
      const val = parseFloat(input);
      if (!isNaN(val) && val > 0) return input;
      this.error("Invalid amount. Enter a positive number.");
    }
  }

  // ---------- account selection ----------
  async selectUser() {
    this.section("SELECT CURRENT USER ACCOUNT");

    try {
      const marketData = await this.priceOracle.getMarketData();

      const table = new Table({
        head: [this.theme.section("Idx"), this.theme.section("Address"), this.theme.section("Balance (PHX)"), this.theme.section("USD Value")],
        colWidths: [6, 42, 15, 15]
      });

      for (let i = 0; i < this.userAccounts.length; i++) {
        const addr = this.userAccounts[i].address;
        const bal = await this.phx.balanceOf(addr);
        const phxBalance = parseFloat(ethers.formatUnits(bal, 18));
        const usdValue = await this.priceOracle.convertToUSD(phxBalance);
        
        table.push([
          this.theme.value(i.toString()), 
          this.theme.value(addr), 
          this.theme.ok(phxBalance.toFixed(2)), 
          this.theme.ok(`$${usdValue.toFixed(2)}`)
        ]);
      }

      console.log(table.toString());

      while (true) {
        const choice = await this.question(this.theme.warn(`\nSelect account index (0-${this.userAccounts.length - 1}): `));
        const index = parseInt(choice);
        if (!isNaN(index) && index >= 0 && index < this.userAccounts.length) {
          this.currentUser = this.userAccounts[index];
          const balance = await this.phx.balanceOf(this.currentUser.address);
          const phxBalance = parseFloat(ethers.formatUnits(balance, 18));
          const usdValue = await this.priceOracle.convertToUSD(phxBalance);
          this.success(`Selected account ${index} | Balance: ${phxBalance.toFixed(2)} PHX ($${usdValue.toFixed(2)} USD)`);
          break;
        }
        this.error("Invalid index.");
      }
    } catch (error) {
      this.error("Account selection failed: " + (error?.message || String(error)));
      throw error;
    }
  }

  // ---------- operations ----------
  async checkMyBalance() {
    this.section("MY BALANCE");
    try {
      const balance = await this.phx.balanceOf(this.currentUser.address);
      const phxBalance = parseFloat(ethers.formatUnits(balance, 18));
      const usdValue = await this.priceOracle.convertToUSD(phxBalance);
      const marketData = await this.priceOracle.getMarketData();

      console.log(this.theme.label("Address: ") + this.theme.value(this.currentUser.address));
      console.log(this.theme.label("Balance: ") + this.theme.ok(`${phxBalance.toFixed(2)} PHX`));
      console.log(this.theme.label("USD Value: ") + this.theme.ok(`$${usdValue.toFixed(2)}`));
      console.log(this.theme.dim(`Current PHX Price: $${marketData.price} USD`));
      
      // Show risk warning if high
      if (parseFloat(marketData.crashProbability) > 40) {
        console.log(this.theme.err(`Warning: High market risk (${marketData.crashProbability}% crash probability)`));
      }
    } catch (error) {
      this.error(error?.message || String(error));
    }
  }

  async checkAddressBalance() {
    this.section("CHECK ADDRESS BALANCE");

    try {
      // Display available accounts first
      const marketData = await this.priceOracle.getMarketData();

      const table = new Table({
        head: [this.theme.section("Idx"), this.theme.section("Address"), this.theme.section("Balance (PHX)"), this.theme.section("USD Value")],
        colWidths: [6, 42, 15, 15]
      });

      for (let i = 0; i < this.userAccounts.length; i++) {
        const addr = this.userAccounts[i].address;
        const bal = await this.phx.balanceOf(addr);
        const phxBalance = parseFloat(ethers.formatUnits(bal, 18));
        const usdValue = await this.priceOracle.convertToUSD(phxBalance);
        
        table.push([
          this.theme.value(i.toString()), 
          this.theme.value(addr), 
          this.theme.ok(phxBalance.toFixed(2)), 
          this.theme.ok(`$${usdValue.toFixed(2)}`)
        ]);
      }

      console.log(table.toString());
      console.log(this.theme.dim("\nAvailable wallet addresses listed above"));
      console.log(this.theme.dim("You can also enter any valid Ethereum address"));
      console.log(this.theme.dim(`Current PHX Price: $${marketData.price} USD`));

      // Get address input
      const address = await this.getAddressFromUser("Enter address or index: ");
      const balance = await this.phx.balanceOf(address);
      const phxBalance = parseFloat(ethers.formatUnits(balance, 18));
      const usdValue = await this.priceOracle.convertToUSD(phxBalance);

      // Display result
      this.section("BALANCE CHECK RESULT");
      console.log(this.theme.label("Address: ") + this.theme.value(address));
      console.log(this.theme.label("Balance: ") + this.theme.ok(`${phxBalance.toFixed(2)} PHX`));
      console.log(this.theme.label("USD Value: ") + this.theme.ok(`$${usdValue.toFixed(2)}`));
      console.log(this.theme.dim(`Current PHX Price: $${marketData.price} USD`));
      
    } catch (error) {
      this.error(error?.message || String(error));
    }
  }

  // ---------- transfer ----------
  async transferToUser() {
    this.section("TRANSFER PHX");

    try {
      let recipient;
      while (true) {
        console.log(this.theme.section("\nRecipient Options:"));
        console.log(this.theme.value(" 1. Enter address or index"));
        console.log(this.theme.value(" 2. View available accounts"));
        console.log(this.theme.value(" 3. Cancel transfer\n"));

        const opt = (await this.question(this.theme.warn("Select an option (1–3): "))).trim();

        if (opt === "1") {
          recipient = await this.getAddressFromUser("Enter recipient: ");
          break;
        } else if (opt === "2") {
          await this.viewAllBalances();
        } else if (opt === "3") {
          this.smallNote("Transfer cancelled.");
          return;
        } else {
          this.error("Invalid option.");
        }
      }

      const amountStr = await this.getAmountFromUser("Enter amount of PHX to transfer: ");
      const amountWei = ethers.parseUnits(amountStr, 18);
      const marketData = await this.priceOracle.getMarketData();
      const usdValue = await this.priceOracle.convertToUSD(parseFloat(amountStr));

      console.log(this.theme.dim("\nTransfer summary:"));
      console.log(this.theme.label(" From:     ") + this.theme.value(this.currentUser.address));
      console.log(this.theme.label(" To:       ") + this.theme.value(recipient));
      console.log(this.theme.label(" Amount:   ") + this.theme.value(`${amountStr} PHX`));
      console.log(this.theme.label(" USD Value: ") + this.theme.value(`$${usdValue.toFixed(2)}`));
      console.log(this.theme.label(" Fee:      ") + this.theme.value("0 PHX (No fees)"));
      console.log(this.theme.dim(` Current Price: $${marketData.price} USD/PHX`));

      // Large transfer warning
      if (parseFloat(amountStr) > 1000) {
        console.log(this.theme.err(" Warning: Large transfer may impact market price"));
      }

      const confirm = (await this.question(this.theme.warn("\nConfirm transfer? (y/n): "))).trim().toLowerCase();
      if (confirm !== "y" && confirm !== "yes") {
        this.smallNote("Transfer cancelled.");
        return;
      }

      const bal = await this.phx.balanceOf(this.currentUser.address);
      if (bal < amountWei) {
        this.error(`Insufficient balance. Available: ${ethers.formatUnits(bal, 18)} PHX`);
        return;
      }

      const spinner = ora("Submitting transaction...").start();
      const tx = await this.phx.connect(this.currentUser).transfer(recipient, amountWei);
      spinner.text = "Awaiting confirmation...";
      const receipt = await tx.wait();
      
      // Update price oracle with new transaction
      await this.priceOracle.updatePriceAfterTransaction();
      
      spinner.succeed("Transfer complete.");

      // Show price impact
      const newMarketData = await this.priceOracle.getMarketData();
      console.log(this.theme.dim(`New PHX Price: $${newMarketData.price} USD`));

    } catch (error) {
      this.error("Transfer failed: " + (error?.message || String(error)));
    }
  }

  async switchUser() { await this.selectUser(); }

  async viewAllBalances() {
    this.section("ALL USER BALANCES (Treasury Hidden)");
    try {
      const marketData = await this.priceOracle.getMarketData();

      const table = new Table({
        head: [this.theme.section("Idx"), this.theme.section("Address"), this.theme.section("Balance (PHX)"), this.theme.section("USD Value"), this.theme.section("Status")],
        colWidths: [6, 36, 15, 15, 10]
      });

      for (let i = 0; i < this.userAccounts.length; i++) {
        const addr = this.userAccounts[i].address;
        const bal = await this.phx.balanceOf(addr);
        const phxBalance = parseFloat(ethers.formatUnits(bal, 18));
        const usdValue = await this.priceOracle.convertToUSD(phxBalance);
        const status = addr === this.currentUser.address ? this.theme.warn("ACTIVE") : "";
        
        table.push([
          this.theme.value(i.toString()), 
          this.theme.value(addr), 
          this.theme.ok(phxBalance.toFixed(2)), 
          this.theme.ok(`$${usdValue.toFixed(2)}`),
          status
        ]);
      }

      console.log(table.toString());
      console.log(this.theme.dim(`Current PHX Price: $${marketData.price} USD`));

      // Show concentration warning
      if (parseFloat(marketData.concentrationRisk) > 50) {
        console.log(this.theme.err(`High concentration risk: ${marketData.concentrationRisk}%`));
      }

      const treasuryBal = await this.phx.balanceOf(this.availableAccounts[0].address);
      const treasuryPHX = parseFloat(ethers.formatUnits(treasuryBal, 18));
      const treasuryUSD = await this.priceOracle.convertToUSD(treasuryPHX);
      console.log(this.theme.dim(`\nTreasury Balance: ${treasuryPHX.toFixed(2)} PHX ($${treasuryUSD.toFixed(2)} USD) - Read-Only`));
    } catch (error) {
      this.error(error?.message || String(error));
    }
  }

  // ---------- transaction history ----------
  async viewTransactionHistory() {
    this.section("MY TRANSACTION HISTORY (current user)");

    try {
      if (!this.currentUser || !this.currentUser.address) {
        this.error("No current user selected.");
        return;
      }

      const me = String(this.currentUser.address).toLowerCase();
      const contractAddress = this.phx.address ?? this.phx.target ?? this.phx._address;
      if (!contractAddress) {
        this.error("Cannot determine contract address.");
        return;
      }

      const provider = ethers.provider;
      if (!provider) {
        this.error("Provider missing.");
        return;
      }

      // Query Transfer events
      const filter = this.phx.filters.Transfer();
      const events = await this.phx.queryFilter(filter, 0, "latest");

      // Filter only relevant events
      const myEvents = [];
      for (const ev of events) {
        const from = String(ev.args.from || ev.args[0]).toLowerCase();
        const to = String(ev.args.to || ev.args[1]).toLowerCase();

        if (from !== me && to !== me) continue;

        const b = await provider.getBlock(ev.blockNumber);
        const ts = b ? b.timestamp : null;

        myEvents.push({
          txHash: ev.transactionHash,
          from,
          to,
          value: ev.args.value || ev.args[2],
          time: ts ? new Date(Number(ts) * 1000).toLocaleString() : "n/a",
          blockNumber: ev.blockNumber
        });
      }

      if (myEvents.length === 0) {
        this.smallNote("No transactions found for the current user.");
        return;
      }

      myEvents.sort((a, b) => Number(b.blockNumber) - Number(a.blockNumber));
      const marketData = await this.priceOracle.getMarketData();

      for (const e of myEvents) {
        const shortHash = String(e.txHash).slice(0, 12) + "...";
        const fromShort = String(e.from).slice(0, 10) + (String(e.from).length > 10 ? "…" : "");
        const toShort = String(e.to).slice(0, 10) + (String(e.to).length > 10 ? "…" : "");
        const amount = parseFloat(ethers.formatUnits(e.value, 18));
        const usdValue = await this.priceOracle.convertToUSD(amount);

        if (e.from === me) {
          console.log(this.theme.err(fromShort) + " " + this.theme.label("──────▶") + " " + this.theme.value(toShort));
          console.log(this.theme.label(" Amount: ") + this.theme.err(`-${amount.toFixed(2)} PHX`) + this.theme.dim(` ($${usdValue.toFixed(2)} USD)`));
        } else {
          console.log(this.theme.value(fromShort) + " " + this.theme.label("──────▶") + " " + this.theme.ok("YOU"));
          console.log(this.theme.label(" Amount: ") + this.theme.ok(`+${amount.toFixed(2)} PHX`) + this.theme.dim(` ($${usdValue.toFixed(2)} USD)`));
        }
        console.log(this.theme.label(" Time:   ") + this.theme.value(e.time));
        console.log(this.theme.label(" Tx:     ") + this.theme.value(shortHash));
        console.log(this.theme.dim("──────────────────────────────────────────────"));
      }

      console.log(this.theme.dim(`\nCurrent PHX Price: $${marketData.price} USD`));

    } catch (error) {
      this.error("Failed to load history: " + (error?.message || String(error)));
    }
  }

  // ---------- market data ----------
  async showMarketData() {
    this.section("PHX MARKET DATA");

    try {
      const marketData = await this.priceOracle.getMarketData();
      const pricePerformance = this.priceOracle.getPricePerformance();
      const priceHistory = this.priceOracle.getPriceHistory();

      console.log(this.theme.section("Current Price: ") + this.theme.value(`$${marketData.price} USD`));
      console.log(this.theme.section("Base Peg: ") + this.theme.value("1 PHX = $100 USD"));
      console.log(this.theme.section("Price Change: ") + 
        (marketData.priceChange >= 0 ? this.theme.ok(`+${marketData.priceChange}%`) : this.theme.err(`${marketData.priceChange}%`)));
      console.log(this.theme.section("24h Volume: ") + this.theme.value(`${marketData.volume24h.toFixed(2)} PHX`));
      console.log(this.theme.section("Total Transactions: ") + this.theme.value(marketData.totalTransactions.toString()));
      console.log(this.theme.section("Total Volume: ") + this.theme.value(`${marketData.totalVolume.toFixed(2)} PHX`));

      // Risk metrics
      console.log("\n" + this.theme.section("RISK METRICS:"));
      console.log(this.theme.section("Concentration Risk: ") + 
        (marketData.concentrationRisk > 50 ? this.theme.err(`${marketData.concentrationRisk}%`) : this.theme.value(`${marketData.concentrationRisk}%`)));
      console.log(this.theme.section("Velocity Risk: ") + 
        (marketData.velocityRisk > 30 ? this.theme.err(`${marketData.velocityRisk}%`) : this.theme.value(`${marketData.velocityRisk}%`)));
      console.log(this.theme.section("Large Transfer Risk: ") + 
        (marketData.largeTransferRisk > 20 ? this.theme.err(`${marketData.largeTransferRisk}%`) : this.theme.value(`${marketData.largeTransferRisk}%`)));
      console.log(this.theme.section("Crash Probability: ") + 
        (marketData.crashProbability > 40 ? this.theme.err(`${marketData.crashProbability}%`) : this.theme.warn(`${marketData.crashProbability}%`)));

      if (pricePerformance) {
        console.log("\n" + this.theme.section("PRICE PERFORMANCE:"));
        console.log(this.theme.section("Start Price: ") + this.theme.value(`$${pricePerformance.startPrice} USD`));
        console.log(this.theme.section("All-Time High: ") + this.theme.ok(`$${pricePerformance.highestPrice} USD`));
        console.log(this.theme.section("All-Time Low: ") + this.theme.err(`$${pricePerformance.lowestPrice} USD`));
        console.log(this.theme.section("Total Return: ") + 
          (parseFloat(pricePerformance.totalChange) >= 0 ? this.theme.ok(`${pricePerformance.totalChange}%`) : this.theme.err(`${pricePerformance.totalChange}%`)));
        console.log(this.theme.section("From ATH: ") + 
          (parseFloat(pricePerformance.fromATH) >= 0 ? this.theme.ok(`${pricePerformance.fromATH}%`) : this.theme.err(`${pricePerformance.fromATH}%`)));
        console.log(this.theme.section("Volatility: ") + this.theme.value(`${pricePerformance.volatility}%`));
      }

      // Show recent price history
      if (priceHistory.length > 0) {
        console.log("\n" + this.theme.section("RECENT PRICE HISTORY:"));
        const recentPrices = priceHistory.slice(-5).reverse();
        recentPrices.forEach((price, index) => {
          if (index > 0) {
            const prevPrice = recentPrices[index - 1].price;
            const change = ((price.price - prevPrice) / prevPrice * 100).toFixed(2);
            const changeColor = change >= 0 ? this.theme.ok : this.theme.err;
            const changeSymbol = change >= 0 ? '+' : '';
            console.log(`  ${price.timestamp}: $${price.price} USD ${changeColor(`(${changeSymbol}${change}%)`)}`);
          } else {
            console.log(`  ${price.timestamp}: $${price.price} USD`);
          }
        });
      }

      console.log(this.theme.dim("\nPrice factors: Transaction volume, network activity, market momentum"));
      console.log(this.theme.dim("Crash factors: Token concentration, high velocity, large transfers"));
      console.log(this.theme.dim("Base peg maintained through algorithmic price stabilization"));
    } catch (error) {
      this.error(error?.message || String(error));
    }
  }

  // ---------- system info ----------
  async showSystemInfo() {
    this.section("PHX SYSTEM INFORMATION");

    try {
      const totalSupply = await this.phx.totalSupply();
      const treasuryBalance = await this.phx.balanceOf(this.availableAccounts[0].address);
      const circulating = totalSupply - treasuryBalance;
      const marketData = await this.priceOracle.getMarketData();

      console.log(this.theme.section("Total Supply: ") + this.theme.value(ethers.formatUnits(totalSupply, 18) + " PHX"));
      console.log(this.theme.section("Treasury Reserve: ") + this.theme.value(ethers.formatUnits(treasuryBalance, 18) + " PHX"));
      console.log(this.theme.section("Circulating Supply: ") + this.theme.value(ethers.formatUnits(circulating, 18) + " PHX"));
      console.log(this.theme.section("Transfer Fee: ") + this.theme.value("0 PHX (No fees)"));
      console.log(this.theme.section("Current Price: ") + this.theme.value(`$${marketData.price} USD`));

      // Price range info
      console.log(this.theme.section("Price Range: ") + this.theme.value(`$${this.priceOracle.basePriceUSD * 0.3} - $${(this.priceOracle.basePriceUSD * 2.5).toFixed(0)} USD`));
      console.log(this.theme.section("Max Crash: ") + this.theme.err("-70% from base peg"));

      console.log(this.theme.dim("\nTreasury operations restricted to Central Bank Console."));
      console.log(this.theme.dim("Using shared price data file: phx_price.json"));
    } catch (error) {
      this.error(error?.message || String(error));
    }
  }

  // ---------- price converter ----------
  async showPriceConverter() {
    this.section("PHX PRICE CONVERTER");

    try {
      const marketData = await this.priceOracle.getMarketData();

      console.log(this.theme.label("Current PHX Price: ") + this.theme.ok(`$${marketData.price} USD`));
      console.log(this.theme.label("Base Peg: ") + this.theme.value("1 PHX = $100 USD") + "\n");

      // PHX to USD conversion
      const phxAmount = await this.question(this.theme.warn("Enter PHX amount to convert to USD: "));
      const phxValue = parseFloat(phxAmount);
      if (!isNaN(phxValue) && phxValue > 0) {
        const usdValue = await this.priceOracle.convertToUSD(phxValue);
        console.log(this.theme.ok(`\n${phxValue} PHX = $${usdValue.toFixed(2)} USD`));
      }

      console.log("");

      // USD to PHX conversion
      const usdAmount = await this.question(this.theme.warn("Enter USD amount to convert to PHX: "));
      const usdValue = parseFloat(usdAmount);
      if (!isNaN(usdValue) && usdValue > 0) {
        const phxValue = await this.priceOracle.convertToPHX(usdValue);
        console.log(this.theme.ok(`\n$${usdValue.toFixed(2)} USD = ${phxValue.toFixed(6)} PHX`));
      }

    } catch (error) {
      this.error(error?.message || String(error));
    }
  }

  // ---------- refresh market data ----------
  async refreshMarketData() {
    this.section("REFRESH MARKET DATA");
    try {
      await this.priceOracle.initialize();
      const marketData = await this.priceOracle.getMarketData();
      this.success(`Market data refreshed! Current price: $${marketData.price} USD`);
    } catch (error) {
      this.error("Failed to refresh market data: " + error.message);
    }
  }

  // ---------- main menu ----------
  async mainMenu() {
    while (true) {
      const marketData = await this.priceOracle.getMarketData();
      const priceChangeColor = marketData.priceChange >= 0 ? this.theme.ok : this.theme.err;
      const crashWarning = parseFloat(marketData.crashProbability) > 40 ? this.theme.err("HIGH RISK") : "";
      
      this.section("MAIN MENU");
      console.log(this.theme.section(`PHX Price: $${marketData.price} USD `) + 
                 priceChangeColor(`(${marketData.priceChange >= 0 ? '+' : ''}${marketData.priceChange}%)`) + crashWarning);
      console.log("");
      console.log(this.theme.value(" 1. Check My Balance"));
      console.log(this.theme.value(" 2. Check Address Balance"));
      console.log(this.theme.value(" 3. Transfer PHX"));
      console.log(this.theme.value(" 4. View All Balances"));
      console.log(this.theme.value(" 5. View Transaction History"));
      console.log(this.theme.value(" 6. Show Market Data"));
      console.log(this.theme.value(" 7. Price Converter"));
      console.log(this.theme.value(" 8. Show System Info"));
      console.log(this.theme.value(" 9. Switch User"));
      console.log(this.theme.value("10. Refresh Market Data"));
      console.log(this.theme.value("11. Exit\n"));

      const priceHistory = this.priceOracle.getPriceHistory();
      console.log(this.theme.dim(` Analytics: ${priceHistory.length} price points | ${marketData.totalTransactions} blockchain txs`));
      console.log(this.theme.dim(` Data Source: Shared phx_price.json file`));

      const choice = (await this.question(this.theme.warn("Select option: "))).trim();

      if (choice === "1") await this.checkMyBalance();
      else if (choice === "2") await this.checkAddressBalance();
      else if (choice === "3") await this.transferToUser();
      else if (choice === "4") await this.viewAllBalances();
      else if (choice === "5") await this.viewTransactionHistory();
      else if (choice === "6") await this.showMarketData();
      else if (choice === "7") await this.showPriceConverter();
      else if (choice === "8") await this.showSystemInfo();
      else if (choice === "9") await this.switchUser();
      else if (choice === "10") await this.refreshMarketData();
      else if (choice === "11") {
        this.smallNote("Exiting wallet...");
        this.rl.close();
        process.exit(0);
      } else {
        this.error("Invalid selection.");
      }

      await this.question(this.theme.dim("\nPress Enter to continue..."));
    }
  }
}

// ---------- execution ----------
async function start() {
  const wallet = new PHXClientWallet();
  const ok = await wallet.initialize();
  if (ok) await wallet.mainMenu();
}
start();