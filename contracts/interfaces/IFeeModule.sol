pragma solidity 0.8.16;
//SPDX-License-Identifier: MIT

interface IFeeModule {

    function getCurrentFeePerSecond() external view returns(uint256 currentFee);

}