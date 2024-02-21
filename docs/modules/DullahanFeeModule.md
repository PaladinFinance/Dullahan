# Solidity API

## DullahanFeeModule

### UNIT

```solidity
uint256 UNIT
```

1e18 scale

### TRESHOLD

```solidity
uint256 TRESHOLD
```

Threshold ratio to apply the extra multiplier

### BASE_MULTIPLIER

```solidity
uint256 BASE_MULTIPLIER
```

Base extra multiplier

### EXTRA_MULTIPLIER_STEP

```solidity
uint256 EXTRA_MULTIPLIER_STEP
```

Multplier increase for extra ratio over the treshold

### vault

```solidity
address vault
```

Address of the Dullahan Vault

### feePerStkAavePerSecond

```solidity
uint256 feePerStkAavePerSecond
```

Amount of GHO fees per second per stkAAVE

### UpdatedFeePerStkAavePerSecond

```solidity
event UpdatedFeePerStkAavePerSecond(uint256 oldFee, uint256 newFee)
```

Event emitted when the fee per second value is updated

### constructor

```solidity
constructor(address _vault, uint256 _startFee) public
```

### utilizationRate

```solidity
function utilizationRate() public view returns (uint256)
```

Get the current utilization rate

_Calculates the current utilization rate based on the Vault rented amount & total assets_

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | uint256 : Current utilization rate |

### getCurrentFeePerSecond

```solidity
function getCurrentFeePerSecond() external view returns (uint256 currentFee)
```

Get the current fee per second

_Calculates the current fee per second based on the current utilization rate_

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| currentFee | uint256 | - uint256 : Current fee per second |

### updateFeePerStkAavePerSecond

```solidity
function updateFeePerStkAavePerSecond(uint256 newFee) external
```

Updates the feePerStkAavePerSecond parameter

_Updates the feePerStkAavePerSecond in storage with the given value_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newFee | uint256 | New value tu set |

