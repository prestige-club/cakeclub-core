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
    let cake = await deploy('CakeMock', {
        from: deployer,
        args: [],
        log: true
    })

    const distributor = await deploy('PayoutDistributor', {
        from: deployer,
        args: [cake.address],
        log: true,
        skipIfAlreadyDeployed: false
    });

    let d = await ethers.getContractAt("PayoutDistributor", distributor.address) as PayoutDistributor
    let cakeInstance = await ethers.getContractAt("CakeMock", cake.address) as CakeMock

    for(let i = 0 ; i < 10 ; i += 10){
        let addr = [];
        let amounts = [];

        addr.push(deployer)
        amounts.push(ether("10"))

        for(let j = i ; j < i + 10 ; j++){
            let user = users[j];
            addr.push(user.address)
            amounts.push(BigNumber.from(user.manualPayout))
        }
        await d.addPayouts(addr, amounts)

        console.log()
        console.log(amounts.reduce((a, b) => a + ", " + ethers.utils.formatEther(b), ""))
        console.log(addr.reduce((a, b) => a + ", " + b))
        console.log()

        let sum = amounts.reduce((a, b) => a.add(b))

        await cakeInstance.mint(sum)
        await cakeInstance.transfer(d.address, sum)
    }

    console.log((await cakeInstance.balanceOf(d.address)).toString())

};
export default func;
func.tags = ['Extra'];