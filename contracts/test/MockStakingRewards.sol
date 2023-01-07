pragma solidity 0.8.16;
//SPDX-License-Identifier: MIT

contract MockStakingRewards {

    uint256 private constant UNIT = 1e18;
    uint256 private constant INITIAL_INDEX = 1e27;
    uint256 private constant DISTRIBUTION_DURATION = 604800; // 1 week
    uint256 private constant MAX_BPS = 10000;
    uint256 private constant MAX_UINT256 = 2**256 - 1;
    uint256 private constant UPDATE_REWARD_RATIO = 8500; // 85 %

    address[] public rewardList;

    struct RewardState {
        uint256 rewardPerToken;
        uint256 lastUpdate;
        uint256 ratePerSecond;
        uint256 currentRewardAmount;
        uint256 queuedRewardAmount;
        uint256 distributionEndTimestamp;
    }

    // reward token => reward state
    mapping(address => RewardState) public rewardStates;

    function queueRewards(address rewardToken, uint256 amount) 
        external
        returns(bool) 
    {

        RewardState storage state = rewardStates[rewardToken];

        if(state.lastUpdate == 0) {
            rewardList.push(rewardToken);
        }

        // Mock state update
        state.lastUpdate = block.timestamp > state.distributionEndTimestamp ? state.distributionEndTimestamp : block.timestamp;

        uint256 totalQueued = amount + state.queuedRewardAmount;

        if(block.timestamp >= state.distributionEndTimestamp){
            _updateRewardDistribution(rewardToken, state, totalQueued);
            state.queuedRewardAmount = 0;

            return true;
        }

        uint256 currentRemainingAmount =  state.ratePerSecond * (state.distributionEndTimestamp - block.timestamp);
        uint256 queuedAmountRatio =  (totalQueued * MAX_BPS) / (totalQueued + currentRemainingAmount);

        if(queuedAmountRatio >= UPDATE_REWARD_RATIO) {
            _updateRewardDistribution(rewardToken, state, totalQueued);
            state.queuedRewardAmount = 0;
        } else {
            state.queuedRewardAmount = totalQueued;
        }

        return true;
    }

    function _updateRewardDistribution(address rewardToken, RewardState storage state, uint256 rewardAmount) internal {
        if(block.timestamp < state.distributionEndTimestamp) {
            uint256 remainingRewards = state.ratePerSecond * (state.distributionEndTimestamp - block.timestamp);
            rewardAmount += remainingRewards;
        }
        state.ratePerSecond = rewardAmount / DISTRIBUTION_DURATION;
        state.currentRewardAmount = rewardAmount;
        state.lastUpdate = block.timestamp;
        uint256 distributionEnd = block.timestamp + DISTRIBUTION_DURATION;
        state.distributionEndTimestamp = distributionEnd;
    }

}