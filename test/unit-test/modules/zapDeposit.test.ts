const hre = require("hardhat");
import { ethers } from "hardhat";
import chai from "chai";
import { BigNumber } from "ethers";
import { solidity } from "ethereum-waffle";
import { DullahanVault } from "../../../typechain/DullahanVault";
import { DullahanRewardsStaking } from "../../../typechain/DullahanRewardsStaking";
import { DullahanZapDeposit } from "../../../typechain/modules/DullahanZapDeposit";
import { IERC20 } from "../../../typechain/oz/interfaces/IERC20";
import { IERC20__factory } from "../../../typechain/factories/oz/interfaces/IERC20__factory";
import { IStakedAave } from "../../../typechain/interfaces/IStakedAave";
import { IStakedAave__factory } from "../../../typechain/factories/interfaces/IStakedAave__factory";
import { IGovernancePowerDelegationToken } from "../../../typechain/interfaces/IGovernancePowerDelegationToken";
import { IGovernancePowerDelegationToken__factory } from "../../../typechain/factories/interfaces/IGovernancePowerDelegationToken__factory";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ContractFactory } from "@ethersproject/contracts";

import {
    getERC20,
    advanceTime,
    resetFork
} from "../../utils/utils";

import {
    AAVE,
    STK_AAVE,
    HOLDER_AAVE,
    AMOUNT_AAVE,
    REWARD_TOKEN_1,
    HOLDER_REWARD_1,
    AMOUNT_REWARD_1,
    REWARD_TOKEN_2,
    HOLDER_REWARD_2,
    AMOUNT_REWARD_2,
} from "../../utils/constants"

chai.use(solidity);
const { expect } = chai;
const { provider } = ethers;

let vaultFactory: ContractFactory
let stakingFactory: ContractFactory
let zapFactory: ContractFactory

const MAX_BPS = BigNumber.from('10000')
const MAX_UINT256 = ethers.constants.MaxUint256
const WEEK = BigNumber.from(7 * 86400);
const RAY = ethers.utils.parseEther('1000000000')

const user1_deposit = ethers.utils.parseEther('150')
const user2_deposit = ethers.utils.parseEther('85')
const user3_deposit = ethers.utils.parseEther('250')

describe('DullahanZapDeposit contract tests', () => {
    let admin: SignerWithAddress

    let zap: DullahanZapDeposit

    let vault: DullahanVault
    let staking: DullahanRewardsStaking

    let reserveManager: SignerWithAddress
    let votingManager: SignerWithAddress

    let depositor1: SignerWithAddress
    let depositor2: SignerWithAddress
    let depositor3: SignerWithAddress

    let aave: IERC20
    let stkAave: IERC20
    let stkAave_staking: IStakedAave

    let rewardToken1: IERC20
    let rewardToken2: IERC20

    let rewardManager: SignerWithAddress
    let rewardManager2: SignerWithAddress

    const reserve_ratio = BigNumber.from(100)

    before(async () => {
        await resetFork();

        [admin, reserveManager, votingManager, depositor1, depositor2, depositor3, rewardManager, rewardManager2] = await ethers.getSigners();

        vaultFactory = await ethers.getContractFactory("DullahanVault");
        stakingFactory = await ethers.getContractFactory("DullahanRewardsStaking")
        zapFactory = await ethers.getContractFactory("DullahanZapDeposit");;

        aave = IERC20__factory.connect(AAVE, provider);
        stkAave = IERC20__factory.connect(STK_AAVE, provider);
        stkAave_staking = IStakedAave__factory.connect(STK_AAVE, provider);

        await getERC20(admin, HOLDER_AAVE, aave, admin.address, AMOUNT_AAVE);

        await aave.connect(admin).approve(stkAave_staking.address, AMOUNT_AAVE.sub(user3_deposit));
        await stkAave_staking.connect(admin).stake(admin.address, AMOUNT_AAVE.sub(user3_deposit));

        await aave.connect(admin).transfer(depositor3.address, user3_deposit);

        rewardToken1 = IERC20__factory.connect(REWARD_TOKEN_1, provider);
        rewardToken2 = IERC20__factory.connect(REWARD_TOKEN_2, provider);

        await getERC20(admin, HOLDER_REWARD_1, rewardToken1, rewardManager.address, AMOUNT_REWARD_1);
        await getERC20(admin, HOLDER_REWARD_2, rewardToken2, rewardManager2.address, AMOUNT_REWARD_2);
    });

    beforeEach(async () => {

        vault = (await vaultFactory.connect(admin).deploy(
            admin.address,
            reserve_ratio,
            reserveManager.address,
            AAVE,
            STK_AAVE,
            "Dullahan stkAave",
            "dstkAAVE"
        )) as DullahanVault;
        await vault.deployed();

        const seed_deposit = ethers.utils.parseEther('0.001')
        await stkAave.connect(admin).approve(vault.address, seed_deposit)
        await vault.connect(admin).init(votingManager.address)

        staking = (await stakingFactory.connect(admin).deploy(
            vault.address
        )) as DullahanRewardsStaking;
        await staking.deployed();

        zap = (await zapFactory.connect(admin).deploy(
            aave.address,
            stkAave.address,
            vault.address,
            staking.address
        )) as DullahanZapDeposit;
        await zap.deployed();

        await vault.connect(admin).approve(staking.address, ethers.constants.MaxUint256)
        await staking.connect(admin).init()

        const total_amount = ethers.utils.parseEther('1500')
        const total_amount2 = ethers.utils.parseEther('950')

        await staking.connect(admin).addRewardDepositor(rewardManager.address)
        await staking.connect(admin).addRewardDepositor(rewardManager2.address)

        await staking.connect(rewardManager).queueRewards(rewardToken1.address, total_amount)
        await staking.connect(rewardManager2).queueRewards(rewardToken2.address, total_amount2)

        await rewardToken1.connect(rewardManager).transfer(staking.address, total_amount)
        await rewardToken2.connect(rewardManager2).transfer(staking.address, total_amount2)

        await stkAave.connect(admin).transfer(depositor1.address, user1_deposit)
        await stkAave.connect(admin).transfer(depositor2.address, user2_deposit)
        await stkAave.connect(admin).transfer(depositor3.address, user3_deposit)

        await stkAave.connect(depositor1).approve(zap.address, MAX_UINT256)
        await stkAave.connect(depositor2).approve(zap.address, user2_deposit)
        await aave.connect(depositor3).approve(zap.address, user3_deposit)

    });

    it(' should be deployed & have correct parameters', async () => {
        expect(zap.address).to.properAddress

        expect(await zap.owner()).to.be.eq(admin.address)

        expect(await zap.vault()).to.be.eq(vault.address)
        expect(await zap.staking()).to.be.eq(staking.address)
        expect(await zap.aave()).to.be.eq(aave.address)
        expect(await zap.stkAave()).to.be.eq(stkAave.address)

    });

    describe('zapDeposit', async () => {

        it(' should deposit into the Vault & stake the shares (& emit correct Event)', async () => {

            const prev_user_stkAave_balance = await stkAave.balanceOf(depositor1.address)
            const prev_vault_stkAave_balance = await stkAave.balanceOf(vault.address)
            const prev_zap_stkAave_balance = await stkAave.balanceOf(zap.address)

            const prev_user_balance = await vault.balanceOf(depositor1.address)
            const prev_staking_balance = await vault.balanceOf(staking.address)
            const prev_total_supply = await vault.totalSupply()
            const prev_total_assets = await vault.totalAssets()

            const prev_user_scaled_balance = await vault.scaledBalanceOf(depositor1.address)
            const prev_staking_scaled_balance = await vault.scaledBalanceOf(staking.address)
            const prev_total_scaled_supply = await vault.totalScaledSupply()

            const old_staking_user_scaled_balance = await staking.userScaledBalances(depositor1.address)
            const old_staking_total_scaled_supply = await staking.totalScaledAmount()

            const old_staking_total_assets = await staking.totalAssets()

            const old_staking_user_staked_amount = await staking.userCurrentStakedAmount(depositor1.address)

            const deposit_tx = await zap.connect(depositor1).zapDeposit(stkAave.address, user1_deposit, depositor1.address, true)
            
            const new_user_stkAave_balance = await stkAave.balanceOf(depositor1.address)
            const new_vault_stkAave_balance = await stkAave.balanceOf(vault.address)
            const new_zap_stkAave_balance = await stkAave.balanceOf(zap.address)

            const new_user_balance = await vault.balanceOf(depositor1.address)
            const new_staking_balance = await vault.balanceOf(staking.address)
            const new_total_supply = await vault.totalSupply()
            const new_total_assets = await vault.totalAssets()

            const new_user_scaled_balance = await vault.scaledBalanceOf(depositor1.address)
            const new_staking_scaled_balance = await vault.scaledBalanceOf(staking.address)
            const new_total_scaled_supply = await vault.totalScaledSupply()

            // Part stkAave reward claim & re-stake
            const stkAave_claim = new_vault_stkAave_balance.sub(prev_vault_stkAave_balance).sub(user1_deposit)
            const stkAave_claim_reserve = stkAave_claim.mul(await vault.reserveRatio()).div(MAX_BPS)
            // --------------------------------------------------

            const staking_stkAave_claim_share = (stkAave_claim.sub(stkAave_claim_reserve)).mul(prev_staking_balance).div(prev_total_supply)

            const expected_staking_index = old_staking_total_assets.add(staking_stkAave_claim_share).mul(RAY).add(old_staking_total_scaled_supply.div(2)).div(old_staking_total_scaled_supply)

            const expected_scaled_amount = user1_deposit.mul(RAY).add(expected_staking_index.div(2)).div(expected_staking_index)

            const new_staking_user_scaled_balance = await staking.userScaledBalances(depositor1.address)
            const new_staking_total_scaled_supply = await staking.totalScaledAmount()

            const new_staking_user_staked_amount = await staking.userCurrentStakedAmount(depositor1.address)

            const expected_user_index = (prev_total_assets.add(stkAave_claim.sub(stkAave_claim_reserve))).mul(RAY).add(prev_total_scaled_supply.div(2)).div(prev_total_scaled_supply)
            const expected_new_index = new_total_assets.mul(RAY).add(new_total_scaled_supply.div(2)).div(new_total_scaled_supply)

            const expected_scaledAmount = user1_deposit.mul(RAY).add(expected_user_index.div(2)).div(expected_user_index)

            const new_index = await vault.getCurrentIndex()

            expect(new_user_stkAave_balance).to.be.eq(prev_user_stkAave_balance.sub(user1_deposit))
            expect(new_zap_stkAave_balance).to.be.eq(prev_zap_stkAave_balance)

            expect(new_user_balance).to.be.eq(prev_user_balance)
            expect(new_staking_balance).to.be.eq(prev_staking_balance.add(user1_deposit).add(staking_stkAave_claim_share))
            expect(new_total_supply).to.be.eq(prev_total_supply.add(user1_deposit).add(stkAave_claim).sub(stkAave_claim_reserve))
            expect(new_total_assets).to.be.eq(prev_total_assets.add(user1_deposit).add(stkAave_claim).sub(stkAave_claim_reserve))

            expect(new_user_scaled_balance).to.be.eq(prev_user_scaled_balance)
            expect(new_staking_scaled_balance).to.be.eq(prev_staking_scaled_balance.add(expected_scaledAmount))
            expect(new_total_scaled_supply).to.be.eq(prev_total_scaled_supply.add(expected_scaledAmount))

            expect(new_total_supply).to.be.eq(new_total_assets)

            expect(new_index).to.be.eq(expected_new_index)

            expect(new_staking_user_scaled_balance).to.be.eq(old_staking_user_scaled_balance.add(expected_scaled_amount))
            expect(new_staking_total_scaled_supply).to.be.eq(old_staking_total_scaled_supply.add(expected_scaled_amount))

            expect(new_staking_user_staked_amount).to.be.eq(old_staking_user_staked_amount.add(user1_deposit))

            await expect(deposit_tx).to.emit(stkAave, 'Transfer').withArgs(
                depositor1.address,
                zap.address,
                user1_deposit
            );

            await expect(deposit_tx).to.emit(stkAave, 'Transfer').withArgs(
                zap.address,
                vault.address,
                user1_deposit
            );

            await expect(deposit_tx).to.emit(vault, 'Mint').withArgs(
                zap.address,
                expected_scaledAmount,
                expected_user_index
            );

            await expect(deposit_tx).to.emit(vault, 'Transfer').withArgs(
                ethers.constants.AddressZero,
                zap.address,
                user1_deposit
            );
            
            await expect(deposit_tx).to.emit(vault, 'Deposit').withArgs(
                zap.address,
                zap.address,
                user1_deposit,
                user1_deposit
            );

            await expect(deposit_tx).to.emit(vault, "Transfer")
            .withArgs(
                zap.address,
                staking.address,
                user1_deposit
            );

            await expect(deposit_tx).to.emit(staking, "Staked")
            .withArgs(
                zap.address,
                depositor1.address,
                user1_deposit,
                expected_scaled_amount
            );
            
            await expect(deposit_tx).to.emit(zap, 'ZapDeposit').withArgs(
                depositor1.address,
                depositor1.address,
                stkAave.address,
                user1_deposit,
                true
            );

        });

        it(' should only deposit into the Vault & send shares to the suer (& emit correct Event)', async () => {

            const prev_user_stkAave_balance = await stkAave.balanceOf(depositor2.address)
            const prev_vault_stkAave_balance = await stkAave.balanceOf(vault.address)

            const prev_user_balance = await vault.balanceOf(depositor2.address)
            const prev_total_supply = await vault.totalSupply()
            const prev_total_assets = await vault.totalAssets()

            const prev_user_scaled_balance = await vault.scaledBalanceOf(depositor2.address)
            const prev_total_scaled_supply = await vault.totalScaledSupply()

            const deposit_tx = await zap.connect(depositor2).zapDeposit(stkAave.address, user2_deposit, depositor2.address, false)
            
            const new_user_stkAave_balance = await stkAave.balanceOf(depositor2.address)
            const new_vault_stkAave_balance = await stkAave.balanceOf(vault.address)

            const new_user_balance = await vault.balanceOf(depositor2.address)
            const new_total_supply = await vault.totalSupply()
            const new_total_assets = await vault.totalAssets()

            const new_user_scaled_balance = await vault.scaledBalanceOf(depositor2.address)
            const new_total_scaled_supply = await vault.totalScaledSupply()

            // Part stkAave reward claim & re-stake
            const stkAave_claim = new_vault_stkAave_balance.sub(prev_vault_stkAave_balance).sub(user2_deposit)
            const stkAave_claim_reserve = stkAave_claim.mul(await vault.reserveRatio()).div(MAX_BPS)
            // --------------------------------------------------

            const expected_user_index = (prev_total_assets.add(stkAave_claim.sub(stkAave_claim_reserve))).mul(RAY).add(prev_total_scaled_supply.div(2)).div(prev_total_scaled_supply)
            const expected_new_index = new_total_assets.mul(RAY).add(new_total_scaled_supply.div(2)).div(new_total_scaled_supply)

            const expected_scaledAmount = user2_deposit.mul(RAY).add(expected_user_index.div(2)).div(expected_user_index)

            const new_index = await vault.getCurrentIndex()

            expect(new_user_stkAave_balance).to.be.eq(prev_user_stkAave_balance.sub(user2_deposit))

            expect(new_user_balance).to.be.eq(prev_user_balance.add(user2_deposit))
            expect(new_total_supply).to.be.eq(prev_total_supply.add(user2_deposit).add(stkAave_claim).sub(stkAave_claim_reserve))
            expect(new_total_assets).to.be.eq(prev_total_assets.add(user2_deposit).add(stkAave_claim).sub(stkAave_claim_reserve))

            expect(new_user_scaled_balance).to.be.eq(prev_user_scaled_balance.add(expected_scaledAmount))
            expect(new_total_scaled_supply).to.be.eq(prev_total_scaled_supply.add(expected_scaledAmount))

            expect(new_total_supply).to.be.eq(new_total_assets)

            expect(new_index).to.be.eq(expected_new_index)

            await expect(deposit_tx).to.emit(stkAave, 'Transfer').withArgs(
                depositor2.address,
                zap.address,
                user2_deposit
            );

            await expect(deposit_tx).to.emit(stkAave, 'Transfer').withArgs(
                zap.address,
                vault.address,
                user2_deposit
            );

            await expect(deposit_tx).to.emit(vault, 'Mint').withArgs(
                depositor2.address,
                expected_scaledAmount,
                expected_user_index
            );

            await expect(deposit_tx).to.emit(vault, 'Transfer').withArgs(
                ethers.constants.AddressZero,
                depositor2.address,
                user2_deposit
            );
            
            await expect(deposit_tx).to.emit(vault, 'Deposit').withArgs(
                zap.address,
                depositor2.address,
                user2_deposit,
                user2_deposit
            );
            
            await expect(deposit_tx).to.emit(zap, 'ZapDeposit').withArgs(
                depositor2.address,
                depositor2.address,
                stkAave.address,
                user2_deposit,
                false
            );

        });

        it(' should stake AAVE into stkAAVE before depositing (& emit correct Event)', async () => {

            const prev_user_stkAave_balance = await stkAave.balanceOf(depositor3.address)
            const prev_user_aave_balance = await aave.balanceOf(depositor3.address)
            const prev_vault_stkAave_balance = await stkAave.balanceOf(vault.address)
            const prev_zap_stkAave_balance = await stkAave.balanceOf(zap.address)

            const prev_user_balance = await vault.balanceOf(depositor3.address)
            const prev_staking_balance = await vault.balanceOf(staking.address)
            const prev_total_supply = await vault.totalSupply()
            const prev_total_assets = await vault.totalAssets()

            const prev_user_scaled_balance = await vault.scaledBalanceOf(depositor3.address)
            const prev_staking_scaled_balance = await vault.scaledBalanceOf(staking.address)
            const prev_total_scaled_supply = await vault.totalScaledSupply()

            const old_staking_user_scaled_balance = await staking.userScaledBalances(depositor1.address)
            const old_staking_total_scaled_supply = await staking.totalScaledAmount()

            const old_staking_total_assets = await staking.totalAssets()

            const old_staking_user_staked_amount = await staking.userCurrentStakedAmount(depositor1.address)

            const deposit_tx = await zap.connect(depositor3).zapDeposit(aave.address, user3_deposit, depositor3.address, true)
            
            const new_user_stkAave_balance = await stkAave.balanceOf(depositor3.address)
            const new_user_aave_balance = await aave.balanceOf(depositor3.address)
            const new_vault_stkAave_balance = await stkAave.balanceOf(vault.address)
            const new_zap_stkAave_balance = await stkAave.balanceOf(zap.address)

            const new_user_balance = await vault.balanceOf(depositor3.address)
            const new_staking_balance = await vault.balanceOf(staking.address)
            const new_total_supply = await vault.totalSupply()
            const new_total_assets = await vault.totalAssets()

            const new_user_scaled_balance = await vault.scaledBalanceOf(depositor3.address)
            const new_staking_scaled_balance = await vault.scaledBalanceOf(staking.address)
            const new_total_scaled_supply = await vault.totalScaledSupply()

            // Part stkAave reward claim & re-stake
            const stkAave_claim = new_vault_stkAave_balance.sub(prev_vault_stkAave_balance).sub(user3_deposit)
            const stkAave_claim_reserve = stkAave_claim.mul(await vault.reserveRatio()).div(MAX_BPS)
            // --------------------------------------------------

            const staking_stkAave_claim_share = (stkAave_claim.sub(stkAave_claim_reserve)).mul(prev_staking_balance).div(prev_total_supply)

            const expected_staking_index = old_staking_total_assets.add(staking_stkAave_claim_share).mul(RAY).add(old_staking_total_scaled_supply.div(2)).div(old_staking_total_scaled_supply)

            const expected_scaled_amount = user3_deposit.mul(RAY).add(expected_staking_index.div(2)).div(expected_staking_index)

            const new_staking_user_scaled_balance = await staking.userScaledBalances(depositor3.address)
            const new_staking_total_scaled_supply = await staking.totalScaledAmount()

            const new_staking_user_staked_amount = await staking.userCurrentStakedAmount(depositor3.address)

            const expected_user_index = (prev_total_assets.add(stkAave_claim.sub(stkAave_claim_reserve))).mul(RAY).add(prev_total_scaled_supply.div(2)).div(prev_total_scaled_supply)
            const expected_new_index = new_total_assets.mul(RAY).add(new_total_scaled_supply.div(2)).div(new_total_scaled_supply)

            const expected_scaledAmount = user3_deposit.mul(RAY).add(expected_user_index.div(2)).div(expected_user_index)

            const new_index = await vault.getCurrentIndex()

            expect(new_user_aave_balance).to.be.eq(prev_user_aave_balance.sub(user3_deposit))
            expect(new_user_stkAave_balance).to.be.eq(prev_user_stkAave_balance)
            expect(new_zap_stkAave_balance).to.be.eq(prev_zap_stkAave_balance)

            expect(new_user_balance).to.be.eq(prev_user_balance)
            expect(new_staking_balance).to.be.eq(prev_staking_balance.add(user3_deposit).add(staking_stkAave_claim_share))
            expect(new_total_supply).to.be.eq(prev_total_supply.add(user3_deposit).add(stkAave_claim).sub(stkAave_claim_reserve))
            expect(new_total_assets).to.be.eq(prev_total_assets.add(user3_deposit).add(stkAave_claim).sub(stkAave_claim_reserve))

            expect(new_user_scaled_balance).to.be.eq(prev_user_scaled_balance)
            expect(new_staking_scaled_balance).to.be.eq(prev_staking_scaled_balance.add(expected_scaledAmount))
            expect(new_total_scaled_supply).to.be.eq(prev_total_scaled_supply.add(expected_scaledAmount))

            expect(new_total_supply).to.be.eq(new_total_assets)

            expect(new_index).to.be.eq(expected_new_index)

            expect(new_staking_user_scaled_balance).to.be.eq(old_staking_user_scaled_balance.add(expected_scaled_amount))
            expect(new_staking_total_scaled_supply).to.be.eq(old_staking_total_scaled_supply.add(expected_scaled_amount))

            expect(new_staking_user_staked_amount).to.be.eq(old_staking_user_staked_amount.add(user3_deposit))

            await expect(deposit_tx).to.emit(aave, 'Transfer').withArgs(
                depositor3.address,
                zap.address,
                user3_deposit
            );

            await expect(deposit_tx).to.emit(stkAave, 'Transfer').withArgs(
                ethers.constants.AddressZero,
                zap.address,
                user3_deposit
            );

            await expect(deposit_tx).to.emit(stkAave_staking, 'Staked').withArgs(
                zap.address,
                zap.address,
                user3_deposit,
                user3_deposit
            );

            await expect(deposit_tx).to.emit(stkAave, 'Transfer').withArgs(
                zap.address,
                vault.address,
                user3_deposit
            );

            await expect(deposit_tx).to.emit(vault, 'Mint').withArgs(
                zap.address,
                expected_scaledAmount,
                expected_user_index
            );

            await expect(deposit_tx).to.emit(vault, 'Transfer').withArgs(
                ethers.constants.AddressZero,
                zap.address,
                user3_deposit
            );
            
            await expect(deposit_tx).to.emit(vault, 'Deposit').withArgs(
                zap.address,
                zap.address,
                user3_deposit,
                user3_deposit
            );

            await expect(deposit_tx).to.emit(vault, "Transfer")
            .withArgs(
                zap.address,
                staking.address,
                user3_deposit
            );

            await expect(deposit_tx).to.emit(staking, "Staked")
            .withArgs(
                zap.address,
                depositor3.address,
                user3_deposit,
                expected_scaled_amount
            );
            
            await expect(deposit_tx).to.emit(zap, 'ZapDeposit').withArgs(
                depositor3.address,
                depositor3.address,
                aave.address,
                user3_deposit,
                true
            );

        });

        it(' should allow to zap deposit for another receiver', async () => {

            const prev_user_stkAave_balance = await stkAave.balanceOf(depositor1.address)
            const prev_vault_stkAave_balance = await stkAave.balanceOf(vault.address)
            const prev_zap_stkAave_balance = await stkAave.balanceOf(zap.address)

            const prev_user_balance = await vault.balanceOf(depositor1.address)
            const prev_staking_balance = await vault.balanceOf(staking.address)
            const prev_total_supply = await vault.totalSupply()
            const prev_total_assets = await vault.totalAssets()

            const prev_user_scaled_balance = await vault.scaledBalanceOf(depositor1.address)
            const prev_staking_scaled_balance = await vault.scaledBalanceOf(staking.address)
            const prev_total_scaled_supply = await vault.totalScaledSupply()

            const old_staking_user_scaled_balance = await staking.userScaledBalances(depositor1.address)
            const old_staking_receiver_scaled_balance = await staking.userScaledBalances(depositor3.address)
            const old_staking_total_scaled_supply = await staking.totalScaledAmount()

            const old_staking_total_assets = await staking.totalAssets()

            const old_staking_user_staked_amount = await staking.userCurrentStakedAmount(depositor1.address)
            const old_staking_receiver_staked_amount = await staking.userCurrentStakedAmount(depositor3.address)

            const deposit_tx = await zap.connect(depositor1).zapDeposit(stkAave.address, user1_deposit, depositor3.address, true)
            
            const new_user_stkAave_balance = await stkAave.balanceOf(depositor1.address)
            const new_vault_stkAave_balance = await stkAave.balanceOf(vault.address)
            const new_zap_stkAave_balance = await stkAave.balanceOf(zap.address)

            const new_user_balance = await vault.balanceOf(depositor1.address)
            const new_staking_balance = await vault.balanceOf(staking.address)
            const new_total_supply = await vault.totalSupply()
            const new_total_assets = await vault.totalAssets()

            const new_user_scaled_balance = await vault.scaledBalanceOf(depositor1.address)
            const new_staking_scaled_balance = await vault.scaledBalanceOf(staking.address)
            const new_total_scaled_supply = await vault.totalScaledSupply()

            // Part stkAave reward claim & re-stake
            const stkAave_claim = new_vault_stkAave_balance.sub(prev_vault_stkAave_balance).sub(user1_deposit)
            const stkAave_claim_reserve = stkAave_claim.mul(await vault.reserveRatio()).div(MAX_BPS)
            // --------------------------------------------------

            const staking_stkAave_claim_share = (stkAave_claim.sub(stkAave_claim_reserve)).mul(prev_staking_balance).div(prev_total_supply)

            const expected_staking_index = old_staking_total_assets.add(staking_stkAave_claim_share).mul(RAY).add(old_staking_total_scaled_supply.div(2)).div(old_staking_total_scaled_supply)

            const expected_scaled_amount = user1_deposit.mul(RAY).add(expected_staking_index.div(2)).div(expected_staking_index)

            const new_staking_user_scaled_balance = await staking.userScaledBalances(depositor1.address)
            const new_staking_receiver_scaled_balance = await staking.userScaledBalances(depositor3.address)
            const new_staking_total_scaled_supply = await staking.totalScaledAmount()

            const new_staking_user_staked_amount = await staking.userCurrentStakedAmount(depositor1.address)
            const new_staking_receiver_staked_amount = await staking.userCurrentStakedAmount(depositor3.address)

            const expected_user_index = (prev_total_assets.add(stkAave_claim.sub(stkAave_claim_reserve))).mul(RAY).add(prev_total_scaled_supply.div(2)).div(prev_total_scaled_supply)
            const expected_new_index = new_total_assets.mul(RAY).add(new_total_scaled_supply.div(2)).div(new_total_scaled_supply)

            const expected_scaledAmount = user1_deposit.mul(RAY).add(expected_user_index.div(2)).div(expected_user_index)

            const new_index = await vault.getCurrentIndex()

            expect(new_user_stkAave_balance).to.be.eq(prev_user_stkAave_balance.sub(user1_deposit))
            expect(new_zap_stkAave_balance).to.be.eq(prev_zap_stkAave_balance)

            expect(new_user_balance).to.be.eq(prev_user_balance)
            expect(new_staking_balance).to.be.eq(prev_staking_balance.add(user1_deposit).add(staking_stkAave_claim_share))
            expect(new_total_supply).to.be.eq(prev_total_supply.add(user1_deposit).add(stkAave_claim).sub(stkAave_claim_reserve))
            expect(new_total_assets).to.be.eq(prev_total_assets.add(user1_deposit).add(stkAave_claim).sub(stkAave_claim_reserve))

            expect(new_user_scaled_balance).to.be.eq(prev_user_scaled_balance)
            expect(new_staking_scaled_balance).to.be.eq(prev_staking_scaled_balance.add(expected_scaledAmount))
            expect(new_total_scaled_supply).to.be.eq(prev_total_scaled_supply.add(expected_scaledAmount))

            expect(new_total_supply).to.be.eq(new_total_assets)

            expect(new_index).to.be.eq(expected_new_index)

            expect(new_staking_user_scaled_balance).to.be.eq(old_staking_user_scaled_balance)
            expect(new_staking_receiver_scaled_balance).to.be.eq(old_staking_receiver_scaled_balance.add(expected_scaled_amount))
            expect(new_staking_total_scaled_supply).to.be.eq(old_staking_total_scaled_supply.add(expected_scaled_amount))

            expect(new_staking_user_staked_amount).to.be.eq(old_staking_user_staked_amount)
            expect(new_staking_receiver_staked_amount).to.be.eq(old_staking_receiver_staked_amount.add(user1_deposit))

            await expect(deposit_tx).to.emit(stkAave, 'Transfer').withArgs(
                depositor1.address,
                zap.address,
                user1_deposit
            );

            await expect(deposit_tx).to.emit(stkAave, 'Transfer').withArgs(
                zap.address,
                vault.address,
                user1_deposit
            );

            await expect(deposit_tx).to.emit(vault, 'Mint').withArgs(
                zap.address,
                expected_scaledAmount,
                expected_user_index
            );

            await expect(deposit_tx).to.emit(vault, 'Transfer').withArgs(
                ethers.constants.AddressZero,
                zap.address,
                user1_deposit
            );
            
            await expect(deposit_tx).to.emit(vault, 'Deposit').withArgs(
                zap.address,
                zap.address,
                user1_deposit,
                user1_deposit
            );

            await expect(deposit_tx).to.emit(vault, "Transfer")
            .withArgs(
                zap.address,
                staking.address,
                user1_deposit
            );

            await expect(deposit_tx).to.emit(staking, "Staked")
            .withArgs(
                zap.address,
                depositor3.address,
                user1_deposit,
                expected_scaled_amount
            );
            
            await expect(deposit_tx).to.emit(zap, 'ZapDeposit').withArgs(
                depositor1.address,
                depositor3.address,
                stkAave.address,
                user1_deposit,
                true
            );

        });

        it(' should fail if given address 0x0', async () => {

            await expect(
                zap.connect(depositor1).zapDeposit(ethers.constants.AddressZero, user1_deposit, depositor1.address, true)
            ).to.be.revertedWith('AddressZero')

            await expect(
                zap.connect(depositor1).zapDeposit(stkAave.address, user1_deposit, ethers.constants.AddressZero, true)
            ).to.be.revertedWith('AddressZero')

        });

        it(' should fail if given a null amount', async () => {

            await expect(
                zap.connect(depositor1).zapDeposit(stkAave.address, 0, depositor1.address, true)
            ).to.be.revertedWith('NullAmount')

        });

        it(' should fail if given an incorrect source token (!= AAVE && != stkAAVE)', async () => {

            await expect(
                zap.connect(depositor1).zapDeposit(rewardToken1.address, user1_deposit, depositor1.address, true)
            ).to.be.revertedWith('InvalidSourceToken')

            await expect(
                zap.connect(depositor1).zapDeposit(rewardToken2.address, user1_deposit, depositor1.address, true)
            ).to.be.revertedWith('InvalidSourceToken')

        });

    });

    describe('recoverERC20', async () => {

        const lost_amount = ethers.utils.parseEther('1000');

        beforeEach(async () => {

            await rewardToken1.connect(rewardManager).transfer(zap.address, lost_amount)

        });

        it(' should retrieve the lost tokens and send it to the admin', async () => {

            const oldBalance = await rewardToken1.balanceOf(admin.address);

            await zap.connect(admin).recoverERC20(rewardToken1.address)

            const newBalance = await rewardToken1.balanceOf(admin.address);

            expect(newBalance.sub(oldBalance)).to.be.eq(lost_amount)

        });

        it(' should block non-admin caller', async () => {

            await expect(
                zap.connect(depositor1).recoverERC20(rewardToken1.address)
            ).to.be.revertedWith('Ownable: caller is not the owner')

        });

    });

});