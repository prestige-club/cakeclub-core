// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

contract OwnableWithSeller is Ownable {

    address _sellingContract;

    function setSellingContract(address sc) public onlyOwner {
        _sellingContract = sc;
    }

}