const SafeMath = artifacts.require("SafeMath");
const CakeClub = artifacts.require("CakeClub");
const WETH = artifacts.require("WETH");
const CakeClone = artifacts.require("CakeClone");
const CakeVaultMock = artifacts.require("CakeVaultMock");

module.exports = async function(deployer, network, accounts) {
  // deployer.deploy(ConvertLib);
  // deployer.link(ConvertLib, MetaCoin);
  // deployer.deploy(MetaCoin);

  deployer.deploy(SafeMath);
  deployer.link(SafeMath, CakeClub);
  
  let cake_addr = "0x73feaa1ee314f8c655e354234017be2193c9e24e"

  if(network == "mumbai"){

    // weth_addr = "0xA6FA4fB5f76172d178d61B04b0ecd319C5d1C0aa";

  }else if(["develop", "development", "local", "ganache", "gnache", "testnet"].includes(network)){

    await deployer.deploy(CakeClone);
    let we = await CakeClone.deployed(); 
    console.log("CakeClone: " + we.address)

    await deployer.deploy(CakeVaultMock, we.address);
    let vault = await CakeVaultMock.deployed();
    console.log("CakeVault: " + vault.address)
    cake_addr = vault.address;

    // for(let i = 0 ; i < 5 ; i++){
    //   await we.deposit({value: web3.utils.toWei("10", "ether"), from: accounts[i]});
    // }

  }else if(network == "matic" || network == "matic-fork") {

    // weth_addr = "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619";

  }else{
    console.log("Network is not support from Migration 2");
  }

  await deployer.deploy(CakeClub, cake_addr);

};
