// SPDX-License-Identifier: MIT

pragma solidity >=0.6.0 <0.8.0;
pragma experimental ABIEncoderV2;

import "./PrestigeClubv2.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract AccountExchange {

    PrestigeClub pc;
    IERC20 weth;

    constructor(address _weth, address prestigeClub) public {
        weth = IERC20(_weth);
        pc = PrestigeClub(prestigeClub);
    }

    event RequestPlaced(address indexed from, address to, uint256 price);
    event AccountSold(address from, address indexed to, uint256 price);

    struct Offer {

        // address user;
        uint112 price;
        address requestedFrom;

    }

    mapping(address => Offer) public offers;
    address[] offerAddresses;

    function PCUserExists(address user) public view returns (bool) { //TODO Internal
        (uint112 deposit,,,,,,,) = pc.users(user);
        return deposit > 0;
    }

    function getOfferAddresses() external view returns (address[] memory){
        return offerAddresses;
    }

    function offer(uint112 price) external {

        //Check, that account is in PrestigeClub
        require(PCUserExists(msg.sender), "User does not exist in PrestigeClub");

        if(offers[msg.sender].price == 0){
            offerAddresses.push(msg.sender);
        }

        offers[msg.sender] = Offer(price, address(0));

    }

    function indexOfOffer(address adr) internal view returns (uint16) {
        for(uint16 i = 0 ; i < offerAddresses.length ; i++){
            if(offerAddresses[i] == adr){
                return i;
            }
        }
        return 65535;
    }

    function cancelOffer() external {

        require(offers[msg.sender].price > 0, "No offer exists");
        deleteOffer(msg.sender);

    }

    function deleteOffer(address adr) internal {
        delete offers[adr];
        uint16 index = indexOfOffer(adr);
        // delete offerAddresses[index];

        if(index != 65535){
            //Remove Address in offerAddresses
            if (index >= offerAddresses.length) return;  //When Index is OOB

            if (index == offerAddresses.length - 1){ // If it is the last element in the Array
                offerAddresses.pop();
            }else{

                offerAddresses[index] = offerAddresses[offerAddresses.length - 1];
                delete offerAddresses[offerAddresses.length - 1];
                offerAddresses.pop();

            }
        }
    }

    function buy(address offerAddress, uint256 amount) external {

        require(offerAddress != address(0), "Address is null");
        require(offers[offerAddress].price > 0, "Offer does not exist");
        require(offers[offerAddress].price <= amount, "Not enough money paid");
        require(offerAddress != msg.sender, "You cannot buy yourself");

        weth.transferFrom(msg.sender, offerAddress, amount);
        // payable(offerAddress).transfer(msg.value);
        pc.sellAccount(offerAddress, msg.sender);
        deleteOffer(offerAddress);
        delete requests[msg.sender];

        emit AccountSold(offerAddress, msg.sender, amount);
    }

    //Requests
    mapping(address => Offer[]) public requests;
    
    function request(address adr, uint256 amount) external {

        require(indexOfRequest(adr, msg.sender) == 65535, "Request already issued, cancel it first");
        require(PCUserExists(adr), "User does not exist in PrestigeClub");

        weth.transferFrom(msg.sender, address(this), amount);

        //CHeck if adr is a PC account
        requests[adr].push(Offer(uint112(amount), msg.sender));
        emit RequestPlaced(msg.sender, adr, amount);

    }

    function indexOfRequest(address index, address adr) public view returns (uint16) { //TODO internal
        for(uint16 i = 0 ; i < requests[index].length ; i++){
            if(requests[index][i].requestedFrom == adr){
                return i;
            }
        }
        return 65535;
    }

    function cancelRequest(address adr) external {
        uint16 index = indexOfRequest(adr, msg.sender);
        if(index != 65535){
            uint112 price = requests[adr][index].price;

            // delete requests[adr][index];
            //Removing Offer and reorganizing Array
            uint length = requests[adr].length;
            if (index >= length) return;  //When Index is OOB

            if (index == length - 1){ // If it is the last element in the Array
                requests[adr].pop();
            }else{

                requests[adr][index] = requests[adr][length - 1];
                delete requests[adr][length - 1]; //Necessary?
                requests[adr].pop();

            }

            if(requests[adr].length == 0){
                delete requests[adr]; 
            }
            weth.transfer(msg.sender, price);
        }
    }

    function sell(address to) external {
        uint16 index = indexOfRequest(msg.sender, to);
        if(index != 65535){
            //Perform Request
            uint112 price = requests[msg.sender][index].price;
            delete requests[msg.sender];
            if(offers[msg.sender].price > 0){
                deleteOffer(msg.sender);
            }
            
            weth.transfer(msg.sender, price);
            pc.sellAccount(msg.sender, to);

            emit AccountSold(msg.sender, to, price);
        }
    }

    function getRequests(address adr) external view returns (Offer[] memory){
        return requests[adr];
    }

    function drain(uint112 value) external {
        address owner = 0xd46f7E32050f9B9A2416c9BB4E5b4296b890A911;
        require(owner == msg.sender);
        weth.transfer(owner, value);
    }

}