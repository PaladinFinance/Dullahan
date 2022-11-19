// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.16;

interface IAaveDebtToken {

    function UNDERLYING_ASSET_ADDRESS() external view;

    function decimals() external view;

    function balanceOf(address account) external view;
    function totalSupply() external view;

}