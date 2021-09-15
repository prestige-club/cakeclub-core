const PrestigeClub = artifacts.require("PrestigeClub");
const PrestigeClubCalculations = artifacts.require("PrestigeClubCalculations");
const SafeMath112 = artifacts.require("SafeMath112");
// const PEthDex = artifacts.require("PEthDex");
// const Seller = artifacts.require("AccountExchange");

module.exports = function(deployer, network, accounts) {

  deployer.deploy(SafeMath112)//.then(() => {

  deployer.link(SafeMath112, PrestigeClubCalculations)
  deployer.deploy(PrestigeClubCalculations)

};
