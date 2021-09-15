const PrestigeClub = artifacts.require("PrestigeClub");
const PrestigeClubCalculations = artifacts.require("PrestigeClubCalculations");
const SafeMath112 = artifacts.require("SafeMath112");
const CakeClub = artifacts.require("CakeClub");
// const Seller = artifacts.require("AccountExchange");

module.exports = async function(deployer, network, accounts) {

  // deployer.then(function() {
  let vault = await CakeClub.deployed();
  console.log(vault.address);
  // }).then(function(dex) {
  deployer.link(PrestigeClubCalculations, PrestigeClub)
  deployer.link(SafeMath112, PrestigeClub)

  await deployer.deploy(PrestigeClub, vault.address)

  let pc = await PrestigeClub.deployed()

  await vault.setPrestigeClub(pc.address);

  // await dex.setPrestigeClub(pc.address);

  console.log("PC: " + pc.address)
  console.log("CakeClub: " + vault.address)

};
