//██████╗  █████╗ ██╗      █████╗ ██████╗ ██╗███╗   ██╗
//██╔══██╗██╔══██╗██║     ██╔══██╗██╔══██╗██║████╗  ██║
//██████╔╝███████║██║     ███████║██║  ██║██║██╔██╗ ██║
//██╔═══╝ ██╔══██║██║     ██╔══██║██║  ██║██║██║╚██╗██║
//██║     ██║  ██║███████╗██║  ██║██████╔╝██║██║ ╚████║
//╚═╝     ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝ ╚═╝╚═╝  ╚═══╝


pragma solidity 0.8.16;
//SPDX-License-Identifier: MIT

import "../interfaces/IDullahanVault.sol";
import "../interfaces/IFeeModule.sol";
import "../utils/Owner.sol";
import {Errors} from "../utils/Errors.sol";

/** @title Dullahan Fee Module
 *  @author Paladin
 *  @notice Module handling the calculation of fee rate for renting stkaave from the Dullahan Vault
 */
contract DullahanFeeModule is IFeeModule, Owner {

    // Constants

    /** @notice 1e18 scale */
    uint256 public constant UNIT = 1e18;
    /** @notice Max value for BPS - 100% */
    uint256 public constant MAX_BPS = 10000;

    /** @notice Threshold ratio to apply the extra multiplier */
    uint256 public constant TRESHOLD = 0.75 ether;
    /** @notice Base extra multiplier */
    uint256 public constant BASE_MULTIPLIER = 1e18;
    /** @notice Multplier increase for extra ratio over the treshold  */
    uint256 public constant EXTRA_MULTIPLIER_STEP = 4e18;


    // Storage

    /** @notice Address of the Dullahan Vault */
    address public immutable vault;

    /** @notice Amount of GHO fees per second per stkAAVE */
    uint256 public feePerStkAavePerSecond;


    // Events

    /** @notice Event emitted when the fee per second value is updated */
    event UpdatedFeePerStkAavePerSecond(uint256 oldFee, uint256 newFee);


    // Constructor

    constructor(
        address _vault,
        uint256 _startFee
    ) {
        if(_vault == address(0)) revert Errors.AddressZero();
        if(_startFee == 0) revert Errors.NullAmount();

        vault = _vault;
        feePerStkAavePerSecond = _startFee;
    }


    // Functions

    /**
    * @notice Get the current utilization rate
    * @dev Calculates the current utilization rate based on the Vault rented amount & total assets
    * @return uint256 : Current utilization rate
    */
    function utilizationRate() public view returns(uint256) {
        IDullahanVault _vault = IDullahanVault(vault);
        uint256 vaultTotalAssets = _vault.totalAssets();
        uint256 currentlyRented = _vault.totalRentedAmount();

        if(vaultTotalAssets == 0) return 0;

        // Utilization Rate = Current Rented amount / Total Vault Assets
        return (currentlyRented * UNIT) / vaultTotalAssets;
    }

    /**
    * @notice Get the current fee per second
    * @dev Calculates the current fee per second based on the current utilization rate
    * @return currentFee - uint256 : Current fee per second
    */
    function getCurrentFeePerSecond() external view returns(uint256 currentFee) {
        uint256 utilRate = utilizationRate();
        currentFee = feePerStkAavePerSecond;

        // If the Utilization Rate is over the Threshold, increase the fee per second
        // using the calculated multiplier
        if(utilRate >= TRESHOLD) {
            uint256 multiplier = BASE_MULTIPLIER + ((EXTRA_MULTIPLIER_STEP * (utilRate - TRESHOLD) / UNIT));
            currentFee = (currentFee * multiplier) / UNIT;
        }
    }


    // Admin Functions

    /**
    * @notice Updates the feePerStkAavePerSecond parameter
    * @dev Updates the feePerStkAavePerSecond in storage with the given value
    * @param newFee New value tu set
    */
    function updateFeePerStkAavePerSecond(uint256 newFee) external onlyOwner {
        if(newFee == 0) revert Errors.NullAmount();

        uint256 oldFee = feePerStkAavePerSecond;
        feePerStkAavePerSecond = newFee;

        emit UpdatedFeePerStkAavePerSecond(oldFee, newFee);
    }

}