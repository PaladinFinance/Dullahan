pragma solidity 0.8.16;
//SPDX-License-Identifier: MIT

interface ISwapModule {

    function swapCollateralToFees(address collateral, uint256 collateralAmount) external returns(uint256 receivedAmount);

}