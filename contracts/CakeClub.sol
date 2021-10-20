pragma solidity >=0.6.0 <0.8.0;

// SPDX-License-Identifier: MIT

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "./ICakeClub.sol";

interface CakeVault{
    function cake() external view returns (address);
    function enterStaking(uint256 amount) external;
    function leaveStaking(uint256 amount) external;
    function pendingCake(uint256 _pid, address _user) external view returns (uint256);
    function userInfo(uint256 _pid, address _user) external view returns (uint256, uint256);
}

interface IPrestigeClub{
    function depositSum() external view returns (uint128);
    function totalDownlineVolume() external view returns (uint128);
}

contract CakeClub is Ownable(){ //, ICakeClub

    using SafeMath for uint256;

    IERC20 public cake;
    CakeVault vault;
    IPrestigeClub prestigeclub;

    constructor(address _vault, address _syrup) public {
        vault = CakeVault(_vault);
        cake = IERC20(vault.cake());
        
        cake.approve(_vault, ~uint256(0));
        IERC20(_syrup).approve(_vault, ~uint256(0));

        estimatedPeth = 1000;
        rewardLastEstimation = 2000;
    }

    uint256 public alreadyWithdrawn;
    uint256 public depositedCake;
    uint256 public estimatedPeth;
    uint256 public rewardLastEstimation;

    uint256 constant payout_interval = 15 minutes;//1 days;
    uint256 last_payout_calculation = block.timestamp - (block.timestamp % payout_interval);

    uint256 dust = 100000;

    uint256 constant ownerShares = 15;
    uint256 public ownerProvision;

    event Log(string title, uint256 value);

    event Withdrawal(address indexed addr, uint256 peth, uint256 cake);

    function getDailyRate() public view returns (uint256) {

        //1e12 here because 1e18 is 100% -> prestigeclub percentages are ppm -> *1e12
        //And 2 seperate 1e12 * x because downlineRate shoudl be as exact as possible without truncations
        uint256 downlineRate = uint256(1e12).mul(uint256(prestigeclub.totalDownlineVolume()).mul(25)).div(uint256(prestigeclub.depositSum()));

        return
        uint256((800 + //Interest
        250 + //Directs
        390 //Pool (65 * 6)
         ) * 1e12)
        .add(downlineRate);
    }

    /**
        Withdraws pending Cake Rewards
        @return Returns amount of withdrawn Rewards
    */
    function _withdrawRewards() internal returns (uint256) {
        uint256 balance = cake.balanceOf(address(this));
        vault.leaveStaking(0);
        uint256 diff = cake.balanceOf(address(this)).sub(balance);
        alreadyWithdrawn = alreadyWithdrawn.add(diff);
        return diff;
    }

    function invest() public onlyPrestige {
        uint256 balance = cake.balanceOf(address(this));

        uint256 rewards = _withdrawRewards();

        //Invest into Masterchef
        vault.enterStaking(balance + rewards);

        depositedCake += balance;
    }

    function totalProfit() public view returns (uint256) {
        return vault.pendingCake(0, address(this)).add(alreadyWithdrawn);
    }

    //Note This function is only used by the frontend
    function outputWithEstimation(uint256 peth) public view returns (uint256){
        uint pethEstimation = estimatedPeth;
        uint rewards = rewardLastEstimation;

        uint dayz = (block.timestamp.sub(last_payout_calculation)) / payout_interval; //payout_interval will never be 0
        if(dayz > 0){
            pethEstimation = pethEstimation.add(uint256(prestigeclub.depositSum()).mul(getDailyRate()).mul(dayz).div(1e18));
            rewards = totalProfit();
        }

        return 1 ether * peth / pethEstimation * rewards / 1 ether;
    }

    function output(uint256 peth) public view returns (uint256) {
        return uint256(1 ether).mul(peth).div(estimatedPeth).mul(rewardLastEstimation) / 1 ether;
    }

    function withdraw(uint256 peth, address to) public onlyPrestige {

        updateEstimation();
        uint256 cakeAmount = output(peth);

        uint256 pending = vault.pendingCake(0, address(this));
        // uint256 pending = pendingTotal * 85 / 100;
        uint256 withdrawAmount = 0;
        if(pending < cakeAmount){ //Since compounding will occur, withdrawal of Stake is possible
            withdrawAmount = cakeAmount.sub(pending);
        }

        vault.leaveStaking(withdrawAmount);

        alreadyWithdrawn = alreadyWithdrawn.add(pending);

        uint256 ownerSharesC = cakeAmount * ownerShares / 100; //ownerShares can´t be in the range of overflows
        
        ownerProvision += ownerSharesC;
        cake.transfer(to, cakeAmount.sub(ownerSharesC));

        uint256 balanceLeft = cake.balanceOf(address(this));
        if(balanceLeft > 0){
            vault.enterStaking(balanceLeft);
        }

        emit Withdrawal(to, peth, cakeAmount);

        (uint256 deposit, ) = vault.userInfo(0, address(this));
        require(deposit >= depositedCake, "Vault Deposit under total deposits");

    }

    function compound() external {

        _withdrawRewards();
        uint256 balance = cake.balanceOf(address(this));
        vault.enterStaking(balance);

    }

    function updateEstimation() public {

        while(block.timestamp > last_payout_calculation + payout_interval){

            estimatedPeth = estimatedPeth.add(uint256(prestigeclub.depositSum()).mul(getDailyRate()).div(1e18));
            rewardLastEstimation = totalProfit();

            last_payout_calculation += payout_interval;
        }

    }

    function setPrestigeClub(address prestige) external onlyOwner {
        prestigeclub = IPrestigeClub(prestige);
    }

    function payoutProvision() external onlyOwner {
        cake.transfer(owner(), ownerProvision);
    }

    function initialInvest(uint256 amount, uint256 importedRewards) external onlyOwner {

        if(importedRewards > 0){
            require(alreadyWithdrawn == 0, "Cant import rewards twice");
        }

        uint256 pending = vault.pendingCake(0, address(this));

        //Invest into Masterchef
        vault.enterStaking(amount); //Expects that cake already lie on address(this)

        alreadyWithdrawn = alreadyWithdrawn.add(pending).add(importedRewards);

        depositedCake = depositedCake.add(amount);
    }

    modifier onlyPrestige() {
        require(msg.sender == address(prestigeclub), "Caller not PrestigeClub Contract");
        _;
    }


    // ---- Safety functions -----
    function emergencyWithdraw(uint256 amount) external onlyOwner {
        vault.leaveStaking(amount);
        cake.transfer(owner(), cake.balanceOf(address(this)));
    }

    function leaveStaking(uint256 amount) external onlyOwner {
        vault.leaveStaking(amount);
    }

    function rescueErc20(address token, address addr, uint256 amount) external onlyOwner {
        IERC20(token).transfer(addr, amount);
    }

}