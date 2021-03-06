pragma solidity >=0.6.0 <0.8.0;

import "./libraries/PrestigeClubCalculations.sol";
import "./libraries/SafeMath112.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./OwnableWithSeller.sol";
import "./ICakeClub.sol";

// SPDX-License-Identifier: MIT

//Restrictions:
//only 2^32 Users
//Maximum of (2^104 / 10^18 Ether) investment. Theoretically 20 Trl Ether, practically 100000000000 Ether compiles
contract PrestigeClub is OwnableWithSeller() {

    using SafeMath112 for uint112;

    //User Object which stores all data associated with a specific address
    struct User {
        uint112 deposit; //amount a User has paid in. Note: Deposits can not be removed, since withdrawals are only possible on payout
        uint112 payout; //Generated revenue
        uint32 position; //The position (a incrementing int value). Used for calculation of the streamline
        uint8 qualifiedPools;  //Number of Pools and DownlineBonuses, which the User has qualified for respectively
        uint8 downlineBonus;
        address referrer;
        address[] referrals;

        uint112 directSum;   //Sum of deposits of all direct referrals
        uint40 lastPayout;  //Timestamp of the last calculated Payout

        uint112[5] downlineVolumes;  //Used for downline bonus calculation, correspondings to logical mapping  downlineBonusStage (+ 0) => sum of deposits of users directly or indirectly referred in given downlineBonusStage
    }
    
    event NewDeposit(address indexed addr, uint112 amount);
    event PoolReached(address indexed addr, uint8 pool);
    
    event Payout(address indexed addr, uint112 interest, uint112 direct, uint112 pool, uint112 downline, uint40 dayz); 
    
    event Withdraw(address indexed addr, uint112 amount);
    
    mapping (address => User) public users;
    //userList is basically a mapping position(int) => address
    address[] public userList;

    uint32 public lastPosition; //= 0
    
    uint128 public depositSum; //= 0 //Pos 4

    uint128 public totalDownlineVolume;

    uint128 public totalWithdrawn;
    
    Pool[8] public pools;
    
    struct Pool {
        uint112 minOwnInvestment;
        uint8 minDirects;
        uint112 minSumDirects;
        uint8 payoutQuote; //ppm
        uint32 numUsers;
    }

    //Poolstates are importing for calculating the pool payout for every seperate day.
    //Since the number of Deposits and Users in every pool change every day, but payouts are only calculated if they need to be calculated, their history has to be stored
    PoolState[] public states;

    struct PoolState {
        uint128 totalDeposits;
        uint32[8] numUsers;
    }

    //Downline bonus is a bonus, which users get when they reach a certain pool. The Bonus is calculated based on the sum of the deposits of all Users delow them in the structure
    DownlineBonusStage[4] downlineBonuses;
    
    struct DownlineBonusStage {
        uint32 minPool;
        uint64 payoutQuote; //ppm
    }
    
    uint40 public pool_last_draw;

    ICakeClub cakeClub;
    IERC20 cake;
    
    constructor(address _cakeClub) public {
 
        uint40 timestamp = uint40(block.timestamp);
        pool_last_draw = timestamp - (timestamp % payout_interval);

        cakeClub = ICakeClub(_cakeClub);
        cake = IERC20(cakeClub.cake());

        //Definition of the Pools and DownlineBonuses with their respective conditions and percentages. 

        //Prod values
        pools[0] = Pool(20 ether, 1, 20 ether, 70, 0);
        pools[1] = Pool(166 ether, 3, 300 ether, 70, 0);
        pools[2] = Pool(662 ether, 4, 1200 ether, 70, 0);
        pools[3] = Pool(1250 ether, 10, 4000 ether, 70, 0);
        pools[4] = Pool(2300 ether, 15, 9000 ether, 70, 0);
        pools[5] = Pool(3250 ether, 20, 18000 ether, 70, 0);

        downlineBonuses[0] = DownlineBonusStage(3, 25);
        downlineBonuses[1] = DownlineBonusStage(4, 50);
        downlineBonuses[2] = DownlineBonusStage(5, 75);
        downlineBonuses[3] = DownlineBonusStage(6, 100);
        
        //Testing Pools
        // pools[0] = Pool(1000 wei, 1, 1000 wei, 130, 0); 
        // pools[1] = Pool(1000 wei, 1, 1000 wei, 130, 0);
        // pools[2] = Pool(1000 wei, 1, 10000 wei, 130, 0);
        // pools[3] = Pool(2 ether, 1, 10000 wei, 130, 0);
        // pools[4] = Pool(2 ether, 1, 10000 wei, 130, 0);
        // pools[5] = Pool(2 ether, 1, 10000 wei, 130, 0);
        
        //Test Values
        // downlineBonuses[0] = DownlineBonusStage(3, 100);
        // downlineBonuses[1] = DownlineBonusStage(4, 160);
        // downlineBonuses[2] = DownlineBonusStage(5, 210);
        // downlineBonuses[3] = DownlineBonusStage(6, 260);

        userList.push(address(0));

        uint32 zero = uint32(0);
        states.push(PoolState(0, [zero,zero,zero,zero,zero,zero,zero,zero]));
        states.push(PoolState(0, [zero,zero,zero,zero,zero,zero,zero,zero]));
        
    }
    
    uint112 internal minDeposit = 20 ether; 
    
    // uint40 constant internal payout_interval = 15 minutes;
    uint40 constant internal payout_interval = 1 days;
    
    //Investment function for new deposits
    function recieve(uint112 amount) public {
        User storage user = users[msg.sender];
        require(user.deposit >= minDeposit || amount >= minDeposit, "Minimum deposit value not reached");
        
        address sender = msg.sender;

        //Transfer peth
        cake.transferFrom(sender, address(cakeClub), amount);
        cakeClub.invest();

        bool userExists = user.position != 0;
        
        //Trigger calculation of next Pool State, if 1 day has passed
        triggerCalculation();

        // Create a position for new accounts
        if(!userExists){
            lastPosition++;
            user.position = lastPosition;
            user.lastPayout = (pool_last_draw + 1);
            userList.push(sender);
        }

        address referrer = user.referrer; //can put outside because referrer is always set since setReferral() gets called before recieve() in recieve(address)

        if(referrer != address(0)){
            updateUpline(sender, referrer, amount);
        }

        //Update Payouts
        if(userExists){
            updatePayout(sender);
        }

        user.deposit = user.deposit.add(amount);
        
        emit NewDeposit(sender, amount);
        
        updateUserPool(sender);
        updateDownlineBonusStage(sender);
        if(referrer != address(0)){
            users[referrer].directSum = users[referrer].directSum.add(amount);

            updateUserPool(referrer);
            updateDownlineBonusStage(referrer);
        }
        
        require(depositSum + amount > depositSum, "Overflow"); //Overflow check
        depositSum = depositSum + amount; 

    }
    
    
    //New deposits with referral address
    function recieve(uint112 amount, address referrer) public {
        
        _setReferral(referrer);
        recieve(amount);
        
    }

    function reinvest(uint112 amount) public {

        uint256 before = cake.balanceOf(msg.sender);

        withdraw(amount);

        uint256 afterB = cake.balanceOf(msg.sender);
        require(afterB > before, "Overflow");

        uint256 diff = afterB - before;
        require(diff < ~uint112(0), "uint112 overflow");

        recieve(uint112(diff));

    }

    //Updating the payouts and stats for the direct and every User which indirectly referred User reciever
    //adr = Address of the first referrer , addition = new deposit value
    function updateUpline(address reciever, address adr, uint112 addition) private {
        
        address current = adr;
        uint8 bonusStage = users[reciever].downlineBonus;
        
        uint8 downlineLimitCounter = 30;
        
        while(current != address(0) && downlineLimitCounter > 0){

            updatePayout(current);

            users[current].downlineVolumes[bonusStage] = users[current].downlineVolumes[bonusStage].add(addition);
            uint8 currentBonus = users[current].downlineBonus;
            if(currentBonus > bonusStage){
                uint128 prevTDV = totalDownlineVolume;
                totalDownlineVolume += addition * (currentBonus - bonusStage);
                require(prevTDV <= totalDownlineVolume, "Overflow");
                bonusStage = currentBonus;
            }

            current = users[current].referrer;
            downlineLimitCounter--;
        }
        
    }

    //Updates the payout amount for given user
    function updatePayout(address adr) private {
        
        User storage user = users[adr];
        uint40 dayz = (uint40(block.timestamp) - user.lastPayout) / (payout_interval);
        if(dayz >= 1){
            
            // Calculate Base Payouts

            // Interest Payout
            uint112 deposit = user.deposit;
            uint8 quote = 8;
            
            uint112 interestPayout = deposit.mul(quote) / 10000;

            uint112 poolpayout = getPoolPayout(adr, dayz);

            uint112 directsPayout = getDirectsPayout(adr);

            uint112 downlineBonusAmount = getDownlinePayout(adr);
            
            uint112 sum = interestPayout.add(directsPayout).add(downlineBonusAmount); 
            sum = (sum.mul(dayz)).add(poolpayout);
            
            user.payout = user.payout.add(sum);

            uint40 lastPayoutTemp = user.lastPayout;
            user.lastPayout += (payout_interval * dayz);
            require(user.lastPayout >= lastPayoutTemp, "Overflow");
            
            emit Payout(adr, interestPayout, directsPayout, poolpayout, downlineBonusAmount, dayz);

        }
    }
    
    function getPoolPayout(address adr, uint40 dayz) public view returns (uint112){
        return PrestigeClubCalculations.getPoolPayout(users[adr], dayz, pools, states);
    }

    function getDownlinePayout(address adr) public view returns (uint112){
        return PrestigeClubCalculations.getDownlinePayout(users[adr], downlineBonuses);
    }

    function getDirectsPayout(address adr) public view returns (uint112) {
        
        // Calculate Directs Payouts
       return users[adr].directSum.mul(25) / 100000;
        
    }
    
    function triggerCalculation() public { 
        while(block.timestamp > pool_last_draw + payout_interval){
            pushPoolState();
        }
    }

    //Gets called every 24 hours to push new PoolState
    function pushPoolState() private {
        uint32[8] memory temp;
        for(uint8 i = 0 ; i < 8 ; i++){
            temp[i] = pools[i].numUsers;
        }
        states.push(PoolState(depositSum, temp));
        pool_last_draw += payout_interval;
    }

    //updateUserPool and updateDownlineBonusStage check if the requirements for the next pool or stage are reached, and if so, increment the counter in his User struct 
    function updateUserPool(address adr) private {
        
        if(users[adr].qualifiedPools < pools.length){
            
            uint8 poolnum = users[adr].qualifiedPools;
            
            uint112 sumDirects = users[adr].directSum;
            
            //Check if requirements for next pool are met
            if(users[adr].deposit >= pools[poolnum].minOwnInvestment && users[adr].referrals.length >= pools[poolnum].minDirects && sumDirects >= pools[poolnum].minSumDirects){
                users[adr].qualifiedPools = poolnum + 1;
                pools[poolnum].numUsers++;
                
                emit PoolReached(adr, poolnum + 1);
                
                updateUserPool(adr);
            }
            
        }
        
    }
    
    function updateDownlineBonusStage(address adr) private {

        User storage user = users[adr];
        uint8 bonusstage = user.downlineBonus;

        if(bonusstage < downlineBonuses.length){

            //Check if requirements for next stage are met
            if(user.qualifiedPools >= downlineBonuses[bonusstage].minPool){
                user.downlineBonus += 1;
                
                //Update data in upline
                uint112 value = user.deposit;  //Value without current stage, since that must not be subtracted. This value is used as the "downline value of address adr" for all Users above User adr

                for(uint8 i = 0 ; i <= bonusstage ; i++){
                    value = value.add(user.downlineVolumes[i]);
                }

                uint128 prevTDV = totalDownlineVolume;
                totalDownlineVolume += (value - user.deposit); //This should be the amount the user is now earning more in DownlineBonus than before
                require(prevTDV <= totalDownlineVolume, "Overflow");

                // uint8 previousBonusStage = bonusstage;
                uint8 currentBonusStage = bonusstage + 1;
                uint8 lastBonusStage = bonusstage;

                bool sumBonusStageUpdated = false;

                uint8 downlineLimitCounter = 30;

                address current = user.referrer;
                while(current != address(0) && downlineLimitCounter > 0){

                    User storage currentUser = users[current];
                    currentUser.downlineVolumes[lastBonusStage] = currentUser.downlineVolumes[lastBonusStage].sub(value);
                    currentUser.downlineVolumes[currentBonusStage] = currentUser.downlineVolumes[currentBonusStage].add(value);

                    //Remove DownlineBonus which is now consumed by User adr since he is one stage higher
                    if(!sumBonusStageUpdated && currentUser.downlineBonus > bonusstage){
                        require(value < totalDownlineVolume, "Overflow");
                        totalDownlineVolume -= value;
                        sumBonusStageUpdated = true;
                    }

                    uint8 currentDB = currentUser.downlineBonus;
                    if(currentDB > currentBonusStage){
                        currentBonusStage = currentDB;
                    }
                    if(currentDB > lastBonusStage){
                        lastBonusStage = currentDB;
                    }

                    if(lastBonusStage == currentBonusStage){
                        break;
                    }

                    downlineLimitCounter--;
                    current = currentUser.referrer;
                }
                
                updateDownlineBonusStage(adr);
            }
        }
        
    }
    
    //Endpoint to withdraw payouts
    function withdraw(uint112 amount) public {

        User storage user = users[msg.sender];

        triggerCalculation();
        updatePayout(msg.sender);

        require(user.payout >= amount, "Not enough payout available");
        
        user.payout -= amount; //No Safemath since validation occurs above

        cakeClub.withdraw(amount, msg.sender);
        
        totalWithdrawn += amount;
        emit Withdraw(msg.sender, amount);
        
    }

    function _setReferral(address referrer) private {
        
        User storage user = users[msg.sender];
        if(user.referrer == referrer){
            return;
        }
        
        if(user.position != 0 && user.position < users[referrer].position) {
            return;
        }
        
        require(user.referrer == address(0), "Referrer already set");
        require(users[referrer].position > 0, "Referrer doesnt exist");
        require(msg.sender != referrer, "Referrer is self");
        
        users[referrer].referrals.push(msg.sender);
        user.referrer = referrer;

        if(user.deposit > 0){
            users[referrer].directSum = users[referrer].directSum.add(user.deposit);
        }
        
    }
    
    function setLimits(uint112 _minDeposit) public onlyOwner {
        minDeposit = _minDeposit;
    }

    //Data Import Logic
    function reCalculateImported(uint32 _lastPosition, uint112 _depositSum, uint112 _totalDownlineVolume) public onlyOwner {

        lastPosition = _lastPosition;
        depositSum = _depositSum;
        totalDownlineVolume = _totalDownlineVolume;
    }
    
    function _import(address[] memory _sender, uint112[] memory deposit, address[] memory _referrer, uint32 startposition, 
        uint8[] memory downlineBonus, uint112[5][] memory volumes) public onlyOwner {

        require(userList.length == startposition, "Positions wrong");

        uint40 time = pool_last_draw;

        for(uint32 i = 0 ; i < _sender.length ; i++){

            address sender = _sender[i];
            address referrer = _referrer[i];
            User storage user = users[sender];

            require(user.deposit == 0, "Account exists already");

            // Create a position for new accounts
            user.position = startposition + i;
            user.lastPayout = time;
            userList.push(sender);

            if(referrer != address(0)){

                User storage referrerUser = users[referrer];
                require(referrerUser.position < user.position, "Referer has higher position than user");
                referrerUser.referrals.push(sender);
                user.referrer = referrer;
            }

            user.deposit = deposit[i];

            user.downlineBonus = downlineBonus[i] % 16;
            user.downlineVolumes = volumes[i];

            uint8 pool = downlineBonus[i] >> 4; // / 16
            
            user.qualifiedPools = pool;
            for(uint8 p = 0 ; p < pool ; p++){
                pools[p].numUsers++;
            }
            
            if(referrer != address(0)){
                
                users[referrer].directSum += deposit[i];

            }

        }
    }

    //0.44 KB
    function setPool(uint8 index, uint112 minOwnInvestment, uint8 minDirects, uint112 minSumDirects, uint8 payoutQuote) external onlyOwner {
        Pool storage pool = pools[index];
        pool.minDirects = minDirects;
        pool.minSumDirects = minSumDirects;
        pool.payoutQuote = payoutQuote;
        pool.minOwnInvestment = minOwnInvestment;
    }

    function getDetailedUserInfos(address adr) public view returns (address[] memory /*referrals */, uint112[5] memory /*volumes*/) {
        return (users[adr].referrals, users[adr].downlineVolumes);
    }

    function getDownline(address adr) public view returns (uint112, uint128){ 
        return PrestigeClubCalculations.getDownline(users, adr);
    }
    
    //DEBUGGING
    //Used for extraction of User data in case of something bad happening and fund reversal needed.
    function getUserList() public view returns (address[] memory){ 
        return userList;
    }

    function rescueERC20(address addr) public onlyOwner {
        IERC20 token = IERC20(addr);
        token.transfer(owner(), token.balanceOf(address(this)));
    }

    function sellAccount(address from, address to) public { 

        require(msg.sender == owner() || msg.sender == _sellingContract, "Not authorized");

        User storage userFrom = users[from];

        require(userFrom.deposit > 0, "User does not exist");
        require(users[to].deposit == 0 || to == address(0), "User already exists");

        userList[userFrom.position] = to;

        address referrer = userFrom.referrer;
        if(referrer != address(0)){
            address[] storage arr = users[referrer].referrals;
            for(uint16 i = 0 ; i < arr.length ; i++){
                if(arr[i] == from){
                    users[referrer].referrals[i] = to;
                    break;
                }
            }
        }

        for(uint16 i = 0 ; i < users[from].referrals.length ; i++){
            users[userFrom.referrals[i]].referrer = to;
        }

        users[to] = userFrom;
        delete users[from];

    }

    function setCakeClub(address _cakeClub) external onlyOwner {
        cakeClub = ICakeClub(_cakeClub);
    }
}