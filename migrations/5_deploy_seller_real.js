const PrestigeClub = artifacts.require("PrestigeClub");
const Seller = artifacts.require("AccountExchange");
const WETH = artifacts.require("WETH");

module.exports = async function(deployer, network, accounts) {

    // let pc = await PrestigeClub.at("0x3211096255950aCE4b4D89adc94fc0fE17e0AEfc")
    let pc = await PrestigeClub.deployed()

    /*
    let weth_addr = "";
    if(network == "mumbai"){

        weth_addr = "0xA6FA4fB5f76172d178d61B04b0ecd319C5d1C0aa";

    }else if(["develop", "development", "local", "ganache", "gnache"].includes(network)){
        let weth = await WETH.deployed(); //TODO Replace WETH
        weth_addr = weth.address;
    }else if(network == "matic" || network == "matic-fork") {

        weth_addr = "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619";
    
    }else{
        console.log("Wrong Network")
    }

    // await deployer.deploy(Seller, "0x4406deba31861a67d291189ac74f734bb0b1cef2"); //{from: accounts[1]}
    await deployer.deploy(Seller, weth_addr, pc.address); //{from: accounts[1]}

    let seller = await Seller.deployed()
    await pc.setSellingContract(seller.address);
    console.log("Seller: " + seller.address);*/

}