//██████╗  █████╗ ██╗      █████╗ ██████╗ ██╗███╗   ██╗
//██╔══██╗██╔══██╗██║     ██╔══██╗██╔══██╗██║████╗  ██║
//██████╔╝███████║██║     ███████║██║  ██║██║██╔██╗ ██║
//██╔═══╝ ██╔══██║██║     ██╔══██║██║  ██║██║██║╚██╗██║
//██║     ██║  ██║███████╗██║  ██║██████╔╝██║██║ ╚████║
//╚═╝     ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝ ╚═╝╚═╝  ╚═══╝


pragma solidity 0.8.16;
//SPDX-License-Identifier: MIT

import "./interfaces/IScalingERC20.sol";
import "./oz/interfaces/IERC20.sol";
import "./oz/interfaces/IERC20.sol";
import "./oz/libraries/SafeERC20.sol";
import "./oz/utils/ReentrancyGuard.sol";
import "./oz/utils/Pausable.sol";
import "./utils/Owner.sol";
import {Errors} from "./utils/Errors.sol";
import {WadRayMath} from  "./utils/WadRayMath.sol";

/** @title DullahanRewardsStaking contract
 *  @author Paladin
 *  @notice Staking system for Dullahan share holders to receive the rewards
 *          generated by Dullahan modules.
 */
contract DullahanRewardsStaking is ReentrancyGuard, Pausable, Owner {
    using SafeERC20 for IERC20;
    using WadRayMath for uint256;


    // Constants

    /** @notice 1e18 scale */
    uint256 private constant UNIT = 1e18;
    /** @notice Max value for BPS - 100% */
    uint256 private constant MAX_BPS = 10000;
    /** @notice Max value possible for an uint256 */
    uint256 private constant MAX_UINT256 = 2**256 - 1;

    /** @notice Duration in second of a reward distribution */
    uint256 private constant DISTRIBUTION_DURATION = 604800; // 1 week
    /** @notice 1e27 - RAY - Initial Index for balance to scaled balance */
    uint256 private constant INITIAL_INDEX = 1e27;
    /** @notice Ratio of the total reward amount to be in the queue before moving it to distribution */
    uint256 private constant UPDATE_REWARD_RATIO = 8500; // 85 %
    /** @notice Amount to deposit to seed the contract during initialization */
    uint256 private constant SEED_DEPOSIT = 0.001 ether;


    // Structs

    /** @notice UserRewardState struct 
    *   lastRewardPerToken: last update reward per token value
    *   accruedRewards: total amount of rewards accrued
    */
    struct UserRewardState {
        uint256 lastRewardPerToken;
        uint256 accruedRewards;
    }

    /** @notice RewardState struct 
    *   rewardPerToken: current reward per token value
    *   lastUpdate: last state update timestamp 
    *   distributionEndTimestamp: timestamp of the end of the current distribution
    *   ratePerSecond: current disitrbution rate per second
    *   currentRewardAmount: current amount of rewards in the distribution
    *   queuedRewardAmount: current amount of reward queued for the distribution
    *   userStates: users reward state for the reward token
    */
    struct RewardState { // to pack better - gas opti
        uint256 rewardPerToken;
        uint128 lastUpdate;
        uint128 distributionEndTimestamp;
        uint256 ratePerSecond;
        uint256 currentRewardAmount;
        uint256 queuedRewardAmount;
        // user address => user reward state
        mapping(address => UserRewardState) userStates;
    }

    /** @notice UserClaimableRewards struct 
    *   reward: address of the reward token
    *   claimableAmount: amount of rewards accrued by the user
    */
    struct UserClaimableRewards {
        address reward;
        uint256 claimableAmount;
    }

    /** @notice UserClaimableRewards struct 
    *   reward: address of the reward token
    *   amount: amount of rewards claimed by the user
    */
    struct UserClaimedRewards {
        address reward;
        uint256 amount;
    }


    // Storage

    /** @notice Is the contract initialized */
    bool public initialized;

    /** @notice Address of the Dullahan Vault */
    address public immutable vault;

    /** @notice Total scaled deposited amount */
    uint256 public totalScaledAmount;
    /** @notice User scaled deposits */
    mapping(address => uint256) public userScaledBalances;

    /** @notice Address of tokens used in reward distributions */
    address[] public rewardList;

    /** @notice Reward state for each reward token */
    mapping(address => RewardState) public rewardStates;

    /** @notice Addresses allowed to deposit rewards */
    mapping(address => bool) public rewardDepositors;

    /** @notice Addresses allowed to claim for another user */
    mapping(address => address) public allowedClaimer;


    // Events

    /** @notice Event emitted when the contract is initialized */
    event Initialized();

    /** @notice Event emitted when staking */
    event Staked(address indexed caller, address indexed receiver, uint256 amount, uint256 scaledAmount);
    /** @notice Event emitted when unstaking */
    event Unstaked(address indexed owner, address indexed receiver, uint256 amount, uint256 scaledAmount);
    
    /** @notice Event emitted when rewards are claimed */
    event ClaimedRewards(address indexed reward, address indexed user, address indexed receiver, uint256 amount);

    /** @notice Event emitted when a new Claimer is set for an user */
    event SetUserAllowedClaimer(address indexed user, address indexed claimer);

    /** @notice Event emitted when a new reward is added */
    event NewRewards(address indexed rewardToken, uint256 amount, uint256 endTimestamp);

    /** @notice Event emitted when a new reward depositor is added */
    event AddedRewardDepositor(address indexed depositor);
    /** @notice Event emitted when a reward depositor is removed */
    event RemovedRewardDepositor(address indexed depositor);


    // Modifers

    /** @notice Check that the caller is allowed to deposit rewards */
    modifier onlyRewardDepositors() {
        if(!rewardDepositors[msg.sender]) revert Errors.CallerNotAllowed();
        _;
    }

    /** @notice Check that the contract is initalized */
    modifier isInitialized() {
        if (!initialized) revert Errors.NotInitialized();
        _;
    }


    // Constructor

    constructor(
        address _vault
    ) {
        if(_vault == address(0)) revert Errors.AddressZero();

        vault = _vault;
    }

    function init() external onlyOwner {
        if(initialized) revert Errors.AlreadyInitialized();

        initialized = true;

        // Seed deposit to prevent 1 wei LP token exploit
        _stake(msg.sender, SEED_DEPOSIT, msg.sender);

        emit Initialized();
    }


    // View functions

    /**
    * @notice Get the last update timestamp for a reward token
    * @param reward Address of the reward token
    * @return uint256 : Last update timestamp
    */
    function lastRewardUpdateTimestamp(address reward) public view returns(uint256) {
        uint256 rewardEndTimestamp = rewardStates[reward].distributionEndTimestamp;
        // If the distribution is already over, return the timestamp of the end of distribution
        // to prevent from accruing rewards that do not exist
        return block.timestamp > rewardEndTimestamp ? rewardEndTimestamp : block.timestamp;
    }

    /**
    * @notice Get the total amount of assets staked
    * @return uint256 : Total amount of assets staked
    */
    function totalAssets() public view returns(uint256) {
        return IScalingERC20(vault).balanceOf(address(this));
    }

    /**
    * @notice Get the current index to convert between balance and scaled balances
    * @return uint256 : Current index
    */
    function getCurrentIndex() external view returns(uint256) {
        return _getCurrentIndex();
    }

    /**
    * @notice Get the list of all reward tokens
    * @return address[] : List of reward tokens
    */
    function getRewardList() public view returns(address[] memory) {
        return rewardList;
    }

    /**
    * @notice Get the current amount staked by an user
    * @param user Address of the user
    * @return uint256 : Current amount staked
    */
    function userCurrentStakedAmount(address user) public view returns(uint256) {
        return userScaledBalances[user].rayMul(_getCurrentIndex());
    }

    /**
    * @notice Get the current reward state of an user for a given reward token
    * @param reward Address of the reward token
    * @param user Address of the user
    * @return UserRewardState : User reward state
    */
    function getUserRewardState(address reward, address user) external view returns(UserRewardState memory) {
        return rewardStates[reward].userStates[user];
    }

    /**
    * @notice Get the current amount of rewards accrued by an user for a given reward token
    * @param reward Address of the reward token
    * @param user Address of the user
    * @return uint256 : amount of rewards accured
    */
    function getUserAccruedRewards(address reward, address user) external view returns(uint256) {
        return rewardStates[reward].userStates[user].accruedRewards + _getUserEarnedRewards(reward, user, _getNewRewardPerToken(reward));
    }

    /**
    * @notice Get all current claimable amount of rewards for all reward tokens for a given user
    * @param user Address of the user
    * @return UserClaimableRewards[] : Amounts of rewards claimable by reward token
    */
    function getUserTotalClaimableRewards(address user) external view returns(UserClaimableRewards[] memory){
        address[] memory rewards = rewardList;
        uint256 rewardsLength = rewards.length;
        UserClaimableRewards[] memory rewardAmounts = new UserClaimableRewards[](rewardsLength);

        // For each listed reward
        for(uint256 i; i < rewardsLength;){
            // Add the reward token to the list
            rewardAmounts[i].reward = rewards[i];
            // And add the calculated claimable amount of the given reward
            rewardAmounts[i].claimableAmount = rewardStates[rewards[i]].userStates[user].accruedRewards + _getUserEarnedRewards(rewards[i], user, _getNewRewardPerToken(rewards[i]));

            unchecked { ++i; }
        }
        return rewardAmounts;
    }



    // State-changing functions

    // Can give MAX_UINT256 to stake full balance
    /**
    * @notice Stake Vault shares
    * @param amount Amount to stake
    * @param receiver Address of the address to stake for
    * @return uint256 : scaled amount for the deposit 
    */
    function stake(uint256 amount, address receiver) external nonReentrant isInitialized whenNotPaused returns(uint256) {
        if(amount == 0) revert Errors.NullAmount();
        if(receiver == address(0)) revert Errors.AddressZero();

        return _stake(msg.sender, amount, receiver);
    }

    /**
    * @dev Pull the ScalingERC20 token & stake in this contract & tracks the correct scaled amount
    * @param receiver Address of the caller to pull token from
    * @param amount Amount to stake
    * @param receiver Address of the address to stake for
    * @return uint256 : scaled amount for the deposit 
    */
    function _stake(address caller, uint256 amount, address receiver) internal returns(uint256) {
        // We just want to update the reward states for the user who's balance gonna change
        _updateAllUserRewardStates(receiver);

        // If given MAX_UINT256, we want to deposit the full user balance
        if(amount == MAX_UINT256) amount = IERC20(vault).balanceOf(caller);

        // Calculate the scaled amount corresponding to the user deposit
        // based on the total tokens held by this contract (because of the Scaling ERC20 logic)
        uint256 scaledAmount = amount.rayDiv(_getCurrentIndex());
        if(scaledAmount == 0) revert Errors.NullScaledAmount();

        // Pull the tokens from the user
        IERC20(vault).safeTransferFrom(caller, address(this), amount);

        // Update storage
        userScaledBalances[receiver] += scaledAmount;
        totalScaledAmount += scaledAmount;

        emit Staked(caller, receiver, amount, scaledAmount);

        return scaledAmount;
    }

    // Can give MAX_UINT256 to unstake full balance
    /**
    * @notice Unstake Vault shares
    * @dev Unstake ScalingERC20 shares based on the given scaled amount & send them to the receiver
    * @param scaledAmount Scaled amount ot unstake
    * @param receiver Address to receive the shares
    * @return uint256 : amount unstaked
    */
    function unstake(uint256 scaledAmount, address receiver) external nonReentrant isInitialized returns(uint256) {
        if(scaledAmount == 0) revert Errors.NullScaledAmount();
        if(receiver == address(0)) revert Errors.AddressZero();

        // We just want to update the reward states for the user who's balance gonna change
        _updateAllUserRewardStates(msg.sender);

        // If given MAX_UINT256, we want to withdraw the full user balance
        if(scaledAmount == MAX_UINT256) scaledAmount = userScaledBalances[msg.sender];

        // Calculate the amount to receive based on the given scaled amount
        uint256 amount = scaledAmount.rayMul(_getCurrentIndex());
        if(amount == 0) revert Errors.NullAmount();

        // Update storage
        userScaledBalances[msg.sender] -= scaledAmount;
        totalScaledAmount -= scaledAmount;

        // And send the tokens to the given receiver
        IERC20(vault).safeTransfer(receiver, amount);

        emit Unstaked(msg.sender, receiver, amount, scaledAmount);

        return amount;
    }

    /**
    * @notice Claim the accrued rewards for a given reward token
    * @param reward Address of the reward token
    * @param receiver Address to receive the rewards
    * @return uint256 : Amount of rewards claimed
    */
    function claimRewards(address reward, address receiver) external nonReentrant isInitialized whenNotPaused returns(uint256) {
        if(receiver == address(0)) revert Errors.AddressZero();

        return _claimRewards(reward, msg.sender, receiver);
    }

    /**
    * @notice Claim the accrued rewards for a given reward token on behalf of a given user
    * @param reward Address of the reward token
    * @param user Address that accrued the rewards
    * @param receiver Address to receive the rewards
    * @return uint256 : Amount of rewards claimed
    */
    function claimRewardsForUser(address reward, address user, address receiver) external nonReentrant isInitialized whenNotPaused returns(uint256) {
        if(receiver == address(0) || user == address(0)) revert Errors.AddressZero();
        if(msg.sender != allowedClaimer[user]) revert Errors.ClaimNotAllowed();

        return _claimRewards(reward, user, receiver);
    }

    /**
    * @notice Claim all accrued rewards for all reward tokens
    * @param receiver Address to receive the rewards
    * @return UserClaimedRewards[] : Amounts of reward claimed
    */
    function claimAllRewards(address receiver) external nonReentrant isInitialized whenNotPaused returns(UserClaimedRewards[] memory) {
        if(receiver == address(0)) revert Errors.AddressZero();

        return _claimAllRewards(msg.sender, receiver);
    }

    /**
    * @notice Claim all accrued rewards for all reward tokens on behalf of a given user
    * @param user Address that accrued the rewards
    * @param receiver Address to receive the rewards
    * @return UserClaimedRewards[] : Amounts of reward claimed
    */
    function claimAllRewardsForUser(address user, address receiver) external nonReentrant isInitialized whenNotPaused returns(UserClaimedRewards[] memory) {
        if(receiver == address(0) || user == address(0)) revert Errors.AddressZero();
        if(msg.sender != allowedClaimer[user]) revert Errors.ClaimNotAllowed();

        return _claimAllRewards(user, receiver);
    }

    /**
    * @notice Update the reward state for a given reward token
    * @param reward Address of the reward token
    */
    function updateRewardState(address reward) external isInitialized whenNotPaused {
        if(reward == address(0)) revert Errors.AddressZero();
        _updateRewardState(reward);
    }

    /**
    * @notice Update the reward state for all reward tokens
    */
    function updateAllRewardState() external isInitialized whenNotPaused {
        _updateAllRewardStates();
    }


    // Reward Managers functions

    /**
    * @notice Add rewards to the disitribution queue
    * @dev Set the amount of reward in the queue & push it to distribution if reaching the ratio
    * @param rewardToken Address of the reward token
    * @param amount Amount to queue
    * @return bool : success
    */
    function queueRewards(address rewardToken, uint256 amount) 
        external
        nonReentrant
        isInitialized
        whenNotPaused
        onlyRewardDepositors
        returns(bool) 
    {
        if(amount == 0) revert Errors.NullAmount();
        if(rewardToken == address(0)) revert Errors.AddressZero();

        RewardState storage state = rewardStates[rewardToken];

        // If the given reward token is new (no previous distribution),
        // add it to the reward list
        if(state.lastUpdate == 0) {
            rewardList.push(rewardToken);
        }

        // Update the reward token state before queueing new rewards
        _updateRewardState(rewardToken);

        // Get the total queued amount (previous queued amount + new amount)
        uint256 totalQueued = amount + state.queuedRewardAmount;

        // If there is no current disitrbution (previous is over or new reward token):
        // Start the new distribution directly without queueing the rewards
        if(block.timestamp >= state.distributionEndTimestamp){
            _updateRewardDistribution(rewardToken, state, totalQueued);
            state.queuedRewardAmount = 0;

            return true;
        }

        // Calculate the reamining duration for the current distribution
        // and the ratio of queued rewards compared to total rewards (queued + reamining in current distribution)
        // state.distributionEndTimestamp - block.timestamp => remaining time in the current distribution
        uint256 currentRemainingAmount =  state.ratePerSecond * (state.distributionEndTimestamp - block.timestamp);
        uint256 queuedAmountRatio =  (totalQueued * MAX_BPS) / (totalQueued + currentRemainingAmount);

        // If 85% or more of the total rewards are queued, move them to distribution
        if(queuedAmountRatio >= UPDATE_REWARD_RATIO) {
            _updateRewardDistribution(rewardToken, state, totalQueued);
            state.queuedRewardAmount = 0;
        } else {
            state.queuedRewardAmount = totalQueued;
        }

        return true;
    }

    /**
    * @dev Update the disitrubtion parameters for a given reward token
    * @param rewardToken Address of the reward token
    * @param state State of the reward token
    * @param rewardAmount Total amount ot distribute
    */
    function _updateRewardDistribution(address rewardToken, RewardState storage state, uint256 rewardAmount) internal {
        // Calculate the remaining duration of the current distribution (if not already over)
        // to calculate the amount fo rewards not yet distributed, and add them to the new amount to distribute
        if(block.timestamp < state.distributionEndTimestamp) {
            uint256 remainingRewards = state.ratePerSecond * (state.distributionEndTimestamp - block.timestamp);
            rewardAmount += remainingRewards;
        }
        // Calculate the new rate per second
        // & update the storage for the new distribution state
        state.ratePerSecond = rewardAmount / DISTRIBUTION_DURATION;
        state.currentRewardAmount = rewardAmount;
        state.lastUpdate = safe128(block.timestamp);
        uint256 distributionEnd = block.timestamp + DISTRIBUTION_DURATION;
        state.distributionEndTimestamp = safe128(distributionEnd);

        emit NewRewards(rewardToken, rewardAmount, distributionEnd);
    }


    // Internal functions

    /**
    * @dev Get the current index to convert between balance and scaled balances
    * @return uint256 : Current index
    */
    function _getCurrentIndex() internal view returns(uint256) {
        if(totalScaledAmount == 0) return INITIAL_INDEX;
        return totalAssets().rayDiv(totalScaledAmount);
    }

    /**
    * @dev Calculate the new rewardPerToken value for a reward token distribution
    * @param reward Address of the reward token
    * @return uint256 : new rewardPerToken value
    */
    function _getNewRewardPerToken(address reward) internal view returns(uint256) {
        RewardState storage state = rewardStates[reward];

        // If no fudns are deposited, we don't want to distribute rewards
        if(totalScaledAmount == 0) return state.rewardPerToken;

        // Get the last update timestamp
        uint256 lastRewardTimetamp = lastRewardUpdateTimestamp(reward);
        if(state.lastUpdate == lastRewardTimetamp) return state.rewardPerToken;

        // Calculate the increase since the last update
        return state.rewardPerToken + (
            (((lastRewardTimetamp - state.lastUpdate) * state.ratePerSecond) * UNIT) / totalScaledAmount
        );
    }

    /**
    * @dev Calculate the amount of rewards accrued by an user since last update for a reward token
    * @param reward Address of the reward token
    * @param user Address of the user
    * @return uint256 : Accrued rewards amount for the user
    */
    function _getUserEarnedRewards(address reward, address user, uint256 currentRewardPerToken) internal view returns(uint256) {
        UserRewardState storage userState = rewardStates[reward].userStates[user];

        // Get the user scaled balance
        uint256 userScaledBalance = userScaledBalances[user];

        if(userScaledBalance == 0) return 0;

        // If the user has a previous deposit (scaled balance is not null), calcualte the
        // earned rewards based on the increase of the rewardPerToken value
        return (userScaledBalance * (currentRewardPerToken - userState.lastRewardPerToken)) / UNIT;
    }

    /**
    * @dev Update the reward token distribution state
    * @param reward Address of the reward token
    */
    function _updateRewardState(address reward) internal {
        RewardState storage state = rewardStates[reward];

        // Update the storage with the new reward state 
        state.rewardPerToken = _getNewRewardPerToken(reward);
        state.lastUpdate = safe128(lastRewardUpdateTimestamp(reward));
    }

    /**
    * @dev Update the user reward state for a given reward token
    * @param reward Address of the reward token
    * @param user Address of the user
    */
    function _updateUserRewardState(address reward, address user) internal {
        // Update the reward token state before the user's state
        _updateRewardState(reward);

        UserRewardState storage userState = rewardStates[reward].userStates[user];

        // Update the storage with the new reward state
        uint256 currentRewardPerToken = rewardStates[reward].rewardPerToken;
        userState.accruedRewards += _getUserEarnedRewards(reward, user, currentRewardPerToken);
        userState.lastRewardPerToken = currentRewardPerToken;
    }

    /**
    * @dev Update the reward state for all the reward tokens
    */
    function _updateAllRewardStates() internal {
        address[] memory _rewards = rewardList;
        uint256 length = _rewards.length;

        // For all reward token in the list, update the reward state
        for(uint256 i; i < length;){
            _updateRewardState(_rewards[i]);

            unchecked{ ++i; }
        }
    }

    /**
    * @dev Update the reward state of the given user for all the reward tokens
    * @param user Address of the user
    */
    function _updateAllUserRewardStates(address user) internal {
        address[] memory _rewards = rewardList;
        uint256 length = _rewards.length;

        // For all reward token in the list, update the user's reward state
        for(uint256 i; i < length;){
            _updateUserRewardState(_rewards[i], user);

            unchecked{ ++i; }
        }
    }

    /**
    * @dev Claims rewards of an user for a given reward token and sends them to the receiver address
    * @param reward Address of reward token
    * @param user Address of the user
    * @param receiver Address to receive the rewards
    * @return uint256 : claimed amount
    */
    function _claimRewards(address reward, address user, address receiver) internal returns(uint256) {
        // Update all user states to get all current claimable rewards
        _updateUserRewardState(reward, user);

        UserRewardState storage userState = rewardStates[reward].userStates[user];
        
        // Fetch the amount of rewards accrued by the user
        uint256 rewardAmount = userState.accruedRewards;

        if(rewardAmount == 0) return 0;
        
        // Reset user's accrued rewards
        userState.accruedRewards = 0;

        // If the user accrued rewards, send them to the given receiver
        IERC20(reward).safeTransfer(receiver, rewardAmount);

        emit ClaimedRewards(reward, user, receiver, rewardAmount);

        return rewardAmount;
    }

    /**
    * @dev Claims all rewards of an user and sends them to the receiver address
    * @param user Address of the user
    * @param receiver Address to receive the rewards
    * @return UserClaimedRewards[] : list of claimed rewards
    */
    function _claimAllRewards(address user, address receiver) internal returns(UserClaimedRewards[] memory) {
        address[] memory rewards = rewardList;
        uint256 rewardsLength = rewards.length;

        UserClaimedRewards[] memory rewardAmounts = new UserClaimedRewards[](rewardsLength);

        // Update all user states to get all current claimable rewards
        _updateAllUserRewardStates(user);

        // For each reward token in the reward list
        for(uint256 i; i < rewardsLength; ++i){
            UserRewardState storage userState = rewardStates[rewards[i]].userStates[user];
            
            // Fetch the amount of rewards accrued by the user
            uint256 rewardAmount = userState.accruedRewards;

            // If the user accrued no rewards, skip
            if(rewardAmount == 0) continue;

            // Track the claimed amount for the reward token
            rewardAmounts[i].reward = rewards[i];
            rewardAmounts[i].amount = rewardAmount;
            
            // Reset user's accrued rewards
            userState.accruedRewards = 0;
            
            // For each reward token, send the accrued rewards to the given receiver
            IERC20(rewards[i]).safeTransfer(receiver, rewardAmount);

            emit ClaimedRewards(rewards[i], user, receiver, rewardAmounts[i].amount);
        }

        return rewardAmounts;
    }


    // Admin functions
    
    /**
     * @notice Pause the contract
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause the contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
    * @notice Add an address to the lsit of allowed reward depositors
    * @param depositor Address to deposit rewards
    */
    function addRewardDepositor(address depositor) external onlyOwner {
        if(depositor == address(0)) revert Errors.AddressZero();
        if(rewardDepositors[depositor]) revert Errors.AlreadyListedDepositor();

        rewardDepositors[depositor] = true;

        emit AddedRewardDepositor(depositor);
    }

    /**
    * @notice Remove an address from the lsit of allowed reward depositors
    * @param depositor Address to deposit rewards
    */
    function removeRewardDepositor(address depositor) external onlyOwner {
        if(depositor == address(0)) revert Errors.AddressZero();
        if(!rewardDepositors[depositor]) revert Errors.NotListedDepositor();

        rewardDepositors[depositor] = false;

        emit RemovedRewardDepositor(depositor);
    }

    /**
    * @notice aaa
    * @dev aaa
    * @param aa xx
    * @param aa xx
    * @return uint256 : aa
    */
    /**
    * @notice Sets a given address as allowed to claim rewards for a given user
    * @dev Sets a given address as allowed to claim rewards for a given user
    * @param user Address of the user
    * @param claimer Address of the allowed claimer
    */
    function setUserAllowedClaimer(address user, address claimer) external onlyOwner {
        if(user == address(0) || claimer == address(0)) revert Errors.AddressZero();

        // Set the given address as the claimer for the given user
        allowedClaimer[user] = claimer;

        emit SetUserAllowedClaimer(user, claimer);
    }


    // Maths

    function safe128(uint256 n) internal pure returns (uint128) {
        if(n > type(uint128).max) revert Errors.NumberExceed128Bits();
        return uint128(n);
    }


}