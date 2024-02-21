# Solidity API

## DullahanRegistry

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

### GHO

```solidity
address GHO
```

Address of the GHO token

### DEBT_GHO

```solidity
address DEBT_GHO
```

Address of the GHO debt token

### AAVE_POOL_V3

```solidity
address AAVE_POOL_V3
```

Address of the Aave v3 Pool

### AAVE_REWARD_COONTROLLER

```solidity
address AAVE_REWARD_COONTROLLER
```

Address of the Aave rewards controller

### dullahanVault

```solidity
address dullahanVault
```

Address of the Dullahan Vault

### dullahanPodManagers

```solidity
address[] dullahanPodManagers
```

Address of Dullahan Pod Managers

### SetVault

```solidity
event SetVault(address vault)
```

Event emitted when the Vault is set

### AddPodManager

```solidity
event AddPodManager(address newManager)
```

Event emitted when a Manager is added

### constructor

```solidity
constructor(address _aave, address _stkAave, address _gho, address _ghoDebt, address _aavePool, address _aaveRewardController) public
```

### setVault

```solidity
function setVault(address vault) external
```

Set the Dullahan Vault

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| vault | address | address of the vault |

### addPodManager

```solidity
function addPodManager(address manager) external
```

Add a Pod Manager

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| manager | address | Address of the new manager |

### getPodManagers

```solidity
function getPodManagers() external view returns (address[])
```

Get the list of Pod Managers

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address[] | address[] : List of Pod Managers |

