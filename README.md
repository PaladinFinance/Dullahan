
# Dullahan


## Overview

A Dullahan comes from the Irish mythology, and is depicted as a headless knight riding a black horse, holding its own head in its hand. This product is the newest member of the Paladin round table, and is aimed to use the best synergy betwenn stkAAVE, GHO & vote lending, the image of a ghost knight is the best incarnation of it.

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

 
![Dullahan diagram](misc/Dullahan_diagram.png?raw=true "Dullahan diagram")


## Deployed contracts

coming soon ... 


## Dependencies & Installation


To start, make sure you have `node` & `npm` installed : 
* `node` - tested with v16.4.0
* `npm` - tested with v7.18.1

Then, clone this repo, and install the dependencies : 

```
git clone https://github.com/PaladinFinance/Dullahan.git
cd Dullahan
npm install
```

This will install `Hardhat`, `Ethers v5`, and all the hardhat plugins used in this project.


## Contracts

- [Dullahan Vault](https://github.com/PaladinFinance/Dullahan/blob/main/contracts/DullahanVault.sol) : Main vault, holding stkAave & auto-compounding Safety Module rewards
- [Dullahan Staking](https://github.com/PaladinFinance/Dullahan/blob/main/contracts/DullahanRewardsStaking.sol) : Staking for the Vault shares, distributing yield
- [Dullahan Pod Manager](https://github.com/PaladinFinance/Dullahan/blob/main/contracts/DullahanPodManager.sol) : Pod Manager, allowing to create Pod & rent stkAave from the Vault
- [Dullahan Pod Implementation](https://github.com/PaladinFinance/Dullahan/blob/main/contracts/DullahanPod.sol): Pod implementation, depositing colleteral in Aave, minting the GHO & holding the rened stkAave
- [Dullahan Fee Module](https://github.com/PaladinFinance/Dullahan/blob/main/contracts/modules/DullahanFeeModule.sol) : Module to calculate the fees for renting stkAave
- [Dullahan Oracle Module](https://github.com/PaladinFinance/Dullahan/blob/main/contracts/modules/OracleModule.sol) : Module wrapping the Aave Price Oracle to calcualte liquidation amounts
- [Dullahan Zap Deposit](https://github.com/PaladinFinance/Dullahan/blob/main/contracts/modules/DullahanZapDeposit.sol) : Module to deposit & stake in 1 transaction


## Tests

Tests can be found in the `./test` directory.

To run the tests : 
```
npm run test
```


## Deploy


Deploy to Mainnet :
```
npm run build
npm run deploy <path_to_deploy_script>
```


## Security & Audit

Dullahan was adited by Pessimistic : [Audit Report](https://github.com/PaladinFinance/Dullahan/blob/main/audit/Paladin%20Dullahan%20Security%20Analysis%20by%20Pessimistic.pdf)


## Ressources


Website : [paladin.vote](https://.paladin.vote)

Documentation : [doc.paladin.vote](https://doc.paladin.vote)


## Community

For any question about this project, or to engage with us :

[Twitter](https://twitter.com/Paladin_vote)

[Discord](https://discord.com/invite/esZhmTbKHc)



## License


This project is licensed under the [MIT](https://github.com/PaladinFinance/Paladin-Evocations/blob/main/MIT-LICENSE.TXT) license


