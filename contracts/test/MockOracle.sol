pragma solidity 0.8.16;
//SPDX-License-Identifier: MIT

contract MockOracle {

    mapping(address => uint256) public prices;

    function getAssetPrice(address asset) external view returns(uint256) {
        return prices[asset];
    }

    function setAssetPrice(address asset, uint256 price) external {
        prices[asset] = price;
    }

}