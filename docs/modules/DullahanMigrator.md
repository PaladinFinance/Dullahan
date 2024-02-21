# Solidity API

## DullahanMigrator

### stkAave

```solidity
address stkAave
```

Address of the stkAAVE token

### palStkAave

```solidity
address palStkAave
```

Address of the palStkAave token

### palPool

```solidity
address palPool
```

Address of the palStkAave PalPool

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

### Migrate

```solidity
event Migrate(address caller, address receiver, uint256 amount, uint256 stkAave, bool staked)
```

Event emitted when a Migration id performed

### TokenRecovered

```solidity
event TokenRecovered(address token, uint256 amount)
```

Event emitted when an ERC20 token is recovered from this contract

### constructor

```solidity
constructor(address _stkAave, address _palStkAave, address _palPool, address _vault, address _staking) public
```

### migrate

```solidity
function migrate(uint256 amount, address receiver, bool stake) external
```

Withdraw palStkAAVE & deposit into the Vault & stake them

_Withdraw palStkAAVE, deposit in the Vault, and stake if flag was given_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | Amount of palStkAave |
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
| [0] | bool | bool: success |

