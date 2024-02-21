# Solidity API

## ScalingERC20

### UNIT

```solidity
uint256 UNIT
```

1e18 scale

### INITIAL_INDEX

```solidity
uint256 INITIAL_INDEX
```

1e27 - RAY - Initial Index for balance to scaled balance

### UserState

```solidity
struct UserState {
  uint128 scaledBalance;
  uint128 index;
}
```

### _totalSupply

```solidity
uint256 _totalSupply
```

Total scaled supply

### _allowances

```solidity
mapping(address => mapping(address => uint256)) _allowances
```

Allowances for users

### _userStates

```solidity
mapping(address => struct ScalingERC20.UserState) _userStates
```

User states

### Mint

```solidity
event Mint(address user, uint256 scaledAmount, uint256 index)
```

Event emitted when minting

### Burn

```solidity
event Burn(address user, uint256 scaledAmount, uint256 index)
```

Event emitted when burning

### constructor

```solidity
constructor(string __name, string __symbol) internal
```

### name

```solidity
function name() public view returns (string)
```

Get the name of the ERC20

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | string | string : Name |

### symbol

```solidity
function symbol() external view returns (string)
```

Get the symbol of the ERC20

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | string | string : Symbol |

### decimals

```solidity
function decimals() external view returns (uint8)
```

Get the decimals of the ERC20

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint8 | uint256 : Number of decimals |

### totalSupply

```solidity
function totalSupply() public view virtual returns (uint256)
```

Get the current total supply

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | uint256 : Current total supply |

### balanceOf

```solidity
function balanceOf(address account) public view virtual returns (uint256)
```

Get the current user balance

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| account | address | Address of user |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | uint256 : User balance |

### totalScaledSupply

```solidity
function totalScaledSupply() public view virtual returns (uint256)
```

Get the current total scaled supply

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | uint256 : Current total scaled supply |

### scaledBalanceOf

```solidity
function scaledBalanceOf(address account) public view virtual returns (uint256)
```

Get the current user scaled balance

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| account | address | Address of user |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | uint256 : User scaled balance |

### allowance

```solidity
function allowance(address owner, address spender) public view virtual returns (uint256)
```

Get the allowance of a spender for a given owner

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address | Address of the owner |
| spender | address | Address of the spender |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | uint256 : allowance amount |

### approve

```solidity
function approve(address spender, uint256 amount) public virtual returns (bool)
```

Approve a spender to spend tokens

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| spender | address | Address of the spender |
| amount | uint256 | Amount to approve |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | bool : success |

### increaseAllowance

```solidity
function increaseAllowance(address spender, uint256 addedValue) public virtual returns (bool)
```

Increase the allowance given to a spender

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| spender | address | Address of the spender |
| addedValue | uint256 | Increase amount |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | bool : success |

### decreaseAllowance

```solidity
function decreaseAllowance(address spender, uint256 subtractedValue) public virtual returns (bool)
```

Decrease the allowance given to a spender

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| spender | address | Address of the spender |
| subtractedValue | uint256 | Decrease amount |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | bool : success |

### transfer

```solidity
function transfer(address recipient, uint256 amount) public virtual returns (bool)
```

Transfer tokens to the given recipient

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| recipient | address | Address to receive the tokens |
| amount | uint256 | Amount to transfer |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | bool : success |

### transferFrom

```solidity
function transferFrom(address sender, address recipient, uint256 amount) public virtual returns (bool)
```

Transfer tokens from the spender to the given recipient

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| sender | address | Address sending the tokens |
| recipient | address | Address to receive the tokens |
| amount | uint256 | Amount to transfer |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | bool : success |

### _getCurrentIndex

```solidity
function _getCurrentIndex() internal view virtual returns (uint256)
```

_Get the current index to convert between balance and scaled balances_

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | uint256 : Current index |

### _approve

```solidity
function _approve(address owner, address spender, uint256 amount) internal virtual
```

_Approve a spender to spend tokens_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address | Address of the woner |
| spender | address | Address of the spender |
| amount | uint256 | Amount to approve |

### _transfer

```solidity
function _transfer(address sender, address recipient, uint256 amount) internal virtual
```

_Transfer tokens from the spender to the given recipient_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| sender | address | Address sending the tokens |
| recipient | address | Address to receive the tokens |
| amount | uint256 | Amount to transfer |

### _transferScaled

```solidity
function _transferScaled(address sender, address recipient, uint128 scaledAmount) internal virtual
```

_Transfer the scaled amount of tokens_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| sender | address | Address sending the tokens |
| recipient | address | Address to receive the tokens |
| scaledAmount | uint128 | Scaled amount to transfer |

### _mint

```solidity
function _mint(address account, uint256 amount, uint256 _currentIndex) internal virtual returns (uint256)
```

_Mint the given amount to the given address (by minting the correct scaled amount)_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| account | address | Address to mint to |
| amount | uint256 | Amount to mint |
| _currentIndex | uint256 | Index to use to calculate the scaled amount |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | uint256 : Amount minted |

### _burn

```solidity
function _burn(address account, uint256 amount, bool maxWithdraw) internal virtual returns (uint256)
```

_Burn the given amount from the given address (by burning the correct scaled amount)_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| account | address | Address to burn from |
| amount | uint256 | Amount to burn |
| maxWithdraw | bool | True if burning the full balance |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | uint256 : Amount burned |

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

### safe128

```solidity
function safe128(uint256 n) internal pure returns (uint128)
```

