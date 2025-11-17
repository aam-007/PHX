require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.20",
  networks: {
    ganache: {
      url: "http://127.0.0.1:7545",
      accounts: {
        mnemonic: "filter entry flat control mass drip sugar bench cost decade shop film", // Or use private keys
        // Or use this for private key:
        // accounts: ["YOUR_PRIVATE_KEY_HERE"]
      }
    }
  }
};



