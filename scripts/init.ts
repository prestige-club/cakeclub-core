const hardhat = require("hardhat")
import { BigNumber } from '@ethersproject/bignumber';
import { ethers } from 'hardhat';
import { users } from '../data/data';
import { CakeClub, CakeToken, PrestigeClub } from '../typechain';
import { CakeMock } from '../typechain/CakeMock';

async function f(){

    let cake = await ethers.getContract("CakeMock") as CakeMock
    console.log("Address: " + (await ethers.getSigners())[0].address)
    await cake.mint(ethers.utils.parseEther("10"))

    let prestige = await ethers.getContract("PrestigeClub") as PrestigeClub
    await prestige['recieve(uint112)'](ethers.utils.parseEther("2"))

    console.log("Done")

};

async function _import(){

    let prestige = await ethers.getContract("PrestigeClub") as PrestigeClub
    console.log(prestige.address)

    let depositSum = BigNumber.from(0)
    let lastPosition = 0
    let downlineSum = BigNumber.from(0)

    let step = 20
    for(let i = 0 ; i < 80 ; i += step){

        let userSlice = users.slice(i, i + step);
        
        let addresses = userSlice.map(x => x.address)
        let deposits = userSlice.map(x => BigNumber.from(x.deposit))
        let referrer = userSlice.map(x => x.referer)
        let downlineBonusRaw = userSlice.map(x => x.downlineBonus)
        let qualifiedPools = userSlice.map(x => x.qualifiedPools)
        let downlineBonus = downlineBonusRaw.map((db, i) => db + (qualifiedPools[i] * 16));
        let volumes = userSlice.map(x => x.volumes.map(y => BigNumber.from(y)) as [BigNumber, BigNumber, BigNumber, BigNumber, BigNumber])

        console.log((await prestige.getUserList()).length)
        console.log(i + 1)

        await prestige._import(addresses, deposits, referrer, i + 1, downlineBonus, volumes, {gasLimit: 5000000})
        lastPosition = i + step + 1;
        depositSum = depositSum.add(deposits.reduce((a, b) => a.add(b)))
        for(let j = 0 ; j < downlineBonusRaw.length ; j++){
            for(let k = 0 ; k < downlineBonusRaw[j] ; k++){
                downlineSum = downlineSum.add(volumes[j][k].mul(downlineBonusRaw[j] - k))
            }
        }

        console.log("Imported " + i + " to " + (i + step))

    }

    await prestige.reCalculateImported(lastPosition, depositSum, downlineSum);

    let cakeClub = await ethers.getContract("CakeClub") as CakeClub
    let cake = await ethers.getContract("CakeToken") as CakeToken
    await cake.transfer(cakeClub.address, depositSum)
    await cakeClub.initialInvest(depositSum, BigNumber.from(0))

    await prestige.pushPoolState()

}
// f()
_import()