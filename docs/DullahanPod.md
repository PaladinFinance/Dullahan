# DullahanPod

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

### MIN_MINT_AMOUNT

```solidity
uint256 MIN_MINT_AMOUNT
```

Minimum allowed amount of GHO to mint

### initialized

```solidity
bool initialized
```

Is the Pod initialized

### manager

```solidity
address manager
```

Address of the Pod manager

### vault

```solidity
address vault
```

Address of the Vault

### registry

```solidity
address registry
```

Address of the Registry

### podOwner

```solidity
address podOwner
```

Address of the Pod owner

### delegate

```solidity
address delegate
```

Address of the delegate receiving the Pod voting power

### collateral

```solidity
address collateral
```

Address of the collateral in the Pod

### aToken

```solidity
address aToken
```

Address of the aToken for the collateral

### aave

```solidity
address aave
```

Address of the AAVE token

### stkAave

```solidity
address stkAave
```

Address of the stkAAVE token

## Events

### PodInitialized

```solidity
event PodInitialized(address podManager, address collateral, address podOwner, address vault, address registry, address delegate)
```

Event emitted when the Pod is initialized

### CollateralDeposited

```solidity
event CollateralDeposited(address collateral, uint256 amount)
```

Event emitted when collateral is deposited

### CollateralWithdrawn

```solidity
event CollateralWithdrawn(address collateral, uint256 amount)
```

Event emitted when collateral is withdrawn

### CollateralLiquidated

```solidity
event CollateralLiquidated(address collateral, uint256 amount)
```

Event emitted when collateral is liquidated

### GhoMinted

```solidity
event GhoMinted(uint256 mintedAmount)
```

Event emitted when GHO is minted

### GhoRepayed

```solidity
event GhoRepayed(uint256 amountToRepay)
```

Event emitted when GHO is repayed

### RentedStkAave

```solidity
event RentedStkAave()
```

Event emitted when stkAAVE is rented by the Pod

### UpdatedDelegate

```solidity
event UpdatedDelegate(address oldDelegate, address newDelegate)
```

Event emitted when the Pod delegate is updated

### UpdatedRegistry

```solidity
event UpdatedRegistry(address oldRegistry, address newRegistry)
```

Event emitted when the Pod registry is updated

## Modifiers

### onlyPodOwner

```solidity
modifier onlyPodOwner()
```

Check that the caller is the Pod owner

### onlyManager

```solidity
modifier onlyManager()
```

Check that the caller is the manager

### isInitialized

```solidity
modifier isInitialized()
```

Check that the Pod is initialized

## Constructor

```solidity
constructor() public
```

### init

```solidity
function init(address _manager, address _vault, address _registry, address _podOwner, address _collateral, address _aToken, address _delegate) external
```

Initialize the Pod with the given parameters

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _manager | address | Address of the Manager |
| _vault | address | Address of the Vault |
| _registry | address | Address of the Registry |
| _podOwner | address | Address of the Pod owner |
| _collateral | address | Address of the collateral |
| _aToken | address | Address of the aToken for the collateral |
| _delegate | address | Address of the delegate for the voting power |

## View Methods

### podCollateralBalance

```solidity
function podCollateralBalance() external view returns (uint256)
```

Get the Pod's current collateral balance

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| - | uint256 | uint256 : Current collateral balance |

### podDebtBalance

```solidity
function podDebtBalance() public view returns (uint256)
```

Get the Pod's current GHO debt balance

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| - | uint256 | uint256 : Current GHO debt balance |

### podOwedFees

```solidity
function podOwedFees() external view returns (uint256)
```

Get the stored amount of fees owed by this Pod

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| - | uint256 | uint256 : Stored amount of fees owed |

## State Changing Methods

### depositCollateral

```solidity
function depositCollateral(uint256 amount) external
```

Deposit collateral

_Pull collateral in the Pod to deposit it in the Aave Pool_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | Amount to deposit |

### withdrawCollateral

```solidity
function withdrawCollateral(uint256 amount, address receiver) external
```

Withdraw collateral

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | Amount to withdraw |
| receiver | address | Address to receive the collateral |

### claimAaveExtraRewards

```solidity
function claimAaveExtraRewards(address receiver) external
```

Claim any existing rewards from the Aave Rewards Controller for this Pod

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| receiver | address | Address to receive the rewards |

### compoundStkAave

```solidity
function compoundStkAave() external
```

Claim Safety Module rewards & stake them in stkAAVE

### mintGho

```solidity
function mintGho(uint256 amountToMint, address receiver) external returns (uint256 mintedAmount)
```

Mint GHO & rent stkAAVE

_Rent stkAAVE from the Vault & mint GHO with the best interest rate discount possible_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| amountToMint | uint256 | Amount of GHO to be minted |
| receiver | address | Address to receive the minted GHO |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| mintedAmount | uint256 | - uint256 : amount of GHO minted after fees |

### repayGho

```solidity
function repayGho(uint256 amountToRepay) external returns (bool)
```

Repay GHO fees and debt

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| amountToRepay | uint256 | Amount of GHO to de repaid |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| - | bool | bool : Success |

### repayGhoAndWithdrawCollateral

```solidity
function repayGhoAndWithdrawCollateral(uint256 repayAmount, uint256 withdrawAmount, address receiver) external returns (bool)
```

Repay GHO fees and debt & withdraw collateral

_Repay GHO fees & debt to be allowed to withdraw collateral_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| repayAmount | uint256 | Amount of GHO to de repaid |
| withdrawAmount | uint256 | Amount to withdraw |
| receiver | address | Address to receive the collateral |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| - | bool | bool : Success |

### rentStkAave

```solidity
function rentStkAave() external returns (bool)
```

Rent stkAAVE from the Vault to get the best interest rate reduction

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| - | bool | bool : Success |

### liquidateCollateral

```solidity
function liquidateCollateral(uint256 amount, address receiver) external
```

Liquidate Pod collateral to repay owed fees

_Liquidate Pod collateral to repay owed fees, in the case the this Pod got liquidated on Aave market, and fees are still owed to Dullahan_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | Amount of collateral to liquidate |
| receiver | address | Address to receive the collateral |

### updateDelegation

```solidity
function updateDelegation(address newDelegate) external
```

Update the Pod's delegate address & delegate the voting power to it

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newDelegate | address | Address of the new delegate |

### updateRegistry

```solidity
function updateRegistry(address newRegistry) external
```

Update the Pod's Registry address

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newRegistry | address | Address of the new Registry |

## Internal Methods

### _withdrawCollateral

```solidity
function _withdrawCollateral(uint256 amount, address receiver) internal
```

_Withdraw collateral from the Aave Pool directly to the given receiver (only if Pod fees are fully repaid)_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | Amount to withdraw |
| receiver | address | Address to receive the collateral |

### _repayGho

```solidity
function _repayGho(uint256 amountToRepay) internal returns (bool)
```

_Repay GHO owed fees & debt (fees in priority)_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| amountToRepay | uint256 | Amount of GHO to be repayed |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| - | bool | bool : Success |

### _getStkAaveRewards

```solidity
function _getStkAaveRewards() internal
```

_Claim AAVE rewards from the Safety Module & stake them to receive stkAAVE & notify the Manager_

