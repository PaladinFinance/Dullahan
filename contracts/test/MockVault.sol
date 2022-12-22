pragma solidity 0.8.16;
//SPDX-License-Identifier: MIT

contract MockVault {

    uint256 public _totalAssets;
    uint256 public _totalRentedAmount;

    function totalAssets() external view returns (uint256){
        return _totalAssets;
    }

    function totalRentedAmount() external view returns (uint256){
        return _totalRentedAmount;
    }

    function setTotalAssets(uint256 value) external {
        _totalAssets = value;
    }
    
    function setTotalRentedAmount(uint256 value) external {
        _totalRentedAmount = value;
    }

}