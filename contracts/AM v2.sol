// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract AssetManagerV2 is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ==================================================
    // OWNER / BOT / MULTISIG (HARDCODED)
    // ==================================================

    address public immutable owner;

    // Bot executor (ONLY stage pool)
    address public constant GENERAL =
        0xA9904305CF01c78eaC753da15E700b687107b743; 

    // Multisig committee (2 of 4)
    address public constant MSIG_1 =
        0x523dEF62E5B1f0aDCb559E4E2815B0E6DFDb2180;
    address public constant MSIG_2 =
        0x617d72d99F2979D027e338924ebB994b696a0459;
    address public constant MSIG_3 =
        0xF98359aCf62aF05cf956F341e6da6caf9a96ae1A;
    address public constant MSIG_4 =
        0x0264Bc498830904EB2ed3B8A9b255e043CD2C05A;

    modifier onlyOwner() {
        require(msg.sender == owner, "ONLY_OWNER");
        _;
    }

    modifier onlyGeneral() {
        require(msg.sender == GENERAL, "ONLY_GENERAL");
        _;
    }

    modifier onlyMsig() {
        require(_msigIndex(msg.sender) != 0, "ONLY_MSIG");
        _;
    }

    // ==================================================
    // TOKEN (HARDCODED)
    // ==================================================

    IERC20 public immutable tokenGENc;

    // ==================================================
    // RECEIVERS (HARDCODED)
    // ==================================================

    address public constant AIRDROP_WALLET =
        0x56aD64Ae67eEd1f84eBBA7348A0850FE9d597aD2;

    address public constant PARTNERS_WALLET =
        0x748D87424ee8551AAD6B7150A22438996a039F91;

    address public constant DIVIDEND_WALLET =
        0x96aB16FB2A3d5BC99471c8094b8e13D4F4C3F3d3;

    address public constant BURN_WALLET =
        0xFCbeD5F7713B684494b6E4f2c53bE31e3348A6A4;

    // ==================================================
    // POOLS
    // ==================================================

    uint8 public constant POOL_AIRDROP_STAGE = 1;     // BOT -> AIRDROP
    uint8 public constant POOL_AIRDROP_MILESTONE = 2; // MSIG -> AIRDROP
    uint8 public constant POOL_PARTNERS = 3;          // MSIG + CLIFF -> PARTNERS
    uint8 public constant POOL_AIRDROP_CONTEST = 4;   // MSIG + CLIFF -> AIRDROP

    // ==================================================
    // CAPS
    // ==================================================

    uint256 public constant STAGE_POOL_CAP = 1_500_000_000e18;
    uint256 public constant MILESTONE_POOL_CAP = 1_000_000_000e18;

    // ==================================================
    // ACCOUNTING (SoT)
    // ==================================================

    mapping(uint8 => uint256) public funded;
    mapping(uint8 => uint256) public released;
    mapping(uint8 => uint256) public poolBal;

    mapping(uint8 => bool) public releasedStage;       // stageId 1..5
    mapping(uint16 => bool) public releasedMilestone;  // 100/250/500/1000/1500

    // ==================================================
    // CLIFFS
    // ==================================================

    uint256 public constant CLIFF_PARTNERS = 240 hours;
    uint256 public constant CLIFF_CONTEST  = 72 hours;

    struct ArmedRelease {
        uint256 nonce;
        uint256 amount;
        uint64 armedAt;
        uint64 cliffSec;
        bytes32 metaHash;
        bool armed;
    }

    ArmedRelease public partnersArmed;
    ArmedRelease public contestArmed;

    // ==================================================
    // MULTISIG OPS (owner proposes, 2 MSIG approve, execute)
    // ==================================================

    enum OpKind {
        MILESTONE_RELEASE, // pool2 -> airdrop
        PARTNERS_ARM,
        PARTNERS_EXECUTE,
        PARTNERS_CANCEL,
        CONTEST_ARM,
        CONTEST_EXECUTE,
        CONTEST_CANCEL
    }

    struct Operation {
        OpKind kind;
        uint256 nonce;
        uint256 amount;
        uint16 milestoneId; // for milestone
        bytes32 metaHash;
        uint64 proposedAt;
        bool executed;
        uint8 approvalsCount;
        uint8 approvalsMask; // 4-bit mask
    }

    mapping(bytes32 => Operation) public ops;
    mapping(OpKind => uint256) public opNonce;

    // ==================================================
    // EVENTS (PROOF + MSIG)
    // ==================================================

    event PoolFunded(uint8 indexed poolId, uint256 amount, uint256 newFunded);

    event PoolReleased(uint8 indexed poolId, uint256 amount, address indexed to, bytes32 metaHash);

    event StageReleased(uint8 indexed stageId, uint256 amount, uint8 mode, bytes32 metaHash);

    event MilestoneReleased(uint16 indexed milestoneId, uint256 amount, bytes32 metaHash);

    event StageFailedSplit(uint8 indexed stageId, uint256 burnAmount, uint256 dividendAmount, bytes32 metaHash);

    event Armed(uint8 indexed poolId, uint256 nonce, uint256 amount, uint64 armedAt, uint64 cliffEnd, bytes32 metaHash);

    event Executed(uint8 indexed poolId, uint256 nonce, uint256 amount, uint64 executedAt, bytes32 metaHash);

    event Cancelled(uint8 indexed poolId, uint256 nonce, uint64 cancelledAt, bytes32 metaHash);

    // multisig proof
    event Proposed(bytes32 indexed opId, OpKind kind, uint256 nonce, uint256 amount, uint16 milestoneId, bytes32 metaHash);
    event Approved(bytes32 indexed opId, address indexed signer, uint8 approvalsCount, uint8 approvalsMask);
    event OpExecuted(bytes32 indexed opId, OpKind kind);

    // ==================================================
    // CONSTRUCTOR
    // ==================================================

    constructor() {
        owner = msg.sender;
        tokenGENc = IERC20(0x8d9f95Dd624F581803e06652623897DfeCB82CA6);
    }

    // ==================================================
    // FUNDING (OWNER)
    // ==================================================

    function fundStagePool(uint256 amount) external onlyOwner nonReentrant {
        _fund(POOL_AIRDROP_STAGE, amount);
    }

    function fundMilestonePool(uint256 amount) external onlyOwner nonReentrant {
        _fund(POOL_AIRDROP_MILESTONE, amount);
    }

    function fundPartnersPool(uint256 amount) external onlyOwner nonReentrant {
        _fund(POOL_PARTNERS, amount);
    }

    function fundContestPool(uint256 amount) external onlyOwner nonReentrant {
        _fund(POOL_AIRDROP_CONTEST, amount);
    }

    function _fund(uint8 poolId, uint256 amount) internal {
        require(amount > 0, "AMOUNT_0");

        if (poolId == POOL_AIRDROP_STAGE) {
            require(funded[poolId] + amount <= STAGE_POOL_CAP, "STAGE_CAP");
        } else if (poolId == POOL_AIRDROP_MILESTONE) {
            require(funded[poolId] + amount <= MILESTONE_POOL_CAP, "MILESTONE_CAP");
        } else {
            require(poolId == POOL_PARTNERS || poolId == POOL_AIRDROP_CONTEST, "BAD_POOL");
        }

        funded[poolId] += amount;
        poolBal[poolId] += amount;

        tokenGENc.safeTransferFrom(msg.sender, address(this), amount);
        emit PoolFunded(poolId, amount, funded[poolId]);
    }

    // ==================================================
    // BOT (STAGE POOL ONLY)
    // ==================================================

    function releaseStage(uint8 stageId, bytes32 metaHash) external onlyGeneral nonReentrant {
        require(stageId >= 1 && stageId <= 5, "STAGE_RANGE");
        require(!releasedStage[stageId], "STAGE_ALREADY");

        uint256 amount = _stageAmount(stageId);
        require(poolBal[POOL_AIRDROP_STAGE] >= amount, "POOL_BAL_LOW");

        releasedStage[stageId] = true;
        poolBal[POOL_AIRDROP_STAGE] -= amount;
        released[POOL_AIRDROP_STAGE] += amount;

        tokenGENc.safeTransfer(AIRDROP_WALLET, amount);

        emit StageReleased(stageId, amount, 1, metaHash);
        emit PoolReleased(POOL_AIRDROP_STAGE, amount, AIRDROP_WALLET, metaHash);
    }

    function releaseStageFail(uint8 stageId, bytes32 metaHash) external onlyGeneral nonReentrant {
        require(stageId >= 2 && stageId <= 4, "FAIL_ONLY_234");
        require(!releasedStage[stageId], "STAGE_ALREADY");

        uint256 amount = _stageAmount(stageId);
        require(poolBal[POOL_AIRDROP_STAGE] >= amount, "POOL_BAL_LOW");

        releasedStage[stageId] = true;
        poolBal[POOL_AIRDROP_STAGE] -= amount;
        released[POOL_AIRDROP_STAGE] += amount;

        uint256 half = amount / 2;
        uint256 burnAmount = half;
        uint256 dividendAmount = amount - half;

        tokenGENc.safeTransfer(BURN_WALLET, burnAmount);
        tokenGENc.safeTransfer(DIVIDEND_WALLET, dividendAmount);

        emit StageFailedSplit(stageId, burnAmount, dividendAmount, metaHash);
        emit StageReleased(stageId, amount, 2, metaHash);

        emit PoolReleased(POOL_AIRDROP_STAGE, burnAmount, BURN_WALLET, metaHash);
        emit PoolReleased(POOL_AIRDROP_STAGE, dividendAmount, DIVIDEND_WALLET, metaHash);
    }

    // ==================================================
    // MULTISIG PROPOSE (OWNER ONLY)
    // ==================================================

    function proposeMilestone(uint16 milestoneId, bytes32 metaHash) external onlyOwner returns (bytes32 opId) {
        require(_isMilestoneValid(milestoneId), "MILESTONE_INVALID");
        require(!releasedMilestone[milestoneId], "MILESTONE_ALREADY");

        uint256 amount = _milestoneAmount(milestoneId);
        require(poolBal[POOL_AIRDROP_MILESTONE] >= amount, "POOL_BAL_LOW");

        uint256 nonce = ++opNonce[OpKind.MILESTONE_RELEASE];
        opId = keccak256(abi.encode(OpKind.MILESTONE_RELEASE, nonce, amount, milestoneId, metaHash));

        ops[opId] = Operation({
            kind: OpKind.MILESTONE_RELEASE,
            nonce: nonce,
            amount: amount,
            milestoneId: milestoneId,
            metaHash: metaHash,
            proposedAt: uint64(block.timestamp),
            executed: false,
            approvalsCount: 0,
            approvalsMask: 0
        });

        emit Proposed(opId, OpKind.MILESTONE_RELEASE, nonce, amount, milestoneId, metaHash);
    }

    function proposePartnersArm(uint256 amount, bytes32 metaHash) external onlyOwner returns (bytes32 opId) {
        require(!partnersArmed.armed, "ARMED");
        require(amount > 0, "AMOUNT_0");
        require(poolBal[POOL_PARTNERS] >= amount, "POOL_BAL_LOW");

        uint256 nonce = ++opNonce[OpKind.PARTNERS_ARM];
        opId = keccak256(abi.encode(OpKind.PARTNERS_ARM, nonce, amount, uint16(0), metaHash));

        ops[opId] = Operation({
            kind: OpKind.PARTNERS_ARM,
            nonce: nonce,
            amount: amount,
            milestoneId: 0,
            metaHash: metaHash,
            proposedAt: uint64(block.timestamp),
            executed: false,
            approvalsCount: 0,
            approvalsMask: 0
        });

        emit Proposed(opId, OpKind.PARTNERS_ARM, nonce, amount, 0, metaHash);
    }

    function proposePartnersExecute(bytes32 metaHash) external onlyOwner returns (bytes32 opId) {
        require(partnersArmed.armed, "NOT_ARMED");
        require(block.timestamp >= uint256(partnersArmed.armedAt) + uint256(partnersArmed.cliffSec), "CLIFF_ACTIVE");

        uint256 nonce = ++opNonce[OpKind.PARTNERS_EXECUTE];
        uint256 amount = partnersArmed.amount;
        opId = keccak256(abi.encode(OpKind.PARTNERS_EXECUTE, nonce, amount, uint16(0), metaHash));

        ops[opId] = Operation({
            kind: OpKind.PARTNERS_EXECUTE,
            nonce: nonce,
            amount: amount,
            milestoneId: 0,
            metaHash: metaHash,
            proposedAt: uint64(block.timestamp),
            executed: false,
            approvalsCount: 0,
            approvalsMask: 0
        });

        emit Proposed(opId, OpKind.PARTNERS_EXECUTE, nonce, amount, 0, metaHash);
    }

    function proposePartnersCancel(bytes32 metaHash) external onlyOwner returns (bytes32 opId) {
        require(partnersArmed.armed, "NOT_ARMED");

        uint256 nonce = ++opNonce[OpKind.PARTNERS_CANCEL];
        uint256 amount = partnersArmed.amount;
        opId = keccak256(abi.encode(OpKind.PARTNERS_CANCEL, nonce, amount, uint16(0), metaHash));

        ops[opId] = Operation({
            kind: OpKind.PARTNERS_CANCEL,
            nonce: nonce,
            amount: amount,
            milestoneId: 0,
            metaHash: metaHash,
            proposedAt: uint64(block.timestamp),
            executed: false,
            approvalsCount: 0,
            approvalsMask: 0
        });

        emit Proposed(opId, OpKind.PARTNERS_CANCEL, nonce, amount, 0, metaHash);
    }

    function proposeContestArm(uint256 amount, bytes32 metaHash) external onlyOwner returns (bytes32 opId) {
        require(!contestArmed.armed, "ARMED");
        require(amount > 0, "AMOUNT_0");
        require(poolBal[POOL_AIRDROP_CONTEST] >= amount, "POOL_BAL_LOW");

        uint256 nonce = ++opNonce[OpKind.CONTEST_ARM];
        opId = keccak256(abi.encode(OpKind.CONTEST_ARM, nonce, amount, uint16(0), metaHash));

        ops[opId] = Operation({
            kind: OpKind.CONTEST_ARM,
            nonce: nonce,
            amount: amount,
            milestoneId: 0,
            metaHash: metaHash,
            proposedAt: uint64(block.timestamp),
            executed: false,
            approvalsCount: 0,
            approvalsMask: 0
        });

        emit Proposed(opId, OpKind.CONTEST_ARM, nonce, amount, 0, metaHash);
    }

    function proposeContestExecute(bytes32 metaHash) external onlyOwner returns (bytes32 opId) {
        require(contestArmed.armed, "NOT_ARMED");
        require(block.timestamp >= uint256(contestArmed.armedAt) + uint256(contestArmed.cliffSec), "CLIFF_ACTIVE");

        uint256 nonce = ++opNonce[OpKind.CONTEST_EXECUTE];
        uint256 amount = contestArmed.amount;
        opId = keccak256(abi.encode(OpKind.CONTEST_EXECUTE, nonce, amount, uint16(0), metaHash));

        ops[opId] = Operation({
            kind: OpKind.CONTEST_EXECUTE,
            nonce: nonce,
            amount: amount,
            milestoneId: 0,
            metaHash: metaHash,
            proposedAt: uint64(block.timestamp),
            executed: false,
            approvalsCount: 0,
            approvalsMask: 0
        });

        emit Proposed(opId, OpKind.CONTEST_EXECUTE, nonce, amount, 0, metaHash);
    }

    function proposeContestCancel(bytes32 metaHash) external onlyOwner returns (bytes32 opId) {
        require(contestArmed.armed, "NOT_ARMED");

        uint256 nonce = ++opNonce[OpKind.CONTEST_CANCEL];
        uint256 amount = contestArmed.amount;
        opId = keccak256(abi.encode(OpKind.CONTEST_CANCEL, nonce, amount, uint16(0), metaHash));

        ops[opId] = Operation({
            kind: OpKind.CONTEST_CANCEL,
            nonce: nonce,
            amount: amount,
            milestoneId: 0,
            metaHash: metaHash,
            proposedAt: uint64(block.timestamp),
            executed: false,
            approvalsCount: 0,
            approvalsMask: 0
        });

        emit Proposed(opId, OpKind.CONTEST_CANCEL, nonce, amount, 0, metaHash);
    }

    // ==================================================
    // APPROVE (MSIG ONLY) — needs 2 distinct approvals
    // ==================================================

    function approve(bytes32 opId) external onlyMsig {
        Operation storage op = ops[opId];
        require(op.proposedAt != 0, "OP_NOT_FOUND");
        require(!op.executed, "OP_EXECUTED");

        uint8 idx = _msigIndex(msg.sender); // 1..4
        uint8 bit = uint8(1 << (idx - 1));
        require((op.approvalsMask & bit) == 0, "ALREADY_APPROVED");

        op.approvalsMask |= bit;
        op.approvalsCount += 1;

        emit Approved(opId, msg.sender, op.approvalsCount, op.approvalsMask);
    }

    // ==================================================
    // EXECUTE (ANYONE) — after 2 approvals
    // ==================================================

    function execute(bytes32 opId) external nonReentrant {
        Operation storage op = ops[opId];
        require(op.proposedAt != 0, "OP_NOT_FOUND");
        require(!op.executed, "OP_EXECUTED");
        require(op.approvalsCount >= 2, "NEED_2_APPROVALS");

        op.executed = true;

        if (op.kind == OpKind.MILESTONE_RELEASE) {
            _execMilestone(op);
        } else if (op.kind == OpKind.PARTNERS_ARM) {
            _execPartnersArm(op);
        } else if (op.kind == OpKind.PARTNERS_EXECUTE) {
            _execPartnersExecute(op);
        } else if (op.kind == OpKind.PARTNERS_CANCEL) {
            _execPartnersCancel(op);
        } else if (op.kind == OpKind.CONTEST_ARM) {
            _execContestArm(op);
        } else if (op.kind == OpKind.CONTEST_EXECUTE) {
            _execContestExecute(op);
        } else if (op.kind == OpKind.CONTEST_CANCEL) {
            _execContestCancel(op);
        } else {
            revert("BAD_KIND");
        }

        emit OpExecuted(opId, op.kind);
    }

    // ==================================================
    // INTERNAL EXECS (deterministic)
    // ==================================================

    function _execMilestone(Operation storage op) internal {
        uint16 milestoneId = op.milestoneId;
        require(_isMilestoneValid(milestoneId), "MILESTONE_INVALID");
        require(!releasedMilestone[milestoneId], "MILESTONE_ALREADY");

        uint256 amount = op.amount;
        require(poolBal[POOL_AIRDROP_MILESTONE] >= amount, "POOL_BAL_LOW");

        releasedMilestone[milestoneId] = true;
        poolBal[POOL_AIRDROP_MILESTONE] -= amount;
        released[POOL_AIRDROP_MILESTONE] += amount;

        tokenGENc.safeTransfer(AIRDROP_WALLET, amount);

        emit MilestoneReleased(milestoneId, amount, op.metaHash);
        emit PoolReleased(POOL_AIRDROP_MILESTONE, amount, AIRDROP_WALLET, op.metaHash);
    }

    function _execPartnersArm(Operation storage op) internal {
        require(!partnersArmed.armed, "ARMED");
        require(poolBal[POOL_PARTNERS] >= op.amount, "POOL_BAL_LOW");

        poolBal[POOL_PARTNERS] -= op.amount;

        partnersArmed = ArmedRelease({
            nonce: op.nonce,
            amount: op.amount,
            armedAt: uint64(block.timestamp),
            cliffSec: uint64(CLIFF_PARTNERS),
            metaHash: op.metaHash,
            armed: true
        });

        emit Armed(
            POOL_PARTNERS,
            partnersArmed.nonce,
            op.amount,
            partnersArmed.armedAt,
            uint64(partnersArmed.armedAt + partnersArmed.cliffSec),
            op.metaHash
        );
    }

    function _execPartnersExecute(Operation storage op) internal {
        require(partnersArmed.armed, "NOT_ARMED");
        require(block.timestamp >= uint256(partnersArmed.armedAt) + uint256(partnersArmed.cliffSec), "CLIFF_ACTIVE");

        uint256 amt = partnersArmed.amount;
        uint256 nonce = partnersArmed.nonce;
        bytes32 mh = op.metaHash;

        delete partnersArmed;

        released[POOL_PARTNERS] += amt;
        tokenGENc.safeTransfer(PARTNERS_WALLET, amt);

        emit Executed(POOL_PARTNERS, nonce, amt, uint64(block.timestamp), mh);
        emit PoolReleased(POOL_PARTNERS, amt, PARTNERS_WALLET, mh);
    }

    function _execPartnersCancel(Operation storage op) internal {
        require(partnersArmed.armed, "NOT_ARMED");

        uint256 amt = partnersArmed.amount;
        uint256 nonce = partnersArmed.nonce;
        bytes32 mh = op.metaHash;

        delete partnersArmed;

        poolBal[POOL_PARTNERS] += amt;
        emit Cancelled(POOL_PARTNERS, nonce, uint64(block.timestamp), mh);
    }

    function _execContestArm(Operation storage op) internal {
        require(!contestArmed.armed, "ARMED");
        require(poolBal[POOL_AIRDROP_CONTEST] >= op.amount, "POOL_BAL_LOW");

        poolBal[POOL_AIRDROP_CONTEST] -= op.amount;

        contestArmed = ArmedRelease({
            nonce: op.nonce,
            amount: op.amount,
            armedAt: uint64(block.timestamp),
            cliffSec: uint64(CLIFF_CONTEST),
            metaHash: op.metaHash,
            armed: true
        });

        emit Armed(
            POOL_AIRDROP_CONTEST,
            contestArmed.nonce,
            op.amount,
            contestArmed.armedAt,
            uint64(contestArmed.armedAt + contestArmed.cliffSec),
            op.metaHash
        );
    }

    function _execContestExecute(Operation storage op) internal {
        require(contestArmed.armed, "NOT_ARMED");
        require(block.timestamp >= uint256(contestArmed.armedAt) + uint256(contestArmed.cliffSec), "CLIFF_ACTIVE");

        uint256 amt = contestArmed.amount;
        uint256 nonce = contestArmed.nonce;
        bytes32 mh = op.metaHash;

        delete contestArmed;

        released[POOL_AIRDROP_CONTEST] += amt;
        tokenGENc.safeTransfer(AIRDROP_WALLET, amt);

        emit Executed(POOL_AIRDROP_CONTEST, nonce, amt, uint64(block.timestamp), mh);
        emit PoolReleased(POOL_AIRDROP_CONTEST, amt, AIRDROP_WALLET, mh);
    }

    function _execContestCancel(Operation storage op) internal {
        require(contestArmed.armed, "NOT_ARMED");

        uint256 amt = contestArmed.amount;
        uint256 nonce = contestArmed.nonce;
        bytes32 mh = op.metaHash;

        delete contestArmed;

        poolBal[POOL_AIRDROP_CONTEST] += amt;
        emit Cancelled(POOL_AIRDROP_CONTEST, nonce, uint64(block.timestamp), mh);
    }

    // ==================================================
    // VIEWS / HELPERS
    // ==================================================

    function poolSealed(uint8 poolId) external view returns (bool) {
        if (poolId == POOL_AIRDROP_STAGE) return funded[poolId] == STAGE_POOL_CAP;
        if (poolId == POOL_AIRDROP_MILESTONE) return funded[poolId] == MILESTONE_POOL_CAP;
        if (poolId == POOL_PARTNERS || poolId == POOL_AIRDROP_CONTEST) return false;
        revert("BAD_POOL");
    }

    function _msigIndex(address a) internal pure returns (uint8) {
        if (a == MSIG_1) return 1;
        if (a == MSIG_2) return 2;
        if (a == MSIG_3) return 3;
        if (a == MSIG_4) return 4;
        return 0;
    }

    function _stageAmount(uint8 stageId) internal pure returns (uint256) {
        if (stageId == 1) return 100_000_000e18;
        if (stageId == 2) return 200_000_000e18;
        if (stageId == 3) return 300_000_000e18;
        if (stageId == 4) return 400_000_000e18;
        return 500_000_000e18;
    }

    function _isMilestoneValid(uint16 id) internal pure returns (bool) {
        return (id == 100 || id == 250 || id == 500 || id == 1000 || id == 1500);
    }

    function _milestoneAmount(uint16 id) internal pure returns (uint256) {
        if (id == 100) return 20_000_000e18;
        if (id == 250) return 60_000_000e18;
        if (id == 500) return 140_000_000e18;
        if (id == 1000) return 300_000_000e18;
        return 480_000_000e18;
    }
}
