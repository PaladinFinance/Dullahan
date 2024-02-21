# Solidity API

## DullahanVault

### MAX_BPS

```solidity
uint256 MAX_BPS
```

Max value for BPS - 100%

### MAX_UINT256

```solidity
uint256 MAX_UINT256
```

Max value possible for an uint256

### STK_AAVE

```solidity
address STK_AAVE
```

Address of the stkAAVE token

### AAVE

```solidity
address AAVE
```

Address of the AAVE token

### PodsManager

```solidity
struct PodsManager {
  bool rentingAllowed;
  uint248 totalRented;
}
```

### initialized

```solidity
bool initialized
```

Is the Vault initialized

### admin

```solidity
address admin
```

Address of the Vault admin

### pendingAdmin

```solidity
address pendingAdmin
```

Address of the Vault pending admin

### totalRentedAmount

```solidity
uint256 totalRentedAmount
```

Total amount of stkAAVE rented to Pod Managers

### podManagers

```solidity
mapping(address => struct DullahanVault.PodsManager) podManagers
```

Pod Manager states

### votingPowerManager

```solidity
address votingPowerManager
```

Address receiving the delegated voting power from the Vault

### proposalPowerManager

```solidity
address proposalPowerManager
```

Address receiving the delegated proposal power from the Vault

### bufferRatio

```solidity
uint256 bufferRatio
```

Percentage of funds to stay in the contract for withdraws

### reserveAmount

```solidity
uint256 reserveAmount
```

Amount accrued as Reserve

### reserveRatio

```solidity
uint256 reserveRatio
```

Ratio of claimed rewards to be set as Reserve

### reserveManager

```solidity
address reserveManager
```

Address of the Reserve Manager

### Initialized

```solidity
event Initialized()
```

Event emitted when the Vault is initialized

### RentToPod

```solidity
event RentToPod(address manager, address pod, uint256 amount)
```

Event emitted when stkAAVE is rented to a Pod

### NotifyRentedAmount

```solidity
event NotifyRentedAmount(address manager, address pod, uint256 addedAmount)
```

Event emitted when stkAAVE claim is notified by a Pod

### PullFromPod

```solidity
event PullFromPod(address manager, address pod, uint256 amount)
```

Event emitted when stkAAVE is pulled back from a Pod

### AdminTransferred

```solidity
event AdminTransferred(address previousAdmin, address newAdmin)
```

Event emitted when the adminship is transfered

### NewPendingAdmin

```solidity
event NewPendingAdmin(address previousPendingAdmin, address newPendingAdmin)
```

Event emitted when a new pending admin is set

### NewPodManager

```solidity
event NewPodManager(address newManager)
```

Event emitted when a new Pod Manager is added

### BlockedPodManager

```solidity
event BlockedPodManager(address manager)
```

Event emitted when a Pod Manager is blocked

### ReserveDeposit

```solidity
event ReserveDeposit(address from, uint256 amount)
```

Event emitted when depositing in the Reserve

### ReserveWithdraw

```solidity
event ReserveWithdraw(address to, uint256 amount)
```

Event emitted when withdrawing from the Reserve

### UpdatedVotingPowerManager

```solidity
event UpdatedVotingPowerManager(address oldManager, address newManager)
```

Event emitted when the Voting maanger is updated

### UpdatedProposalPowerManager

```solidity
event UpdatedProposalPowerManager(address oldManager, address newManager)
```

Event emitted when the Proposal maanger is updated

### UpdatedReserveManager

```solidity
event UpdatedReserveManager(address oldManager, address newManager)
```

Event emitted when the Reserve manager is updated

### UpdatedBufferRatio

```solidity
event UpdatedBufferRatio(uint256 oldRatio, uint256 newRatio)
```

Event emitted when the Buffer ratio is updated

### UpdatedReserveRatio

```solidity
event UpdatedReserveRatio(uint256 oldRatio, uint256 newRatio)
```

Event emitted when the Reserve ratio is updated

### TokenRecovered

```solidity
event TokenRecovered(address token, uint256 amount)
```

Event emitted when an ERC20 token is recovered

### onlyAdmin

```solidity
modifier onlyAdmin()
```

Check that the caller is the admin

### onlyAllowed

```solidity
modifier onlyAllowed()
```

Check that the caller is the admin or the Reserve maanger

### isInitialized

```solidity
modifier isInitialized()
```

Check that the contract is initialized

### constructor

```solidity
constructor(address _admin, uint256 _reserveRatio, address _reserveManager, address _aave, address _stkAave, string _name, string _symbol) public
```

### init

```solidity
function init(address _votingPowerManager, address _proposalPowerManager) external
```

Initialize the Vault

_Initialize the Vault by performing a seed deposit & delegating voting power_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _votingPowerManager | address | Address to receive the voting power delegation |
| _proposalPowerManager | address | Address to receive the proposal power delegation |

### asset

```solidity
function asset() external view returns (address)
```

Get the vault's asset

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | address : Address of the asset |

### totalAssets

```solidity
function totalAssets() public view returns (uint256)
```

Get the total amount of assets in the Vault

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | uint256 : total amount of assets |

### totalSupply

```solidity
function totalSupply() public view returns (uint256)
```

Get the total supply of shares

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | uint256 : Total supply of shares |

### totalAvailable

```solidity
function totalAvailable() public view returns (uint256)
```

Get the current total amount of asset available in the Vault

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | uint256 : Current total amount available |

### convertToShares

```solidity
function convertToShares(uint256 assets) public pure returns (uint256)
```

Convert a given amount of assets to shares

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| assets | uint256 | amount of assets |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | uint256 : amount of shares |

### convertToAssets

```solidity
function convertToAssets(uint256 shares) public pure returns (uint256)
```

Convert a given amount of shares to assets

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| shares | uint256 | amount of shares |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | uint256 : amount of assets |

### previewDeposit

```solidity
function previewDeposit(uint256 assets) public pure returns (uint256)
```

Return the amount of shares expected for depositing the given assets

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| assets | uint256 | Amount of assets to be deposited |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | uint256 : amount of shares |

### previewMint

```solidity
function previewMint(uint256 shares) public pure returns (uint256)
```

Return the amount of assets expected for minting the given shares

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| shares | uint256 | Amount of shares to be minted |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | uint256 : amount of assets |

### previewWithdraw

```solidity
function previewWithdraw(uint256 assets) public pure returns (uint256)
```

Return the amount of shares expected for withdrawing the given assets

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| assets | uint256 | Amount of assets to be withdrawn |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | uint256 : amount of shares |

### previewRedeem

```solidity
function previewRedeem(uint256 shares) public pure returns (uint256)
```

Return the amount of assets expected for burning the given shares

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| shares | uint256 | Amount of shares to be burned |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | uint256 : amount of assets |

### maxDeposit

```solidity
function maxDeposit(address user) public view returns (uint256)
```

Get the maximum amount that can be deposited by the user

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| user | address | User address |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | uint256 : Max amount to deposit |

### maxMint

```solidity
function maxMint(address user) public view returns (uint256)
```

Get the maximum amount that can be minted by the user

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| user | address | User address |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | uint256 : Max amount to mint |

### maxWithdraw

```solidity
function maxWithdraw(address owner) public view returns (uint256)
```

Get the maximum amount that can be withdrawn by the user

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address | Owner address |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | uint256 : Max amount to withdraw |

### maxRedeem

```solidity
function maxRedeem(address owner) public view returns (uint256)
```

Get the maximum amount that can be burned by the user

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address | Owner address |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | uint256 : Max amount to burn |

### getCurrentIndex

```solidity
function getCurrentIndex() public view returns (uint256)
```

Get the current index to convert between balance and scaled balances

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | uint256 : Current index |

### getDelegates

```solidity
function getDelegates() external view returns (address votingPower, address proposalPower)
```

Get the current delegates for the Vault voting power & proposal power

### deposit

```solidity
function deposit(uint256 assets, address receiver) public returns (uint256 shares)
```

Deposit assets in the Vault & mint shares

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| assets | uint256 | Amount to deposit |
| receiver | address | Address to receive the shares |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| shares | uint256 | - uint256 : Amount of shares minted |

### mint

```solidity
function mint(uint256 shares, address receiver) public returns (uint256 assets)
```

Mint vault shares by depositing assets

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| shares | uint256 | Amount of shares to mint |
| receiver | address | Address to receive the shares |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| assets | uint256 | - uint256 : Amount of assets deposited |

### withdraw

```solidity
function withdraw(uint256 assets, address receiver, address owner) public returns (uint256 shares)
```

Withdraw from the Vault & burn shares

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| assets | uint256 | Amount of assets to withdraw |
| receiver | address | Address to receive the assets |
| owner | address | Address of the owner of the shares |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| shares | uint256 | - uint256 : Amount of shares burned |

### redeem

```solidity
function redeem(uint256 shares, address receiver, address owner) public returns (uint256 assets)
```

Burn shares to withdraw from the Vault

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| shares | uint256 | Amount of shares to burn |
| receiver | address | Address to receive the assets |
| owner | address | Address of the owner of the shares |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| assets | uint256 | - uint256 : Amount of assets withdrawn |

### updateStkAaveRewards

```solidity
function updateStkAaveRewards() external
```

Claim Safety Module rewards & stake them in stkAAVE

### rentStkAave

```solidity
function rentStkAave(address pod, uint256 amount) external
```

Rent stkAAVE for a Pod

_Rent stkAAVE to a Pod, sending the amount & tracking the manager that requested_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| pod | address | Address of the Pod |
| amount | uint256 | Amount to rent |

### notifyRentedAmount

```solidity
function notifyRentedAmount(address pod, uint256 addedAmount) external
```

Notify a claim on rented stkAAVE

_Notify the newly claimed rewards from rented stkAAVE to a Pod & add it as rented to the Pod_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| pod | address | Address of the Pod |
| addedAmount | uint256 | Amount added |

### pullRentedStkAave

```solidity
function pullRentedStkAave(address pod, uint256 amount) external
```

Pull rented stkAAVE from a Pod

_Pull stkAAVE from a Pod & update the tracked rented amount_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| pod | address | Address of the Pod |
| amount | uint256 | Amount to pull |

### _getCurrentIndex

```solidity
function _getCurrentIndex() internal view returns (uint256)
```

_Get the current index to convert between balance and scaled balances_

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | uint256 : Current index |

### _deposit

```solidity
function _deposit(uint256 amount, address receiver, address depositor) internal returns (uint256, uint256)
```

_Pull assets to deposit in the Vault & mint shares_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | Amount to deposit |
| receiver | address | Address to receive the shares |
| depositor | address | Address depositing the assets |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | uint256 : Amount of assets deposited |
| [1] | uint256 | uint256 : Amount of shares minted |

### _withdraw

```solidity
function _withdraw(uint256 amount, address owner, address receiver, address sender) internal returns (uint256, uint256)
```

_Withdraw assets from the Vault & send to the receiver & burn shares_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | Amount to withdraw |
| owner | address | Address owning the shares |
| receiver | address | Address to receive the assets |
| sender | address | Address of the caller |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | uint256 : Amount of assets withdrawn |
| [1] | uint256 | uint256 : Amount of shares burned |

### beforeWithdraw

```solidity
function beforeWithdraw(uint256 amount) internal
```

_Hook exectued before withdrawing_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | Amount to withdraw |

### afterDeposit

```solidity
function afterDeposit(uint256 amount) internal
```

_Hook exectued after depositing_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | Amount deposited |

### _beforeTokenTransfer

```solidity
function _beforeTokenTransfer(address from, address to, uint256 amount) internal virtual
```

_Hook executed before each transfer_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| from | address | Sender address |
| to | address | Receiver address |
| amount | uint256 | Amount to transfer |

### _afterTokenTransfer

```solidity
function _afterTokenTransfer(address from, address to, uint256 amount) internal virtual
```

_Hook executed after each transfer_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| from | address | Sender address |
| to | address | Receiver address |
| amount | uint256 | Amount to transfer |

### _getStkAaveRewards

```solidity
function _getStkAaveRewards() internal
```

_Claim AAVE rewards from the Safety Module & stake them to receive stkAAVE_

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

### transferAdmin

```solidity
function transferAdmin(address newAdmin) external
```

Set a given address as the new pending admin

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newAdmin | address | Address to be the new admin |

### acceptAdmin

```solidity
function acceptAdmin() external
```

Accpet adminship of the contract (must be the pending admin)

### addPodManager

```solidity
function addPodManager(address newManager) external
```

Add a new Pod Manager

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newManager | address | Address of the new manager |

### blockPodManager

```solidity
function blockPodManager(address manager) external
```

Block a Pod Manager

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| manager | address | Address of the manager |

### updateVotingPowerManager

```solidity
function updateVotingPowerManager(address newManager) external
```

Update the Vault's voting power manager & delegate the voting power to it

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newManager | address | Address of the new manager |

### updateProposalPowerManager

```solidity
function updateProposalPowerManager(address newManager) external
```

Update the Vault's proposal power manager & delegate the proposal power to it

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newManager | address | Address of the new manager |

### updateReserveManager

```solidity
function updateReserveManager(address newManager) external
```

Update the Vault's Reserve manager

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newManager | address | Address of the new manager |

### updateReserveRatio

```solidity
function updateReserveRatio(uint256 newRatio) external
```

Uodate the reserve ratio parameter

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newRatio | uint256 | New ratio value |

### updateBufferRatio

```solidity
function updateBufferRatio(uint256 newRatio) external
```

Uodate the buffer ratio parameter

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newRatio | uint256 | New ratio value |

### depositToReserve

```solidity
function depositToReserve(uint256 amount) external returns (bool)
```

Deposit token in the reserve

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | Amount of token to deposit |

### withdrawFromReserve

```solidity
function withdrawFromReserve(uint256 amount, address receiver) external returns (bool)
```

Withdraw tokens from the reserve to send to the given receiver

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | Amount of token to withdraw |
| receiver | address | Address to receive the tokens |

### recoverERC20

```solidity
function recoverERC20(address token) external returns (bool)
```

Recover ERC2O tokens sent by mistake to the contract

_Recover ERC2O tokens sent by mistake to the contract_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| token | address | Address of the ERC2O token |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | bool: success |

### safe248

```solidity
function safe248(uint256 n) internal pure returns (uint248)
```

