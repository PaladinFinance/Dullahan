pragma solidity 0.8.16;
//SPDX-License-Identifier: MIT

interface IDullahanVault {

    function totalAssets() external view returns (uint256);
    function totalRentedAmount() external view returns (uint256);

}