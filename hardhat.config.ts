import { task } from "hardhat/config";
import "@nomiclabs/hardhat-waffle";
import '@typechain/hardhat'
import 'hardhat-tracer'
import "hardhat-gas-reporter"
import 'hardhat-deploy'
import '@nomiclabs/hardhat-ethers'
import { projectId, mnemonics, pk } from './secrets.json'
// import '@eth-optimism/smock/build/src/plugins/hardhat-storagelayout'

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
      // forking: {
      //   url: "https://apis.ankr.com/88ee9bef6d9d4f9bb2b571efc47dd22c/85045f66451e39080e9907ca8d1f6fb1/binance/full/main",
        // blockNumber: 10959083
      // }
    },
    ganache: {
      url: "http://127.0.0.1:8545",
      accounts: {
        mnemonic: mnemonics,
        count: 10
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
  namedAccounts: {
    deployer: 0,
    owner: 1,
  },
  paths: {
    sources: "./contracts",
    tests: "./test_ts",
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