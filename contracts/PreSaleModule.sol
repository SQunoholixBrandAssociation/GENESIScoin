// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract PreSaleGENc is ReentrancyGuard {

    // === STRUCTS ===
    struct Stage {
        uint256 tokensAvailable;
        uint256 tokenPrice;
        uint256 bonusPercent;
        uint256 tokensSold;
        uint256 duration;
        uint256 startTime;
        bool isActive;
    }

    struct B100DParticipant {
        uint256 initialHolding;
        bool isActive;
    }

    // === CONSTANTS ===
    uint256 public constant MAX_PURCHASE_GENc = 500_000_000 * 1e18;
    uint256 public constant MAX_HOLD_PER_WALLET = 1_000_000_000 * 1e18;
    uint256 public constant MIN_GENc_BUY = 4_000 * 1e18;
    uint256 public constant TOTAL_STAGES = 5;

    uint256 public constant MIN_HOLDING_B100D = 15_000_000 * 1e18;
    uint256 public constant BASIC_PAYOUT_AMOUNT = 15_000 * 1e18;
    uint256 public constant B100D_DURATION_DAYS = 101;
    uint256 public constant REGISTER_FEE_BNB = 0.1 ether;

    uint256 public constant DISTRIBUTION_INTERVAL = 86400;

    address payable public constant walletDevG = payable(0x1B9D7Ae16B16dbb262FCBDB016125E0A716FA974);
    address payable public constant walletTeamG = payable(0x4e556f5b51Fd9B23A9EE9d0C539C2601ffAdb411);
    address payable public constant walletLiquidityPool = payable(0x033B3140d9111d4a7cbC024CD6C083351dB26f89);
    address payable public constant walletMarketing = payable(0x3E945A92eC45B19d038183a94e6Ea499fd1403F2);
    address payable public constant walletCommunity = payable(0x28cb2c7FA6F1ABD194E1997e1E61da89D5f28897);
    address payable public constant walletProjectExpansion = payable(0x7a4f37ED38F400a32476Fd018064FE39DcbbA5Bc);
    address payable public constant walletLevelUpVision = payable(0xc7BCa8C3C592272c95A49FE37D96De52D09dA7fD);
    address payable public constant walletBurn = payable(0xFCbeD5F7713B684494b6E4f2c53bE31e3348A6A4);
    address payable public constant walletSecureAudit = payable(0x230ADb273B37862794715DCC604D91785AdBA1Bb);
    address payable public constant walletDividend = payable(0x96aB16FB2A3d5BC99471c8094b8e13D4F4C3F3d3);
    address payable public constant walletGENcGasReserve = payable(0x1F04D3135D0F5DB662AF64bba113890a7C79B51f);

       // === VARIABLES ===
    mapping(uint256 => Stage) public stages;
    mapping(address => uint256) public userHoldings;
    mapping(address => B100DParticipant) public b100dParticipants;
    mapping(address => bool) public finalBonusClaimed;

    address[] public b100dAddresses;
    address public finalBBotAddress;
    address public whitelistBotAddress;
    address public oracleAddress;
    address public owner;
    IERC20 public token;

    uint256 public totalInitialHold;
    uint256 public bnbPrice;
    uint256 public lastPriceUpdateTime;
    uint256 public currentStageId = 1;
    bool public preSaleEnded = false;

    bool public b100dWhitelistOpen = false;
    bool public b100dStarted = false;
    bool public finalBonusDistributionStarted = false;

    uint256 public totalInitialHoldForFinalBonus = 0;
    uint256 public preSaleEndTime;
    uint256 public b100dWhitelistStartTime;
    uint256 public b100dWhitelistCloseTime;
    uint256 public b100dStartTime;
    uint256 public b100dCurrentDay;
    uint256 public lastB100DPayoutIndex = 0;
    uint256 public finalBonusDistributionTimestamp;

    uint256 public lastDistributionTime;

    uint256 public b100dPoolGENc;
    uint256 public preSaleBonusPoolGENc;
    uint256 public GENcGasReserve;
    uint256 public preSaleGENcPool;

    // === EVENTS ===
    event StageSoldOut(uint256 indexed stage, uint256 timestamp);
    event StageTimeout(uint256 indexed stage, uint256 timestamp);
    event TokensPurchased(address indexed buyer, uint256 tokensAmount, uint256 bonusAmount, uint256 totalHoldingAfter);
    event WhitelistOpened(uint256 timestamp);
    event WhitelistClosed(uint256 timestamp);
    event B100DRegistered(address indexed user, uint256 initialHolding);
    event FinalBonusDistributed(address indexed user, uint256 amount);
    event RemovedFromB100DWhitelist(address indexed user);
    event FundsDistributed(uint256 totalAmount, uint256 timestamp);
    event ForceStageCloseByOwner(uint256 stageId, uint256 tokensLeft, uint256 tokensNeeded, uint256 timestamp);
    event ClaimFailed(address indexed user, uint256 day);
    event FinalBonusStarted(uint256 totalInitialHold, uint256 pool);
    event FinalBonusBatchProcessed(uint256 from, uint256 to);
    event FinalBonusCompleted();
    event B100DDayCompleted(uint256 indexed day);
    event B100DBatchProcessed(uint256 from, uint256 to);

    // === MODIFIERS ===
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    modifier onlyWhitelistBot() {
        require(msg.sender == whitelistBotAddress, "Not whitelist bot");
        _;
    }
    modifier onlyOracle() {
        require(msg.sender == oracleAddress, "Only oracle");
        _;
    }
     modifier onlyFinalBBot() {
        require(msg.sender == finalBBotAddress, "Not finalBBot");
        _;
    }
    constructor() {
        owner = msg.sender;
        finalBBotAddress = 0x4E309d6A925AE6D9DDfa0e1F846BE5f640b7BF97;
        oracleAddress = 0xd627CBfbc17c6e37b409d2885d4320b6064150e1;
        whitelistBotAddress = 0x3D2BE06c46A6849D96b830AEF47d0a7C9Bf8ddC5;
        token = IERC20(0x8d9f95Dd624F581803e06652623897DfeCB82CA6);

        stages[1] = Stage(10_400_000_000 * 1e18, 0.0001 * 1e18, 4, 0, 0, 0, true);     // 10B + 4%
        stages[2] = Stage(6_480_000_000 * 1e18, 0.0002 * 1e18, 8, 0, 50 days, 0, false);  // 6B + 8%
        stages[3] = Stage(6_540_000_000 * 1e18, 0.0003 * 1e18, 9, 0, 50 days, 0, false);  // 6B + 9%
        stages[4] = Stage(6_600_000_000 * 1e18, 0.0004 * 1e18, 10, 0, 50 days, 0, false); // 6B + 10%
        stages[5] = Stage(5_750_000_000 * 1e18, 0.0005 * 1e18, 15, 0, 0, 0, false);    // 5B + 15%
    }

    function updateBNBPrice(uint256 _bnbPrice) external onlyOracle {
        require(block.timestamp >= lastPriceUpdateTime + 5 minutes, "Only 5 min updates");
        bnbPrice = _bnbPrice;
        lastPriceUpdateTime = block.timestamp;
    }

    function getInfo() external view returns (
        uint256 _bnbPrice,
        uint256 _currentStageId,
        uint256 _tokenPrice,
        uint256 _bonusPercent,
        uint256 _tokensAvailable,
        uint256 _tokensSold,
        uint256 _duration,
        uint256 _startTime
    ) {
        Stage storage stage = stages[currentStageId];
        return (
            bnbPrice,
            currentStageId,
            stage.tokenPrice,
            stage.bonusPercent,
            stage.tokensAvailable,
            stage.tokensSold,
            stage.duration,
            stage.startTime
        );
    }

    function participantsCount() external view returns (uint256) {
        return b100dAddresses.length;
    }

    function buyTokens() external payable nonReentrant {
        Stage storage stage = stages[currentStageId];
        require(stage.isActive, "Stage inactive");

        uint256 tokensLeft = stage.tokensAvailable - stage.tokensSold;
        if (tokensLeft < MIN_GENc_BUY) {
            _closeStage(currentStageId, true); 
            revert("Stage exhausted (<5k GENc left)");
        }

        if (stage.duration != 0 && block.timestamp > stage.startTime + stage.duration) {
            emit StageTimeout(currentStageId, block.timestamp);
        }

        uint256 usdAmount = (msg.value * bnbPrice) / 100;

        uint256 tokensAmount = (usdAmount * 1e18) / stage.tokenPrice;
        require(tokensAmount >= MIN_GENc_BUY, "Below minimum GENc");
        require(tokensAmount > 0, "Zero GENc calculated");
        require(tokensAmount <= MAX_PURCHASE_GENc, "Above max GENc per purchase");
        require(userHoldings[msg.sender] + tokensAmount <= MAX_HOLD_PER_WALLET, "Wallet limit exceeded");
        require(stage.tokensSold + tokensAmount <= stage.tokensAvailable, "Not enough tokens in stage");
        require(preSaleGENcPool >= tokensAmount, "Not enough tokens in pool");

        uint256 bonusTokens = (tokensAmount * stage.bonusPercent) / 100;
        uint256 totalTokens = tokensAmount + bonusTokens;

        require(token.transfer(msg.sender, totalTokens), "Token transfer failed");

        stage.tokensSold += totalTokens;
        userHoldings[msg.sender] += totalTokens;
        preSaleGENcPool -= totalTokens;
        emit TokensPurchased(msg.sender, tokensAmount, bonusTokens, userHoldings[msg.sender]);

        if (stage.tokensAvailable - stage.tokensSold < MIN_GENc_BUY) {
            _closeStage(currentStageId, true);
        }

        if (stage.tokensSold >= stage.tokensAvailable) {
            _closeStage(currentStageId, true);
        }
    }

    function forceCloseStageByOwner(uint256 _stageId) external onlyOwner {
        Stage storage stage = stages[_stageId];
        require(stage.isActive, "Stage already closed");

        uint256 tokensLeft = stage.tokensAvailable - stage.tokensSold;
        require(tokensLeft < 5000 * 1e18, "Too many tokens left");

        emit ForceStageCloseByOwner(_stageId, tokensLeft, 5000 * 1e18, block.timestamp);
        _closeStage(_stageId, true);
    }


    function closeStageByOracle(uint256 _stageId) external onlyOracle {
        Stage storage stage = stages[_stageId];
        require(stage.isActive, "Stage already closed");
        require(stage.duration > 0, "Stage has no duration");
        require(block.timestamp >= stage.startTime + stage.duration, "Stage not expired");

        _closeStage(_stageId, false);
    }

    function _closeStage(uint256 _stageId, bool soldOut) internal {
        Stage storage stage = stages[_stageId];
        stage.isActive = false;

        if (soldOut) {
            emit StageSoldOut(_stageId, block.timestamp);
        } else {
            emit StageTimeout(_stageId, block.timestamp);

            uint256 unsold = stage.tokensAvailable - stage.tokensSold;

            if (unsold > 0) {
                uint256 toLiquidityPool = (unsold * 15) / 100;
                uint256 toBurn = (unsold * 15) / 100;
                uint256 toTeamG = (unsold * 15) / 100;
                uint256 toCommunity = (unsold * 15) / 100;
                uint256 toDividend = (unsold * 35) / 100;
                uint256 toDevG = (unsold * 5) / 100;

                token.transfer(walletLiquidityPool, toLiquidityPool);
                token.transfer(walletBurn, toBurn);
                token.transfer(walletTeamG, toTeamG);
                token.transfer(walletCommunity, toCommunity);
                token.transfer(walletDevG, toDevG);
                token.transfer(walletDividend, toDividend);
            }
        }

        if (_stageId < TOTAL_STAGES) {
            currentStageId++;
            stages[currentStageId].isActive = true;
            stages[currentStageId].startTime = block.timestamp;
        }

        if (_stageId == TOTAL_STAGES) {
            preSaleEnded = true;
            preSaleEndTime = block.timestamp;
        }
    }

    function registerToB100DWhitelist() external payable nonReentrant {
        require(b100dWhitelistOpen, "Whitelist not open");
        require(!b100dStarted, "B100D already started");
        require(userHoldings[msg.sender] >= MIN_HOLDING_B100D, "Below min holding");
        require(!b100dParticipants[msg.sender].isActive, "Already registered");
        require(msg.value == REGISTER_FEE_BNB, "Invalid fee");

        b100dParticipants[msg.sender] = B100DParticipant({
            initialHolding: userHoldings[msg.sender],
            isActive: true
        });

        b100dAddresses.push(msg.sender);

        walletGENcGasReserve.transfer(msg.value);
        GENcGasReserve += msg.value;

        emit B100DRegistered(msg.sender, userHoldings[msg.sender]);
    }

    function ejectFromWhitelist(address user) external onlyWhitelistBot nonReentrant {
        B100DParticipant storage p = b100dParticipants[user];
        require(p.isActive, "Not in whitelist");
        p.isActive = false;
        emit RemovedFromB100DWhitelist(user);
    }

    function triggerWhitelistOpen() external onlyOracle nonReentrant {
        require(currentStageId == 5, "Stage 5 not active");
        require(!b100dWhitelistOpen, "Already open");

        b100dWhitelistOpen = true;
        b100dWhitelistStartTime = block.timestamp;

        emit WhitelistOpened(block.timestamp);
    }

    function triggerWhitelistClose() external onlyOracle {
        require(b100dWhitelistOpen, "Not open");
        require(block.timestamp >= preSaleEndTime + 24 hours, "Too early");

        b100dWhitelistOpen = false;
        b100dWhitelistCloseTime = block.timestamp;

        emit WhitelistClosed(block.timestamp);
    }

    function triggerB100DStart() external onlyOracle {
        require(preSaleEnded, "Presale not ended");
        require(!b100dStarted, "Already started");
        require(block.timestamp >= b100dWhitelistCloseTime + 24 hours, "Too early");

        b100dStarted = true;
        b100dStartTime = block.timestamp;
        b100dCurrentDay = 1;
    }

    function triggerDailyB100DPayout() external onlyOracle {
        require(b100dStarted, "B100D not started");
        require(b100dCurrentDay <= B100D_DURATION_DAYS, "All days distributed");

        uint256 totalUsers = b100dAddresses.length;
        require(lastB100DPayoutIndex < totalUsers, "All batches processed");

        uint256 end = lastB100DPayoutIndex + 50;
        if (end > totalUsers) end = totalUsers;

        for (uint256 i = lastB100DPayoutIndex; i < end; i++) {
            address user = b100dAddresses[i];
            if (b100dParticipants[user].isActive) {
                if (token.transfer(user, BASIC_PAYOUT_AMOUNT)) {
                    b100dPoolGENc -= BASIC_PAYOUT_AMOUNT;
                } else {
                    emit ClaimFailed(user, b100dCurrentDay);
                }
            }
        }

        lastB100DPayoutIndex = end;

        if (lastB100DPayoutIndex >= totalUsers) {
            b100dCurrentDay++;
            lastB100DPayoutIndex = 0;
            emit B100DDayCompleted(b100dCurrentDay);
        } else {
            emit B100DBatchProcessed(end, totalUsers);
        }
    }

    function triggerFinalBonusDistribution() external onlyFinalBBot nonReentrant {
        require(!finalBonusDistributionStarted, "Final bonus already distributed");
        require(b100dCurrentDay >= B100D_DURATION_DAYS, "B100D not finished");

        uint256 totalInitial = 0;
        address[] memory eligible = new address[](b100dAddresses.length);
        uint256 count = 0;

        for (uint256 i = 0; i < b100dAddresses.length; i++) {
            address user = b100dAddresses[i];
            if (b100dParticipants[user].isActive) {
                totalInitial += b100dParticipants[user].initialHolding;
                eligible[count] = user;
                count++;
            }
        }

        require(totalInitial > 0, "No eligible users");

        uint256 pool = b100dPoolGENc;
        require(pool > 0, "No funds in final bonus pool");

        finalBonusDistributionTimestamp = block.timestamp;
        finalBonusDistributionStarted = true;
        totalInitialHoldForFinalBonus = totalInitial;

        emit FinalBonusStarted(totalInitial, pool);

        uint256 maxPerBatch = 75;
        uint256 start = 0;
        while (start < count) {
            uint256 end = start + maxPerBatch;
            if (end > count) end = count;

            for (uint256 j = start; j < end; j++) {
                address user = eligible[j];
                if (finalBonusClaimed[user]) continue;

                uint256 userInitial = b100dParticipants[user].initialHolding;
                uint256 share = (userInitial * pool) / totalInitial;

                if (b100dPoolGENc < share) break;

                finalBonusClaimed[user] = true;
                b100dPoolGENc -= share;
                require(token.transfer(user, share), "Transfer failed");
                emit FinalBonusDistributed(user, share);
            }
            emit FinalBonusBatchProcessed(start, end);
            start = end;
        }
        emit FinalBonusCompleted();
    }


    function emergencyWithdraw() external onlyOwner nonReentrant {
        uint256 bnbBalance = address(this).balance;
        uint256 tokenBalance = token.balanceOf(address(this));

        if (bnbBalance > 0) {
            walletGENcGasReserve.transfer(bnbBalance);
        }

        if (tokenBalance > 0) {
            require(token.transfer(walletLevelUpVision, tokenBalance), "GENc Transfer failed");
        }
    }

    function fundB100DPool(uint256 amount) external onlyOwner {
        require(token.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        b100dPoolGENc += amount;
    }

    function fundGENcGasReserve() external payable onlyOwner {
        require(msg.value > 0, "Zero BNB");
        GENcGasReserve += msg.value;
    }

    function fundPreSaleGENcPool(uint256 amount) external onlyOwner {
        require(token.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        preSaleGENcPool += amount;
    }

    function distributeFunds() external onlyOracle nonReentrant {
        require(block.timestamp >= lastDistributionTime + DISTRIBUTION_INTERVAL, "Only once per day");

        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to distribute");

        walletTeamG.transfer((balance * 10) / 100);
        walletLiquidityPool.transfer((balance * 50) / 100);
        walletMarketing.transfer((balance * 6) / 100);
        walletCommunity.transfer((balance * 5) / 100);
        walletSecureAudit.transfer((balance * 7) / 100);
        walletDevG.transfer((balance * 10) / 100);
        walletLevelUpVision.transfer((balance * 7) / 100);
        walletProjectExpansion.transfer((balance * 5) / 100);

        lastDistributionTime = block.timestamp;
        emit FundsDistributed(balance, block.timestamp);
    }
}


