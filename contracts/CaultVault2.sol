pragma solidity >=0.6.0 <0.8.0;

// SPDX-License-Identifier: MIT

interface CakeVault2{ //TODO Remove, only used in tests
    function deposit(uint256 _amount) external;
    function withdraw(uint256 _shares) external;
    function userInfo(address addr) external returns (uint256, uint256, uint256, uint256);
    function getPricePerFullShare() external returns (uint256);
    function token() external view returns (address);
}