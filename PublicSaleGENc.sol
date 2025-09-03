// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract PublicSaleGENc is ReentrancyGuard {
    IERC20 public token;

    address public owner;
    address public oracleAddress;
    address public airdropBotAddress;
    address public dividendBotAddress;
    address public eligibleBotAddress;

    // === BONUS PHASES CONFIG ===
    uint256 public constant BONUS_PHASE_1_END_DAY = 100;
    uint256 public constant BONUS_PHASE_2_END_DAY = 200;
    uint256 public constant BONUS_PHASE_3_END_DAY = 300;

    uint256 public constant BONUS_PHASE_1_THRESHOLD = 2_000_000 * 1e18;
    uint256 public constant BONUS_PHASE_2_THRESHOLD = 3_000_000 * 1e18;
    uint256 public constant BONUS_PHASE_3_THRESHOLD = 5_000_000 * 1e18;
    uint256 public constant BONUS_PHASE_4_THRESHOLD = 7_000_000 * 1e18;

    uint256 public constant BONUS_PHASE_1_AMOUNT = 1_000_000 * 1e18;
    uint256 public constant BONUS_PHASE_2_AMOUNT = 1_300_000 * 1e18;
    uint256 public constant BONUS_PHASE_3_AMOUNT = 2_000_000 * 1e18;
    uint256 public constant BONUS_PHASE_4_AMOUNT = 3_000_000 * 1e18;

    uint256 public constant BONUS_PHASE_1_MAX_USERS = 100;
    uint256 public constant BONUS_PHASE_2_MAX_USERS = 75;
    uint256 public constant BONUS_PHASE_3_MAX_USERS = 50;


    // === STATE ===
    uint256 public publicSaleStartTimestamp;

    uint256 public publicSaleBonusPoolGENc;
    uint256 public dividendPoolGENc;
    uint256 public airdropPoolGENc;

    mapping(uint256 => mapping(address => bool)) public hasClaimed;
    mapping(uint256 => uint256) public dailyBonusClaimed;

    // === EVENTS ===
    event DailyBonusGranted(address indexed recipient, uint256 indexed dayNumber);
    event DividendPaid(address indexed user, uint256 timestamp);
    event AirdropExecuted(address indexed recipient, uint256 timestamp);

    modifier onlyOracle() {
        require(msg.sender == oracleAddress, "Only oracle");
        _;
    }

    modifier onlyEligibleBot() {
        require(msg.sender == eligibleBotAddress, "Not Eligible bot");
        _;
    }

    modifier onlyDividendBot() {
        require(msg.sender == dividendBotAddress, "Not authorized");
        _;
    }

    modifier onlyAirdropBot() {
        require(msg.sender == airdropBotAddress, "Not airdrop bot");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        token = IERC20(0xb0ad142296952305679f691D646B3F9e3d589349);
        oracleAddress = 0x088480533422d2fDdB91a3B0B4f7b9037a6e2fdC;
        airdropBotAddress = 0x225Ed038B1B1bE5b5A9Caf264E9fbADa8c2226b6;
        eligibleBotAddress = 0x87258159Ae83B41256e58E90717021d492B843C2;
        dividendBotAddress = 0xE9071864E267Fb5Dd2c7D9ac744A71fbeB441c87;
        owner = msg.sender;
    }

    function startPublicSale() external onlyOracle {
        publicSaleStartTimestamp = block.timestamp;
    }

    function processDailyBonus(address buyer, uint256 day)
        external onlyEligibleBot nonReentrant {

        require(publicSaleStartTimestamp > 0, "Sale not started");
        require(day > 0, "Invalid day");
        require(!hasClaimed[day][buyer], "Already claimed");

        uint8 phase = getPhase(day);
        uint256 bonusAmount = getBonusAmountForPhase(phase);

        require(publicSaleBonusPoolGENc >= bonusAmount, "Insufficient pool");  
        require(token.transfer(buyer, bonusAmount), "Transfer failed");

        publicSaleBonusPoolGENc -= bonusAmount;
        hasClaimed[day][buyer] = true;
        dailyBonusClaimed[day] += bonusAmount;

        emit DailyBonusGranted(buyer, day);
    }

    function getPhase(uint256 day) public pure returns (uint8) {
        if (day <= BONUS_PHASE_1_END_DAY) return 1;
        if (day <= BONUS_PHASE_2_END_DAY) return 2;
        if (day <= BONUS_PHASE_3_END_DAY) return 3;
        return 4;
    }

    function getBonusAmountForPhase(uint8 phase) public pure returns (uint256) {
        if (phase == 1) return BONUS_PHASE_1_AMOUNT;
        if (phase == 2) return BONUS_PHASE_2_AMOUNT;
        if (phase == 3) return BONUS_PHASE_3_AMOUNT;
        return BONUS_PHASE_4_AMOUNT;
    }

    function getCurrentDay() public view returns (uint256) {
        require(publicSaleStartTimestamp > 0, "Sale not started");
        return ((block.timestamp - publicSaleStartTimestamp) / 86400) + 1;
    }

    function fundPublicSaleBonusPool(uint256 amount) external onlyOwner {
        require(token.transferFrom(msg.sender, address(this), amount), "TransferFrom failed");
        publicSaleBonusPoolGENc += amount;
    }

    function fundDividendPool(uint256 amount) external onlyOwner {
        require(token.transferFrom(msg.sender, address(this), amount), "TransferFrom failed");
        dividendPoolGENc += amount;
    }

    function fundAirdropPool(uint256 amount) external onlyOwner {
        require(token.transferFrom(msg.sender, address(this), amount), "TransferFrom failed");
        airdropPoolGENc += amount;
    }

    function distributeDividendsAdjusted(
        address[] calldata recipients,
        uint256[] calldata payouts
    ) external onlyDividendBot nonReentrant {
        require(recipients.length == payouts.length, "Array length mismatch");
        require(recipients.length <= 100, "Max 100 recipients per batch");

        for (uint256 i = 0; i < recipients.length; i++) {
            uint256 amount = payouts[i];
            require(token.transfer(recipients[i], amount), "Dividend transfer failed");
            dividendPoolGENc -= amount;
            emit DividendPaid(recipients[i], block.timestamp);
        }
    }

    function airdropByList(
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external onlyAirdropBot nonReentrant {
        require(recipients.length == amounts.length, "Array length mismatch");
        require(recipients.length <= 100, "Max 100 recipients per batch");

        for (uint256 i = 0; i < recipients.length; i++) {
            uint256 amount = amounts[i];
            require(airdropPoolGENc >= amount, "Insufficient airdrop pool");
            require(token.transfer(recipients[i], amount), "Airdrop transfer failed");
            airdropPoolGENc -= amount;
            emit AirdropExecuted(recipients[i], block.timestamp);
        }
    }
}
