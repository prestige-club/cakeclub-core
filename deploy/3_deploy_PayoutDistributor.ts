import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {CakeMock, PayoutDistributor} from '../typechain'
import { ethers } from 'hardhat';
import { BigNumber } from 'ethers';
import { users } from '../data/data';

const ether = ethers.utils.parseEther

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    const {deployments, getNamedAccounts} = hre;
    const {deploy} = deployments;

    const {deployer, owner} = await getNamedAccounts();

    //Deploy PrestigeClub

    //   let cake = await ethers.getContractAt("CakeToken", CakeToken.address) as CakeToken
    // let cake = await deploy('CakeMock', {
    //     from: deployer,
    //     args: [],
    //     log: true
    // })
    let cake = {address: "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82"}

    const distributor = await deploy('PayoutDistributor', {
        from: deployer,
        args: [cake.address],
        log: true,
        skipIfAlreadyDeployed: false
    });

    let d = await ethers.getContractAt("PayoutDistributor", distributor.address) as PayoutDistributor
    // let cakeInstance = await ethers.getContractAt("CakeMock", cake.address) as CakeMock

    let sum = BigNumber.from(0)

    let step = 100
    for(let i = 0 ; i < users.length ; i += step){

        let userSlice = users.slice(i, i + step);
        
        let addresses = userSlice.map(x => x.address)
        let payouts = userSlice.map(x => BigNumber.from(x.manualPayout))

        let tx = await d.addPayouts(addresses, payouts)
        await tx.wait();

        console.log()
        // console.log(payouts.reduce((a, b) => a + ", " + ethers.utils.formatEther(b), ""))
        // console.log(addresses.reduce((a, b) => a + ", " + b))
        console.log()

        let sumi = payouts.reduce((a, b) => a.add(b))
        sum = sum.add(sumi)

        console.log("Added " + i + " to " + (i + step))

    }

    // await cakeInstance.mint(sum)
    // await cakeInstance.transfer(d.address, sum)

    console.log(sum.toString())
    // console.log((await cakeInstance.balanceOf(d.address)).toString())

};
export default func;
func.tags = ['Extra'];