pragma solidity 0.8.16;
//SPDX-License-Identifier: MIT

import "../base/ScalingERC20.sol";
import {WadRayMath} from  "../utils/WadRayMath.sol";

contract MockScalingERC20 is ScalingERC20 {
    using WadRayMath for uint256;

    uint256 public totalAssets;

    constructor(
        string memory _name,
        string memory _symbol
    ) ScalingERC20(_name, _symbol) {}

    function mint(uint256 amount, address owner) external {
        uint256 _currentIndex = _getCurrentIndex();

        totalAssets += amount;

        _mint(owner, amount, _currentIndex);
    }

    function burn(uint256 amount, address owner) external {
        totalAssets -= amount;

        _burn(owner, amount, false);
    }

    function updateTotalAssets(uint256 newTotalAssets) external {
        totalAssets = newTotalAssets;
    }

    function _getCurrentIndex() internal view override returns (uint256) {
        if(_totalSupply == 0) return INITIAL_INDEX;
        return totalAssets.rayDiv(_totalSupply);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override {}

    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override {}

}