pragma solidity 0.8.16;
//SPDX-License-Identifier: MIT

import "../interfaces/IDiscountCalculator.sol";

contract MockCalculator is IDiscountCalculator {

    /** @notice 1e18 scale */
    uint256 public constant UNIT = 1e18;

    function calculateAmountForMaxDiscount(uint256 totalDebtAmount) external pure returns (uint256 neededAmount) {
        return (totalDebtAmount * UNIT) / (50 ether);
    }

}