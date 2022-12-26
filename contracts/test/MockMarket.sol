pragma solidity 0.8.16;
//SPDX-License-Identifier: MIT

import "../oz/interfaces/IERC20.sol";
import "../oz/libraries/SafeERC20.sol";
import "./MockERC20.sol";

contract MockMarket {
    using SafeERC20 for IERC20;

    address public gho;
    address public debtGho;

    mapping(address => mapping(address => uint256)) public deposits;
    mapping(address => uint256) public debt;

    constructor(
        address _gho,
        address _debtGho
    ) {
        gho = _gho;
        debtGho = _debtGho;
    }

    function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external {
        referralCode;

        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);

        deposits[asset][onBehalfOf] += amount;
    }

    function withdraw(address asset, uint256 amount, address to) external {

        deposits[asset][msg.sender] -= amount;

        IERC20(asset).safeTransfer(to, amount);
    }


    function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf) external {
        asset; interestRateMode; referralCode;

        debt[onBehalfOf] += amount;

        MockERC20(gho).mint(msg.sender, amount);
        MockERC20(debtGho).mint(onBehalfOf, amount);
    }

    function repay(address asset, uint256 amount, uint256 rateMode, address onBehalfOf) external {
        asset; rateMode;

        debt[onBehalfOf] -= amount;

        MockERC20(gho).burn(msg.sender, amount);
        MockERC20(debtGho).burn(onBehalfOf, amount);
    }

    // fake supply APY
    function increaseUserDeposit(address asset, address user, uint256 amount) external {
        deposits[asset][user] += amount;
    }

    // fake borrow APY - debt increase
    function increaseUserDebt(address user, uint256 amount) external {
        debt[user] += amount;
    }

    function liquidateUser(address user, uint256 amount, address collateral, uint256 collateralAmount) external {
        address liquidator = msg.sender;

        debt[user] -= amount;
        deposits[collateral][msg.sender] -= collateralAmount;

        IERC20(collateral).safeTransfer(liquidator, collateralAmount);

        MockERC20(gho).burn(liquidator, amount);
        MockERC20(debtGho).burn(user, amount);
    }

}