// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.16;

interface IAavePool {

    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external;
    function withdraw(address asset, uint256 amount, address to) external;

    function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf) external;
    function repay(address asset, uint256 amount, uint256 rateMode, address onBehalfOf) external;
    function repayWithATokens(address asset,uint256 amount,uint256 interestRateMode) external;

    function setUserUseReserveAsCollateral(address asset, bool useAsCollateral) external;

    function getUserAccountData(address user) external view;

}