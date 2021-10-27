pragma solidity >=0.6.0 <0.8.0;

// SPDX-License-Identifier: MIT

import "./IMintableERC20.sol";
import "./CakeClub.sol";

contract CakeVaultMock is CakeVault {

    address cakeAddr;
    IMintableERC20 token;
    mapping(address => uint256) stake;
    mapping(address => uint256) lastReward;
    uint256 rewardRate = 0.01 ether; // 1000000 per Second

    struct PoolInfo {
        IMintableERC20 lpToken;           // Address of LP token contract.
        uint256 allocPoint;       // How many allocation points assigned to this pool. CAKEs to distribute per block.
        uint256 lastRewardBlock;  // Last block number that CAKEs distribution occurs.
        uint256 accCakePerShare; // Accumulated CAKEs per share, times 1e12. See below.
    }

    PoolInfo[] public poolInfo;

    uint256 public totalAllocPoint = 800000;

    constructor(address _cake) public {
        cakeAddr = _cake;
        token = IMintableERC20(_cake);

        poolInfo.push(PoolInfo(
            IMintableERC20(_cake),
            200000,
            0, 0
        ));
    }

    function getReward(address user) internal view returns (uint256) {
        if(lastReward[user] != 0){
            return rewardRate * (block.timestamp - lastReward[user]);
        }else{
            return 0;
        }
    }

    function enterStaking(uint256 amount) external override {

        token.transferFrom(msg.sender, address(this), amount);
        stake[msg.sender] += amount;
        stake[msg.sender] += getReward(msg.sender);
        lastReward[msg.sender] = block.timestamp;

    }

    function leaveStaking(uint256 amount) external override {

        uint256 reward = getReward(msg.sender);
        require(stake[msg.sender] + reward >= amount, "Not enough");
        
        uint256 bal = token.balanceOf(address(this));
        if(reward + amount > bal){
            token.mint(reward + amount - bal);
        }

        token.transfer(msg.sender, reward);
        lastReward[msg.sender] = block.timestamp;
        stake[msg.sender] -= amount;
        token.transfer(msg.sender, amount);

    }

    function pendingCake(uint256 _pid, address _user) external view override returns (uint256){
        require(_pid == 0);
        return getReward(_user);
    }

    function userInfo(uint256 _pid, address _user) external view override returns (uint256, uint256){
        require(_pid == 0);
        return (stake[_user], 0);
    }

    function cake() external view override returns (address){
        return cakeAddr;
    }

    function emergencyWithdraw(uint256 _pid) external override {

    }

}