# Solidity API

## OracleModule

### UNIT

```solidity
uint256 UNIT
```

1e18 scale

### GHO_DECIMALS

```solidity
uint256 GHO_DECIMALS
```

Number of decimals in the GHO token

### AAVE_ORACLE

```solidity
address AAVE_ORACLE
```

Address of the Aave Price Oracle

### GHO

```solidity
address GHO
```

Address of the GHO token

### constructor

```solidity
constructor(address _oracle, address _gho) public
```

### getCollateralAmount

```solidity
function getCollateralAmount(address collateral, uint256 feeAmount) external view returns (uint256)
```

Get the amount of collateral for a given amount of fees

_Calculates the amount of collateral matching the given amount of fees based on current prices_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| collateral | address | Address of the collateral |
| feeAmount | uint256 | Amount of fees |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | uint256 : Amount of collateral |

### getFeeAmount

```solidity
function getFeeAmount(address collateral, uint256 collateralAmount) external view returns (uint256)
```

Get the amount of fees for a given amount of collateral

_Calculates the amount of fees matching the given amount of collateral based on current prices_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| collateral | address | Address of the collateral |
| collateralAmount | uint256 | Amount of collateral |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | uint256 : Amount of fees |

