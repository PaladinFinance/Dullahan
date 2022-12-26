pragma solidity 0.8.16;
//SPDX-License-Identifier: MIT

import "../oz/interfaces/IERC20.sol";
import "../oz/libraries/SafeERC20.sol";
import "../DullahanPod.sol";

contract MockManager {
    using SafeERC20 for IERC20;

    uint256 public constant UNIT = 1e18;
    uint256 public constant MAX_BPS = 10000;

    address public vault;

    address public stkAave;
    address public gho;
    address public ghoDebt;

    mapping(address => uint256) public _podOwedFees;
    mapping(address => uint256) public podRentedAmount;


    mapping(address => uint256) public podStateUpdate; // block number

    uint256 public ghoToStkAaveRatio = 200 ether; // 1 stkAave covers 200 GHO

    constructor(
        address _vault,
        address _stkAave,
        address _gho,
        address _ghoDebt
    ) {
        vault = _vault;
        stkAave = _stkAave;
        gho = _gho;
        ghoDebt = _ghoDebt;
    }

    function mintFeeRatio() external view returns(uint256) {
        return 50;
    }

    function podOwedFees(address pod) external view returns(uint256) {
        return _podOwedFees[pod];
    }

    function setPodOwedFees(address pod, uint256 amount) external {
        _podOwedFees[pod] = amount;
    }

    function updatePodState(address pod) external returns(bool) {
        podStateUpdate[pod] = block.number;

        return true;
    }

    function getStkAave(uint256 amountToMint) external returns(bool) {
        address _pod = msg.sender;

        uint256 neededStkAaveAmount = _calculatedNeededStkAave(_pod, amountToMint);
        uint256 currentStkAaveBalance = IERC20(stkAave).balanceOf(_pod);

        uint256 rentAmount = neededStkAaveAmount > currentStkAaveBalance ? neededStkAaveAmount - currentStkAaveBalance : 0;

        if(rentAmount > 0) {
            podRentedAmount[_pod] += rentAmount;

            IERC20(stkAave).safeTransferFrom(vault, _pod, rentAmount);
        }

        return true;
    }

    function freeStkAave(address pod) external returns(bool) {
        uint256 neededStkAaveAmount = _calculatedNeededStkAave(pod, 0);
        uint256 currentStkAaveBalance = IERC20(stkAave).balanceOf(pod);

        if(currentStkAaveBalance > neededStkAaveAmount) {
            uint256 pullAmount = currentStkAaveBalance - neededStkAaveAmount;

            podRentedAmount[pod] -= pullAmount;

            IERC20(stkAave).safeTransferFrom(pod, vault, pullAmount);
        }

        return true;
    }

    function _calculatedNeededStkAave(address pod, uint256 addedDebtAmount) internal view returns(uint256) {
        uint256 totalDebt = IERC20(ghoDebt).balanceOf(pod) + addedDebtAmount;
        uint256 stkAaveAmount = (totalDebt * UNIT) / ghoToStkAaveRatio;
        return stkAaveAmount;
    }

    function notifyStkAaveClaim(uint256 claimedAmount) external {
        address _pod = msg.sender;

        podRentedAmount[_pod] += claimedAmount;
    }

    function notifyPayFee(uint256 feeAmount) external {
        address _pod = msg.sender;

        _podOwedFees[_pod] -= feeAmount;
    }

}