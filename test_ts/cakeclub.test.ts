import { expect } from "chai";
import { deployContract, deployMockContract } from "ethereum-waffle";
import { BigNumber, Contract, ContractFactory, Signer } from "ethers";
import { ethers, deployments, network } from "hardhat";
import { CakeClub, CakeClub__factory, CakeVaultMock, CakeVaultMock__factory, ERC20__factory, PrestigeClub, PrestigeClub__factory } from "../typechain";
import { CakeMock } from "../typechain/CakeMock";
import { smockit } from "@eth-optimism/smock";

const eth = ethers.utils.parseEther

// async function initContract(accounts){

//     const contract = await prestigeclub.deployed();
//     const cake = await ethers.getContract("CakeMock") as CakeMock
  
//     await weth.deposit({from: accounts[15], value: web3.utils.toWei("3000", "ether")})
//     await weth.approve(dexC.address, web3.utils.toWei("3000", "ether"))
//     await weth.transfer(dexC.address, web3.utils.toWei("400", "ether"), {from: accounts[15]})
  
//     for(let i = 0 ; i < accounts.length / 2 ; i++){
//       await weth.deposit({from: accounts[i], value: web3.utils.toWei("90", "ether")})
//       await weth.approve(dexC.address, web3.utils.toWei("90", "ether"), {from: accounts[i]})
//       await dexC.buyPeth(web3.utils.toWei("90", "ether"), {from: accounts[i]})
//     }
//     return [dexC, contract];
    
// }

describe("CakeClub Tests", () => {

    let signers : Signer[];
    let addresses : string[] = []; 
    let accounts: string[];
    let cake: CakeMock
    let prestige: PrestigeClub
    let cakeClub: CakeClub

    beforeEach(async () => {
        signers = await ethers.getSigners();
        for(let i = 0 ; i < signers.length ; i++){
            addresses.push(await signers[i].getAddress())
        }
        accounts = addresses;

        cake = await ethers.getContract("CakeMock") as CakeMock
        prestige = await ethers.getContract("PrestigeClub") as PrestigeClub
        cakeClub = await ethers.getContract("CakeClub") as CakeClub
    })

    it("CakeClub-Interface-Integration", async function() {
        console.log("Accounts[0]: " + accounts[0])

        expect((await cakeClub.depositedCake())).to.equal(0);
        expect((await prestige.depositSum())).to.equal(0);

        const vault = cakeClub
        const vaultRef = await ethers.getContract("CakeVaultMock") as CakeVaultMock

        let x = await cake.balanceOf("0xd46f7E32050f9B9A2416c9BB4E5b4296b890A911")
        console.log(x.toString())

        // await cake.transfer(accounts[0], web3.utils.toWei("1000", "ether"), {from: "0xd46f7E32050f9B9A2416c9BB4E5b4296b890A911"})
        cake = cake.connect(signers[0])
        prestige = prestige.connect(signers[0])
        await cake.mint(eth("1000"))
        await cake.approve(prestige.address, eth("1000"))
        await prestige["recieve(uint112)"](eth("1"))

        let userinfo = await vaultRef.userInfo(0, vault.address)
        console.log(JSON.stringify(userinfo));

        await network.provider.send("evm_increaseTime", [10 * 60])
        await network.provider.send("evm_mine", [])

        let before = await cake.balanceOf(accounts[0])

        await vault.updateEstimation()

        x = await vaultRef.pendingCake(0, vault.address)
        console.log("Pending Cake:" + x.toString())

        await prestige.withdraw(eth("0.001"))

        let user = await prestige.users(accounts[0])
        console.log("Payout: " + user["payout"].toString())
        let payout = user["payout"].add(eth("0.001"));
        let expectedCakeWithdrawal = x.mul(eth("1")).div(payout).mul(eth("0.0001")).div(eth("1"))

        let after = await cake.balanceOf(accounts[0])
        let pendingafter = await vaultRef.pendingCake(0, vault.address)

        console.log("Before / After:")
        console.log(before.toString())
        console.log(after.toString())

        let diff = after.sub(before).toString()
        expect(diff).to.equal(expectedCakeWithdrawal)
        console.log("Diff: " + diff + " should be roughly " + expectedCakeWithdrawal.toString())

        expect(pendingafter).to.equal(0);

        // expect(1).equal(2);
    })

    it("Test correct Daily Rate", async function() {

        // expect((await cakeClub.depositedCake())).to.equal(0);
        let prestigeMock = await deployMockContract(signers[0], PrestigeClub__factory.abi);
        await cakeClub.setPrestigeClub(prestigeMock.address);
        let doTest = async (downline: BigNumber, expected: number) => {
            console.log("Testing Downline " + ethers.utils.formatEther(downline) + "ETH -> " + expected)
            await prestigeMock.mock.depositSum.returns(eth("10"))
            await prestigeMock.mock.downlinePayoutSum.returns(downline)
    
            let rate = await cakeClub.getDailyRate();
            expect(rate.div(BigNumber.from("1000000000000"))).to.equal((expected))
        }

        await doTest(eth("10"), 800+250+390+25)
        await doTest(eth("20"), 800+250+390+50)
        await doTest(eth("0"), 800+250+390)

    });

    it("Test correct output", async function () {

        //TODO Make new describe and remove the deployment shit in this method

        const vaultRef = await ethers.getContract("CakeVaultMock") as CakeVaultMock
        let cakeClub = await deploy<CakeClub__factory, CakeClub>("CakeClub", signers[0], [vaultRef.address, cake.address])
        await cakeClub.setPrestigeClub(await signers[0].getAddress())
        cake = cake.connect(signers[0])
        await cake.mint(eth("10"))
        await cake.transfer(cakeClub.address, eth("3.163")) //Some random value
        await cakeClub.invest();

        await network.provider.send("evm_increaseTime", [6 * 60]) // Payout interval 5 min
        await network.provider.send("evm_mine", [])

        let pendingCake = (await vaultRef.pendingCake(0, cakeClub.address)).add(await cakeClub.alreadyWithdrawn());
        let estimatedPeth = await cakeClub.estimatedPeth()
        await cakeClub.updateEstimation()

        let expected = pendingCake.mul(eth("1")).div(estimatedPeth)
        let output = await cakeClub.output(eth("1"))
        expect(expected).to.equal(output)

    })

    it2("Downlinebonus test", async function(){
    
        let one_ether = eth("40");
    
        let base_deposit = one_ether;
    
        //1. Test normal downline without difference effect
    
        await prestige.triggerCalculation();
        await prestige.triggerCalculation();
        await prestige.connect(signers[1])["recieve(uint112)"](one_ether);
    
        await prestige.connect(signers[2])["recieve(uint112,address)"](one_ether, accounts[1]);
        
        await prestige.connect(signers[3])["recieve(uint112,address)"](one_ether, accounts[1]);
    
        //await account4["recieve(address)"](accounts[2].address, overrides);
    
        await network.provider.send("evm_increaseTime", [10 * 60])
        
        await prestige.connect(signers[4])["recieve(uint112,address)"](one_ether, accounts[2]);
    
        let poolsnum = 7;
        let downlinestage = 4;
        let downlinePercentage = 260;
    
        let streamline = (base_deposit.mul(3)).div(3).mul(2)
        console.log("Streamline: " + streamline)
        let poolpayout = streamline .div( 1000000 ).mul(130) 
        let interest = base_deposit .mul( 1000 ).mul((poolsnum > 3 ? 1.5 : 1));
        let downline = base_deposit.mul(2).div(1000000).mul( downlinePercentage);
        let expected = interest.add(base_deposit.mul(2).div(10000).mul(5)) .add (poolpayout.mul(poolsnum)) .add(downline)
    
        console.log("Expected: interest: " + interest + " directs " + (base_deposit .div(10000).mul(5)).mul(2) + " pool " + poolpayout.mul(poolsnum) + " down: " + downline)
    
        let userdata = await prestige.users(accounts[1])
        expected = expected.div(1000000)
        expect(userdata.payout.div(1000000).toNumber()).to.approximately(expected.toNumber(), expected.mul(2).div(1000).toNumber())
    
        expect(userdata.qualifiedPools).equal(poolsnum);
        expect(userdata.downlineBonus).equal(downlinestage);
    
        //2. Test Downline with difference
    
        await prestige.connect(signers[5])["recieve(uint112,address)"](one_ether, accounts[2]);
    
        await network.provider.send("evm_increaseTime", [10 * 60])
    
        await prestige.connect(signers[6])["recieve(uint112,address)"](one_ether, accounts[4]);
    
        let userdata1 = await prestige.users(accounts[1]);
        //let userdata2 = await account2.getUserData();
    
        let streamline1 = (base_deposit .mul(5)).div(4).mul(3) //5 bc of double entry of 4
        console.log("Streamline1: " + streamline1)
        let poolpayout1 = (streamline1 .mul(130).div(1000000)).div(2).mul(poolsnum)
        let downline1 = (base_deposit.mul(2)).div(1000000).mul( downlinePercentage)
        let expected1 = expected.add(interest.add(base_deposit.mul(2).div(10000).mul(5))) .add (poolpayout1) .add( downline1 )
        expected1 = expected1.div(1000000)
        console.log("Expected: interest: " + interest + " directs " + (base_deposit.div(10000).mul(5)).mul(2) + " pool " + poolpayout1 + " down: " + downline1)
        expect(userdata1.payout.div(1000000).toNumber()).to.approximately(expected1.toNumber(), expected.mul(2).div(1000).toNumber())
    
        expect(userdata1.qualifiedPools).equal(poolsnum);
        expect(userdata1.downlineBonus).equal(downlinestage);
    
        for(let i = 1 ; i <= 6 ; i++){
          let info = await prestige.users(accounts[i])
          console.log(i + ":")
          const v = {
            address: accounts[i],
            deposit: info.deposit.toString(),
            position: info.position,
            referer: info.referer,
            qualifiedPools: info.qualifiedPools,
            downlineBonus: info.downlineBonus};
          console.log(JSON.stringify(v))
    
          let volumes = (await prestige.getDetailedUserInfos(accounts[i]))[1]
          console.log(volumes.map(x => x.toString()))
    
        }

        //3. Test upgrade 2nd Level
    
      });

    it2("CakeClub Calculation Test", async () => {

        // const [dexC, contract] = await initContract(accounts);

        for(let i = 0 ; i < accounts.length ; i++){
            let cakeS = cake.connect(signers[i])
            await cakeS.mint(ethers.utils.parseEther("90"))
            await cakeS.approve(prestige.address, ethers.utils.parseEther("90"))
        }

        let min_deposit = BigNumber.from("20000");
        let one_ether = eth("1"); //1000

        // let base_deposit = min_deposit.div(20).mul(19);
        let ether_deposit = one_ether;

        //1. Test normal downline without difference effect

        // let x = JSON.stringify(contract).substr(0, 10000);


        await prestige.connect(signers[1])['recieve(uint112)'](one_ether.mul(3));

        await prestige.connect(signers[2])["recieve(uint112,address)"](1000, accounts[1]);
        
        await prestige.connect(signers[3])["recieve(uint112,address)"](min_deposit, accounts[2]);

        await prestige.connect(signers[4])["recieve(uint112,address)"](one_ether, accounts[1]);

        await prestige.connect(signers[5])["recieve(uint112,address)"](one_ether, accounts[3]);

        expect((await prestige.getDownlinePayout(accounts[5])).toNumber()).to.equal(0);
        expect((await prestige.getDownlinePayout(accounts[4])).toNumber()).to.equal(0);
        expect((await prestige.getDownlinePayout(accounts[2])).toNumber()).to.equal(0);

        expect((await prestige.getDownlinePayout(accounts[3])).toString()).to.equal((ether_deposit.div(1000000).mul(100)).toString());

        let expected = (ether_deposit.mul(160)).add(ether_deposit.mul(260)).div(1000000).div(1000000)
        expect((await prestige.getDownlinePayout(accounts[1])).div(1000000).toNumber()).to.approximately(expected.toNumber(), expected.mul(2).div(1000).toNumber()); // 2 1000ands

        console.log(" --------------- \nPart2 ")
        let res = await prestige.connect(signers[2])["recieve(uint112)"](one_ether.mul(3));

        expect((await prestige.getDownlinePayout(accounts[3])).toString()).equal((ether_deposit.div(1000000).mul(100)).toString());

        expected = (ether_deposit.mul(160).div(1000000)).div(1000000)
        expect((await prestige.getDownlinePayout(accounts[2])).div(1000000).toNumber()).to.approximately(expected.toNumber(), expected.mul(2).div(1000).toNumber());

        expected = (ether_deposit.mul(4 * 50)).add(ether_deposit.mul(260)).div(1000000).div(1000000)
        expect((await prestige.getDownlinePayout(accounts[1])).div(1000000).toNumber()).to.approximately(expected.toNumber(), expected.mul(2).div(1000).toNumber());

    })

    it2("CakeClub Integration Test", async () => {

        // let cake_addr = "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82"
        // cake = await ERC20__factory.connect(cake_addr, signers[0])
        cake = await ethers.getContract("CakeMock") as CakeMock

        console.log("" + (await cake.balanceOf(await signers[0].getAddress())).toString())

        let z = "0x0000000000000000000000000000000000000000"
        
        await prestige._import(
            ["0xe6b1b029feDe0F74787bcA48F730146f8713Cc88", "0x3BeAce27eb2a022A19D1ddC5b827c433E7a1EFf3", "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", "0xCcd63970824546d0B4b8A1acE3dF4638B803cC1e"],
            [eth("1000"), eth("1000"), eth("100"), eth("100")],
            [z, "0xe6b1b029feDe0F74787bcA48F730146f8713Cc88", "0x3BeAce27eb2a022A19D1ddC5b827c433E7a1EFf3", "0xe6b1b029feDe0F74787bcA48F730146f8713Cc88"],
            1, [3, 2, 0, 0], [[eth("100"),0,eth("1100"),0,0], [eth("100"),0,0,0,0], [0,0,0,0,0], [0,0,0,0,0]]
        )

        await prestige.reCalculateImported(2, eth("1100"), eth("0")) //TODO 3rd arg
        await cake.mint(eth("1100"))
        await cake.transfer(cakeClub.address, eth("1100"))
        await cakeClub.initialInvest(eth("1100"))

        await prestige.transferOwnership("0x3BeAce27eb2a022A19D1ddC5b827c433E7a1EFf3")
        await cakeClub.transferOwnership("0x3BeAce27eb2a022A19D1ddC5b827c433E7a1EFf3")

        cake = cake.connect(signers[3])
        let prestigeSigner3 = prestige.connect(signers[3])

        console.log(await addresses[3])

        await cake.mint(eth("1"))
        await cake.approve(prestige.address, eth("1"))
        await prestigeSigner3["recieve(uint112,address)"](eth("1"), "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");

        await network.provider.send("evm_increaseTime", [6 * 3600])

        // await prestigeSigner3.triggerCalculation()
        // await prestigeSigner3.triggerPayoutUpdate(addresses[3])
        let payout = (await prestigeSigner3.users(addresses[3])).payout
        console.log(payout.toString())
        await prestigeSigner3.withdraw(payout)

        console.log((await cake.balanceOf(addresses[3])).toString())
        payout = (await prestigeSigner3.users(addresses[3])).payout
        console.log(payout.toString())
    })

})

function it2(s: string, x: any){}

async function deploy<F extends ContractFactory, V extends Contract>(name: string, signer: Signer, args: any[] = []) : Promise<V>{
    const factory = ((await ethers.getContractFactory(name, signer)) as unknown) as F;
    let x = (await factory.deploy(...args)) as unknown as V;
    await x.deployed()
    return x
}