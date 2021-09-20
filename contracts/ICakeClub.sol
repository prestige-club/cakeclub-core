pragma solidity >=0.6.0 <0.8.0;

// SPDX-License-Identifier: MIT

interface ICakeClub {
    function invest() external;
    function withdraw(uint256 peth, address to) external;
    function cake() external returns (address);
}