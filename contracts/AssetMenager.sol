// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract AssetMenager is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ======================
    // MODULE: ROLES & TOKEN
    // ======================
    address public immutable owner; 
    address public constant GENERAL = 0x4E309d6A925AE6D9DDfa0e1F846BE5f640b7BF97; // bot
    IERC20  public immutable tokenGENc;   

    modifier onlyOwner()   { require(msg.sender == owner,   "Not owner");   _; }
    modifier onlyGeneral() { require(msg.sender == GENERAL, "Not general"); _; }

    // ======================
    // MODULE: ORIGINS & CAPS
    // ======================
    address public constant ORIGIN_ID1 = 0xa23493758741F118dA4a555B67Aae4A57d2ae54a; // Team
    address public constant ORIGIN_ID2 = 0xD6B0F8bb0F85805df3971EEC9BF4DA5982c8D524; // Marketing
    address public constant ORIGIN_ID3 = 0x4667EB38aBAF064AFA7c750519Ca80aA1cD92cCa; // Dev
    address public constant ORIGIN_ID4 = 0x9102Cd7F68E07526D8BeeA3B9819fEA0275C7C2E; // Expo/Event
    address public constant ORIGIN_ID5 = 0x0C2DAe44547F66b95c83dFBa80c8358e46f5C679; // Future Project
    address public constant ORIGIN_ID6 = 0x3b76647007A9D7d50Dd46eB9EcE910746E3fDb00; // SBA Reserve

    uint256 public constant CAP_ID1 = 5_000_000_000e18;
    uint256 public constant CAP_ID2 = 5_000_000_000e18;
    uint256 public constant CAP_ID3 = 1_000_000_000e18;
    uint256 public constant CAP_ID4 = 3_000_000_000e18;
    uint256 public constant CAP_ID5 = 3_100_000_000e18;
    uint256 public constant CAP_ID6 = 3_100_000_000e18;

    uint256 private constant DAY = 86400; 

    // ======================
    // MODULE: STATE VESTING
    // ======================
    uint64  public wasteStart;      
    bool    public wasteSet;
    mapping(uint8 => uint256) public funded;
    mapping(uint8 => uint256) public released;
    mapping(uint8 => uint16)  public nextIndex;
    mapping(uint8 => uint64)  public lastReleaseTs;

    // ======================
    // MODULE: EVENTS
    // ======================
    event WasteStartSet(uint64 ts);
    event PoolFunded(uint8 indexed id, uint256 amount, uint256 newFunded, address indexed origin);
    event ReleaseExecuted(uint8 indexed id, uint16 index, uint256 amount, address indexed to, uint64 dueTs);

    // ======================
    // MODULE: CTOR
    // ======================
    constructor() {
        owner = msg.sender;
        tokenGENc = IERC20(0x8d9f95Dd624F581803e06652623897DfeCB82CA6);
    }

    // ======================
    // MODULE: ADMIN FUNDING
    // ======================
    function FUND_TEAMGENc(uint256 a)        external onlyOwner nonReentrant { _fund(1, a); }
    function FUND_MARKETINGGENc(uint256 a)   external onlyOwner nonReentrant { _fund(2, a); }
    function FUND_DEVGENc(uint256 a)         external onlyOwner nonReentrant { _fund(3, a); }
    function FUND_EVENTEXPO(uint256 a)       external onlyOwner nonReentrant { _fund(4, a); }
    function FUND_FUTUREPROJECT(uint256 a)   external onlyOwner nonReentrant { _fund(5, a); }
    function FUND_SBA(uint256 a)             external onlyOwner nonReentrant { _fund(6, a); }

    function _fund(uint8 id, uint256 amount) internal {
        require(amount > 0, "ZERO");
        funded[id] += amount;
        require(funded[id] <= capOf(id), "CAP_EXCEEDED");
        tokenGENc.safeTransferFrom(msg.sender, address(this), amount);
        emit PoolFunded(id, amount, funded[id], originOf(id));
    }

    // ======================
    // MODULE: BOT ACTIONS
    // ======================
    function setWasteStart(uint64 ts) external onlyGeneral {
        require(!wasteSet, "SET");
        require(ts > 0, "TS_0");
        wasteStart = ts;
        wasteSet   = true;
        emit WasteStartSet(ts);
    }

    function release(uint8 id) external onlyGeneral nonReentrant {
        require(wasteSet, "WASTE_NOT_SET");
        (uint256[] memory A, uint16[] memory G) = _sched(id);
        uint16 i = nextIndex[id];
        require(i < A.length, "DONE");

        uint64 due = _dueTs(id, i, G);
        require(block.timestamp >= due, "NOT_DUE");

        released[id]      += A[i];
        nextIndex[id]      = i + 1;
        lastReleaseTs[id]  = due;

        tokenGENc.safeTransfer(originOf(id), A[i]);
        emit ReleaseExecuted(id, i, A[i], originOf(id), due);
    }

    // ======================
    // MODULE: VIEWS BASIC
    // ======================
    function capOf(uint8 id) public pure returns (uint256) {
        if (id==1) return CAP_ID1; if (id==2) return CAP_ID2; if (id==3) return CAP_ID3;
        if (id==4) return CAP_ID4; if (id==5) return CAP_ID5; if (id==6) return CAP_ID6;
        revert("BAD_ID");
    }

    function originOf(uint8 id) public pure returns (address) {
        if (id==1) return ORIGIN_ID1; if (id==2) return ORIGIN_ID2; if (id==3) return ORIGIN_ID3;
        if (id==4) return ORIGIN_ID4; if (id==5) return ORIGIN_ID5; if (id==6) return ORIGIN_ID6;
        revert("BAD_ID");
    }

    function nextDue(uint8 id) external view returns (uint64 tsDue, uint16 index, uint256 amount) {
        if (!wasteSet) return (0, nextIndex[id], 0);
        (uint256[] memory A, uint16[] memory G) = _sched(id);
        uint16 i = nextIndex[id];
        if (i >= A.length) return (0, i, 0);
        return (_dueTs(id, i, G), i, A[i]);
    }

    // ======================
    // MODULE: HELPERS (SoT)
    // ======================
    struct PoolStatus {
        uint256 cap;
        uint256 funded;
        uint256 released;
        bool    isSealed;
        bool    wasteSet;
        uint16  nextIndex;
        uint16  len;
        uint64  wasteStart;
        uint64  nextDue;
        uint256 nextAmount;
    }

    function currentDaySinceStart() public view returns (uint64) {
        if (!wasteSet) return 0;
        unchecked { return uint64((block.timestamp - wasteStart) / DAY); }
    }

    function scheduleLen(uint8 id) public view returns (uint16) {
        (uint256[] memory A, ) = _sched(id);
        return uint16(A.length);
    }

    function scheduleAt(uint8 id, uint16 i) public view returns (uint256 amount, uint64 dueTs, bool done) {
        (uint256[] memory A, uint16[] memory G) = _sched(id);
        require(i < A.length, "IDX_OOB");
        amount = A[i];
        dueTs  = _dueTs(id, i, G);
        done   = (i < nextIndex[id]) ? true : false;
    }

    function adviseRelease(uint8 id) public view returns (bool due, uint16 index, uint64 dueTs, uint256 amount) {
        if (!wasteSet) return (false, nextIndex[id], 0, 0);
        (uint256[] memory A, uint16[] memory G) = _sched(id);
        uint16 i = nextIndex[id];
        if (i >= A.length) return (false, i, 0, 0);
        uint64 dts = _dueTs(id, i, G);
        return (block.timestamp >= dts, i, dts, A[i]);
    }

    function poolStatus(uint8 id) public view returns (PoolStatus memory s) {
        (uint256[] memory A, uint16[] memory G) = _sched(id);
        uint16 i = nextIndex[id];
        uint64 nd = 0;
        uint256 na = 0;
        if (wasteSet && i < A.length) {
            nd = _dueTs(id, i, G);
            na = A[i];
        }
        s = PoolStatus({
            cap: capOf(id),
            funded: funded[id],
            released: released[id],
            isSealed: funded[id] == capOf(id),
            wasteSet: wasteSet,
            nextIndex: i,
            len: uint16(A.length),
            wasteStart: wasteStart,
            nextDue: nd,
            nextAmount: na
        });
    }

    function dueTsOf(uint8 id, uint16 i) external view returns (uint64) {
        ( , uint16[] memory G) = _sched(id);
        (uint256[] memory A, ) = _sched(id);
        require(i < A.length, "IDX_OOB");
        return _dueTs(id, i, G);
    }
    
    // ======================
    // MODULE: SCHEDULE CORE
    // ======================
    function _sched(uint8 id) internal pure returns (uint256[] memory A, uint16[] memory G) {
        if (id == 1) {
            A = _mkU(500_000_000e18, 300_000_000e18, 15);
            G = _mkG(0, 100, 30, 15);
            return (A, G);
        }

        if (id == 2) {
            A = _mkU(500_000_000e18, 300_000_000e18, 15);
            G = _mkG(0, 75, 30, 15);
            return (A, G);
        }

        if (id == 3) {
            A = _mkU(200_000_000e18, 100_000_000e18, 8);
            G = _mkG(90, 50, 50, 7);
            return (A, G);
        }

        if (id == 4) {
            A = _mkU(1_000_000_000e18, 1_000_000_000e18, 2);
            G = _mkG(365, 365, 365, 1);
            return (A, G);
        }

        if (id == 5) {
            A = _mkU(3_100_000_000e18, 0, 0);
            G = _mkG(365, 0, 0, 0);
            return (A, G);
        }

        if (id == 6) {
            A = _mkU(600_000_000e18, 500_000_000e18, 5);
            G = _mkG(0, 50, 50, 5);
            return (A, G);
        }

        revert("BAD_ID");
    }



    function _dueTs(uint8 id, uint16 i, uint16[] memory G) internal view returns (uint64) {
        if (i == 0) {
            return uint64(uint256(wasteStart) + uint256(G[0]) * DAY);
        }
        uint64 base = lastReleaseTs[id];
        if (base == 0) {
            base = uint64(uint256(wasteStart) + uint256(G[0]) * DAY);
        }
        return uint64(uint256(base) + uint256(G[i]) * DAY);
    }

    // ======================
    // MODULE: BUILDERS
    // ======================
    function _mkU(uint256 tgeAmt, uint256 repeatAmt, uint8 repTimes) private pure returns (uint256[] memory out) {
        out = new uint256[](1 + repTimes);
        out[0] = tgeAmt;
        for (uint256 i=1; i<out.length; i++) out[i] = repeatAmt;
    }

    function _mkG(uint16 tgeGap, uint16 cliffGap, uint16 stepGap, uint8 repStep) private pure returns (uint16[] memory out) {
        out = new uint16[](2 + repStep);
        out[0] = tgeGap;
        out[1] = cliffGap;          
        for (uint256 i=2; i<out.length; i++) out[i] = stepGap; 
    }
}
