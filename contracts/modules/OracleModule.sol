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

    address public constant AAVE_ORACLE = 0x000000000000000000000000000000000000dEaD;
    address public constant GHO = 0x000000000000000000000000000000000000dEaD;
    
    uint256 public constant GHO_DECIMALS = 18;


    // Functions
    function getCollateralAmount(address collateral, uint256 feeAmount) external view returns(uint256 collateralAmount) {
        uint256 collateralDecimals = IERC20Metadata(collateral).decimals();

        IAaveOracle _oracle = IAaveOracle(AAVE_ORACLE);

        //uint256 priceScale = _oracle.BASE_CURRENCY_UNIT(); => not needed since all prices should be with the same scale

        uint256 collateralPrice = _oracle.getAssetPrice(collateral);
        uint256 feePrice = _oracle.getAssetPrice(GHO);

        if(collateralDecimals > GHO_DECIMALS) {
            return ((feeAmount * feePrice) * (10**(collateralDecimals - GHO_DECIMALS))) / collateralPrice;
        } else {
            return ((feeAmount * feePrice) / (10**(GHO_DECIMALS - collateralDecimals))) / collateralPrice;
        }

    }

}