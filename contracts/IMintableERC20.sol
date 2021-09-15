pragma solidity >=0.6.0 <0.8.0;

// SPDX-License-Identifier: MIT

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface IMintableERC20 is IERC20 {
    function mint(uint256 amount) external;
    function burn(uint256 amount) external;
}