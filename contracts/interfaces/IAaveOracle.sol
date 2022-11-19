// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.16;

interface IAaveOracle {

    function BASE_CURRENCY() external view;
    function BASE_CURRENCY_UNIT() external view;

    function getAssetPrice(address asset) external view;

    function getSourceOfAsset(address asset) external view;

    function getFallbackOracle() external view;

}