pragma solidity 0.8.16;
//SPDX-License-Identifier: MIT

import "./oz/interfaces/IERC20.sol";
import "./oz/libraries/SafeERC20.sol";
import "./oz/utils/ReentrancyGuard.sol";
import "./interfaces/IDullahanPodManager.sol";
import "./DullahanVault.sol";
import "./interfaces/IStakedAave.sol";
import "./interfaces/IAavePool.sol";
import "./interfaces/IGovernancePowerDelegationToken.sol";
import "./interfaces/IAaveRewardsController.sol";
import {Errors} from "./utils/Errors.sol";

/** @title Dullahan Pod contract
 *  @author Paladin
 *  @notice Dullahan Pod, unique to each user, allowing to depoist collateral,
 *          rent stkAAVE from the Dullahan Vault & borrow GHO
 */
contract DullahanPod is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Constants
    uint256 public constant UNIT = 1e18;
    uint256 public constant MAX_BPS = 10000;

    uint256 public constant MIN_MINT_AMOUNT = 1e9;

    address public constant STK_AAVE = 0x4da27a545c0c5B758a6BA100e3a049001de870f5;
    address public constant AAVE = 0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9;

    address public constant GHO = 0x000000000000000000000000000000000000dEaD;

    address public constant AAVE_POOL_V3 = 0x000000000000000000000000000000000000dEaD;

    address public constant AAVE_REWARD_COONTROLLER = 0x000000000000000000000000000000000000dEaD;

    // Storage
    bool public initialized;

    address public manager;
    address public vault;

    address public podOwner;

    address public delegate;

    address public collateral;
    address public aToken;


    // Events

    event PodInitialized(
        address indexed podManager,
        address indexed collateral,
        address indexed podOwner,
        address vault,
        address delegate
    );

    event UpdatedDelegate(address indexed oldDelegate, address indexed newDelegate);


    // Modifers

    modifier onlyPodOwner() {
        if(msg.sender != podOwner) revert Errors.NotPodOwner();
        _;
    }

    modifier onlyManager() {
        if(msg.sender != manager) revert Errors.NotPodManager();
        _;
    }


    // Constructor

    constructor() {
        manager = address(0xdEaD);
        vault = address(0xdEaD);
        collateral = address(0xdEaD);
        podOwner = address(0xdEaD);
        delegate = address(0xdEaD);
    }

    function init(
        address _manager,
        address _vault,
        address _podOwner,
        address _collateral,
        address _aToken,
        address _delegate
    ) external {
        if(initialized) revert Errors.AlreadyInitialized();
        if(
            _manager == address(0)
            || _vault == address(0)
            || _podOwner == address(0)
            || _collateral == address(0)
            || _aToken == address(0)
            || _delegate == address(0)
        ) revert Errors.AddressZero();

        IERC20(STK_AAVE).safeIncreaseAllowance(_vault, type(uint256).max);
        IERC20(GHO).safeIncreaseAllowance(_manager, type(uint256).max);
        
        manager = _manager;
        vault = _vault;
        podOwner = _podOwner;
        collateral = _collateral;
        delegate = _delegate;

        aToken = _aToken;

        IGovernancePowerDelegationToken(STK_AAVE).delegate(_delegate);

        emit PodInitialized(_manager, _collateral, _podOwner, _vault, _delegate);
    }


    // View functions




    // State-changing functions

    function depositCollateral(uint256 amount) external nonReentrant onlyPodOwner {
        if(amount == 0) revert Errors.NullAmount();
        if(!IDullahanPodManager(manager).updatePodState(address(this))) revert Errors.FailPodStateUpdate();

        IERC20 _collateral = IERC20(collateral);
        // pull collateral
        _collateral.safeTransferFrom(podOwner, address(this), amount);

        _collateral.safeIncreaseAllowance(AAVE_POOL_V3, amount);
        IAavePool(AAVE_POOL_V3).supply(collateral, amount, address(this), 0);

        // event here
    }

    function withdrawCollateral(uint256 amount, address receiver) external nonReentrant onlyPodOwner {
        // Use type(uint).max to withdraw all
        if(amount == 0) revert Errors.NullAmount();
        if(receiver == address(0)) revert Errors.AddressZero();
        if(!IDullahanPodManager(manager).updatePodState(address(this))) revert Errors.FailPodStateUpdate();

        if(
            IDullahanPodManager(manager).podOwedFees(address(this)) > 0
            && true
        ) revert Errors.CollateralBlocked();

        IAavePool(AAVE_POOL_V3).withdraw(collateral, amount, receiver);

        // event here
    }

    function claimAaveExtraRewards(address receiver) external nonReentrant onlyPodOwner {
        if(receiver == address(0)) revert Errors.AddressZero();
        address[] memory assets = new address[](1);
        assets[0] = aToken;
        IAaveRewardsController(AAVE_REWARD_COONTROLLER).claimAllRewards(assets, receiver);
    }

    function compoundStkAave() external nonReentrant {
        _getStkAaveRewards();
    }

    function mintGHO(uint256 amountToMint, address receiver) external nonReentrant onlyPodOwner returns(uint256 mintedAmount) {
        if(amountToMint == 0) revert Errors.NullAmount();
        if(receiver == address(0)) revert Errors.AddressZero();
        if(amountToMint < MIN_MINT_AMOUNT) revert Errors.MintAmountUnderMinimum();
        IDullahanPodManager _manager = IDullahanPodManager(manager);
        if(!_manager.updatePodState(address(this))) revert Errors.FailPodStateUpdate();

        // Update this contract stkAAVE current balance is there is one
        _getStkAaveRewards();

        // get stkAAVE -> based on allowance + amount wanted to be minted / already minted
        // will also take care of reverting if the Pod is not allowed ot mint or can't receive stkAAVE
        if(!IDullahanPodManager(manager).getStkAave(amountToMint)) revert Errors.MintingAllowanceFailed();

        IAavePool(AAVE_POOL_V3).borrow(GHO, amountToMint, 2, 0, address(this)); // 2 => variable mode (might need to change that)

        uint256 mintFeeRatio = _manager.mintFee();
        uint256 mintFeeAmount = (amountToMint * mintFeeRatio) / MAX_BPS;
        IERC20(GHO).safeTransfer(manager, mintFeeAmount);

        mintedAmount = amountToMint - mintFeeAmount;
        IERC20(GHO).safeTransfer(receiver, mintedAmount);

        // event here
    }

    // repay GHO -> always take the owed fees before, and then repay to Aave Market
    function repayGHO(uint256 amountToRepay) external nonReentrant onlyPodOwner returns(bool) {
        // Use type(uint).max to repay all
        if(amountToRepay == 0) revert Errors.NullAmount();
        IDullahanPodManager _manager = IDullahanPodManager(manager);
        if(!_manager.updatePodState(address(this))) revert Errors.FailPodStateUpdate();

        // Update this contract stkAAVE current balance is there is one
        _getStkAaveRewards();

        IERC20 _gho = IERC20(GHO);
        _gho.safeTransferFrom(podOwner, address(this), amountToRepay);

        uint256 owedFees = IDullahanPodManager(manager).podOwedFees(address(this));
        uint256 realRepayAmount;
        uint256 feesToPay;

        if(owedFees >= amountToRepay) {
            feesToPay = amountToRepay;
        } else {
            realRepayAmount = amountToRepay - owedFees;
            feesToPay = owedFees;
        }
        
        if(feesToPay > 0) {
            // manager get the fees & reset them
        }

        if(realRepayAmount > 0) {
            _gho.safeIncreaseAllowance(AAVE_POOL_V3, realRepayAmount);
            IAavePool(AAVE_POOL_V3).repay(GHO, realRepayAmount, 2, address(this)); // 2 => variable mode (might need to change that)
        }

        if(!IDullahanPodManager(manager).freeStkAave(address(this))) revert Errors.FreeingStkAaveFailed();

        // event here

        return true;
    }

    // method to ask for more stkAAVE only based on current GHO debt
    function rentStkAave() external nonReentrant onlyPodOwner returns(bool) {
        IDullahanPodManager _manager = IDullahanPodManager(manager);
        if(!_manager.updatePodState(address(this))) revert Errors.FailPodStateUpdate();

        // Update this contract stkAAVE current balance is there is one
        _getStkAaveRewards();

        // get stkAAVE -> based on allowance + amount wanted to be minted / already minted
        // will also take care of reverting if the Pod is not allowed ot mint or can't receive stkAAVE
        if(!IDullahanPodManager(manager).getStkAave(0)) revert Errors.MintingAllowanceFailed();

        // event here
    }


    // Manager only functions

    // liquidate collateral -> only if this pod got liquidated, and fees are still owed to Dullahan

    function updateDelegation(address newDelegate) external onlyManager {
        if(newDelegate == address(0)) revert Errors.AddressZero();
        if(newDelegate == delegate) revert Errors.SameAddress();

        address oldDelegate = delegate;
        delegate = newDelegate;

        IGovernancePowerDelegationToken(STK_AAVE).delegate(newDelegate);

        emit UpdatedDelegate(oldDelegate, newDelegate);
    }


    // Internal functions

    function _getStkAaveRewards() internal {
        IStakedAave _stkAave = IStakedAave(STK_AAVE);

        //Get pending rewards amount
        uint256 pendingRewards = _stkAave.getTotalRewardsBalance(address(this));

        if (pendingRewards > 0) {
            //claim the AAVE tokens
            _stkAave.claimRewards(address(this), pendingRewards);
        }

        IERC20 _aave = IERC20(AAVE);
        uint256 currentBalance = IERC20(_aave).balanceOf(address(this));
        
        if(currentBalance > 0) {
            IERC20(_aave).safeIncreaseAllowance(STK_AAVE, currentBalance);
            _stkAave.stake(address(this), currentBalance);

            IDullahanPodManager(manager).notifyStkAaveClaim(currentBalance);
        }
    }



}