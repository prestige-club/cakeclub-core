import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import { ethers } from 'hardhat';
import { CakeClub, ERC20, PrestigeClub } from '../typechain';
import { CakeMock } from '../typechain/CakeMock';
import { Contract } from 'hardhat/internal/hardhat-network/stack-traces/model';
import { DeployResult } from 'hardhat-deploy/dist/types';

const ether = ethers.utils.parseEther

const mode = "bsc" + ""

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts} = hre;
  const {deploy} = deployments;

  const {deployer, owner} = await getNamedAccounts();

  // const CAKE_ADDRESS = "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82"
  const MASTERCHEF_ADDRESS = "0x73feaa1eE314F8c655E354234017bE2193C9E24E"

  //Deploy CakeClub

  const SafeMath = await deploy('SafeMath', {
    from: deployer,
    args: [],
    log: true,
    contract: "@openzeppelin/contracts/math/SafeMath.sol:SafeMath"
  });

  console.log("Deployed SafeMath")
  
  // const Cake = await deploy("CakeMock", {
  //   from: deployer,
  //   args: [],
  // })

  // console.log("Deployed Cake")

  // const Syrup = await deploy("ERC20", {
  //   from: deployer,
  //   args: ["Syrup", "SYRUP"],
  // })
  // console.log("Deployed Syrup")

  // const MasterChef = await deploy("CakeVaultMock", {
  //   from: deployer,
  //   args: [Cake.address]
  // })


  // let masterchef = "0x73feaa1eE314F8c655E354234017bE2193C9E24E"
  // let syrup = "0x009cf7bc57584b7998236eff51b98a168dcea9b0"

  let masterchef = (await ethers.getContract("MasterChef")).address
  let syrup = (await ethers.getContract("SyrupBar")).address
  let Cake = (await ethers.getContract("CakeToken"))

  // let masterchef = MasterChef.address
  // let syrup = Syrup.address

  const CakeClub = await deploy('CakeClub', {
    from: deployer,
    args: [masterchef, syrup],
    libraries: {
      SafeMath: SafeMath.address
    },
    log: true
  })

  //Deploy PrestigeClub

  const SafeMath112 = await deploy('SafeMath112', {
    from: deployer,
    args: [],
    log: true,
  });

  const PCC = await deploy('PrestigeClubCalculations', {
    from: deployer,
    args: [],
    log: true,
  });

  const PrestigeClub = await deploy('PrestigeClub', {
    from: deployer,
    args: [CakeClub.address],
    libraries: {
      SafeMath: SafeMath112.address,
      PrestigeClubCalculations: PCC.address
    },
    log: true
  })

  let cakeClub = await ethers.getContract("CakeClub") as CakeClub
  await cakeClub.setPrestigeClub(PrestigeClub.address);

  // if(hre.network.name === "ganache"){
  //   let cake = (await ethers.getContract("CakeMock")) as CakeMock
  //   await cake.mint(ether("10"))
  // }
  
  console.log("CAKECLUB_ADDRESS = \"" + PrestigeClub.address + "\"")
  console.log("CAKE_ADDRESS = \"" + Cake.address + "\"")
  console.log("CAKE_VAULT_ADDRESS = \"" + cakeClub.address + "\"")
  // console.log("Masterchef: " + MasterChef.address)

  let cake = await ethers.getContractAt("ERC20", Cake.address) as ERC20
  await cake.approve(PrestigeClub.address, ethers.utils.parseEther("100000000"))

  let prestige = await ethers.getContract("PrestigeClub") as PrestigeClub;
  // await prestige['recieve(uint112)'](ethers.utils.parseEther("10"))

};
export default func;
func.tags = ['Token'];
func.dependencies = ['Farms']