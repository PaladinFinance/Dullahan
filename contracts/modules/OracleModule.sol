//██████╗  █████╗ ██╗      █████╗ ██████╗ ██╗███╗   ██╗
//██╔══██╗██╔══██╗██║     ██╔══██╗██╔══██╗██║████╗  ██║
//██████╔╝███████║██║     ███████║██║  ██║██║██╔██╗ ██║
//██╔═══╝ ██╔══██║██║     ██╔══██║██║  ██║██║██║╚██╗██║
//██║     ██║  ██║███████╗██║  ██║██████╔╝██║██║ ╚████║
//╚═╝     ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝ ╚═╝╚═╝  ╚═══╝


pragma solidity 0.8.16;
//SPDX-License-Identifier: MIT

import "../interfaces/IDullahanVault.sol";
import "../interfaces/IOracleModule.sol";
import "../oz/extensions/IERC20Metadata.sol";
import "../interfaces/IAaveOracle.sol";
import {Errors} from "../utils/Errors.sol";

/** @title Dullahan Oracle Module contract
 *  @author Paladin
 *  @notice Module wrapping the Aave Price Oracle to convert owed GHO fees into an amount of collateral.
 */
contract OracleModule is IOracleModule {

    // Constants
    uint256 public constant UNIT = 1e18;
    
    uint256 public constant GHO_DECIMALS = 18;

    address public immutable AAVE_ORACLE;
    address public immutable GHO;


    constructor(
        address _oracle,
        address _gho
    ) {
        if(_oracle == address(0) || _gho == address(0)) revert Errors.AddressZero();
        AAVE_ORACLE = _oracle;
        GHO = _gho;
    }


    // Functions

    function getCollateralAmount(address collateral, uint256 feeAmount) external view returns(uint256) {
        uint256 collateralDecimals = IERC20Metadata(collateral).decimals();

        IAaveOracle _oracle = IAaveOracle(AAVE_ORACLE);

        uint256 collateralPrice = _oracle.getAssetPrice(collateral);
        uint256 feePrice = _oracle.getAssetPrice(GHO);

        if(collateralDecimals > GHO_DECIMALS) {
            return ((feeAmount * feePrice) * (10**(collateralDecimals - GHO_DECIMALS))) / collateralPrice;
        } else {
            return ((feeAmount * feePrice) / (10**(GHO_DECIMALS - collateralDecimals))) / collateralPrice;
        }

    }

    function getFeeAmount(address collateral, uint256 collateralAmount) external view returns(uint256) {
        uint256 collateralDecimals = IERC20Metadata(collateral).decimals();

        IAaveOracle _oracle = IAaveOracle(AAVE_ORACLE);

        uint256 collateralPrice = _oracle.getAssetPrice(collateral);
        uint256 feePrice = _oracle.getAssetPrice(GHO);

        if(collateralDecimals > GHO_DECIMALS) {
            return ((collateralAmount * collateralPrice) / (10**(collateralDecimals - GHO_DECIMALS))) / feePrice;
        } else {
            return ((collateralAmount * collateralPrice) * (10**(GHO_DECIMALS - collateralDecimals))) / feePrice;
        }
    }

}