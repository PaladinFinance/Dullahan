# Solidity API

## DullahanDiscountCalculator

### UNIT

```solidity
uint256 UNIT
```

1e18 scale

### GHO_DISCOUNTED_PER_DISCOUNT_TOKEN

```solidity
uint256 GHO_DISCOUNTED_PER_DISCOUNT_TOKEN
```

_Amount of debt that is entitled to get a discount per unit of discount token
Expressed with the number of decimals of the discounted token_

### MIN_DISCOUNT_TOKEN_BALANCE

```solidity
uint256 MIN_DISCOUNT_TOKEN_BALANCE
```

_Minimum balance amount of discount token to be entitled to a discount
Expressed with the number of decimals of the discount token_

### MIN_DEBT_TOKEN_BALANCE

```solidity
uint256 MIN_DEBT_TOKEN_BALANCE
```

_Minimum balance amount of debt token to be entitled to a discount
Expressed with the number of decimals of the debt token_

### calculateAmountForMaxDiscount

```solidity
function calculateAmountForMaxDiscount(uint256 totalDebtAmount) external pure returns (uint256 neededAmount)
```

End of Aave parameters zone

