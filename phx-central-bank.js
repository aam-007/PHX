const { ethers } = require("hardhat");
const readline = require('readline');


const CONFIG = {
  PHX_TOKEN_ADDRESS: "0x6652bfFF72971c548Fb70247abEA69A45427dB50",
  CENTRAL_BANK_ADDRESS: "0x7DB0be542A76eBCA2eE2AB13DCB7809E15C12A04",
  NETWORK: "ganache"
};

class PHXCentralBank {
  constructor() {
    this.phx = null;
    this.cb = null;
    this.owner = null;
    this.availableAccounts = [];
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  async initialize() {
    console.log("🏦 Initializing PHX Central Bank Console...");
    
    try {
      // Get all available accounts
      this.availableAccounts = await ethers.getSigners();
      this.owner = this.availableAccounts[0];

      console.log("Available treasury accounts:");
      this.availableAccounts.forEach((account, index) => {
        console.log(`  ${index}: ${account.address}`);
      });

      // Attach to deployed contracts
      const PHX = await ethers.getContractFactory("PhonexCoin");
      this.phx = await PHX.attach(CONFIG.PHX_TOKEN_ADDRESS);

      const CentralBank = await ethers.getContractFactory("PhonexCentralBank");
      this.cb = await CentralBank.attach(CONFIG.CENTRAL_BANK_ADDRESS);

      console.log("✅ Central Bank connected successfully!");
      console.log(`PHX Token: ${CONFIG.PHX_TOKEN_ADDRESS}`);
      console.log(`Central Bank: ${CONFIG.CENTRAL_BANK_ADDRESS}`);
      
      // Verify contracts are connected
      const ownerBalance = await this.phx.balanceOf(this.owner.address);
      console.log(`💰 Treasury Balance: ${ethers.formatUnits(ownerBalance, 18)} PHX`);
      
      return true;
    } catch (error) {
      console.error("❌ Failed to initialize:", error.message);
      console.log("Please make sure:");
      console.log("1. Ganache is running on http://127.0.0.1:7545");
      console.log("2. Contracts are deployed with correct addresses");
      console.log("3. hardhat.config.js is properly configured");
      return false;
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
      
      // Check if input is a number (index)
      if (!isNaN(input) && input >= 0 && input < this.availableAccounts.length) {
        return this.availableAccounts[parseInt(input)].address;
      }
      
      // Check if input is a valid address
      if (ethers.isAddress(input)) {
        return input;
      }
      
      console.log("❌ Invalid address or index. Please try again.");
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

  // Operation Methods - CENTRAL BANK ONLY
  async checkSystemStatus() {
    console.log("\n🔍 CENTRAL BANK SYSTEM STATUS");
    console.log("==============================");
    try {
      console.log("🏛️  Contract Ownership:");
      console.log("  PHX Owner:", await this.phx.owner());
      console.log("  Treasury:", await this.phx.treasury());
      console.log("  Central Bank Governor:", await this.cb.governor());
      
      console.log("\n💰 Treasury & Supply:");
      console.log("  Treasury Balance:", ethers.formatUnits(await this.phx.balanceOf(this.owner.address), 18), "PHX");
      console.log("  Total Supply:", ethers.formatUnits(await this.phx.totalSupply(), 18), "PHX");
      console.log("  Central Bank Reserves:", ethers.formatUnits(await this.phx.balanceOf(await this.cb.getAddress()), 18), "PHX");
      
      console.log("\n📊 Treasury Account Balances:");
      for (let i = 0; i < Math.min(this.availableAccounts.length, 5); i++) {
        const balance = await this.phx.balanceOf(this.availableAccounts[i].address);
        console.log(`  ${i}: ${this.availableAccounts[i].address} - ${ethers.formatUnits(balance, 18)} PHX`);
      }
    } catch (error) {
      console.error("Error checking system status:", error.message);
    }
  }

  async treasuryToWallet() {
    try {
      const recipient = await this.getAddressFromUser("Enter recipient wallet address or index: ");
      const amount = await this.getAmountFromUser("Enter amount of PHX to transfer: ");
      
      console.log(`\n🏦 TREASURY → WALLET TRANSFER`);
      console.log(`From: Treasury (${this.owner.address})`);
      console.log(`To: ${recipient}`);
      console.log(`Amount: ${amount} PHX`);
      
      const amountWei = ethers.parseUnits(amount, 18);
      const tx = await this.phx.transfer(recipient, amountWei);
      console.log("⏳ Waiting for transaction confirmation...");
      await tx.wait();
      
      console.log("✅ Treasury transfer successful!");
      console.log("New treasury balance:", ethers.formatUnits(await this.phx.balanceOf(this.owner.address), 18), "PHX");
      console.log("Recipient balance:", ethers.formatUnits(await this.phx.balanceOf(recipient), 18), "PHX");
    } catch (error) {
      console.error("❌ Treasury transfer failed:", error.message);
    }
  }

  async quantitativeEasing() {
    try {
      const recipient = await this.getAddressFromUser("Enter recipient address for QE injection: ");
      const amount = await this.getAmountFromUser("Enter amount of PHX for QE: ");
      
      console.log(`\n💰 QUANTITATIVE EASING (MONETARY POLICY)`);
      console.log(`Recipient: ${recipient}`);
      console.log(`Amount: ${amount} PHX`);
      
      const amountWei = ethers.parseUnits(amount, 18);
      
      // Fund central bank from treasury
      console.log("⏳ Funding Central Bank from Treasury...");
      const fundTx = await this.phx.transfer(await this.cb.getAddress(), amountWei);
      await fundTx.wait();
      
      // Inject liquidity
      console.log("⏳ Injecting liquidity...");
      const injectTx = await this.cb.inject(recipient, amountWei);
      await injectTx.wait();
      
      console.log("✅ QE Operation Completed!");
      console.log("Recipient new balance:", ethers.formatUnits(await this.phx.balanceOf(recipient), 18), "PHX");
      console.log("Central Bank reserves:", ethers.formatUnits(await this.phx.balanceOf(await this.cb.getAddress()), 18), "PHX");
    } catch (error) {
      console.error("❌ QE Operation failed:", error.message);
    }
  }

  async quantitativeTightening() {
    try {
      const target = await this.getAddressFromUser("Enter target address for QT absorption: ");
      const amount = await this.getAmountFromUser("Enter amount of PHX to absorb: ");
      
      console.log(`\n📉 QUANTITATIVE TIGHTENING (MONETARY POLICY)`);
      console.log(`Target: ${target}`);
      console.log(`Amount: ${amount} PHX`);
      
      const amountWei = ethers.parseUnits(amount, 18);
      
      // Find the signer for approval
      const targetSigner = this.availableAccounts.find(acc => acc.address.toLowerCase() === target.toLowerCase());
      if (!targetSigner) {
        console.log("❌ Cannot perform QT: Target address not in available accounts (needed for approval)");
        return;
      }
      
      // Get user approval
      console.log("⏳ Getting target approval...");
      const approveTx = await this.phx.connect(targetSigner).approve(await this.cb.getAddress(), amountWei);
      await approveTx.wait();
      
      // Absorb liquidity
      console.log("⏳ Absorbing liquidity...");
      const absorbTx = await this.cb.absorb(target, amountWei);
      await absorbTx.wait();
      
      console.log("✅ QT Operation Completed!");
      console.log("Target new balance:", ethers.formatUnits(await this.phx.balanceOf(target), 18), "PHX");
      console.log("Central Bank reserves:", ethers.formatUnits(await this.phx.balanceOf(await this.cb.getAddress()), 18), "PHX");
    } catch (error) {
      console.error("❌ QT Operation failed:", error.message);
    }
  }

  async mintAnnualInflation() {
    try {
      console.log(`\n📈 MINT ANNUAL INFLATION (2.5%)`);
      
      // Fast-forward time
      console.log("⏳ Fast-forwarding 1 year...");
      const { network } = require("hardhat");
      await network.provider.send("evm_increaseTime", [365 * 24 * 60 * 60]);
      await network.provider.send("evm_mine");
      
      const beforeBalance = await this.phx.balanceOf(this.owner.address);
      const beforeSupply = await this.phx.totalSupply();
      
      console.log("⏳ Minting inflation...");
      const tx = await this.phx.mintAnnualInflation();
      await tx.wait();
      
      const afterBalance = await this.phx.balanceOf(this.owner.address);
      const afterSupply = await this.phx.totalSupply();
      
      const inflationAmount = afterBalance - beforeBalance;
      console.log("✅ Annual Inflation Minted!");
      console.log("Inflation amount:", ethers.formatUnits(inflationAmount, 18), "PHX");
      console.log("New treasury balance:", ethers.formatUnits(afterBalance, 18), "PHX");
      console.log("New total supply:", ethers.formatUnits(afterSupply, 18), "PHX");
      console.log("Inflation rate: 2.5%");
    } catch (error) {
      console.error("❌ Inflation minting failed:", error.message);
    }
  }

  async emergencyMint() {
    try {
      const amount = await this.getAmountFromUser("Enter emergency mint amount (PHX): ");
      console.log(`\n🚨 EMERGENCY MINT (MAX 5% OF SUPPLY)`);
      
      const amountWei = ethers.parseUnits(amount, 18);
      const currentSupply = await this.phx.totalSupply();
      const maxEmergency = currentSupply / 20n; // 5%
      
      console.log(`Amount: ${amount} PHX`);
      console.log(`Current supply: ${ethers.formatUnits(currentSupply, 18)} PHX`);
      console.log(`Maximum emergency mint: ${ethers.formatUnits(maxEmergency, 18)} PHX`);
      
      if (amountWei > maxEmergency) {
        console.log("❌ Emergency mint exceeds 5% cap!");
        return;
      }
      
      console.log("⏳ Executing emergency mint...");
      const tx = await this.phx.emergencyMint(amountWei);
      await tx.wait();
      
      console.log("✅ Emergency Mint Completed!");
      console.log("New treasury balance:", ethers.formatUnits(await this.phx.balanceOf(this.owner.address), 18), "PHX");
      console.log("New total supply:", ethers.formatUnits(await this.phx.totalSupply(), 18), "PHX");
    } catch (error) {
      console.error("❌ Emergency mint failed:", error.message);
    }
  }

  async showMenu() {
    console.log("\n" + "=".repeat(60));
    console.log("🏦 PHX CENTRAL BANK CONSOLE - OFFICIAL USE ONLY");
    console.log("=".repeat(60));
    console.log("1.  Check System Status");
    console.log("2.  Treasury → Wallet Transfer");
    console.log("3.  Quantitative Easing (QE)");
    console.log("4.  Quantitative Tightening (QT)");
    console.log("5.  Mint Annual Inflation");
    console.log("6.  Emergency Mint");
    console.log("7.  Exit to Main Menu");
    console.log("=".repeat(60));
    console.log("💡 Central Bank Operations - Monetary Policy Tools");
  }

  async handleMenuChoice(choice) {
    switch (choice) {
      case '1':
        await this.checkSystemStatus();
        break;
      case '2':
        await this.treasuryToWallet();
        break;
      case '3':
        await this.quantitativeEasing();
        break;
      case '4':
        await this.quantitativeTightening();
        break;
      case '5':
        await this.mintAnnualInflation();
        break;
      case '6':
        await this.emergencyMint();
        break;
      case '7':
        console.log("👋 Returning to system...");
        this.rl.close();
        process.exit(0);
        break;
      default:
        console.log("❌ Invalid choice. Please select 1-7.");
    }
  }

  async run() {
    console.log("🚀 Starting PHX Central Bank Console...");
    console.log("Make sure Ganache is running on http://127.0.0.1:7545");
    
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
    const bank = new PHXCentralBank();
    await bank.run();
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

module.exports = PHXCentralBank;