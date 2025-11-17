const { ethers } = require("hardhat");
const readline = require('readline');

const CONFIG = {
  PHX_TOKEN_ADDRESS: "0x6652bfFF72971c548Fb70247abEA69A45427dB50",
  NETWORK: "ganache"
};

class PHXClientWallet {
  constructor() {
    this.phx = null;
    this.availableAccounts = [];
    this.userAccounts = []; // EXCLUDES TREASURY ACCOUNT
    this.currentUser = null;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  async initialize() {
    console.log("👤 Initializing PHX Client Wallet...");
    
    try {
      // Get all available accounts
      this.availableAccounts = await ethers.getSigners();
      
      // EXCLUDE TREASURY ACCOUNT (index 0) - CRITICAL SECURITY FIX
      this.userAccounts = this.availableAccounts.slice(1); // Start from index 1
      
      console.log("Available user accounts (Treasury account hidden):");
      this.userAccounts.forEach((account, index) => {
        console.log(`  ${index}: ${account.address}`);
      });

      // Attach to PHX token contract
      const PHX = await ethers.getContractFactory("PhonexCoin");
      this.phx = await PHX.attach(CONFIG.PHX_TOKEN_ADDRESS);

      console.log("✅ Client Wallet connected successfully!");
      console.log(`PHX Token: ${CONFIG.PHX_TOKEN_ADDRESS}`);
      console.log("🔒 Treasury account hidden for security");
      
      // Select current user
      await this.selectUser();
      
      return true;
    } catch (error) {
      console.error("❌ Failed to initialize:", error.message);
      return false;
    }
  }

  async selectUser() {
    console.log("\n👤 SELECT CURRENT USER ACCOUNT");
    console.log("==============================");
    
    for (let i = 0; i < this.userAccounts.length; i++) {
      const balance = await this.phx.balanceOf(this.userAccounts[i].address);
      console.log(`${i}: ${this.userAccounts[i].address} - ${ethers.formatUnits(balance, 18)} PHX`);
    }
    
    while (true) {
      const choice = await this.question("\nSelect account to use (0-8): ");
      const index = parseInt(choice);
      
      if (!isNaN(index) && index >= 0 && index < this.userAccounts.length) {
        this.currentUser = this.userAccounts[index];
        const balance = await this.phx.balanceOf(this.currentUser.address);
        console.log(`✅ Selected: Account ${index} - ${ethers.formatUnits(balance, 18)} PHX`);
        break;
      } else {
        console.log(`❌ Invalid selection. Please choose 0-${this.userAccounts.length - 1}.`);
      }
    }
  }

  question(prompt) {
    return new Promise((resolve) => {
      this.rl.question(prompt, resolve);
    });
  }

  async getAddressFromUser(prompt) {
    while (true) {
      const input = await this.question(prompt);
      
      // Check if input is a number (index) - ONLY ALLOW USER ACCOUNTS
      if (!isNaN(input) && input >= 0 && input < this.userAccounts.length) {
        return this.userAccounts[parseInt(input)].address;
      }
      
      // Check if input is a valid address
      if (ethers.isAddress(input)) {
        // SECURITY: Prevent using treasury address even if manually entered
        const treasuryAddress = this.availableAccounts[0].address.toLowerCase();
        if (input.toLowerCase() === treasuryAddress) {
          console.log("❌ Access to treasury account not permitted in client wallet.");
          console.log("   Use Central Bank Console for treasury operations.");
          continue;
        }
        return input;
      }
      
      console.log(`❌ Invalid address or index. Please use 0-${this.userAccounts.length - 1} or a valid user address.`);
    }
  }

  async getAmountFromUser(prompt) {
    while (true) {
      const input = await this.question(prompt);
      if (!isNaN(input) && parseFloat(input) > 0) {
        return input;
      }
      console.log("❌ Invalid amount. Please enter a positive number.");
    }
  }

  // Client Operations
  async checkMyBalance() {
    console.log("\n💰 MY BALANCE");
    console.log("=============");
    try {
      const balance = await this.phx.balanceOf(this.currentUser.address);
      console.log(`Account: ${this.currentUser.address}`);
      console.log(`Balance: ${ethers.formatUnits(balance, 18)} PHX`);
    } catch (error) {
      console.error("Error checking balance:", error.message);
    }
  }

  async checkAddressBalance() {
    try {
      const address = await this.getAddressFromUser("Enter address or account index to check: ");
      const balance = await this.phx.balanceOf(address);
      console.log(`\n💰 Balance Check:`);
      console.log(`Address: ${address}`);
      console.log(`Balance: ${ethers.formatUnits(balance, 18)} PHX`);
    } catch (error) {
      console.error("❌ Error checking balance:", error.message);
    }
  }

  async transferToUser() {
    try {
      const recipient = await this.getAddressFromUser("Enter recipient address or account index: ");
      const amount = await this.getAmountFromUser("Enter amount of PHX to transfer: ");
      
      // SECURITY: Check if user has sufficient balance
      const userBalance = await this.phx.balanceOf(this.currentUser.address);
      const amountWei = ethers.parseUnits(amount, 18);
      
      if (userBalance < amountWei) {
        console.log(`❌ Insufficient balance. You have ${ethers.formatUnits(userBalance, 18)} PHX but tried to send ${amount} PHX.`);
        return;
      }
      
      console.log(`\n💸 PERSONAL TRANSFER`);
      console.log(`From: ${this.currentUser.address}`);
      console.log(`To: ${recipient}`);
      console.log(`Amount: ${amount} PHX`);
      
      const tx = await this.phx.connect(this.currentUser).transfer(recipient, amountWei);
      console.log("⏳ Waiting for transaction confirmation...");
      await tx.wait();
      
      console.log("✅ Transfer successful!");
      console.log("My new balance:", ethers.formatUnits(await this.phx.balanceOf(this.currentUser.address), 18), "PHX");
      console.log("Recipient balance:", ethers.formatUnits(await this.phx.balanceOf(recipient), 18), "PHX");
    } catch (error) {
      console.error("❌ Transfer failed:", error.message);
    }
  }

  async switchUser() {
    await this.selectUser();
  }

  async viewAllBalances() {
    console.log("\n📊 ALL USER BALANCES (Treasury Hidden)");
    console.log("=====================================");
    try {
      for (let i = 0; i < this.userAccounts.length; i++) {
        const balance = await this.phx.balanceOf(this.userAccounts[i].address);
        const isCurrent = this.userAccounts[i].address === this.currentUser.address ? " ← CURRENT" : "";
        console.log(`${i}: ${this.userAccounts[i].address} - ${ethers.formatUnits(balance, 18)} PHX${isCurrent}`);
      }
      
      // Show treasury balance separately (read-only, no access)
      const treasuryBalance = await this.phx.balanceOf(this.availableAccounts[0].address);
      console.log(`\n🏦 Treasury Balance: ${ethers.formatUnits(treasuryBalance, 18)} PHX (Central Bank - No Access)`);
    } catch (error) {
      console.error("Error viewing balances:", error.message);
    }
  }

  async showSystemInfo() {
    console.log("\n🏛️  PHX SYSTEM INFORMATION");
    console.log("========================");
    try {
      const totalSupply = await this.phx.totalSupply();
      const treasuryBalance = await this.phx.balanceOf(this.availableAccounts[0].address);
      const circulatingSupply = totalSupply - treasuryBalance;
      
      console.log(`Total Supply: ${ethers.formatUnits(totalSupply, 18)} PHX`);
      console.log(`Treasury Reserve: ${ethers.formatUnits(treasuryBalance, 18)} PHX`);
      console.log(`Circulating Supply: ${ethers.formatUnits(circulatingSupply, 18)} PHX`);
      console.log(`Inflation Rate: 2.5% annually`);
      console.log(`Emergency Mint Cap: 5% of supply`);
      console.log(`\n🔒 Security: Treasury operations restricted to Central Bank Console`);
    } catch (error) {
      console.error("Error getting system info:", error.message);
    }
  }

  async showMenu() {
    console.log("\n" + "=".repeat(60));
    console.log("👤 PHX CLIENT WALLET - PERSONAL BANKING");
    console.log("=".repeat(60));
    console.log(`Current User: ${this.currentUser.address.substring(0, 10)}...`);
    console.log("=".repeat(60));
    console.log("1.  Check My Balance");
    console.log("2.  Check Address Balance");
    console.log("3.  Transfer to Another User");
    console.log("4.  View All User Balances");
    console.log("5.  Switch User Account");
    console.log("6.  System Information");
    console.log("7.  Exit Wallet");
    console.log("=".repeat(60));
    console.log("🔒 Treasury account access: Central Bank Console only");
  }

  async handleMenuChoice(choice) {
    switch (choice) {
      case '1':
        await this.checkMyBalance();
        break;
      case '2':
        await this.checkAddressBalance();
        break;
      case '3':
        await this.transferToUser();
        break;
      case '4':
        await this.viewAllBalances();
        break;
      case '5':
        await this.switchUser();
        break;
      case '6':
        await this.showSystemInfo();
        break;
      case '7':
        console.log("👋 Exiting PHX Client Wallet. Goodbye!");
        this.rl.close();
        process.exit(0);
        break;
      default:
        console.log("❌ Invalid choice. Please select 1-7.");
    }
  }

  async run() {
    console.log("🚀 Starting PHX Client Wallet...");
    console.log("Make sure Ganache is running on http://127.0.0.1:7545");
    console.log("🔒 SECURITY: Treasury account access restricted");
    
    const initialized = await this.initialize();
    if (!initialized) {
      console.log("❌ Failed to initialize. Please check the errors above.");
      this.rl.close();
      process.exit(1);
    }

    while (true) {
      await this.showMenu();
      const choice = await this.question("Select an operation (1-7): ");
      await this.handleMenuChoice(choice.trim());
      
      // Pause before showing menu again
      await this.question("\nPress Enter to continue...");
    }
  }
}

// Main execution
async function main() {
  try {
    const wallet = new PHXClientWallet();
    await wallet.run();
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error("Unhandled error:", error);
    process.exit(1);
  });
}

module.exports = PHXClientWallet;