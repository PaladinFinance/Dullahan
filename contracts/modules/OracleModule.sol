//██████╗  █████╗ ██╗      █████╗ ██████╗ ██╗███╗   ██╗
//██╔══██╗██╔══██╗██║     ██╔══██╗██╔══██╗██║████╗  ██║
//██████╔╝███████║██║     ███████║██║  ██║██║██╔██╗ ██║
//██╔═══╝ ██╔══██║██║     ██╔══██║██║  ██║██║██║╚██╗██║
//██║     ██║  ██║███████╗██║  ██║██████╔╝██║██║ ╚████║
//╚═╝     ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝ ╚═╝╚═╝  ╚═══╝


pragma solidity 0.8.16;
//SPDX-License-Identifier: BUSL-1.1

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

    /** @notice 1e18 scale */
    uint256 public constant UNIT = 1e18;
    
    /** @notice Number of decimals in the GHO token */
    uint256 public constant GHO_DECIMALS = 18;

    /** @notice Address of the Aave Price Oracle */
    address public immutable AAVE_ORACLE;
    /** @notice Address of the GHO token */
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

    /**
    * @notice Get the amount of collateral for a given amount of fees
    * @dev Calculates the amount of collateral matching the given amount of fees based on current prices
    * @param collateral Address of the collateral
    * @param feeAmount Amount of fees
    * @return uint256 : Amount of collateral
    */
    function getCollateralAmount(address collateral, uint256 feeAmount) external view returns(uint256) {
        uint256 collateralDecimals = IERC20Metadata(collateral).decimals();

        IAaveOracle _oracle = IAaveOracle(AAVE_ORACLE);

        // Get the price for both assets
        uint256 collateralPrice = _oracle.getAssetPrice(collateral);
        uint256 feePrice = _oracle.getAssetPrice(GHO);

        // Calculate & return the amount based on both prices & scaling it to the correct decimals for the given token
        if(collateralDecimals > GHO_DECIMALS) {
            return ((feeAmount * feePrice) * (10**(collateralDecimals - GHO_DECIMALS))) / collateralPrice;
        } else {
            return ((feeAmount * feePrice) / (10**(GHO_DECIMALS - collateralDecimals))) / collateralPrice;
        }

    }

    /**
    * @notice Get the amount of fees for a given amount of collateral
    * @dev Calculates the amount of fees matching the given amount of collateral based on current prices
    * @param collateral Address of the collateral
    * @param collateralAmount Amount of collateral
    * @return uint256 : Amount of fees
    */
    function getFeeAmount(address collateral, uint256 collateralAmount) external view returns(uint256) {
        uint256 collateralDecimals = IERC20Metadata(collateral).decimals();

        IAaveOracle _oracle = IAaveOracle(AAVE_ORACLE);

        // Get the price for both assets
        uint256 collateralPrice = _oracle.getAssetPrice(collateral);
        uint256 feePrice = _oracle.getAssetPrice(GHO);

        // Calculate & return the amount based on both prices & scaling it from the decimals of the given token
        if(collateralDecimals > GHO_DECIMALS) {
            return ((collateralAmount * collateralPrice) / (10**(collateralDecimals - GHO_DECIMALS))) / feePrice;
        } else {
            return ((collateralAmount * collateralPrice) * (10**(GHO_DECIMALS - collateralDecimals))) / feePrice;
        }
    }

}