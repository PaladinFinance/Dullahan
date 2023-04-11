//██████╗  █████╗ ██╗      █████╗ ██████╗ ██╗███╗   ██╗
//██╔══██╗██╔══██╗██║     ██╔══██╗██╔══██╗██║████╗  ██║
//██████╔╝███████║██║     ███████║██║  ██║██║██╔██╗ ██║
//██╔═══╝ ██╔══██║██║     ██╔══██║██║  ██║██║██║╚██╗██║
//██║     ██║  ██║███████╗██║  ██║██████╔╝██║██║ ╚████║
//╚═╝     ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝ ╚═╝╚═╝  ╚═══╝

pragma solidity 0.8.16;
//SPDX-License-Identifier: BUSL-1.1

import "../interfaces/IDiscountCalculator.sol";
import {WadRayMath} from  "../utils/WadRayMath.sol";

/** @title Dullahan GHO Discount Calculator Module
 *  @author Paladin
 *  @notice Module handling the calculation of the needed stkAAVE amount ot get the best discount for GHO interests
 */
contract DullahanDiscountCalculator is IDiscountCalculator {
    using WadRayMath for uint256;

    /** @notice 1e18 scale */
    uint256 public constant UNIT = 1e18;

    /**
     * Parameters aken from Aave's GhoDiscountRateStrategy smart contract
     * https://github.com/aave/gho-core/blob/main/src/contracts/facilitators/aave/interestStrategy/GhoDiscountRateStrategy.sol
     * to calculate correctly based on the parameters used by the Strategy
     */
    /** Start of Aave parameters zone */
    /**
     * @dev Amount of debt that is entitled to get a discount per unit of discount token
     * Expressed with the number of decimals of the discounted token
     */
    uint256 public constant GHO_DISCOUNTED_PER_DISCOUNT_TOKEN = 100e18;

    /**
     * @dev Minimum balance amount of discount token to be entitled to a discount
     * Expressed with the number of decimals of the discount token
     */
    uint256 public constant MIN_DISCOUNT_TOKEN_BALANCE = 1e18;

    /**
     * @dev Minimum balance amount of debt token to be entitled to a discount
     * Expressed with the number of decimals of the debt token
     */
    uint256 public constant MIN_DEBT_TOKEN_BALANCE = 1e18;
    /** End of Aave parameters zone */


    function calculateAmountForMaxDiscount(
        uint256 totalDebtAmount
    ) external pure returns (uint256 neededAmount) {
        if(totalDebtAmount < MIN_DEBT_TOKEN_BALANCE) return 0;

        neededAmount = totalDebtAmount.wadDiv(GHO_DISCOUNTED_PER_DISCOUNT_TOKEN);
        if(neededAmount < MIN_DISCOUNT_TOKEN_BALANCE) neededAmount = 0;
    }
}
