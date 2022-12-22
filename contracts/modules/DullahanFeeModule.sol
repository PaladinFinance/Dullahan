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
    uint256 public constant UNIT = 1e18;
    uint256 public constant MAX_BPS = 10000;

    uint256 public constant TRESHOLD = 0.75 ether;
    uint256 public constant BASE_MULTIPLIER = 1e18;
    uint256 public constant EXTRA_MULTIPLIER_STEP = 4e18;


    // Storage

    address public immutable vault;

    uint256 public feePerStkAavePerSecond;


    // Events

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

    function utilizationRate() public view returns(uint256) {
        IDullahanVault _vault = IDullahanVault(vault);
        uint256 vaultTotalAssets = _vault.totalAssets();
        uint256 currentlyRented = _vault.totalRentedAmount();

        if(vaultTotalAssets == 0) return 0;

        return (currentlyRented * UNIT) / vaultTotalAssets;
    }

    function getCurrentFeePerSecond() external view returns(uint256 currentFee) {
        uint256 utilRate = utilizationRate();
        currentFee = feePerStkAavePerSecond;

        if(utilRate >= TRESHOLD) {
            uint256 multiplier = BASE_MULTIPLIER + (EXTRA_MULTIPLIER_STEP * (utilRate - TRESHOLD));
            currentFee = (currentFee * multiplier) / UNIT;
        }
    }


    // Admin Functions

    function updateFeePerStkAavePerSecond(uint256 newFee) external onlyOwner {
        if(newFee == 0) revert Errors.NullAmount();

        uint256 oldFee = feePerStkAavePerSecond;
        feePerStkAavePerSecond = newFee;

        emit UpdatedFeePerStkAavePerSecond(oldFee, newFee);
    }

}