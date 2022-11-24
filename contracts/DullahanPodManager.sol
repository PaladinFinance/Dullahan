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
import "./oz/utils/Pausable.sol";
import "./utils/Owner.sol";
import "./oz/libraries/Clones.sol";
import "./DullahanVault.sol";
import "./DullahanPod.sol";
import "./interfaces/IDullahanRewardsStaking.sol";
import "./interfaces/IFeeModule.sol";
import "./interfaces/ISwapModule.sol";
import "./interfaces/IOracleModule.sol";
import {Errors} from "./utils/Errors.sol";

/** @title DullahanPodManager contract
 *  @author Paladin
 *  @notice Dullahan Pod Manager: allows to deploy new Pods & handles the stkAAVE renting
 *          allocations & fee system
 */
contract DullahanPodManager is ReentrancyGuard, Pausable, Owner {
    using SafeERC20 for IERC20;

    // Constants
    uint256 public constant UNIT = 1e18;
    uint256 public constant MAX_BPS = 10000;

    address public constant STK_AAVE = 0x4da27a545c0c5B758a6BA100e3a049001de870f5;

    address public constant GHO = 0x000000000000000000000000000000000000dEaD;
    address public constant DEBT_GHO = 0x000000000000000000000000000000000000dEaD;

    address public constant AAVE_POOL_V3 = 0x000000000000000000000000000000000000dEaD;


    // Struct

    struct Pod { // To pack better - gas opti
        address podAddress;
        address podOwner;
        address collateral;
        uint256 rentedAmount;
        uint256 lastIndex;
        uint256 lastUpdate; // timestamp
        uint256 accruedFees;
    }


    // Storage

    address public immutable vault;

    address public immutable rewardsStaking;

    address public immutable podImplementation;

    mapping(address => bool) public allowedCollaterals;
    mapping(address => address) public aTokenForCollateral;

    mapping(address => Pod) public pods;
    address[] public allPods;

    address public feeModule;
    address public swapModule;
    address public oracleModule;

    address public protocolFeeChest;

    uint256 public lastUpdatedIndex;
    uint256 public lastIndexUpdate;

    uint256 public mintFeeRatio = 50; // BPS: 0.5%
    uint256 public protocolFeeRatio = 500; // BPS: 5%

    uint256 public reserveAmount;


    // Events

    event PodCreation(
        address indexed collateral,
        address indexed podOwner,
        address indexed pod
    );

    event FreedStkAave(address indexed pod, uint256 pullAmount);
    event RentedStkAave(address indexed pod, uint256 rentAmount);

    event LiquidatedPod(address indexed pod, address indexed collateral, uint256 collateralAmount, uint256 receivedFeeAmount);

    event PaidFees(address indexed pod, uint256 feeAmount);

    event ReserveProcessed(uint256 stakingRewardsAmount);

    event NewCollateral(address indexed collateral, address indexed aToken);
    event CollateralUpdated(address indexed collateral, bool allowed);

    event FeeModuleUpdated(address indexed oldMoldule, address indexed newModule);
    event SwapModuleUpdated(address indexed oldMoldule, address indexed newModule);
    event OracleModuleUpdated(address indexed oldMoldule, address indexed newModule);

    event MintFeeRatioUpdated(uint256 oldRatio, uint256 newRatio);
    event ProtocolFeeRatioUpdated(uint256 oldRatio, uint256 newRatio);


    // Modifers

    modifier isValidPod() {
        if(pods[msg.sender].podAddress == address(0)) revert Errors.CallerNotValidPod();
        _;
    }


    // Constructor

    constructor(
        address _vault,
        address _rewardsStaking,
        address _protocolFeeChest,
        address _podImplementation,
        address _feeModule,
        address _swapModule,
        address _oracleModule
    ) {
        if(
            _vault == address(0)
            || _rewardsStaking == address(0)
            || _protocolFeeChest == address(0)
            || _podImplementation == address(0)
            || _feeModule == address(0)
            || _swapModule == address(0)
            || _oracleModule == address(0)
        ) revert Errors.AddressZero();

        vault = _vault;
        rewardsStaking = _rewardsStaking;
        protocolFeeChest = _protocolFeeChest;
        podImplementation = _podImplementation;
        feeModule = _feeModule;
        swapModule = _swapModule;
        oracleModule = _oracleModule;
    }


    // View functions

    function getCurrentIndex() public view returns(uint256) {
        return lastUpdatedIndex + _accruedIndex();
    }

    function podCurrentOwedFees(address pod) public view returns(uint256) {
        if(pods[pod].lastIndex == 0) return 0;
        return pods[pod].accruedFees + (getCurrentIndex() - pods[pod].lastIndex) * pods[pod].rentedAmount;
    }

    function podOwedFees(address pod) public view returns(uint256) {
        return pods[pod].accruedFees;
    }

    function getAllPods() external view returns(address[] memory) {
        return allPods;
    }

    function isPodLiquidable(address pod) public view returns(bool) {
        // We consider the Pod liquidable since the Pod has no more GHO debt from Aave,
        // but still owes fees to Dullahan, but the Pod logic forces to pay fees before
        // repaying debt to Aave.
        return IERC20(DEBT_GHO).balanceOf(pod) == 0 && pods[pod].accruedFees > 0;
    }


    // State-changing functions

    function createPod(
        address collateral
    ) external nonReentrant returns(address) {
        if(collateral == address(0)) revert Errors.AddressZero();
        if(!allowedCollaterals[collateral]) revert Errors.CollateralNotAllowed();
        if(!_updateGlobalState()) revert Errors.FailStateUpdate();

        address podOwner = msg.sender;

        // Clone to create new Pod
        address newPod = Clones.clone(podImplementation);

        // Init Pod
        DullahanPod(newPod).init(
            address(this),
            vault,
            podOwner,
            collateral,
            aTokenForCollateral[collateral],
            DullahanVault(vault).getDelegate()
        );

        // Write new Pod data in storage
        pods[newPod].podAddress = newPod;
        pods[newPod].podOwner = podOwner;
        pods[newPod].collateral = collateral;
        allPods.push(newPod);

        emit PodCreation(collateral, podOwner, newPod);

        return newPod;
    }

    function updatePodState(address pod) external nonReentrant returns(bool) {
        if(pods[pod].podAddress == address(0)) revert Errors.PodInvalid();

        return _updatePodState(pod);
    }

    function freeStkAave(address pod) external nonReentrant returns(bool) {
        if(!_updatePodState(address(this))) revert Errors.FailPodStateUpdate();
        if(pods[pod].podAddress == address(0)) revert Errors.PodInvalid();

        uint256 neededStkAaveAmount = _calculatedNeededStkAave(pod, 0);
        uint256 currentStkAaveBalance = IERC20(STK_AAVE).balanceOf(pod);

        if(currentStkAaveBalance > neededStkAaveAmount) {
            uint256 pullAmount = currentStkAaveBalance - neededStkAaveAmount;

            DullahanVault(vault).pullRentedStkAave(pod, pullAmount);

            emit FreedStkAave(pod, pullAmount);
        }

        return true;
    }

    function liquidatePod(address pod) external nonReentrant returns(bool) {
        if(pods[pod].podAddress == address(0)) revert Errors.PodInvalid();

        _updatePodState(pod);

        // Check if Pod can be liquidated
        if(!isPodLiquidable(pod)) revert Errors.PodNotLiquidable();

        Pod storage _pod = pods[pod];
        uint256 owedFees = _pod.accruedFees;

        // Get the current amount of collateral left in the Pod (from the aToken balance of the Pod, since 1:1 with collateral)
        // (should not have conversion issues since aTokens have the same amount of decimals than the asset)
        uint256 podCollateralBalance = IERC20(aTokenForCollateral[_pod.collateral]).balanceOf(pod);
        // Get amount of collateral to liquidate
        uint256 collateralAmount = IOracleModule(oracleModule).getCollateralAmount(_pod.collateral, owedFees);
        // If the Pod doesn't have enough collateral left to cover all the fees owed,
        // take all the collateral (the whole aToken balance).
        collateralAmount = collateralAmount > podCollateralBalance ? podCollateralBalance : collateralAmount;

        // Liquidate & send to swapper
        DullahanPod(pod).liquidateCollateral(collateralAmount, swapModule);

        // Trigger swapper
        uint256 receivedFeeAmount = ISwapModule(swapModule).swapCollateralToFees(_pod.collateral, collateralAmount);

        // Reset owed fees for the Pod & add fees to Reserve
        _pod.accruedFees = 0;
        reserveAmount += receivedFeeAmount;

        emit LiquidatedPod(pod, _pod.collateral, collateralAmount, receivedFeeAmount);

        return true;
    }

    // method to liquidate by paying GHO to get part of the pod collateral ?

    function updatePodDelegation(address pod) public {
        if(pods[pod].podAddress == address(0)) revert Errors.PodInvalid();

        DullahanPod(pod).updateDelegation(DullahanVault(vault).getDelegate());
    }

    function updateMultiplePodsDelegation(address[] calldata podList) external {
        uint256 length = podList.length;
        for(uint256 i; i < length;){
            updatePodDelegation(podList[i]);
            unchecked { ++i; }
        }
    }

    function processReserve() external nonReentrant returns(bool) {
        if(!_updateGlobalState()) revert Errors.FailStateUpdate();
        uint256 currentReserveAmount = reserveAmount;
        if(currentReserveAmount == 0) return true;

        reserveAmount = 0;

        IERC20 _gho = IERC20(GHO);
        uint256 protocolFees = (currentReserveAmount * protocolFeeRatio) / MAX_BPS;
        _gho.safeTransfer(protocolFeeChest, protocolFees);

        uint256 stakingRewardsAmount = currentReserveAmount - protocolFees;
        IDullahanRewardsStaking(rewardsStaking).queueRewards(GHO, stakingRewardsAmount);
        _gho.safeTransfer(rewardsStaking, stakingRewardsAmount);

        emit ReserveProcessed(stakingRewardsAmount);

        return true;
    }


    // Pods only functions

    function getStkAave(uint256 amountToMint) external nonReentrant isValidPod returns(bool){
        address pod = msg.sender;

        uint256 neededStkAaveAmount = _calculatedNeededStkAave(pod, amountToMint);
        uint256 currentStkAaveBalance = IERC20(STK_AAVE).balanceOf(pod);

        uint256 rentAmount = neededStkAaveAmount > currentStkAaveBalance ? neededStkAaveAmount - currentStkAaveBalance : 0;

        if(rentAmount > 0) {
            pods[pod].rentedAmount += rentAmount;

            DullahanVault(vault).rentStkAave(pod, rentAmount);

            emit RentedStkAave(pod, rentAmount);
        }

        return true;
    }

    function notifyStkAaveClaim(uint256 claimedAmount) external nonReentrant isValidPod {
        address _pod = msg.sender;

        _updatePodState(_pod);

        pods[_pod].rentedAmount += claimedAmount;

        DullahanVault(vault).notifyRentedAmount(_pod, claimedAmount);

        emit RentedStkAave(_pod, claimedAmount);
    }

    function notifyPayFee(uint256 feeAmount) external nonReentrant isValidPod {
        address _pod = msg.sender;
        pods[_pod].accruedFees -= feeAmount;

        reserveAmount += feeAmount;

        emit PaidFees(_pod, feeAmount);
    }


    // Internal functions

    function _calculatedNeededStkAave(address pod, uint256 addedDebtAmount) internal returns(uint256) {
        // to do
        return 0;
    }

    function _accruedIndex() internal view returns(uint256) {
        if(block.timestamp <= lastIndexUpdate) return 0;

        uint256 elapsedTime = block.timestamp - lastIndexUpdate;

        // Fee (in GHO) per rented stkAave per second
        uint256 currentFeePerSec = IFeeModule(feeModule).getCurrentFeePerSecond();
        return currentFeePerSec * elapsedTime;
    }

    function _updateGlobalState() internal returns(bool) {
        uint256 accruedIndex = _accruedIndex();

        lastIndexUpdate = block.timestamp;
        lastUpdatedIndex = lastUpdatedIndex + accruedIndex;

        return true;
    }

    function _updatePodState(address podAddress) internal returns(bool) {
        if(!_updateGlobalState()) revert Errors.FailStateUpdate();

        Pod storage _pod = pods[podAddress];

        uint256 _lastUpdatedIndex = lastUpdatedIndex;
        uint256 _oldPodIndex = _pod.lastIndex;
        _pod.lastIndex = _lastUpdatedIndex;
        _pod.lastUpdate = block.timestamp;

        if(_pod.rentedAmount != 0 && _oldPodIndex != _lastUpdatedIndex){
            _pod.accruedFees += (_lastUpdatedIndex - _oldPodIndex) * _pod.rentedAmount;
        }

        return true;
    }


    // Admin functions

    function addCollateral(address collateral, address aToken) external onlyOwner {
        if(collateral == address(0) || aToken == address(0)) revert Errors.AddressZero();
        if(aTokenForCollateral[collateral] != address(0)) revert Errors.CollateralAlreadyListed();

        allowedCollaterals[collateral] = true;
        aTokenForCollateral[collateral] = aToken;

        emit NewCollateral(collateral, aToken);
    }

    function updateCollateral(address collateral, bool allowed) external onlyOwner {
        if(collateral == address(0)) revert Errors.AddressZero();
        if(aTokenForCollateral[collateral] == address(0)) revert Errors.CollateralNotListed();

        allowedCollaterals[collateral] = allowed;

        emit CollateralUpdated(collateral, allowed);
    }

    function updateFeeModule(address newModule) external onlyOwner {
        if(newModule == address(0)) revert Errors.AddressZero();

        address oldMoldule = feeModule;
        feeModule = newModule;

        emit FeeModuleUpdated(oldMoldule, newModule);
    }

    function updateSwapModule(address newModule) external onlyOwner {
        if(newModule == address(0)) revert Errors.AddressZero();

        address oldMoldule = swapModule;
        swapModule = newModule;

        emit SwapModuleUpdated(oldMoldule, newModule);
    }

    function updateOraclepModule(address newModule) external onlyOwner {
        if(newModule == address(0)) revert Errors.AddressZero();

        address oldMoldule = oracleModule;
        oracleModule = newModule;

        emit OracleModuleUpdated(oldMoldule, newModule);
    }

    function updateMintFeeRatio(uint256 newRatio) external onlyOwner {
        if(newRatio > 500) revert Errors.InvalidParameter();

        uint256 oldRatio = mintFeeRatio;
        mintFeeRatio = newRatio;

        emit MintFeeRatioUpdated(oldRatio, newRatio);
    }

    function updateProtocolFeeRatio(uint256 newRatio) external onlyOwner {
        if(newRatio > 2500) revert Errors.InvalidParameter();

        uint256 oldRatio = protocolFeeRatio;
        protocolFeeRatio = newRatio;

        emit ProtocolFeeRatioUpdated(oldRatio, newRatio);
    }

}