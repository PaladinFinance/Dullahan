# Solidity API

## DullahanRewardsStaking

### UserRewardState

```solidity
struct UserRewardState {
  uint256 lastRewardPerToken;
  uint256 accruedRewards;
}
```

### RewardState

```solidity
struct RewardState {
  uint256 rewardPerToken;
  uint128 lastUpdate;
  uint128 distributionEndTimestamp;
  uint256 ratePerSecond;
  uint256 currentRewardAmount;
  uint256 queuedRewardAmount;
  mapping(address => struct DullahanRewardsStaking.UserRewardState) userStates;
}
```

### UserClaimableRewards

```solidity
struct UserClaimableRewards {
  address reward;
  uint256 claimableAmount;
}
```

### UserClaimedRewards

```solidity
struct UserClaimedRewards {
  address reward;
  uint256 amount;
}
```

### initialized

```solidity
bool initialized
```

Is the contract initialized

### vault

```solidity
address vault
```

Address of the Dullahan Vault

### totalScaledAmount

```solidity
uint256 totalScaledAmount
```

Total scaled deposited amount

### userScaledBalances

```solidity
mapping(address => uint256) userScaledBalances
```

User scaled deposits

### rewardList

```solidity
address[] rewardList
```

Address of tokens used in reward distributions

### rewardStates

```solidity
mapping(address => struct DullahanRewardsStaking.RewardState) rewardStates
```

Reward state for each reward token

### rewardDepositors

```solidity
mapping(address => bool) rewardDepositors
```

Addresses allowed to deposit rewards

### allowedClaimer

```solidity
mapping(address => address) allowedClaimer
```

Addresses allowed to claim for another user

### Initialized

```solidity
event Initialized()
```

Event emitted when the contract is initialized

### Staked

```solidity
event Staked(address caller, address receiver, uint256 amount, uint256 scaledAmount)
```

Event emitted when staking

### Unstaked

```solidity
event Unstaked(address owner, address receiver, uint256 amount, uint256 scaledAmount)
```

Event emitted when unstaking

### ClaimedRewards

```solidity
event ClaimedRewards(address reward, address user, address receiver, uint256 amount)
```

Event emitted when rewards are claimed

### SetUserAllowedClaimer

```solidity
event SetUserAllowedClaimer(address user, address claimer)
```

Event emitted when a new Claimer is set for an user

### NewRewards

```solidity
event NewRewards(address rewardToken, uint256 amount, uint256 endTimestamp)
```

Event emitted when a new reward is added

### AddedRewardDepositor

```solidity
event AddedRewardDepositor(address depositor)
```

Event emitted when a new reward depositor is added

### RemovedRewardDepositor

```solidity
event RemovedRewardDepositor(address depositor)
```

Event emitted when a reward depositor is removed

### onlyRewardDepositors

```solidity
modifier onlyRewardDepositors()
```

Check that the caller is allowed to deposit rewards

### isInitialized

```solidity
modifier isInitialized()
```

Check that the contract is initalized

### constructor

```solidity
constructor(address _vault) public
```

### init

```solidity
function init() external
```

### lastRewardUpdateTimestamp

```solidity
function lastRewardUpdateTimestamp(address reward) public view returns (uint256)
```

Get the last update timestamp for a reward token

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| reward | address | Address of the reward token |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | uint256 : Last update timestamp |

### totalAssets

```solidity
function totalAssets() public view returns (uint256)
```

Get the total amount of assets staked

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | uint256 : Total amount of assets staked |

### getCurrentIndex

```solidity
function getCurrentIndex() external view returns (uint256)
```

Get the current index to convert between balance and scaled balances

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | uint256 : Current index |

### getRewardList

```solidity
function getRewardList() public view returns (address[])
```

Get the list of all reward tokens

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address[] | address[] : List of reward tokens |

### userCurrentStakedAmount

```solidity
function userCurrentStakedAmount(address user) public view returns (uint256)
```

Get the current amount staked by an user

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| user | address | Address of the user |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | uint256 : Current amount staked |

### getUserRewardState

```solidity
function getUserRewardState(address reward, address user) external view returns (struct DullahanRewardsStaking.UserRewardState)
```

Get the current reward state of an user for a given reward token

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| reward | address | Address of the reward token |
| user | address | Address of the user |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct DullahanRewardsStaking.UserRewardState | UserRewardState : User reward state |

### getUserAccruedRewards

```solidity
function getUserAccruedRewards(address reward, address user) external view returns (uint256)
```

Get the current amount of rewards accrued by an user for a given reward token

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| reward | address | Address of the reward token |
| user | address | Address of the user |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | uint256 : amount of rewards accured |

### getUserTotalClaimableRewards

```solidity
function getUserTotalClaimableRewards(address user) external view returns (struct DullahanRewardsStaking.UserClaimableRewards[])
```

Get all current claimable amount of rewards for all reward tokens for a given user

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| user | address | Address of the user |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct DullahanRewardsStaking.UserClaimableRewards[] | UserClaimableRewards[] : Amounts of rewards claimable by reward token |

### stake

```solidity
function stake(uint256 amount, address receiver) external returns (uint256)
```

Stake Vault shares

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | Amount to stake |
| receiver | address | Address of the address to stake for |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | uint256 : scaled amount for the deposit |

### _stake

```solidity
function _stake(address caller, uint256 amount, address receiver) internal returns (uint256)
```

_Pull the ScalingERC20 token & stake in this contract & tracks the correct scaled amount_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| caller | address |  |
| amount | uint256 | Amount to stake |
| receiver | address | Address of the caller to pull token from |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | uint256 : scaled amount for the deposit |

### unstake

```solidity
function unstake(uint256 scaledAmount, address receiver) external returns (uint256)
```

Unstake Vault shares

_Unstake ScalingERC20 shares based on the given scaled amount & send them to the receiver_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| scaledAmount | uint256 | Scaled amount ot unstake |
| receiver | address | Address to receive the shares |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | uint256 : amount unstaked |

### claimRewards

```solidity
function claimRewards(address reward, address receiver) external returns (uint256)
```

Claim the accrued rewards for a given reward token

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| reward | address | Address of the reward token |
| receiver | address | Address to receive the rewards |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | uint256 : Amount of rewards claimed |

### claimRewardsForUser

```solidity
function claimRewardsForUser(address reward, address user, address receiver) external returns (uint256)
```

Claim the accrued rewards for a given reward token on behalf of a given user

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| reward | address | Address of the reward token |
| user | address | Address that accrued the rewards |
| receiver | address | Address to receive the rewards |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | uint256 : Amount of rewards claimed |

### claimAllRewards

```solidity
function claimAllRewards(address receiver) external returns (struct DullahanRewardsStaking.UserClaimedRewards[])
```

Claim all accrued rewards for all reward tokens

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| receiver | address | Address to receive the rewards |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct DullahanRewardsStaking.UserClaimedRewards[] | UserClaimedRewards[] : Amounts of reward claimed |

### claimAllRewardsForUser

```solidity
function claimAllRewardsForUser(address user, address receiver) external returns (struct DullahanRewardsStaking.UserClaimedRewards[])
```

Claim all accrued rewards for all reward tokens on behalf of a given user

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| user | address | Address that accrued the rewards |
| receiver | address | Address to receive the rewards |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct DullahanRewardsStaking.UserClaimedRewards[] | UserClaimedRewards[] : Amounts of reward claimed |

### updateRewardState

```solidity
function updateRewardState(address reward) external
```

Update the reward state for a given reward token

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| reward | address | Address of the reward token |

### updateAllRewardState

```solidity
function updateAllRewardState() external
```

Update the reward state for all reward tokens

### queueRewards

```solidity
function queueRewards(address rewardToken, uint256 amount) external returns (bool)
```

Add rewards to the disitribution queue

_Set the amount of reward in the queue & push it to distribution if reaching the ratio_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| rewardToken | address | Address of the reward token |
| amount | uint256 | Amount to queue |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | bool : success |

### _updateRewardDistribution

```solidity
function _updateRewardDistribution(address rewardToken, struct DullahanRewardsStaking.RewardState state, uint256 rewardAmount) internal
```

_Update the disitrubtion parameters for a given reward token_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| rewardToken | address | Address of the reward token |
| state | struct DullahanRewardsStaking.RewardState | State of the reward token |
| rewardAmount | uint256 | Total amount ot distribute |

### _getCurrentIndex

```solidity
function _getCurrentIndex() internal view returns (uint256)
```

_Get the current index to convert between balance and scaled balances_

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | uint256 : Current index |

### _getNewRewardPerToken

```solidity
function _getNewRewardPerToken(address reward) internal view returns (uint256)
```

_Calculate the new rewardPerToken value for a reward token distribution_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| reward | address | Address of the reward token |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | uint256 : new rewardPerToken value |

### _getUserEarnedRewards

```solidity
function _getUserEarnedRewards(address reward, address user, uint256 currentRewardPerToken) internal view returns (uint256)
```

_Calculate the amount of rewards accrued by an user since last update for a reward token_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| reward | address | Address of the reward token |
| user | address | Address of the user |
| currentRewardPerToken | uint256 |  |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | uint256 : Accrued rewards amount for the user |

### _updateRewardState

```solidity
function _updateRewardState(address reward) internal
```

_Update the reward token distribution state_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| reward | address | Address of the reward token |

### _updateUserRewardState

```solidity
function _updateUserRewardState(address reward, address user) internal
```

_Update the user reward state for a given reward token_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| reward | address | Address of the reward token |
| user | address | Address of the user |

### _updateAllRewardStates

```solidity
function _updateAllRewardStates() internal
```

_Update the reward state for all the reward tokens_

### _updateAllUserRewardStates

```solidity
function _updateAllUserRewardStates(address user) internal
```

_Update the reward state of the given user for all the reward tokens_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| user | address | Address of the user |

### _claimRewards

```solidity
function _claimRewards(address reward, address user, address receiver) internal returns (uint256)
```

_Claims rewards of an user for a given reward token and sends them to the receiver address_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| reward | address | Address of reward token |
| user | address | Address of the user |
| receiver | address | Address to receive the rewards |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | uint256 : claimed amount |

### _claimAllRewards

```solidity
function _claimAllRewards(address user, address receiver) internal returns (struct DullahanRewardsStaking.UserClaimedRewards[])
```

_Claims all rewards of an user and sends them to the receiver address_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| user | address | Address of the user |
| receiver | address | Address to receive the rewards |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | struct DullahanRewardsStaking.UserClaimedRewards[] | UserClaimedRewards[] : list of claimed rewards |

### pause

```solidity
function pause() external
```

Pause the contract

### unpause

```solidity
function unpause() external
```

Unpause the contract

### addRewardDepositor

```solidity
function addRewardDepositor(address depositor) external
```

Add an address to the lsit of allowed reward depositors

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| depositor | address | Address to deposit rewards |

### removeRewardDepositor

```solidity
function removeRewardDepositor(address depositor) external
```

Remove an address from the lsit of allowed reward depositors

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| depositor | address | Address to deposit rewards |

### setUserAllowedClaimer

```solidity
function setUserAllowedClaimer(address user, address claimer) external
```

Sets a given address as allowed to claim rewards for a given user

_Sets a given address as allowed to claim rewards for a given user_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| user | address | Address of the user |
| claimer | address | Address of the allowed claimer |

### safe128

```solidity
function safe128(uint256 n) internal pure returns (uint128)
```

