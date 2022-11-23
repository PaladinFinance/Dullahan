pragma solidity 0.8.16;
//SPDX-License-Identifier: MIT

interface IOracleModule {

    function getCollateralAmount(address collateral, uint256 feeAmount) external view returns(uint256 collateralAmount);

}