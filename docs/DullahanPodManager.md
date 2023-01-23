# DullahanPodManager

## Storage

### UNIT

```solidity
uint256 UNIT
```

1e18 scale

### MAX_BPS

```solidity
uint256 MAX_BPS
```

Max value for BPS - 100%

### Pod

```solidity
struct Pod {
  address podAddress;
  address podOwner;
  address collateral;
  uint96 lastUpdate;
  uint256 lastIndex;
  uint256 rentedAmount;
  uint256 accruedFees;
}
```

### vault

```solidity
address vault
```

Address of the Dullahan Vault

### rewardsStaking

```solidity
address rewardsStaking
```

Address of the Dullahan Staking contract

### podImplementation

```solidity
address podImplementation
```

Address of the Pod implementation

### registry

```solidity
address registry
```

Address of the Dullahan Registry

### allowedCollaterals

```solidity
mapping(address => bool) allowedCollaterals
```

Allowed token to be used as collaterals

### aTokenForCollateral

```solidity
mapping(address => address) aTokenForCollateral
```

Address of aToken from the Aave Market for each collateral

### pods

```solidity
mapping(address => struct DullahanPodManager.Pod) pods
```

State for Pods

### allPods

```solidity
address[] allPods
```

List of all created Pods

### ownerPods

```solidity
mapping(address => address[]) ownerPods
```

List of Pods created by an user

### feeModule

```solidity
address feeModule
```

Address of the Fee Module

### oracleModule

```solidity
address oracleModule
```

Address of the Oracle Module

### protocolFeeChest

```solidity
address protocolFeeChest
```

Address of the Chest to receive fees

### lastUpdatedIndex

```solidity
uint256 lastUpdatedIndex
```

Last update timestamp for the Index

### lastIndexUpdate

```solidity
uint256 lastIndexUpdate
```

Last updated value of the Index

### extraLiquidationRatio

```solidity
uint256 extraLiquidationRatio
```

Extra ratio applied during liquidations

### mintFeeRatio

```solidity
uint256 mintFeeRatio
```

Ratio of minted amount taken as minting fees

### protocolFeeRatio

```solidity
uint256 protocolFeeRatio
```

Ratio of renting fees taken as protocol fees

### reserveAmount

```solidity
uint256 reserveAmount
```

Total amount set as reserve (holding Vault renting fees)

## Events

### PodCreation

```solidity
event PodCreation(address collateral, address podOwner, address pod)
```

Event emitted when a new Pod is created

### FreedStkAave

```solidity
event FreedStkAave(address pod, uint256 pullAmount)
```

Event emitted when stkAAVE is clawed back from a Pod

### RentedStkAave

```solidity
event RentedStkAave(address pod, uint256 rentAmount)
```

Event emitted when stkAAVE is rented to a Pod

### LiquidatedPod

```solidity
event LiquidatedPod(address pod, address collateral, uint256 collateralAmount, uint256 receivedFeeAmount)
```

Event emitted when a Pod is liquidated

### PaidFees

```solidity
event PaidFees(address pod, uint256 feeAmount)
```

Event emitted when renting fees are paid

### MintingFees

```solidity
event MintingFees(address pod, uint256 feeAmount)
```

Event emitted when minting fees are paid

### ReserveProcessed

```solidity
event ReserveProcessed(uint256 stakingRewardsAmount)
```

Event emitted when the Reserve is processed

### NewCollateral

```solidity
event NewCollateral(address collateral, address aToken)
```

Event emitted when a new collateral is added

### CollateralUpdated

```solidity
event CollateralUpdated(address collateral, bool allowed)
```

Event emitted when a colalteral is updated

### RegistryUpdated

```solidity
event RegistryUpdated(address oldRegistry, address newRegistry)
```

Event emitted when the Registry is updated

### FeeModuleUpdated

```solidity
event FeeModuleUpdated(address oldMoldule, address newModule)
```

Event emitted when the Fee Module is updated

### OracleModuleUpdated

```solidity
event OracleModuleUpdated(address oldMoldule, address newModule)
```

Event emitted when the Oracle Module is updated

### MintFeeRatioUpdated

```solidity
event MintFeeRatioUpdated(uint256 oldRatio, uint256 newRatio)
```

Event emitted when the Mint Fee Ratio is updated

### ProtocolFeeRatioUpdated

```solidity
event ProtocolFeeRatioUpdated(uint256 oldRatio, uint256 newRatio)
```

Event emitted when the Protocol Fee Ratio is updated

### ExtraLiquidationRatioUpdated

```solidity
event ExtraLiquidationRatioUpdated(uint256 oldRatio, uint256 newRatio)
```

Event emitted when the Extra Liquidation Ratio is updated

## Modifiers

### isValidPod

```solidity
modifier isValidPod()
```

Check that the caller is a valid Pod

## Constructor

```solidity
constructor(address _vault, address _rewardsStaking, address _protocolFeeChest, address _podImplementation, address _registry, address _feeModule, address _oracleModule) public
```

## View Methods

### getCurrentIndex

```solidity
function getCurrentIndex() public view returns (uint256)
```

Get the current fee index

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| - | uint256 | uint256 : Current index |

### podCurrentOwedFees

```solidity
function podCurrentOwedFees(address pod) public view returns (uint256)
```

Get the current amount of fees owed by a Pod

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| pod | address | Address of the Pod |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| - | uint256 | uint256 : Current amount of fees owed |

### podOwedFees

```solidity
function podOwedFees(address pod) public view returns (uint256)
```

Get the stored amount of fees owed by a Pod

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| pod | address | Address of the Pod |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| - | uint256 | uint256 : Stored amount of fees owed |

### getAllPods

```solidity
function getAllPods() external view returns (address[])
```

Get all Pods created by this contract

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| - | address[] | address[] : List of Pods |

### getAllOwnerPods

```solidity
function getAllOwnerPods(address account) external view returns (address[])
```

Get the list of Pods owned by a given account

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| account | address | Address of the Pods owner |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| - | address[] | address[] : List of Pods |

### isPodLiquidable

```solidity
function isPodLiquidable(address pod) public view returns (bool)
```

Check if the given Pod is liquidable

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| pod | address | Address of the Pod |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| - | bool | bool : True if liquidable |

### estimatePodLiquidationexternal

```solidity
function estimatePodLiquidationexternal(address pod) external view returns (uint256 feeAmount, uint256 collateralAmount)
```

Estimate the amount of fees to repay to liquidate a Pod & the amount of collaterla to receive after liquidation

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| pod | address | Address of the Pod |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| feeAmount | uint256 | - uint256 : Amount of fees to pay to liquidate |
| collateralAmount | uint256 | - uint256 : Amount of collateral to receive after liquidation |

## State Changing Methods

### createPod

```solidity
function createPod(address collateral) external returns (address)
```

Create a new Pod

_Clone the Pod implementation, initialize it & store the paremeters_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| collateral | address | Address of the collateral for the new Pod |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| - | address | address : Address of the newly deployed Pod |

### updateGlobalState

```solidity
function updateGlobalState() external returns (bool)
```

Update the global state

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| - | bool | bool : Success |

### updatePodState

```solidity
function updatePodState(address pod) external returns (bool)
```

Update a Pod state

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| pod | address | Address of the Pod |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| - | bool | bool : Success |

### freeStkAave

```solidity
function freeStkAave(address pod) external returns (bool)
```

Free all stkAAVE not currently needed by a Pod

_Calculate the needed amount of stkAAVE for a Pod & free any extra stkAAVE held by the Pod_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| pod | address | Address of the Pod |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| - | bool | bool : Success |

### liquidatePod

```solidity
function liquidatePod(address pod) external returns (bool)
```

Liquidate a Pod that owes fees & has no GHO debt

_Repay the fees owed by the Pod & receive some of the Pod colleteral (with an extra ratio)_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| pod | address | Address of the Pod |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| - | bool | bool : Success |

### updatePodDelegation

```solidity
function updatePodDelegation(address pod) public
```

Update the delegator of a Pod

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| pod | address | Address of the Pod |

### updateMultiplePodsDelegation

```solidity
function updateMultiplePodsDelegation(address[] podList) external
```

Update the delegator for a list of Pods

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| podList | address[] | List of Pod addresses |

### processReserve

```solidity
function processReserve() external returns (bool)
```

Process the Reserve

_Send the Reserve to the staking contract to be queued for distribution & take a part as protocol fees_

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| - | bool | bool : Success |

### getStkAave

```solidity
function getStkAave(uint256 amountToMint) external returns (bool)
```

Get the needed amount of stkAAVE for a Pod based on the GHO amount minted

_Calculate the amount of stkAAVE a Pod need based on its GHO debt & amount ot be minted & request the needed amount to the Vault for renting_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| amountToMint | uint256 | Amount of GHO to be minted |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| - | bool | bool : Success |

### notifyStkAaveClaim

```solidity
function notifyStkAaveClaim(uint256 claimedAmount) external
```

Notify the Vault for claimed rewards from the Safety Module for a Pod

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| claimedAmount | uint256 | Amount of rewards claimed |

### notifyPayFee

```solidity
function notifyPayFee(uint256 feeAmount) external
```

Notify fees paid by a Pod

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| feeAmount | uint256 | Amount of fees paid |

### notifyMintingFee

```solidity
function notifyMintingFee(uint256 feeAmount) external
```

Notify minting fees paid by a Pod

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| feeAmount | uint256 | Amount of fees paid |

## Internal Methods

### _calculatedNeededStkAave

```solidity
function _calculatedNeededStkAave(address pod, uint256 addedDebtAmount) internal returns (uint256)
```

_Calculates the amount of stkAAVE needed by a Pod based on its GHO debt & the amount of GHO to be minted_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| pod | address | Address of the Pod |
| addedDebtAmount | uint256 | Amount of GHO to be minted |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| - | uint256 | uint256 : Amount of stkAAVE needed |

### _accruedIndex

```solidity
function _accruedIndex() internal view returns (uint256)
```

_Calculate the index accrual based on the current fee per second_

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| - | uint256 | uint256 : index accrual |

### _updateGlobalState

```solidity
function _updateGlobalState() internal returns (bool)
```

_Update the global state by updating the fee index_

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| - | bool | bool : Success |

### _updatePodState

```solidity
function _updatePodState(address podAddress) internal returns (bool)
```

_Update a Pod's state & accrued owed fees based on the last updated index_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| podAddress | address | Address of the Pod |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| - | bool | bool : Success |

## Admin Methods

### updatePodRegistry

```solidity
function updatePodRegistry(address pod) public
```

Update the Registry for a given Pod

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| pod | address | Address of the Pod |

### updateMultiplePodsRegistry

```solidity
function updateMultiplePodsRegistry(address[] podList) external
```

Update the Registry for a given list of Pods

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| podList | address[] | List of Pod addresses |

### updateAllPodsRegistry

```solidity
function updateAllPodsRegistry() external
```

Update the Registry for all Pods

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

### addCollateral

```solidity
function addCollateral(address collateral, address aToken) external
```

Add a new collateral for Pod creation

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| collateral | address | Address of the collateral |
| aToken | address | Address of the aToken associated to the collateral |

### updateCollateral

```solidity
function updateCollateral(address collateral, bool allowed) external
```

Update a collateral for Pod creation

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| collateral | address | Address of the collateral |
| allowed | bool | Is the collateral allowed ofr Pod creation |

### updateRegistry

```solidity
function updateRegistry(address newRegistry) external
```

Uodate the Registry

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newRegistry | address | Address of the new Registry |

### updateFeeModule

```solidity
function updateFeeModule(address newModule) external
```

Uodate the Fee Module

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newModule | address | Address of the new Module |

### updateOracleModule

```solidity
function updateOracleModule(address newModule) external
```

Uodate the Oracle Module

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newModule | address | Address of the new Module |

### updateMintFeeRatio

```solidity
function updateMintFeeRatio(uint256 newRatio) external
```

Uodate the mint fee ratio parameter

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newRatio | uint256 | New ratio value |

### updateProtocolFeeRatio

```solidity
function updateProtocolFeeRatio(uint256 newRatio) external
```

Uodate the protocol fee ratio parameter

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newRatio | uint256 | New ratio value |

### updateExtraLiquidationRatio

```solidity
function updateExtraLiquidationRatio(uint256 newRatio) external
```

Uodate the extra liquidation ratio parameter

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newRatio | uint256 | New ratio value |

### safe96

```solidity
function safe96(uint256 n) internal pure returns (uint96)
```

