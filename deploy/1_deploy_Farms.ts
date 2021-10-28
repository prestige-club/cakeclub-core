import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import { ethers } from 'hardhat';
import { CakeClub, ERC20, PrestigeClub, SyrupBar, CakeToken, MasterChef } from '../typechain';
import { BigNumber } from 'ethers';

const ether = ethers.utils.parseEther

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const {deployments, getNamedAccounts} = hre;
  const {deploy} = deployments;

  const {deployer, owner} = await getNamedAccounts();

  //Deploy PrestigeClub

  const CakeToken = await deploy('CakeToken', {
    from: deployer,
    args: [],
    log: true,
  });

  const SyrupBar = await deploy('SyrupBar', {
    from: deployer,
    args: [CakeToken.address],
    log: true,
  });

  let cake = await ethers.getContractAt("CakeToken", CakeToken.address) as CakeToken
  let bar = await ethers.getContractAt("SyrupBar", SyrupBar.address) as SyrupBar

  let number = parseInt(BigNumber.from(await hre.network.provider.send("eth_blockNumber", [])).toString())
  console.log("Block: " + number)

  const MasterChef = await deploy('MasterChef', {
    from: deployer,
    args: [CakeToken.address, SyrupBar.address, "0x7A894A47330E61b76D4Be5D9cD0395802f6D00A0", ethers.utils.parseEther("1"), number],
    log: true,
  });

  await cake["mint(address,uint256)"](deployer, ethers.utils.parseEther("1000000"))

  console.log("Minted: " + ethers.utils.formatEther((await cake.balanceOf(deployer))) + " CAKE")

  await cake.transferOwnership(MasterChef.address)
  await bar.transferOwnership(MasterChef.address)

  // let chef = await ethers.getContract("MasterChef") as MasterChef

  // await cake.approve(chef.address, ethers.utils.parseEther("10"))
  // await chef.enterStaking(ethers.utils.parseEther("9"))
  // console.log(await chef.userInfo(0, deployer))
  // console.log(await chef.poolInfo(0))
  // console.log(ethers.utils.formatEther(await chef.pendingCake(0, deployer)))
  // console.log("Block: " + parseInt(BigNumber.from(await hre.network.provider.send("eth_blockNumber", [])).toString()))

  // await hre.network.provider.send("evm_mine", [])
  // await hre.network.provider.send("evm_mine", [])
  // await hre.network.provider.send("evm_mine", [])
  // await hre.network.provider.send("evm_mine", [])
  // await hre.network.provider.send("evm_mine", [])

  // console.log("Block: " + parseInt(BigNumber.from(await hre.network.provider.send("eth_blockNumber", [])).toString()))
  // console.log(await chef.userInfo(0, deployer))
  // console.log(ethers.utils.formatEther(await chef.pendingCake(0, deployer)))

  // const PrestigeClub = await deploy('PrestigeClub', {
  //   from: deployer,
  //   args: [CakeClub.address],
  //   libraries: {
  //     SafeMath: SafeMath112.address,
  //     PrestigeClubCalculations: PCC.address
  //   }
  // })

  // let cake = await ethers.getContractAt("ERC20", CAKE_ADDRESS) as ERC20
  // await cake.approve(PrestigeClub.address, ethers.utils.parseEther("100000000"))

  // let prestige = await ethers.getContract("PrestigeClub") as PrestigeClub;
  // await prestige['recieve(uint112)'](ethers.utils.parseEther("10"))

};
export default func;
func.tags = ['Farms'];