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

    address public constant DEBT_GHO = 0x000000000000000000000000000000000000dEaD;

    address public constant AAVE_POOL_V3 = 0x000000000000000000000000000000000000dEaD;


    // Struct

    struct Pod { // To pack better - gas opti
        address podAddress;
        address podOwner;
        address collateral;
        uint256 allowance; // ??
        // to do
    }


    // Storage

    address public immutable vault;

    address public podImplementation;

    mapping(address => Pod) public pods;
    address[] public allPods;

    mapping(address => bool) public allowedCollaterals;
    mapping(address => address) public aTokenForCollateral;

    uint256 public mintFee = 50; // BPS: 0.5%
    uint256 public extraInterestRatio = 1000; // BPS: 10%


    // Events

    event PodCreation(
        address indexed collateral,
        address indexed podOwner,
        address indexed pod
    );

    event NewCollateral(address indexed collateral, address indexed aToken);
    event CollateralUpdated(address indexed collateral, bool allowed);


    // Modifers

    modifier isValidPod() {
        if(pods[msg.sender].podAddress == address(0)) revert Errors.CallerNotValidPod();
        _;
    }


    // Constructor

    constructor(
        address _vault,
        address _podImplementation
    ) {
        if(_vault == address(0) || _podImplementation == address(0)) revert Errors.AddressZero();

        vault = _vault;
        podImplementation = _podImplementation;
    }


    // View functions

    function podOwedFees(address pod) public view returns(uint256) {
        return 0; // to do
    }

    function getAllPods() external view returns(address[] memory) {
        return allPods;
    }


    // State-changing functions

    function createPod(
        address collateral
    ) external nonReentrant returns(address) {
        if(collateral == address(0)) revert Errors.AddressZero();
        if(!allowedCollaterals[collateral]) revert Errors.CollateralNotAllowed();

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
        // to do:
        // handle fees accrual

        return true;
    }

    function freeStkAave(address pod) external nonReentrant returns(bool) {
        uint256 neededStkAaveAmount = _calculatedNeededStkAave(pod, 0);
        uint256 currentStkAaveBalance = IERC20(STK_AAVE).balanceOf(pod);

        if(currentStkAaveBalance > neededStkAaveAmount) {
            uint256 pullAmount = currentStkAaveBalance - neededStkAaveAmount;

            DullahanVault(vault).pullRentedStkAave(pod, pullAmount);

            // event ?
        }

        return true;
    }

    function updatePodDelegation(address pod) public {
        DullahanPod(pod).updateDelegation(DullahanVault(vault).getDelegate());
    }

    function updateMultiplePodsDelegation(address[] calldata podList) external {
        uint256 length = podList.length;
        for(uint256 i; i < length;){
            updatePodDelegation(podList[i]);
            unchecked { ++i; }
        }
    }


    // Pods only functions

    function getStkAave(uint256 amountToMint) external nonReentrant isValidPod returns(bool){
        address pod = msg.sender;

        uint256 neededStkAaveAmount = _calculatedNeededStkAave(pod, amountToMint);
        uint256 currentStkAaveBalance = IERC20(STK_AAVE).balanceOf(pod);

        uint256 rentAmount = neededStkAaveAmount > currentStkAaveBalance ? neededStkAaveAmount - currentStkAaveBalance : 0;

        if(rentAmount > 0) {
            DullahanVault(vault).rentStkAave(pod, rentAmount);

            // event ?
        }

        return true;
    }

    function notifyStkAaveClaim(uint256 claimedAmount) external nonReentrant isValidPod {
        address _pod = msg.sender;
        DullahanVault(vault).notifyRentedAmount(_pod, claimedAmount);

        // event ?
    }


    // Internal functions

    function _calculatedNeededStkAave(address pod, uint256 addedDebtAmount) internal returns(uint256) {
        // to do
        return 0;
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


}