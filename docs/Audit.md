# Dullahan Audit Context

## System Overview

Dullahan is the next evolution of the palStkAave, aiming to supercharge the staked AAVE token.  
The Dullahan vault will allow users to deposit their stkAAVE tokens to get the best yield from it,
through different mechanisms:
- claim & auto-compound rewards from the Safety Module
- any yield coming from vote lending or voting incentives around the Aave Governance
- yield from users looking to lend stkAAVE to harness the GHO interest rate discount coming from stkAAVE
  
Any reward in AAVE, coming from the Safety Module claim or any other source, will always be staked again
into stkAAVE, to allow to auto-compound the yield and get Safety Module yield on a higher total amount,
while participating in securing the Aave protocol by increasing the size of the Safety Module.  
The Vault will also allow approved Manager contracts to rent stkAave for GHO minting.
The 1st version of the Pod Manager allow users looking to mint GHO to create Pods, and rent stkAAVE, allowing them to deposit their collateral and borrow GHO from the Aave market through Pod with the best interest rate discount they can get. All the stkAAVE that is not necessary to get the best interest rate discount can be clawed back into the main Vault, only leaving the exact amount of stkAAVE needed for the current borrow GHO amount. In the same logic, the Pod can also get more stkAAVE from the Vault to increase the amount of GHO borrowed (if the deposited collateral allows it). When the user GHO debt is repayed (or when the user get liquidated), all stkAAVE are returned to the Vault. Pods accrued fees over the rented stkAAVE, following a decided fee pricing model. The collateral of an user is locked in the Pod as long as retning fees are owed to the Dullahan system.
All the Governance power held by the vault & all the Pods will always be delegated to a Governance Module, that can be a multisig, a chosen Delegate from the Aave governance, or a smart contract, allowing to have the best use of the Vault (& Pods) global voting power, and harvest any incentive that could come from any source (paid vote delegation, voting incentives/bribes, purchase of Proposal power, ...)  
  
The Dullahan Vault uses the Scaling ERC20 logic (inspired by the Aave aToken) so 1 share is always equal to 1 stkAAVE, where the depositors balance will automatically increase based on the yield generated by the Vault. This system will also allow the deposited stkAAVE to have a liquid wrapper that is always equivalent to 1 AAVE, and to be used in DEX Stable Pools so stkAAVE LPs never lose on Safety Module yield when being liquidity providers.

## Files

|**File**|**SOLC**|
|:-|:-:|
|[ScalingERC20](https://github.com/PaladinFinance/Dullahan/blob/main/contracts/base/ScalingERC20.sol)|329|
|[DullahanVault](https://github.com/PaladinFinance/Dullahan/blob/main/contracts/DullahanVault.sol)|730|
|[DullahanRewardsStaking](https://github.com/PaladinFinance/Dullahan/blob/main/contracts/DullahanRewardsStaking.sol)|610|
|[DullahanPodManager](https://github.com/PaladinFinance/Dullahan/blob/main/contracts/DullahanPodManager.sol)|692|
|[DullahanPod](https://github.com/PaladinFinance/Dullahan/blob/main/contracts/DullahanPod.sol)|436|
|[DullahanTreasureChest](https://github.com/PaladinFinance/Dullahan/blob/main/contracts/DullahanTreasureChest.sol)|95|
|[DullahanDiscountCalculator](https://github.com/PaladinFinance/Dullahan/blob/main/contracts/modules/DullahanDiscountCalculator.sol)|48|
|[DullahanFeeModule](https://github.com/PaladinFinance/Dullahan/blob/main/contracts/modules/DullahanFeeModule.sol)|88|
|[DullahanRegistry](https://github.com/PaladinFinance/Dullahan/blob/main/contracts/modules/DullahanRegistry.sol)|95|
|[OracleModule](https://github.com/PaladinFinance/Dullahan/blob/main/contracts/modules/OracleModule.sol)|77|
|[DullahanMigrator](https://github.com/PaladinFinance/Dullahan/blob/main/contracts/modules/DullahanMigrator.sol)|113|
|[DullahanZapDeposit](https://github.com/PaladinFinance/Dullahan/blob/main/contracts/modules/DullahanZapDeposit.sol)|113|

### Coverage

|**File**|**Statements**|**Branches**|**Functions**|**Lines**|
|:-|:-:|:-:|:-:|:-:|
|[ScalingERC20](https://github.com/PaladinFinance/Dullahan/blob/main/contracts/base/ScalingERC20.sol)|94.44%|80.77%|82.61%|95.89%|
|[DullahanVault](https://github.com/PaladinFinance/Dullahan/blob/main/contracts/DullahanVault.sol)|97.81%|93%|98.04%|97.84%|
|[DullahanRewardsStaking](https://github.com/PaladinFinance/Dullahan/blob/main/contracts/DullahanRewardsStaking.sol)|92.99%|90.54%|89.47%|92.9%|
|[DullahanPodManager](https://github.com/PaladinFinance/Dullahan/blob/main/contracts/DullahanPodManager.sol)|98.02%|87.21%|92.5%|98.51%|
|[DullahanPod](https://github.com/PaladinFinance/Dullahan/blob/main/contracts/DullahanPod.sol)|97.12%|83.75%|90.91%|97.84%|
|[DullahanTreasureChest](https://github.com/PaladinFinance/Dullahan/blob/main/contracts/DullahanTreasureChest.sol)|100%|75%|100%|100%|
|[DullahanDiscountCalculator](https://github.com/PaladinFinance/Dullahan/blob/main/contracts/modules/DullahanDiscountCalculator.sol)|100%|100%|100%|100%|
|[DullahanFeeModule](https://github.com/PaladinFinance/Dullahan/blob/main/contracts/modules/DullahanFeeModule.sol)|100%|100%|100%|100%|
|[DullahanRegistry](https://github.com/PaladinFinance/Dullahan/blob/main/contracts/modules/DullahanRegistry.sol)|100%|100%|100%|100%|
|[OracleModule](https://github.com/PaladinFinance/Dullahan/blob/main/contracts/modules/OracleModule.sol)|88.24%|50%|100%|88.24%|
|[DullahanMigrator](https://github.com/PaladinFinance/Dullahan/blob/main/contracts/modules/DullahanMigrator.sol)|0%|0%|0%|0%|
|[DullahanZapDeposit](https://github.com/PaladinFinance/Dullahan/blob/main/contracts/modules/DullahanZapDeposit.sol)|92.86%|77.78%|60%|92.86%|
|**Total**|93.53%|84.32%|89.66%|93.87%|

### Dependencies & Libraries

|**File**|**SOLC**|**Source**|
|:-|:-:|:-:|
|**Contracts**|-|-|
|[Owner](https://github.com/PaladinFinance/Shrine/blob/main/contracts/utils/Owner.sol)|26|Paladin|
|[ERC20](https://github.com/PaladinFinance/Shrine/blob/main/contracts/oz/utils/ERC20.sol)|351|OpenZeppelin|
|**Abstracts**|-|-|
|[Context](https://github.com/PaladinFinance/Shrine/blob/main/contracts/oz/utils/Context.sol)|21|OpenZeppelin|
|[Ownable](https://github.com/PaladinFinance/Shrine/blob/main/contracts/oz/utils/Ownable.sol)|72|OpenZeppelin|
|[Pausable](https://github.com/PaladinFinance/Shrine/blob/main/contracts/oz/utils/Pausable.sol)|92|OpenZeppelin|
|[ReentrancyGuard](https://github.com/PaladinFinance/Shrine/blob/main/contracts/oz/utils/ReentrancyGuard.sol)|54|OpenZeppelin|
|**Libraries**|-|-|
|[Errors](https://github.com/PaladinFinance/Shrine/blob/main/contracts/utils/Errors.sol)|50|Paladin|
|[WadRayMath](https://github.com/PaladinFinance/Shrine/blob/main/contracts/utils/WadRayMath.sol)|106|MorphoLabs|
|[SafeERC20](https://github.com/PaladinFinance/Shrine/blob/main/contracts/oz/libraries/SafeERC20.sol)|88|OpenZeppelin|
|[Address](https://github.com/PaladinFinance/Shrine/blob/main/contracts/oz/utils/Address.sol)|205|OpenZeppelin|
|**Interfaces**|-|-|
|[IERC20](https://github.com/PaladinFinance/Shrine/blob/main/contracts/oz/interfaces/IERC20.sol)|72|OpenZeppelin|
|[IERC20Metadata](https://github.com/PaladinFinance/Shrine/blob/main/contracts/oz/extensions/IERC20Metadata.sol)|23|OpenZeppelin|

## Contracts Desciptions

More infos in each contract file in the [Docs](https://github.com/PaladinFinance/Shrine/blob/main/docs) folder

### ScalingERC20

Abstract contract extending the ERC20 to have a scaling token (based on Aave & OZ implementations).

### DullahanVault

Main Vault (IERC4626 compatible), inheriting Scaling ERC20, so 1 dstkAAVE always equal 1 stkAAVE. Allows to deposit stkAAVE to mint dstkAAVE, and withdraw stkAAVE by burning dstkAAVE. Can list managers allowed to rent stkAAVE from the Vault (for Pods in the current setup).

### DullahanRewardsStaking

Contract allowing to stake dstkAAVE to accrue rewards (mainly GHO fees from stkAave renting, but also potential external rewards).

### DullahanPodManager

Contract to create Pods & list them. Handles the logic for stkAave renting, Pod fees & potential liquidations.

### DullahanPod

Implementation of the Pod logic. Unique to each user, it allows to deposit & withdraw collateral from Aave (holding the aTokens in the contract), to borrow & repay GHO (holding the GHO debt), and rent stkAave from the vault (via the Manager).

### DullahanTreasureChest

Contract receiving all the fees from the Dullahan contracts

### DullahanRegistry

Contract listing the address of all needed Aave contract used through the Dullahan system.

### OracleModule

Wrapper around the Aave Oracle to convert owed GHO fees into collateral amounts, used for liquidations.

### DullahanFeeModule

Contract holding the logic for the amount of fees to pay for renting stkAAVE, based on the total amount of stkAave rented from the Vault.

### DullahanDiscountCalculator

Calculator to find the amount of stkAAVE needed to have the full discount on a given amount of borrowed GHO, based on Aave's [GhoDiscountRateStrategy](https://github.com/aave/gho-core/blob/main/src/contracts/facilitators/aave/interestStrategy/GhoDiscountRateStrategy.sol).

### DullahanZapDeposit

Contract to deposit & stake in 1 transaction. Also allows to take AAVE as input, stake them before depositing.

### DullahanMigrator

Contract made to migrate palStkAave to Dullahan, by withdrawing from the palStkAave pool & deposit in the Dullahan Vault, and stake the dstkAAVE if specified.


## Notes

At deployement, the admin of all the contracts will be the Paladin Core Multisig, to be able to react promptly in case an issue arise. The adminship will later be transfered to the on-chain Governance system that the Paladin DAO will chose (with a Timelock as the direct admin of the contracts).

The test suite for Goerli encounters some revert issues, coming from the Aave contracts, for 2 reasons:
- stkAAVE on Goerli does not distribute rewards (which makes the part of the test for claiming and re-staking to fail)
- the Aave V3 market sometimes revert when repaying the full debt / withdrawing the full balance (we are in discussion with devs from the Aave team to find a solution there)