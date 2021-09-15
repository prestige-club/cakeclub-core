import { task } from "hardhat/config";
import "@nomiclabs/hardhat-waffle";
import '@typechain/hardhat'
import 'hardhat-tracer'
import "hardhat-gas-reporter"

task("accounts", "Prints the list of accounts", async (args, hre) => {
  const accounts = await hre.ethers.getSigners();
  
  for (const account of accounts) {
    console.log(account.address);
  }
});

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
 export default {
  networks: {
    hardhat: {
      forking: {
        url: "https://mainnet.infura.io/v3/a6ffe81db45d4f4091967cee2578920f",
        blockNumber: 13229707
      }
    }
  },
  solidity: {
    version: "0.6.8",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200000
      }
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  mocha: {
    timeout: 200000
  },
  typechain: {
    outDir: "./typechain",
    target: "ethers-v5",
    alwaysGenerateOverloads: false
  }
};