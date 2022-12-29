//██████╗  █████╗ ██╗      █████╗ ██████╗ ██╗███╗   ██╗
//██╔══██╗██╔══██╗██║     ██╔══██╗██╔══██╗██║████╗  ██║
//██████╔╝███████║██║     ███████║██║  ██║██║██╔██╗ ██║
//██╔═══╝ ██╔══██║██║     ██╔══██║██║  ██║██║██║╚██╗██║
//██║     ██║  ██║███████╗██║  ██║██████╔╝██║██║ ╚████║
//╚═╝     ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝ ╚═╝╚═╝  ╚═══╝


pragma solidity 0.8.16;
//SPDX-License-Identifier: MIT

import "./oz/interfaces/IERC20.sol";
import "./oz/libraries/SafeERC20.sol";
import "./oz/utils/ReentrancyGuard.sol";
import "./interfaces/IDullahanPodManager.sol";
import "./DullahanVault.sol";
import "./modules/DullahanRegistry.sol";
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
    uint256 private constant MAX_UINT256 = 2**256 - 1;

    uint256 public constant MIN_MINT_AMOUNT = 1e9;

    // Storage
    bool public initialized;

    address public manager;
    address public vault;
    address public registry;

    address public podOwner;

    address public delegate;

    address public collateral;
    address public aToken;

    address public aave;
    address public stkAave;


    // Events

    event PodInitialized(
        address indexed podManager,
        address indexed collateral,
        address indexed podOwner,
        address vault,
        address registry,
        address delegate
    );

    event CollateralDeposited(address indexed collateral, uint256 amount);
    event CollateralWithdrawn(address indexed collateral, uint256 amount);
    event CollateralLiquidated(address indexed collateral, uint256 amount);

    event GhoMinted(uint256 mintedAmount);
    event GhoRepayed(uint256 amountToRepay);

    event RentedStkAave();

    event UpdatedDelegate(address indexed oldDelegate, address indexed newDelegate);
    event UpdatedRegistry(address indexed oldRegistry, address indexed newRegistry);


    // Modifers

    modifier onlyPodOwner() {
        if(msg.sender != podOwner) revert Errors.NotPodOwner();
        _;
    }

    modifier onlyManager() {
        if(msg.sender != manager) revert Errors.NotPodManager();
        _;
    }

    modifier isInitialized() {
        if(!initialized) revert Errors.NotInitialized();
        _;
    }


    // Constructor

    constructor() {
        manager = address(0xdEaD);
        vault = address(0xdEaD);
        registry = address(0xdEaD);
        collateral = address(0xdEaD);
        podOwner = address(0xdEaD);
        delegate = address(0xdEaD);
    }

    function init(
        address _manager,
        address _vault,
        address _registry,
        address _podOwner,
        address _collateral,
        address _aToken,
        address _delegate
    ) external {
        if(initialized) revert Errors.AlreadyInitialized();
        if(manager == address(0xdEaD)) revert Errors.CannotInitialize();
        if(
            _manager == address(0)
            || _vault == address(0)
            || _registry == address(0)
            || _podOwner == address(0)
            || _collateral == address(0)
            || _aToken == address(0)
            || _delegate == address(0)
        ) revert Errors.AddressZero();

        initialized = true;
        
        manager = _manager;
        vault = _vault;
        registry = _registry;
        podOwner = _podOwner;
        collateral = _collateral;
        delegate = _delegate;

        aToken = _aToken;

        address _stkAave = DullahanRegistry(_registry).STK_AAVE();
        stkAave = _stkAave;
        aave = DullahanRegistry(registry).AAVE();

        IERC20(_stkAave).safeIncreaseAllowance(_vault, type(uint256).max);

        IGovernancePowerDelegationToken(_stkAave).delegate(_delegate);

        emit PodInitialized(_manager, _collateral, _podOwner, _vault, _registry, _delegate);
    }


    // View functions

    function podCollateralBalance() external view returns(uint256) {
        return IERC20(aToken).balanceOf(address(this));
    }

    function podDebtBalance() public view returns(uint256) {
        return IERC20(DullahanRegistry(registry).DEBT_GHO()).balanceOf(address(this));
    }

    function podOwedFees() external view returns(uint256) {
        return IDullahanPodManager(manager).podOwedFees(address(this));
    }


    // State-changing functions

    function depositCollateral(uint256 amount) external nonReentrant isInitialized onlyPodOwner {
        if(amount == 0) revert Errors.NullAmount();
        if(!IDullahanPodManager(manager).updatePodState(address(this))) revert Errors.FailPodStateUpdate();

        IERC20 _collateral = IERC20(collateral);
        // pull collateral
        _collateral.safeTransferFrom(msg.sender, address(this), amount);

        address _aavePool = DullahanRegistry(registry).AAVE_POOL_V3();
        _collateral.safeIncreaseAllowance(_aavePool, amount);
        IAavePool(_aavePool).supply(collateral, amount, address(this), 0);

        emit CollateralDeposited(collateral, amount);
    }

    // Can give MAX_UINT256 to unstake full balance
    function withdrawCollateral(uint256 amount, address receiver) external nonReentrant isInitialized onlyPodOwner {
        // Use type(uint).max to withdraw all
        if(amount == 0) revert Errors.NullAmount();
        if(receiver == address(0)) revert Errors.AddressZero();
        if(!IDullahanPodManager(manager).updatePodState(address(this))) revert Errors.FailPodStateUpdate();

        if(amount == MAX_UINT256) amount = IERC20(aToken).balanceOf(address(this));

        // Not allowed to withdraw collateral before paying the owed fees,
        // in case we need to liquidate part if this collateral to pay
        // the fees owed by this Pod.
        if(
            IDullahanPodManager(manager).podOwedFees(address(this)) > 0
        ) revert Errors.CollateralBlocked();

        IAavePool(DullahanRegistry(registry).AAVE_POOL_V3()).withdraw(collateral, amount, receiver);

        emit CollateralWithdrawn(collateral, amount);
    }

    function claimAaveExtraRewards(address receiver) external nonReentrant isInitialized onlyPodOwner {
        if(receiver == address(0)) revert Errors.AddressZero();
        address[] memory assets = new address[](1);
        assets[0] = aToken;
        IAaveRewardsController(DullahanRegistry(registry).AAVE_REWARD_COONTROLLER()).claimAllRewards(assets, receiver);
    }

    function compoundStkAave() external nonReentrant isInitialized {
        _getStkAaveRewards();
    }

    function mintGHO(uint256 amountToMint, address receiver) external nonReentrant isInitialized onlyPodOwner returns(uint256 mintedAmount) {
        if(amountToMint == 0) revert Errors.NullAmount();
        if(receiver == address(0)) revert Errors.AddressZero();
        if(amountToMint < MIN_MINT_AMOUNT) revert Errors.MintAmountUnderMinimum();
        IDullahanPodManager _manager = IDullahanPodManager(manager);
        if(!_manager.updatePodState(address(this))) revert Errors.FailPodStateUpdate();

        // Update this contract stkAAVE current balance is there is one
        _getStkAaveRewards();

        // get stkAAVE -> based on amount wanted to be minted / already minted
        // will also take care of reverting if the Pod is not allowed to mint or can't receive stkAAVE
        if(!_manager.getStkAave(amountToMint)) revert Errors.MintingAllowanceFailed();

        emit RentedStkAave();

        address _ghoAddress = DullahanRegistry(registry).GHO();
        IAavePool(DullahanRegistry(registry).AAVE_POOL_V3()).borrow(_ghoAddress, amountToMint, 2, 0, address(this)); // 2 => variable mode (might need to change that)

        IERC20 _gho = IERC20(_ghoAddress);
        uint256 mintFeeRatio = _manager.mintFeeRatio();
        uint256 mintFeeAmount = (amountToMint * mintFeeRatio) / MAX_BPS;
        _gho.safeTransfer(manager, mintFeeAmount);
        _manager.notifyMintingFee(mintFeeAmount);

        mintedAmount = amountToMint - mintFeeAmount;
        _gho.safeTransfer(receiver, mintedAmount);

        emit GhoMinted(mintedAmount);
    }

    // repay GHO -> always take the owed fees before, and then repay to Aave Market
    // Can give MAX_UINT256 to repay everything (needs max allowance)
    function repayGHO(uint256 amountToRepay) external nonReentrant isInitialized onlyPodOwner returns(bool) {
        // Use type(uint).max to repay all
        if(amountToRepay == 0) revert Errors.NullAmount();
        IDullahanPodManager _manager = IDullahanPodManager(manager);
        if(!_manager.updatePodState(address(this))) revert Errors.FailPodStateUpdate();

        // Update this contract stkAAVE current balance is there is one
        _getStkAaveRewards();

        uint256 owedFees = _manager.podOwedFees(address(this));

        // If given the MAX_UINT256, we want to repay the fees and all the debt
        if(amountToRepay == MAX_UINT256) {
            amountToRepay = owedFees + podDebtBalance();
        }

        IERC20 _gho = IERC20(DullahanRegistry(registry).GHO());
        _gho.safeTransferFrom(msg.sender, address(this), amountToRepay);

        uint256 realRepayAmount;
        uint256 feesToPay;

        if(owedFees >= amountToRepay) {
            feesToPay = amountToRepay;
        } else {
            realRepayAmount = amountToRepay - owedFees;
            feesToPay = owedFees;
        }
        
        if(feesToPay > 0) {
            _gho.safeTransfer(manager, feesToPay);
            _manager.notifyPayFee(feesToPay);
        }

        if(realRepayAmount > 0) {
            address _aavePool = DullahanRegistry(registry).AAVE_POOL_V3();
            _gho.safeIncreaseAllowance(_aavePool, realRepayAmount);
            IAavePool(_aavePool).repay(address(_gho), realRepayAmount, 2, address(this)); // 2 => variable mode (might need to change that)
        }

        if(!_manager.freeStkAave(address(this))) revert Errors.FreeingStkAaveFailed();

        emit GhoRepayed(amountToRepay);

        return true;
    }

    // method to ask for more stkAAVE only based on current GHO debt
    function rentStkAave() external nonReentrant isInitialized onlyPodOwner returns(bool) {
        IDullahanPodManager _manager = IDullahanPodManager(manager);
        if(!_manager.updatePodState(address(this))) revert Errors.FailPodStateUpdate();

        // Update this contract stkAAVE current balance is there is one
        _getStkAaveRewards();

        // get stkAAVE -> based on amount wanted to be minted / already minted
        // will also take care of reverting if the Pod is not allowed to mint or can't receive stkAAVE
        if(!IDullahanPodManager(manager).getStkAave(0)) revert Errors.MintingAllowanceFailed();

        emit RentedStkAave();

        return true;
    }


    // Manager only functions

    // liquidate collateral -> only if this pod got liquidated, and fees are still owed to Dullahan
    function liquidateCollateral(uint256 amount, address receiver) external nonReentrant isInitialized onlyManager {
        if(amount == 0) return;

        // Using MAX_UINT256 here will withdraw everything
        IAavePool(DullahanRegistry(registry).AAVE_POOL_V3()).withdraw(collateral, amount, address(this));

        if(amount == type(uint256).max) {
            amount = IERC20(collateral).balanceOf(address(this));
        }

        IERC20(collateral).transfer(receiver, amount);

        emit CollateralLiquidated(collateral, amount);
    }

    function updateDelegation(address newDelegate) external isInitialized onlyManager {
        if(newDelegate == address(0)) revert Errors.AddressZero();
        if(newDelegate == delegate) revert Errors.SameAddress();

        address oldDelegate = delegate;
        delegate = newDelegate;

        IGovernancePowerDelegationToken(stkAave).delegate(newDelegate);

        emit UpdatedDelegate(oldDelegate, newDelegate);
    }

    function updateRegistry(address newRegistry) external isInitialized onlyManager {
        if(newRegistry == address(0)) revert Errors.AddressZero();
        if(newRegistry == registry) revert Errors.SameAddress();

        address oldRegistry = registry;
        registry = newRegistry;

        emit UpdatedRegistry(oldRegistry, newRegistry);
    }


    // Internal functions

    function _getStkAaveRewards() internal {
        IStakedAave _stkAave = IStakedAave(stkAave);

        //Get pending rewards amount
        uint256 pendingRewards = _stkAave.getTotalRewardsBalance(address(this));

        if (pendingRewards > 0) {
            //claim the AAVE tokens
            _stkAave.claimRewards(address(this), pendingRewards);
        }

        IERC20 _aave = IERC20(aave);
        uint256 currentBalance = _aave.balanceOf(address(this));
        
        if(currentBalance > 0) {
            _aave.safeIncreaseAllowance(address(_stkAave), currentBalance);
            _stkAave.stake(address(this), currentBalance);

            IDullahanPodManager(manager).notifyStkAaveClaim(currentBalance);
        }
    }



}