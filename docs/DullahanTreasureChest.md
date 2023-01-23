# DullahanTreasureChest

## Events

### AddedManager

```solidity
event AddedManager(address manager)
```

Event emitted when a new manager is added

### RemovedManager

```solidity
event RemovedManager(address manager)
```

Event emitted when a manager is removed

## Modifiers

### onlyAllowed

```solidity
modifier onlyAllowed()
```

Check the caller is either the admin or an approved manager

## View Methods

### currentBalance

```solidity
function currentBalance(address token) external view returns (uint256)
```

Returns the balance of this contract for the given ERC20 token

_Returns the balance of this contract for the given ERC20 token_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| token | address | Address of the ERC2O token |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| - | uint256 | uint256 : current balance in the given ERC20 token |

## State Changing Methods

### increaseAllowanceERC20

```solidity
function increaseAllowanceERC20(address token, address spender, uint256 amount) external
```

Increases the allowance of the spender of a given amount for the given ERC20 token

_Increases the allowance of the spender of a given amount for the given ERC20 token_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| token | address | Address of the ERC2O token |
| spender | address | Address to approve for spending |
| amount | uint256 | Amount to increase |

### decreaseAllowanceERC20

```solidity
function decreaseAllowanceERC20(address token, address spender, uint256 amount) external
```

Decreases the allowance of the spender of a given amount for the given ERC20 token

_Decreases the allowance of the spender of a given amount for the given ERC20 token_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| token | address | Address of the ERC2O token |
| spender | address | Address to approve for spending |
| amount | uint256 | Amount to decrease |

### transferERC20

```solidity
function transferERC20(address token, address recipient, uint256 amount) external
```

Transfers a given amount of ERC20 token to the given recipient

_Transfers a given amount of ERC20 token to the given recipient_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| token | address | Address of the ERC2O token |
| recipient | address | Address fo the recipient |
| amount | uint256 | Amount to transfer |

### approveManager

```solidity
function approveManager(address newManager) external
```

Approves a given address to be manager on this contract

_Approves a given address to be manager on this contract_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| newManager | address | Address to approve as manager |

### removeManager

```solidity
function removeManager(address manager) external
```

Removes a given address from being manager on this contract

_Removes a given address from being manager on this contract_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| manager | address | Address to remove |

