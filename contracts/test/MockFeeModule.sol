pragma solidity 0.8.16;
//SPDX-License-Identifier: MIT

contract MockFeeModule {

    uint256 public utilRate;
    uint256 public feePerSec = 0.0000000315 ether;

    function setUitlRate(uint256 value) public {
        utilRate = value;
    }

    function setFeePerSec(uint256 value) external {
        feePerSec = value;
    }

    function utilizationRate() public view returns(uint256) {
        return utilRate;
    }

    function getCurrentFeePerSecond() external view returns(uint256 currentFee) {
        return feePerSec;
    }

}