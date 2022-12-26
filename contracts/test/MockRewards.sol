pragma solidity 0.8.16;
//SPDX-License-Identifier: MIT

import "../oz/interfaces/IERC20.sol";
import "../oz/libraries/SafeERC20.sol";
import "./MockERC20.sol";

contract MockRewards {
    using SafeERC20 for IERC20;

    address public rewardToken;
    address public rewardToken2;

    address[] public rewardList;

    mapping(address => mapping(address => uint256)) public userRewards;

    constructor(
        address _rewardToken,
        address _rewardToken2
    ) {
        rewardToken = _rewardToken;
        rewardToken2 = _rewardToken2;

        rewardList.push(rewardToken);
        rewardList.push(rewardToken2);
    }

    function setUserRewards(address token, address user, uint256 amount) external {
        userRewards[token][user] = amount;
    }

    function claimAllRewards(
        address[] calldata assets,
        address to
    ) external returns (
        address[] memory rewardsList,
        uint256[] memory claimedAmounts
    ) {
        assets;
        rewardsList = rewardList;
        claimedAmounts = new uint256[](rewardList.length);

        for(uint256 i; i < rewardsList.length; i++) {
            claimedAmounts[i] = userRewards[rewardsList[i]][msg.sender];
            userRewards[rewardsList[i]][msg.sender] = 0;

            IERC20(rewardsList[i]).safeTransfer(to, claimedAmounts[i]);
        }
    }

}