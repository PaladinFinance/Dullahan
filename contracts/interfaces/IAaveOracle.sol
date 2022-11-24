// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.16;

interface IAaveOracle {

    function BASE_CURRENCY() external view returns(address);
    function BASE_CURRENCY_UNIT() external view returns(uint256);

    function getAssetPrice(address asset) external view returns(uint256);

    function getSourceOfAsset(address asset) external view returns(address);

    function getFallbackOracle() external view returns(address);

}