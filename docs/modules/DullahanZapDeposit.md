# DullahanZapDeposit

## Storage

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

### vault

```solidity
address vault
```

Address of the Dullahan Vault

### staking

```solidity
address staking
```

Address of the Dullahan Staking

## Events

### ZapDeposit

```solidity
event ZapDeposit(address caller, address receiver, address sourceToken, uint256 amount, bool staked)
```

Event emitted when a Zap Depsoit is performed

### TokenRecovered

```solidity
event TokenRecovered(address token, uint256 amount)
```

Event emitted when an ERC20 token is recovered from this contract

## Constructor

```solidity
constructor(address _aave, address _stkAave, address _vault, address _staking) public
```

## State Changing Methods

### zapDeposit

```solidity
function zapDeposit(address sourceToken, uint256 amount, address receiver, bool stake) external
```

Zap deposit AAVE or stkAAVE into the Vault & stake them

_Pull AAVE or stkAAVE, deposit in the Vault, and stake if flag was given_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| sourceToken | address | Address of the token to pull (AAVE or stkAAVE) |
| amount | uint256 | Amount to deposit |
| receiver | address | Address to receive the share token / to be staked on behalf of |
| stake | bool | Flag to stake the received shares |

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

### recoverERC20

```solidity
function recoverERC20(address token) external returns (bool)
```

Recover ERC2O tokens in the contract

_Recover ERC2O tokens in the contract_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| token | address | Address of the ERC2O token |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| - | bool | bool: success |

