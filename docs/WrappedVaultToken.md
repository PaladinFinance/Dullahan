# Solidity API

## WrappedVaultToken

### vault

```solidity
address vault
```

Address of the Dullahan Vault

### Wrapped

```solidity
event Wrapped(address user, uint256 dstkAaveAmount, uint256 wdstkAaveAmount)
```

### Unwrapped

```solidity
event Unwrapped(address user, uint256 dstkAaveAmount, uint256 wdstkAaveAmount)
```

### constructor

```solidity
constructor(address _vault, string _name, string _symbol) public
```

### getCurrentIndex

```solidity
function getCurrentIndex() external view returns (uint256)
```

Get the current index to convert between dstkAave & wdstkAave

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | uint256 : Current index |

### convertToWdstkAave

```solidity
function convertToWdstkAave(uint256 dstkAaveAmount) public view returns (uint256 wdstkAaveAmount)
```

Convert a dstkAave amount into wdstkAave

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| dstkAaveAmount | uint256 | : Amount of dstkAave to convert |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| wdstkAaveAmount | uint256 | : Converted amount |

### convertToDstkAave

```solidity
function convertToDstkAave(uint256 wdstkAaveAmount) public view returns (uint256 dstkAaveAmount)
```

Convert a wdstkAave amount into dstkAave

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| wdstkAaveAmount | uint256 | : Amount of wdstkAave to convert |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| dstkAaveAmount | uint256 | : Converted amount |

### wrap

```solidity
function wrap(uint256 dstkAaveAmount) external returns (uint256 wdstkAaveAmount)
```

Wrap dstkAave into wdstkAave

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| dstkAaveAmount | uint256 | : Amount of dstkAave to wrap |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| wdstkAaveAmount | uint256 | : Wrapped amount |

### unwrap

```solidity
function unwrap(uint256 wdstkAaveAmount) external returns (uint256 dstkAaveAmount)
```

Unwrap wdstkAave into dstkAave

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| wdstkAaveAmount | uint256 | : Amount of wdstkAave to unwrap |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| dstkAaveAmount | uint256 | : Unwrapped amount |

### _getCurrentIndex

```solidity
function _getCurrentIndex() internal view returns (uint256)
```

_Get the current index to convert between dstkAave & wdstkAave_

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | uint256 : Current index |

