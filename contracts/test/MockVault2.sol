pragma solidity 0.8.16;
//SPDX-License-Identifier: MIT

import "../oz/interfaces/IERC20.sol";
import "../oz/libraries/SafeERC20.sol";
import "./MockERC20.sol";

contract MockVault2 {
    using SafeERC20 for IERC20;

    address public immutable STK_AAVE;
    address public immutable AAVE;

    address public manager;

    address public delegate;

    mapping(address => uint256) public managerRentedAmounts;

    constructor(
        address _aave,
        address _stkAave
    ) {
        AAVE = _aave;
        STK_AAVE = _stkAave;
    }

    function totalAvailable() external view returns(uint256) {
        return IERC20(STK_AAVE).balanceOf(address(this));
    }

    function setManager(address _manager) external {
        manager = _manager;
    }

    function rentStkAave(address pod, uint256 amount) external {
        managerRentedAmounts[msg.sender] += amount;

        IERC20 _stkAave = IERC20(STK_AAVE);
        _stkAave.safeTransfer(pod, amount);
    }

    function notifyRentedAmount(address pod, uint256 addedAmount) external {
        pod;
        managerRentedAmounts[msg.sender] += addedAmount;
    }

    function pullRentedStkAave(address pod, uint256 amount) external {
        managerRentedAmounts[msg.sender] -= amount;

        // We consider that pod give MAX_UINT256 allowance to this contract when created
        IERC20(STK_AAVE).safeTransferFrom(pod, address(this), amount);
    }

    function withdrawStkAave(uint256 amount) external {
        IERC20(STK_AAVE).safeTransfer(msg.sender, amount);
    }

    function setDelegate(address _delegate) external {
        delegate = _delegate;
    }

    function getDelegate() external view returns(address) {
        return delegate;
    }

}