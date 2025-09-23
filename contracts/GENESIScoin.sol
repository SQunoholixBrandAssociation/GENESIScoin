/*
GENESIScoin (GENc)  
Non-mintable | Fixed Supply 100B | Binance Smart Chain
Core of SQUNOHOLIX BRAND ASSOCIATION Digital LAB — Verified & Auditable
*/


// SPDX-License-Identifier: No License
pragma solidity 0.8.25;

import {IERC20, ERC20} from "./ERC20.sol";
import {ERC20Burnable} from "./ERC20Burnable.sol";
import {Ownable, Ownable2Step} from "./Ownable2Step.sol";
import {SafeERC20Remastered} from "./SafeERC20Remastered.sol";

import {DividendTrackerFunctions} from "./CoinDividendTracker.sol";

import {Initializable} from "./Initializable.sol";
import "./IUniswapV2Factory.sol";
import "./IUniswapV2Pair.sol";
import "./IUniswapV2Router01.sol";
import "./IUniswapV2Router02.sol";

contract GENESIScoin is ERC20, ERC20Burnable, Ownable2Step, DividendTrackerFunctions, Initializable {
    
    using SafeERC20Remastered for IERC20;
 
    uint16 public swapThresholdRatio;
    
    uint256 private _devgencPending;
    uint256 private _teamgencPending;
    uint256 private _expansiongencPending;
    uint256 private _liquidityPending;
    uint256 private _rewardsPending;

    address public devgencAddress;
    uint16[3] public devgencFees;

    address public teamgencAddress;
    uint16[3] public teamgencFees;

    address public expansiongencAddress;
    uint16[3] public expansiongencFees;

    uint16[3] public autoBurnFees;

    uint16[3] public liquidityFees;

    uint16[3] public rewardsFees;

    mapping (address => bool) public isExcludedFromFees;

    uint16[3] public totalFees;
    bool private _swapping;

    IUniswapV2Router02 public routerV2;
    address public pairV2;
    mapping (address => bool) public AMMs;

    bool public tradingEnabled;
    mapping (address => bool) public isExcludedFromTradingRestriction;
 
    error InvalidAmountToRecover(uint256 amount, uint256 maxAmount);

    error InvalidToken(address tokenAddress);

    error CannotDepositNativeCoins(address account);

    error InvalidSwapThresholdRatio(uint16 swapThresholdRatio);

    error InvalidTaxRecipientAddress(address account);

    error CannotExceedMaxTotalFee(uint16 buyFee, uint16 sellFee, uint16 transferFee);

    error InvalidAMM(address AMM);

    error TradingAlreadyEnabled();
    error TradingNotEnabled();
 
    event SwapThresholdUpdated(uint16 swapThresholdRatio);

    event WalletTaxAddressUpdated(uint8 indexed id, address newAddress);
    event WalletTaxFeesUpdated(uint8 indexed id, uint16 buyFee, uint16 sellFee, uint16 transferFee);
    event WalletTaxSent(uint8 indexed id, address recipient, uint256 amount);

    event AutoBurnFeesUpdated(uint16 buyFee, uint16 sellFee, uint16 transferFee);
    event AutoBurned(uint256 amount);

    event LiquidityFeesUpdated(uint16 buyFee, uint16 sellFee, uint16 transferFee);
    event LiquidityAdded(uint amountToken, uint amountCoin, uint liquidity);
    event ForceLiquidityAdded(uint256 leftoverTokens, uint256 unaddedTokens);

    event RewardsFeesUpdated(uint16 buyFee, uint16 sellFee, uint16 transferFee);
    event RewardsSent(uint256 amount);

    event ExcludeFromFees(address indexed account, bool isExcluded);

    event RouterV2Updated(address indexed routerV2);
    event AMMUpdated(address indexed AMM, bool isAMM);

    event TradingEnabled();
    event ExcludeFromTradingRestriction(address indexed account, bool isExcluded);
 
    constructor()
        ERC20(unicode"GENESIScoin", unicode"GENc")
        Ownable(msg.sender)
    {
        assembly { if iszero(extcodesize(caller())) { revert(0, 0) } }
        address supplyRecipient = 0x37584fB4CD088B76187257703cB74C72633ca95f;
        
        updateSwapThreshold(50);

        devgencAddressSetup(0x1B9D7Ae16B16dbb262FCBDB016125E0A716FA974);
        devgencFeesSetup(100, 200, 0);

        teamgencAddressSetup(0x4e556f5b51Fd9B23A9EE9d0C539C2601ffAdb411);
        teamgencFeesSetup(100, 50, 0);

        expansiongencAddressSetup(0x3E945A92eC45B19d038183a94e6Ea499fd1403F2);
        expansiongencFeesSetup(100, 50, 0);

        autoBurnFeesSetup(100, 100, 100);

        liquidityFeesSetup(100, 400, 0);

        _deployDividendTracker(7200, 100000000 * (10 ** decimals()) / 10, 2300);

        gasForProcessingSetup(300000);
        rewardsFeesSetup(200, 200, 100);
        _excludeFromDividends(supplyRecipient, true);
        _excludeFromDividends(address(this), true);
        _excludeFromDividends(address(dividendTracker), true);

        excludeFromFees(supplyRecipient, true);
        excludeFromFees(address(this), true); 

        excludeFromTradingRestriction(supplyRecipient, true);
        excludeFromTradingRestriction(address(this), true);

        _mint(supplyRecipient, 1000000000000 * (10 ** decimals()) / 10);
        _transferOwnership(0x37584fB4CD088B76187257703cB74C72633ca95f);
    }
    
    /*
        This token is not upgradeable. Function afterConstructor finishes post-deployment setup.
    */
    function afterConstructor(address _router) initializer external {
        _updateRouterV2(_router);
    }

    function decimals() public pure override returns (uint8) {
        return 18;
    }
    
    function recoverToken(uint256 amount) external onlyOwner {
        uint256 maxRecoverable = balanceOf(address(this)) - getAllPending();
        if (amount > maxRecoverable) revert InvalidAmountToRecover(amount, maxRecoverable);

        _update(address(this), msg.sender, amount);
    }

    function recoverForeignERC20(address tokenAddress, uint256 amount) external onlyOwner {
        if (tokenAddress == address(this)) revert InvalidToken(tokenAddress);

        IERC20(tokenAddress).safeTransfer(msg.sender, amount);
    }

    // Prevent unintended coin transfers
    receive() external payable {
        if (msg.sender != address(routerV2)) revert CannotDepositNativeCoins(msg.sender);
    }

    function _swapTokensForCoin(uint256 tokenAmount) private {
        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = routerV2.WETH();
        
        routerV2.swapExactTokensForETHSupportingFeeOnTransferTokens(tokenAmount, 0, path, address(this), block.timestamp);
    }

    function updateSwapThreshold(uint16 _swapThresholdRatio) public onlyOwner {
        if (_swapThresholdRatio == 0 || _swapThresholdRatio > 500) revert InvalidSwapThresholdRatio(_swapThresholdRatio);

        swapThresholdRatio = _swapThresholdRatio;
        
        emit SwapThresholdUpdated(_swapThresholdRatio);
    }

    function getSwapThresholdAmount() public view returns (uint256) {
        return balanceOf(pairV2) * swapThresholdRatio / 10000;
    }

    function getAllPending() public view returns (uint256) {
        return 0 + _devgencPending + _teamgencPending + _expansiongencPending + _liquidityPending + _rewardsPending;
    }

    function devgencAddressSetup(address _newAddress) public onlyOwner {
        if (_newAddress == address(0)) revert InvalidTaxRecipientAddress(address(0));

        devgencAddress = _newAddress;
        excludeFromFees(_newAddress, true);

        emit WalletTaxAddressUpdated(1, _newAddress);
    }

    function devgencFeesSetup(uint16 _buyFee, uint16 _sellFee, uint16 _transferFee) public onlyOwner {
        totalFees[0] = totalFees[0] - devgencFees[0] + _buyFee;
        totalFees[1] = totalFees[1] - devgencFees[1] + _sellFee;
        totalFees[2] = totalFees[2] - devgencFees[2] + _transferFee;
        if (totalFees[0] > 2500 || totalFees[1] > 2500 || totalFees[2] > 2500) revert CannotExceedMaxTotalFee(totalFees[0], totalFees[1], totalFees[2]);

        devgencFees = [_buyFee, _sellFee, _transferFee];

        emit WalletTaxFeesUpdated(1, _buyFee, _sellFee, _transferFee);
    }

    function teamgencAddressSetup(address _newAddress) public onlyOwner {
        if (_newAddress == address(0)) revert InvalidTaxRecipientAddress(address(0));

        teamgencAddress = _newAddress;
        excludeFromFees(_newAddress, true);

        emit WalletTaxAddressUpdated(2, _newAddress);
    }

    function teamgencFeesSetup(uint16 _buyFee, uint16 _sellFee, uint16 _transferFee) public onlyOwner {
        totalFees[0] = totalFees[0] - teamgencFees[0] + _buyFee;
        totalFees[1] = totalFees[1] - teamgencFees[1] + _sellFee;
        totalFees[2] = totalFees[2] - teamgencFees[2] + _transferFee;
        if (totalFees[0] > 2500 || totalFees[1] > 2500 || totalFees[2] > 2500) revert CannotExceedMaxTotalFee(totalFees[0], totalFees[1], totalFees[2]);

        teamgencFees = [_buyFee, _sellFee, _transferFee];

        emit WalletTaxFeesUpdated(2, _buyFee, _sellFee, _transferFee);
    }

    function expansiongencAddressSetup(address _newAddress) public onlyOwner {
        if (_newAddress == address(0)) revert InvalidTaxRecipientAddress(address(0));

        expansiongencAddress = _newAddress;
        excludeFromFees(_newAddress, true);

        emit WalletTaxAddressUpdated(3, _newAddress);
    }

    function expansiongencFeesSetup(uint16 _buyFee, uint16 _sellFee, uint16 _transferFee) public onlyOwner {
        totalFees[0] = totalFees[0] - expansiongencFees[0] + _buyFee;
        totalFees[1] = totalFees[1] - expansiongencFees[1] + _sellFee;
        totalFees[2] = totalFees[2] - expansiongencFees[2] + _transferFee;
        if (totalFees[0] > 2500 || totalFees[1] > 2500 || totalFees[2] > 2500) revert CannotExceedMaxTotalFee(totalFees[0], totalFees[1], totalFees[2]);

        expansiongencFees = [_buyFee, _sellFee, _transferFee];

        emit WalletTaxFeesUpdated(3, _buyFee, _sellFee, _transferFee);
    }

    function autoBurnFeesSetup(uint16 _buyFee, uint16 _sellFee, uint16 _transferFee) public onlyOwner {
        totalFees[0] = totalFees[0] - autoBurnFees[0] + _buyFee;
        totalFees[1] = totalFees[1] - autoBurnFees[1] + _sellFee;
        totalFees[2] = totalFees[2] - autoBurnFees[2] + _transferFee;
        if (totalFees[0] > 2500 || totalFees[1] > 2500 || totalFees[2] > 2500) revert CannotExceedMaxTotalFee(totalFees[0], totalFees[1], totalFees[2]);

        autoBurnFees = [_buyFee, _sellFee, _transferFee];

        emit AutoBurnFeesUpdated(_buyFee, _sellFee, _transferFee);
    }

    function _swapAndLiquify(uint256 tokenAmount) private returns (uint256 leftover) {
        // Sub-optimal method for supplying liquidity
        uint256 halfAmount = tokenAmount / 2;
        uint256 otherHalf = tokenAmount - halfAmount;

        _swapTokensForCoin(halfAmount);

        uint256 coinBalance = address(this).balance;

        if (coinBalance > 0) {
            (uint amountToken, uint amountCoin, uint liquidity) = _addLiquidity(otherHalf, coinBalance);

            emit LiquidityAdded(amountToken, amountCoin, liquidity);

            return otherHalf - amountToken;
        } else {
            return otherHalf;
        }
    }

    function _addLiquidity(uint256 tokenAmount, uint256 coinAmount) private returns (uint, uint, uint) {
        return routerV2.addLiquidityETH{value: coinAmount}(address(this), tokenAmount, 0, 0, address(0xdead), block.timestamp);
    }

    function addLiquidityFromLeftoverTokens() external {
        uint256 leftoverTokens = balanceOf(address(this)) - getAllPending();

        uint256 unaddedTokens = _swapAndLiquify(leftoverTokens);

        emit ForceLiquidityAdded(leftoverTokens, unaddedTokens);
    }

    function liquidityFeesSetup(uint16 _buyFee, uint16 _sellFee, uint16 _transferFee) public onlyOwner {
        totalFees[0] = totalFees[0] - liquidityFees[0] + _buyFee;
        totalFees[1] = totalFees[1] - liquidityFees[1] + _sellFee;
        totalFees[2] = totalFees[2] - liquidityFees[2] + _transferFee;
        if (totalFees[0] > 2500 || totalFees[1] > 2500 || totalFees[2] > 2500) revert CannotExceedMaxTotalFee(totalFees[0], totalFees[1], totalFees[2]);

        liquidityFees = [_buyFee, _sellFee, _transferFee];

        emit LiquidityFeesUpdated(_buyFee, _sellFee, _transferFee);
    }

    function _sendDividends(uint256 tokenAmount) private {
        _swapTokensForCoin(tokenAmount);

        uint256 dividends = address(this).balance;
        
        if (dividends > 0) {
            (bool success,) = payable(address(dividendTracker)).call{value: dividends}("");
            if (success) emit RewardsSent(dividends);
        }
    }

    function excludeFromDividends(address account, bool isExcluded) external onlyOwner {
        _excludeFromDividends(account, isExcluded);
    }

    function _excludeFromDividends(address account, bool isExcluded) internal override {
        dividendTracker.excludeFromDividends(account, balanceOf(account), isExcluded);
    }

    function rewardsFeesSetup(uint16 _buyFee, uint16 _sellFee, uint16 _transferFee) public onlyOwner {
        totalFees[0] = totalFees[0] - rewardsFees[0] + _buyFee;
        totalFees[1] = totalFees[1] - rewardsFees[1] + _sellFee;
        totalFees[2] = totalFees[2] - rewardsFees[2] + _transferFee;
        if (totalFees[0] > 2500 || totalFees[1] > 2500 || totalFees[2] > 2500) revert CannotExceedMaxTotalFee(totalFees[0], totalFees[1], totalFees[2]);

        rewardsFees = [_buyFee, _sellFee, _transferFee];

        emit RewardsFeesUpdated(_buyFee, _sellFee, _transferFee);
    }

    function excludeFromFees(address account, bool isExcluded) public onlyOwner {
        isExcludedFromFees[account] = isExcluded;
        
        emit ExcludeFromFees(account, isExcluded);
    }

    function _updateRouterV2(address router) private {
        routerV2 = IUniswapV2Router02(router);
        pairV2 = IUniswapV2Factory(routerV2.factory()).createPair(address(this), routerV2.WETH());

        _approve(address(this), router, type(uint256).max);
        _setAMM(router, true);
        _setAMM(pairV2, true);

        emit RouterV2Updated(router);
    }

    function setAMM(address AMM, bool isAMM) external onlyOwner {
        if (AMM == pairV2 || AMM == address(routerV2)) revert InvalidAMM(AMM);

        _setAMM(AMM, isAMM);
    }

    function _setAMM(address AMM, bool isAMM) private {
        AMMs[AMM] = isAMM;

        if (isAMM) { 
            _excludeFromDividends(AMM, true);

        }

        emit AMMUpdated(AMM, isAMM);
    }

    function enableTrading() external onlyOwner {
        if (tradingEnabled) revert TradingAlreadyEnabled();

        tradingEnabled = true;
        
        emit TradingEnabled();
    }

    function excludeFromTradingRestriction(address account, bool isExcluded) public onlyOwner {
        isExcludedFromTradingRestriction[account] = isExcluded;
        
        emit ExcludeFromTradingRestriction(account, isExcluded);
    }


    function _update(address from, address to, uint256 amount)
        internal
        override
    {
        _beforeTokenUpdate(from, to, amount);
        
        if (from != address(0) && to != address(0)) {
            if (!_swapping && amount > 0 && !isExcludedFromFees[from] && !isExcludedFromFees[to]) {
                uint256 fees = 0;
                uint8 txType = 3;
                
                if (AMMs[from] && !AMMs[to]) {
                    if (totalFees[0] > 0) txType = 0;
                }
                else if (AMMs[to] && !AMMs[from]) {
                    if (totalFees[1] > 0) txType = 1;
                }
                else if (!AMMs[from] && !AMMs[to]) {
                    if (totalFees[2] > 0) txType = 2;
                }
                
                if (txType < 3) {
                    
                    uint256 autoBurnPortion = 0;

                    fees = amount * totalFees[txType] / 10000;
                    amount -= fees;
                    
                    _devgencPending += fees * devgencFees[txType] / totalFees[txType];

                    _teamgencPending += fees * teamgencFees[txType] / totalFees[txType];

                    _expansiongencPending += fees * expansiongencFees[txType] / totalFees[txType];

                    if (autoBurnFees[txType] > 0) {
                        autoBurnPortion = fees * autoBurnFees[txType] / totalFees[txType];
                        super._update(from, address(0), autoBurnPortion);
                        emit AutoBurned(autoBurnPortion);
                    }

                    _liquidityPending += fees * liquidityFees[txType] / totalFees[txType];

                    _rewardsPending += fees * rewardsFees[txType] / totalFees[txType];

                    fees = fees - autoBurnPortion;
                }

                if (fees > 0) {
                    super._update(from, address(this), fees);
                }
            }
            
            bool canSwap = getAllPending() >= getSwapThresholdAmount() && balanceOf(pairV2) > 0;
            
            if (!_swapping && from != pairV2 && from != address(routerV2) && canSwap) {
                _swapping = true;
                
                if (false || _devgencPending > 0 || _teamgencPending > 0 || _expansiongencPending > 0) {
                    uint256 token2Swap = 0 + _devgencPending + _teamgencPending + _expansiongencPending;
                    bool success = false;

                    _swapTokensForCoin(token2Swap);
                    uint256 coinsReceived = address(this).balance;
                    
                    uint256 devgencPortion = coinsReceived * _devgencPending / token2Swap;
                    if (devgencPortion > 0) {
                        (success,) = payable(devgencAddress).call{value: devgencPortion, gas: 20000}("");
                        if (success) {
                            emit WalletTaxSent(1, devgencAddress, devgencPortion);
                        }
                    }
                    _devgencPending = 0;

                    uint256 teamgencPortion = coinsReceived * _teamgencPending / token2Swap;
                    if (teamgencPortion > 0) {
                        (success,) = payable(teamgencAddress).call{value: teamgencPortion, gas: 20000}("");
                        if (success) {
                            emit WalletTaxSent(2, teamgencAddress, teamgencPortion);
                        }
                    }
                    _teamgencPending = 0;

                    uint256 expansiongencPortion = coinsReceived * _expansiongencPending / token2Swap;
                    if (expansiongencPortion > 0) {
                        (success,) = payable(expansiongencAddress).call{value: expansiongencPortion, gas: 20000}("");
                        if (success) {
                            emit WalletTaxSent(3, expansiongencAddress, expansiongencPortion);
                        }
                    }
                    _expansiongencPending = 0;

                }

                if (_liquidityPending > 0) {
                    _swapAndLiquify(_liquidityPending);
                    _liquidityPending = 0;
                }

                if (_rewardsPending > 0 && getNumberOfDividendTokenHolders() > 0) {
                    _sendDividends(_rewardsPending);
                    _rewardsPending = 0;
                }

                _swapping = false;
            }

        }

        super._update(from, to, amount);
        
        _afterTokenUpdate(from, to, amount);
        
        if (from != address(0)) dividendTracker.setBalance(from, balanceOf(from));
        if (to != address(0)) dividendTracker.setBalance(to, balanceOf(to));
        
        if (!_swapping) try dividendTracker.process(gasForProcessing) {} catch {}

    }

    function _beforeTokenUpdate(address from, address to, uint256 amount)
        internal
        view
    {
        // Interactions with DEX are disallowed prior to enabling trading by owner
        if (!tradingEnabled) {
            if ((AMMs[from] && !AMMs[to] && !isExcludedFromTradingRestriction[to]) || (AMMs[to] && !AMMs[from] && !isExcludedFromTradingRestriction[from])) {
                revert TradingNotEnabled();
            }
        }

    }

    function _afterTokenUpdate(address from, address to, uint256 amount)
        internal
    {
    }
}
