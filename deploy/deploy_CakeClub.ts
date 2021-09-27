import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import { ethers } from 'hardhat';
import { CakeClub, ERC20 } from '../typechain';
import { CakeMock } from '../typechain/CakeMock';

const ether = ethers.utils.parseEther

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts} = hre;
  const {deploy} = deployments;

  const {deployer, owner} = await getNamedAccounts();

  //Deploy CakeClub

  const SafeMath = await deploy('SafeMath', {
    from: deployer,
    args: [],
    log: true,
  });

  console.log("Deployed SafeMath")

  const Cake = await deploy("CakeMock", {
    from: deployer,
    args: [],
  })

  console.log("Deployed Cake")

  const Syrup = await deploy("ERC20", {
    from: deployer,
    args: ["Syrup", "SYRUP"],
  })
  console.log("Deployed Syrup")

  const MasterChef = await deploy("CakeVaultMock", {
    from: deployer,
    args: [Cake.address]
  })

  // let masterchef = "0x73feaa1eE314F8c655E354234017bE2193C9E24E"
  // let syrup = "0x009cf7bc57584b7998236eff51b98a168dcea9b0"
  let masterchef = MasterChef.address
  let syrup = Syrup.address

  const CakeClub = await deploy('CakeClub', {
    from: deployer,
    args: [masterchef, syrup],
    libraries: {
      SafeMath: SafeMath.address
    }
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
    }
  })

  let cakeClub = await ethers.getContract("CakeClub") as CakeClub
  await cakeClub.setPrestigeClub(PrestigeClub.address);

  if(hre.network.name === "hardhat"){
    let cake = (await ethers.getContractAt("CakeMock", Cake.address)) as CakeMock
    await cake.mint(ether("10"))
  }



};
export default func;
func.tags = ['Token'];