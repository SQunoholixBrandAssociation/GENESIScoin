// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// ============================================================
//  RM01 — Release Module 01 | Strategic Allocation
//  GENESIScoin | SBA
//  Pool    : 50,000,000 GENc
//  Schedule: TGE 20% (10M) + 8 x 10% (5M) every 30 days
//  TGE ref : PreSaleGENc.b100dWhitelistCloseTime (on-chain call)
//  Funder  : PARTNERS_WALLET (onlyPartners)
//  Executor: RM_BOT (onlyBot)
//  Recipient: ALLOCATION_RECIPIENT (hardcoded)
// ============================================================

// Minimal interface — only what RM01 needs from PreSale
interface IPreSaleGENc {
    function b100dWhitelistCloseTime() external view returns (uint256);
}

contract RM01 is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ======================
    // MODULE: ROLES & TOKEN
    // ======================
    address public constant RM_BOT    = 0x6FC7bF33dcE19733e9E3B97B1343A2fe436a73c8;
    IERC20  public immutable tokenGENc;

    modifier onlyBot()      { require(msg.sender == RM_BOT,          "Not bot");      _; }
    modifier onlyPartners() { require(msg.sender == PARTNERS_WALLET, "Not partners"); _; }

    // ======================
    // MODULE: POOL CONSTANTS
    // ======================
    address public constant PARTNERS_WALLET      = 0x748D87424ee8551AAD6B7150A22438996a039F91;
    address public constant ALLOCATION_RECIPIENT = 0xaFCEDC6f23B78d0e3231A4102D6Bb48049AC0d9b;
    address public constant PRESALE_CONTRACT     = 0x019A2D76D825914B5b52552e1A1D09F024CC4C58;

    uint256 public constant POOL_CAP   = 50_000_000e18;
    uint256 private constant DAY       = 86400;
    uint256 private constant TGE_AMT   = 10_000_000e18; // 20% — index 0
    uint256 private constant STEP_AMT  =  5_000_000e18; // 10% — index 1..8
    uint8   private constant TOTAL     = 9;              // 1 TGE + 8 steps
    uint16  private constant STEP_DAYS = 30;

    // ======================
    // MODULE: STATE
    // ======================
    uint256 public funded;
    uint256 public released;
    uint16  public nextIndex;
    bool    public isSealed;

    bool    public tgeSet;
    uint64  public tgeTimestamp;
    uint64  public lastReleaseTs;

    // ======================
    // MODULE: EVENTS
    // ======================
    event PoolFunded(uint256 amount, uint256 totalFunded);
    event PoolSealed(uint256 timestamp);
    event TGETimestampSet(uint64 ts, address indexed presaleRef);
    event ReleaseExecuted(uint16 indexed index, uint256 amount, address indexed to, uint64 dueTs);

    // ======================
    // MODULE: CONSTRUCTOR
    // ======================
    constructor() {
        tokenGENc = IERC20(0x8d9f95Dd624F581803e06652623897DfeCB82CA6);
    }

    // ======================
    // MODULE: PARTNERS FUNDING
    // ======================

    /// @notice PARTNERS_WALLET funds the pool. Auto-seals at POOL_CAP.
    function FUND_POOL(uint256 amount) external onlyPartners nonReentrant {
        require(!isSealed,    "SEALED");
        require(amount > 0, "ZERO");
        funded += amount;
        require(funded <= POOL_CAP, "CAP_EXCEEDED");
        tokenGENc.safeTransferFrom(msg.sender, address(this), amount);
        emit PoolFunded(amount, funded);
        if (funded == POOL_CAP) {
            isSealed = true;
            emit PoolSealed(block.timestamp);
        }
    }

    // ======================
    // MODULE: BOT — SET TGE
    // ======================

    /// @notice Bot triggers TGE timestamp resolution.
    ///         RM01 calls PreSaleGENc directly to read b100dWhitelistCloseTime.
    ///         One-time, immutable after set.
    function SET_TGE() external onlyBot {
        require(isSealed,  "NOT_SEALED");
        require(!tgeSet, "TGE_ALREADY_SET");

        uint256 wlCloseTime = IPreSaleGENc(PRESALE_CONTRACT).b100dWhitelistCloseTime();

        tgeTimestamp = uint64(wlCloseTime);
        tgeSet       = true;
        emit TGETimestampSet(uint64(wlCloseTime), PRESALE_CONTRACT);
    }

    // ======================
    // MODULE: BOT RELEASE
    // ======================

    /// @notice Bot triggers release when schedule permits.
    function RELEASE() external onlyBot nonReentrant {
        require(isSealed,  "NOT_SEALED");
        require(tgeSet,  "TGE_NOT_SET");

        uint16 i = nextIndex;
        require(i < TOTAL, "ALL_RELEASED");

        uint64 due = _dueTs(i);
        require(block.timestamp >= due, "NOT_DUE");

        uint256 amt = (i == 0) ? TGE_AMT : STEP_AMT;

        released      += amt;
        nextIndex      = i + 1;
        lastReleaseTs  = due;

        tokenGENc.safeTransfer(ALLOCATION_RECIPIENT, amt);
        emit ReleaseExecuted(i, amt, ALLOCATION_RECIPIENT, due);
    }

    // ======================
    // MODULE: SCHEDULE CORE
    // ======================

    /// @dev index 0 = TGE (at tgeTimestamp)
    ///      index 1 = tgeTimestamp + 30d
    ///      index N = lastReleaseTs + 30d
    function _dueTs(uint16 i) internal view returns (uint64) {
        if (i == 0) return tgeTimestamp;
        uint64 base = (lastReleaseTs == 0) ? tgeTimestamp : lastReleaseTs;
        return uint64(uint256(base) + uint256(STEP_DAYS) * DAY);
    }

    // ======================
    // MODULE: VIEWS
    // ======================

    function nextDue() external view returns (uint64 dueTs, uint16 index, uint256 amount) {
        if (!tgeSet || !isSealed) return (0, nextIndex, 0);
        uint16 i = nextIndex;
        if (i >= TOTAL) return (0, i, 0);
        uint256 amt = (i == 0) ? TGE_AMT : STEP_AMT;
        return (_dueTs(i), i, amt);
    }

    function adviseRelease() external view returns (bool due, uint16 index, uint64 dueTs, uint256 amount) {
        if (!tgeSet || !isSealed) return (false, nextIndex, 0, 0);
        uint16 i = nextIndex;
        if (i >= TOTAL) return (false, i, 0, 0);
        uint64 d  = _dueTs(i);
        uint256 a = (i == 0) ? TGE_AMT : STEP_AMT;
        return (block.timestamp >= d, i, d, a);
    }

    function scheduleAt(uint16 i) external view returns (uint256 amount, uint64 dueTs, bool done) {
        require(i < TOTAL, "IDX_OOB");
        require(tgeSet,    "TGE_NOT_SET");
        amount = (i == 0) ? TGE_AMT : STEP_AMT;
        dueTs  = _dueTs(i);
        done   = (i < nextIndex);
    }

    struct PoolStatus {
        uint256 cap;
        uint256 funded;
        uint256 released;
        bool    isSealed;
        bool    tgeSet;
        uint64  tgeTimestamp;
        uint16  nextIndex;
        uint16  total;
        uint64  nextDueTs;
        uint256 nextAmount;
    }

    function poolStatus() external view returns (PoolStatus memory s) {
        uint64  nd = 0;
        uint256 na = 0;
        if (tgeSet && isSealed && nextIndex < TOTAL) {
            nd = _dueTs(nextIndex);
            na = (nextIndex == 0) ? TGE_AMT : STEP_AMT;
        }
        s = PoolStatus({
            cap          : POOL_CAP,
            funded       : funded,
            released     : released,
            isSealed       : isSealed,
            tgeSet       : tgeSet,
            tgeTimestamp : tgeTimestamp,
            nextIndex    : nextIndex,
            total        : TOTAL,
            nextDueTs    : nd,
            nextAmount   : na
        });
    }
}

