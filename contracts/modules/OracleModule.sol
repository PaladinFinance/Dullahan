pragma solidity 0.8.16;
//SPDX-License-Identifier: MIT

import "../interfaces/IDullahanVault.sol";
import "../interfaces/IOracleModule.sol";
import "../oz/interfaces/IERC20.sol";
import "../interfaces/IAaveOracle.sol";
import {Errors} from "../utils/Errors.sol";

/** @title Dullahan Oracle Module contract
 *  @author Paladin
 *  @notice Module wrapping the Aave Price Oracle to convert owed GHO fees into an amount of collateral.
 */
contract OracleModule is IOracleModule {

    // Constants
    uint256 public constant UNIT = 1e18;

    address public constant AAVE_ORACLE = 0x000000000000000000000000000000000000dEaD;

    address public constant GHO = 0x000000000000000000000000000000000000dEaD;


    // Functions
    function getCollateralAmount(address collateral, uint256 feeAmount) external view returns(uint256 collateralAmount) {

    }

}