const hre = require("hardhat");
import { ethers } from "hardhat";
import chai from "chai";
import { BigNumber } from "ethers";
import { solidity } from "ethereum-waffle";
import { DullahanVault } from "../../typechain/DullahanVault";
import { IERC20 } from "../../typechain/oz/interfaces/IERC20";
import { IERC20__factory } from "../../typechain/factories/oz/interfaces/IERC20__factory";
import { IStakedAave } from "../../typechain/interfaces/IStakedAave";
import { IStakedAave__factory } from "../../typechain/factories/interfaces/IStakedAave__factory";
import { IGovernancePowerDelegationToken } from "../../typechain/interfaces/IGovernancePowerDelegationToken";
import { IGovernancePowerDelegationToken__factory } from "../../typechain/factories/interfaces/IGovernancePowerDelegationToken__factory";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ContractFactory } from "@ethersproject/contracts";

import {
    getERC20,
    advanceTime,
    resetForkGoerli,
    mintTokenStorage
} from "../utils/utils";

import {
    AAVE,
    STK_AAVE
} from "../utils/testnet-constants"

chai.use(solidity);
const { expect } = chai;
const { provider } = ethers;

let vaultFactory: ContractFactory

const MAX_BPS = BigNumber.from('10000')
const MAX_UINT256 = ethers.constants.MaxUint256
const WEEK = BigNumber.from(7 * 86400);
const RAY = ethers.utils.parseEther('1000000000')

const aave_amount = ethers.utils.parseEther('5000000')

describe('DullahanVault contract tests - ERC4626 & Scaling ERC20 functions - Goerli version', () => {
    let admin: SignerWithAddress

    let vault: DullahanVault

    let reserveManager: SignerWithAddress
    let votingManager: SignerWithAddress

    let podManager: SignerWithAddress
    let otherPodManager: SignerWithAddress
    let fakePod: SignerWithAddress
    let pod1: SignerWithAddress
    let pod2: SignerWithAddress

    let depositor1: SignerWithAddress
    let depositor2: SignerWithAddress
    let depositor3: SignerWithAddress

    let aave: IERC20
    let stkAave: IERC20
    let stkAave_staking: IStakedAave
    let stkAave_voting_power: IGovernancePowerDelegationToken

    const reserve_ratio = BigNumber.from(100)

    before(async () => {
        await resetForkGoerli();

        [admin, reserveManager, votingManager, podManager, otherPodManager, pod1, pod2, fakePod, depositor1, depositor2, depositor3] = await ethers.getSigners();

        vaultFactory = await ethers.getContractFactory("DullahanVault");

        aave = IERC20__factory.connect(AAVE, provider);
        stkAave = IERC20__factory.connect(STK_AAVE, provider);
        stkAave_staking = IStakedAave__factory.connect(STK_AAVE, provider);
        stkAave_voting_power = IGovernancePowerDelegationToken__factory.connect(STK_AAVE, provider);

        await mintTokenStorage(AAVE, admin, aave_amount, 0);

        await aave.connect(admin).approve(stkAave_staking.address, aave_amount);
        await stkAave_staking.connect(admin).stake(admin.address, aave_amount);

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

    });

    it(' should be deployed & have correct parameters', async () => {
        expect(vault.address).to.properAddress

        expect(await vault.admin()).to.be.eq(admin.address)

        expect(await vault.AAVE()).to.be.eq(AAVE)
        expect(await vault.STK_AAVE()).to.be.eq(STK_AAVE)
        expect(await vault.asset()).to.be.eq(STK_AAVE)

        expect(await vault.reserveRatio()).to.be.eq(reserve_ratio)
        expect(await vault.reserveManager()).to.be.eq(reserveManager.address)

        expect(await vault.votingPowerManager()).to.be.eq(ethers.constants.AddressZero)

        expect(await vault.name()).to.be.eq("Dullahan stkAave")
        expect(await vault.symbol()).to.be.eq("dstkAAVE")
        expect(await vault.decimals()).to.be.eq(18)

        expect(await vault.initialized()).to.be.false

        expect(await vault.totalAssets()).to.be.eq(0)
        expect(await vault.totalSupply()).to.be.eq(0)
        expect(await vault.totalScaledSupply()).to.be.eq(0)

        expect(await vault.getCurrentIndex()).to.be.eq(RAY)

    });

    describe('init', async () => {

        const seed_deposit = ethers.utils.parseEther('0.001')

        beforeEach(async () => {

            await stkAave.connect(admin).approve(vault.address, seed_deposit)

        });

        it(' should initialize the contract and make the inital deposit (& emit the correct Event)', async () => {

            const init_tx = await vault.connect(admin).init(votingManager.address)

            expect(await vault.initialized()).to.be.true

            expect(await vault.totalAssets()).to.be.eq(seed_deposit)
            expect(await vault.totalSupply()).to.be.eq(seed_deposit)
            expect(await vault.totalScaledSupply()).to.be.eq(seed_deposit)

            expect(await vault.balanceOf(admin.address)).to.be.eq(seed_deposit)
            expect(await vault.scaledBalanceOf(admin.address)).to.be.eq(seed_deposit)

            await expect(init_tx).to.emit(vault, 'Initialized')

        });

        it(' should set the correct Voting Manager & have the correct delegate', async () => {

            expect(await vault.getDelegate()).to.be.eq(ethers.constants.AddressZero)

            await vault.connect(admin).init(votingManager.address)

            expect(await vault.getDelegate()).to.be.eq(votingManager.address)
            expect(await vault.votingPowerManager()).to.be.eq(votingManager.address)

            expect(await stkAave_voting_power.getDelegateeByType(vault.address, 0)).to.be.eq(votingManager.address)
            expect(await stkAave_voting_power.getDelegateeByType(vault.address, 1)).to.be.eq(votingManager.address)

        });

        it(' should only be able to initialize once', async () => {

            await vault.connect(admin).init(votingManager.address)

            await expect(
                vault.connect(admin).init(votingManager.address)
            ).to.be.revertedWith('AlreadyInitialized')

        });

        it(' should only be callable by admin', async () => {

            await expect(
                vault.connect(votingManager).init(votingManager.address)
            ).to.be.revertedWith('CallerNotAdmin')

        });

        it(' should block all methods when contract is not initialized', async () => {

            await expect(
                vault.connect(depositor1).deposit(ethers.utils.parseEther('5'), depositor1.address)
            ).to.be.revertedWith('NotInitialized')

            await expect(
                vault.connect(depositor1).mint(ethers.utils.parseEther('5'), depositor1.address)
            ).to.be.revertedWith('NotInitialized')

            await expect(
                vault.connect(depositor1).withdraw(ethers.utils.parseEther('5'), depositor1.address, depositor1.address)
            ).to.be.revertedWith('NotInitialized')

            await expect(
                vault.connect(depositor1).redeem(ethers.utils.parseEther('5'), depositor1.address, depositor1.address)
            ).to.be.revertedWith('NotInitialized')

        });


    });

    describe('deposit', async () => {

        const user1_deposit = ethers.utils.parseEther('150')
        const user2_deposit = ethers.utils.parseEther('85')
        const user3_deposit = ethers.utils.parseEther('250')

        beforeEach(async () => {

            const seed_deposit = ethers.utils.parseEther('0.001')
            await stkAave.connect(admin).approve(vault.address, seed_deposit)
            await vault.connect(admin).init(votingManager.address)

            await stkAave.connect(admin).transfer(depositor1.address, user1_deposit)
            await stkAave.connect(admin).transfer(depositor2.address, user2_deposit)
            await stkAave.connect(admin).transfer(depositor3.address, user3_deposit)

            await stkAave.connect(depositor1).approve(vault.address, MAX_UINT256)
            await stkAave.connect(depositor2).approve(vault.address, user2_deposit)
            await stkAave.connect(depositor3).approve(vault.address, user3_deposit)

        });

        it(' should deposit correctly & mint the correct shares (& emit the correct Event)', async () => {
            
            const prev_user_stkAave_balance = await stkAave.balanceOf(depositor1.address)
            const prev_vault_stkAave_balance = await stkAave.balanceOf(vault.address)

            const prev_user_balance = await vault.balanceOf(depositor1.address)
            const prev_total_supply = await vault.totalSupply()
            const prev_total_assets = await vault.totalAssets()

            const prev_user_scaled_balance = await vault.scaledBalanceOf(depositor1.address)
            const prev_total_scaled_supply = await vault.totalScaledSupply()

            const deposit_tx = await vault.connect(depositor1).deposit(user1_deposit, depositor1.address)
            
            const new_user_stkAave_balance = await stkAave.balanceOf(depositor1.address)
            const new_vault_stkAave_balance = await stkAave.balanceOf(vault.address)

            const new_user_balance = await vault.balanceOf(depositor1.address)
            const new_total_supply = await vault.totalSupply()
            const new_total_assets = await vault.totalAssets()

            const new_user_scaled_balance = await vault.scaledBalanceOf(depositor1.address)
            const new_total_scaled_supply = await vault.totalScaledSupply()

            // Part stkAave reward claim & re-stake
            const stkAave_claim = new_vault_stkAave_balance.sub(prev_vault_stkAave_balance).sub(user1_deposit)
            const stkAave_claim_reserve = stkAave_claim.mul(await vault.reserveRatio()).div(MAX_BPS)
            // --------------------------------------------------

            const expected_user_index = (prev_total_assets.add(stkAave_claim.sub(stkAave_claim_reserve))).mul(RAY).add(prev_total_scaled_supply.div(2)).div(prev_total_scaled_supply)
            const expected_new_index = new_total_assets.mul(RAY).add(new_total_scaled_supply.div(2)).div(new_total_scaled_supply)

            const expected_scaledAmount = user1_deposit.mul(RAY).add(expected_user_index.div(2)).div(expected_user_index)

            const new_index = await vault.getCurrentIndex()

            expect(new_user_stkAave_balance).to.be.eq(prev_user_stkAave_balance.sub(user1_deposit))

            expect(new_user_balance).to.be.eq(prev_user_balance.add(user1_deposit))
            expect(new_total_supply).to.be.eq(prev_total_supply.add(user1_deposit).add(stkAave_claim).sub(stkAave_claim_reserve))
            expect(new_total_assets).to.be.eq(prev_total_assets.add(user1_deposit).add(stkAave_claim).sub(stkAave_claim_reserve))

            expect(new_user_scaled_balance).to.be.eq(prev_user_scaled_balance.add(expected_scaledAmount))
            expect(new_total_scaled_supply).to.be.eq(prev_total_scaled_supply.add(expected_scaledAmount))

            expect(new_total_supply).to.be.eq(new_total_assets)

            expect(new_index).to.be.eq(expected_new_index)

            await expect(deposit_tx).to.emit(stkAave, 'Transfer').withArgs(
                depositor1.address,
                vault.address,
                user1_deposit
            );

            await expect(deposit_tx).to.emit(vault, 'Mint').withArgs(
                depositor1.address,
                expected_scaledAmount,
                expected_user_index
            );

            await expect(deposit_tx).to.emit(vault, 'Transfer').withArgs(
                ethers.constants.AddressZero,
                depositor1.address,
                user1_deposit
            );
            
            await expect(deposit_tx).to.emit(vault, 'Deposit').withArgs(
                depositor1.address,
                depositor1.address,
                user1_deposit,
                user1_deposit
            );

        });

        it(' should allow multiple users to deposit correctly', async () => {

            const prev_vault_stkAave_balance = await stkAave.balanceOf(vault.address)

            const prev_user1_scaled_balance = await vault.scaledBalanceOf(depositor1.address)
            const prev_user2_scaled_balance = await vault.scaledBalanceOf(depositor2.address)
            const prev_user3_scaled_balance = await vault.scaledBalanceOf(depositor3.address)
            const prev_total_scaled_supply = await vault.totalScaledSupply()

            const prev_total_assets = await vault.totalAssets()

            const prev_user1_balance = await vault.balanceOf(depositor1.address)

            const deposit_tx1 = await vault.connect(depositor1).deposit(user1_deposit, depositor1.address)

            const new_vault_stkAave_balance1 = await stkAave.balanceOf(vault.address)

            const new_user1_scaled_balance1 = await vault.scaledBalanceOf(depositor1.address)
            const new_user2_scaled_balance1 = await vault.scaledBalanceOf(depositor2.address)
            const new_user3_scaled_balance1 = await vault.scaledBalanceOf(depositor3.address)
            const new_total_scaled_supply1 = await vault.totalScaledSupply()

            const new_total_assets1 = await vault.totalAssets()

            // Part stkAave reward claim & re-stake
            const stkAave_claim1 = new_vault_stkAave_balance1.sub(prev_vault_stkAave_balance).sub(user1_deposit)
            const stkAave_claim_reserve1 = stkAave_claim1.mul(await vault.reserveRatio()).div(MAX_BPS)
            // --------------------------------------------------

            const expected_user1_index = (prev_total_assets.add(stkAave_claim1.sub(stkAave_claim_reserve1))).mul(RAY).add(prev_total_scaled_supply.div(2)).div(prev_total_scaled_supply)
            const expected_new_index1 = new_total_assets1.mul(RAY).add(new_total_scaled_supply1.div(2)).div(new_total_scaled_supply1)

            const expected_scaledAmount1 = user1_deposit.mul(RAY).add(expected_user1_index.div(2)).div(expected_user1_index)

            const new_index = await vault.getCurrentIndex()

            expect(await vault.balanceOf(depositor1.address)).to.be.eq(prev_user1_balance.add(user1_deposit))

            expect(new_user1_scaled_balance1).to.be.eq(prev_user1_scaled_balance.add(expected_scaledAmount1))
            expect(new_user2_scaled_balance1).to.be.eq(prev_user2_scaled_balance)
            expect(new_user3_scaled_balance1).to.be.eq(prev_user3_scaled_balance)
            expect(new_total_scaled_supply1).to.be.eq(prev_total_scaled_supply.add(expected_scaledAmount1))

            expect(new_index).to.be.eq(expected_new_index1)

            await expect(deposit_tx1).to.emit(stkAave, 'Transfer').withArgs(
                depositor1.address,
                vault.address,
                user1_deposit
            );

            await expect(deposit_tx1).to.emit(vault, 'Mint').withArgs(
                depositor1.address,
                expected_scaledAmount1,
                expected_user1_index
            );

            await expect(deposit_tx1).to.emit(vault, 'Transfer').withArgs(
                ethers.constants.AddressZero,
                depositor1.address,
                user1_deposit
            );
            
            await expect(deposit_tx1).to.emit(vault, 'Deposit').withArgs(
                depositor1.address,
                depositor1.address,
                user1_deposit,
                user1_deposit
            );

            const prev_total_assets2 = await vault.totalAssets()

            const prev_user2_balance = await vault.balanceOf(depositor2.address)

            const deposit_tx2 = await vault.connect(depositor2).deposit(user2_deposit, depositor2.address)

            const new_vault_stkAave_balance2 = await stkAave.balanceOf(vault.address)

            const new_user1_scaled_balance2 = await vault.scaledBalanceOf(depositor1.address)
            const new_user2_scaled_balance2 = await vault.scaledBalanceOf(depositor2.address)
            const new_user3_scaled_balance2 = await vault.scaledBalanceOf(depositor3.address)
            const new_total_scaled_supply2 = await vault.totalScaledSupply()

            const new_total_assets2 = await vault.totalAssets()

            // Part stkAave reward claim & re-stake
            const stkAave_claim2 = new_vault_stkAave_balance2.sub(new_vault_stkAave_balance1).sub(user2_deposit)
            const stkAave_claim_reserve2 = stkAave_claim2.mul(await vault.reserveRatio()).div(MAX_BPS)
            // --------------------------------------------------

            const expected_user2_index = (prev_total_assets2.add(stkAave_claim2.sub(stkAave_claim_reserve2))).mul(RAY).add(new_total_scaled_supply1.div(2)).div(new_total_scaled_supply1)
            const expected_new_index2 = new_total_assets2.mul(RAY).add(new_total_scaled_supply1.div(2)).div(new_total_scaled_supply2)

            const expected_scaledAmount2 = user2_deposit.mul(RAY).add(new_total_scaled_supply1.div(2)).div(expected_user2_index)

            const new_index2 = await vault.getCurrentIndex()

            expect(await vault.balanceOf(depositor2.address)).to.be.eq(prev_user2_balance.add(user2_deposit))

            expect(new_user1_scaled_balance2).to.be.eq(new_user1_scaled_balance1)
            expect(new_user2_scaled_balance2).to.be.eq(new_user2_scaled_balance1.add(expected_scaledAmount2))
            expect(new_user3_scaled_balance2).to.be.eq(new_user3_scaled_balance1)
            expect(new_total_scaled_supply2).to.be.eq(new_total_scaled_supply1.add(expected_scaledAmount2))

            expect(new_index2).to.be.eq(expected_new_index2)

            await expect(deposit_tx2).to.emit(stkAave, 'Transfer').withArgs(
                depositor2.address,
                vault.address,
                user2_deposit
            );

            await expect(deposit_tx2).to.emit(vault, 'Mint').withArgs(
                depositor2.address,
                expected_scaledAmount2,
                expected_user2_index
            );

            await expect(deposit_tx2).to.emit(vault, 'Transfer').withArgs(
                ethers.constants.AddressZero,
                depositor2.address,
                user2_deposit
            );
            
            await expect(deposit_tx2).to.emit(vault, 'Deposit').withArgs(
                depositor2.address,
                depositor2.address,
                user2_deposit,
                user2_deposit
            );

            const prev_total_assets3 = await vault.totalAssets()

            const prev_user3_balance = await vault.balanceOf(depositor3.address)

            const deposit_tx3 = await vault.connect(depositor3).deposit(user3_deposit, depositor3.address)

            const new_vault_stkAave_balance3 = await stkAave.balanceOf(vault.address)

            const new_user1_scaled_balance3 = await vault.scaledBalanceOf(depositor1.address)
            const new_user2_scaled_balance3 = await vault.scaledBalanceOf(depositor2.address)
            const new_user3_scaled_balance3 = await vault.scaledBalanceOf(depositor3.address)
            const new_total_scaled_supply3 = await vault.totalScaledSupply()

            const new_total_assets3 = await vault.totalAssets()

            // Part stkAave reward claim & re-stake
            const stkAave_claim3 = new_vault_stkAave_balance3.sub(new_vault_stkAave_balance2).sub(user3_deposit)
            const stkAave_claim_reserve3 = stkAave_claim3.mul(await vault.reserveRatio()).div(MAX_BPS)
            // --------------------------------------------------

            const expected_user3_index = (prev_total_assets3.add(stkAave_claim3.sub(stkAave_claim_reserve3))).mul(RAY).add(new_total_scaled_supply2.div(2)).div(new_total_scaled_supply2)
            const expected_new_index3 = new_total_assets3.mul(RAY).add(new_total_scaled_supply3.div(2)).div(new_total_scaled_supply3)

            const expected_scaledAmount3 = user3_deposit.mul(RAY).add(expected_user3_index.div(2)).div(expected_user3_index)

            const new_index3 = await vault.getCurrentIndex()

            expect(await vault.balanceOf(depositor3.address)).to.be.eq(prev_user3_balance.add(user3_deposit))

            expect(new_user1_scaled_balance3).to.be.eq(new_user1_scaled_balance2)
            expect(new_user2_scaled_balance3).to.be.eq(new_user2_scaled_balance2)
            expect(new_user3_scaled_balance3).to.be.eq(new_user3_scaled_balance2.add(expected_scaledAmount3))
            expect(new_total_scaled_supply3).to.be.eq(new_total_scaled_supply2.add(expected_scaledAmount3))

            expect(new_index3).to.be.eq(expected_new_index3)

            await expect(deposit_tx3).to.emit(stkAave, 'Transfer').withArgs(
                depositor3.address,
                vault.address,
                user3_deposit
            );

            await expect(deposit_tx3).to.emit(vault, 'Mint').withArgs(
                depositor3.address,
                expected_scaledAmount3,
                expected_user3_index
            );

            await expect(deposit_tx3).to.emit(vault, 'Transfer').withArgs(
                ethers.constants.AddressZero,
                depositor3.address,
                user3_deposit
            );
            
            await expect(deposit_tx3).to.emit(vault, 'Deposit').withArgs(
                depositor3.address,
                depositor3.address,
                user3_deposit,
                user3_deposit
            );

        });

        it(' should fail if given the address 0x0', async () => {

            await expect(
                vault.connect(depositor1).deposit(user1_deposit, ethers.constants.AddressZero)
            ).to.be.revertedWith('AddressZero')

        });

        it(' should fail if given amount 0', async () => {

            await expect(
                vault.connect(depositor1).deposit(0, depositor1.address)
            ).to.be.revertedWith('NullAmount')

        });

    });

    describe('mint', async () => {

        const user1_deposit = ethers.utils.parseEther('150')
        const user2_deposit = ethers.utils.parseEther('85')
        const user3_deposit = ethers.utils.parseEther('250')

        beforeEach(async () => {

            const seed_deposit = ethers.utils.parseEther('0.001')
            await stkAave.connect(admin).approve(vault.address, seed_deposit)
            await vault.connect(admin).init(votingManager.address)

            await stkAave.connect(admin).transfer(depositor1.address, user1_deposit)
            await stkAave.connect(admin).transfer(depositor2.address, user2_deposit)
            await stkAave.connect(admin).transfer(depositor3.address, user3_deposit)

            await stkAave.connect(depositor1).approve(vault.address, MAX_UINT256)
            await stkAave.connect(depositor2).approve(vault.address, user2_deposit)
            await stkAave.connect(depositor3).approve(vault.address, user3_deposit)

        });

        it(' should deposit correctly & mint the correct shares (& emit the correct Event)', async () => {
            
            const prev_user_stkAave_balance = await stkAave.balanceOf(depositor1.address)
            const prev_vault_stkAave_balance = await stkAave.balanceOf(vault.address)

            const prev_user_balance = await vault.balanceOf(depositor1.address)
            const prev_total_supply = await vault.totalSupply()
            const prev_total_assets = await vault.totalAssets()

            const prev_user_scaled_balance = await vault.scaledBalanceOf(depositor1.address)
            const prev_total_scaled_supply = await vault.totalScaledSupply()

            const deposit_tx = await vault.connect(depositor1).mint(user1_deposit, depositor1.address)
            
            const new_user_stkAave_balance = await stkAave.balanceOf(depositor1.address)
            const new_vault_stkAave_balance = await stkAave.balanceOf(vault.address)

            const new_user_balance = await vault.balanceOf(depositor1.address)
            const new_total_supply = await vault.totalSupply()
            const new_total_assets = await vault.totalAssets()

            const new_user_scaled_balance = await vault.scaledBalanceOf(depositor1.address)
            const new_total_scaled_supply = await vault.totalScaledSupply()

            // Part stkAave reward claim & re-stake
            const stkAave_claim = new_vault_stkAave_balance.sub(prev_vault_stkAave_balance).sub(user1_deposit)
            const stkAave_claim_reserve = stkAave_claim.mul(await vault.reserveRatio()).div(MAX_BPS)
            // --------------------------------------------------

            const expected_user_index = (prev_total_assets.add(stkAave_claim.sub(stkAave_claim_reserve))).mul(RAY).add(prev_total_scaled_supply.div(2)).div(prev_total_scaled_supply)
            const expected_new_index = new_total_assets.mul(RAY).add(new_total_scaled_supply.div(2)).div(new_total_scaled_supply)

            const expected_scaledAmount = user1_deposit.mul(RAY).add(expected_user_index.div(2)).div(expected_user_index)

            const new_index = await vault.getCurrentIndex()

            expect(new_user_stkAave_balance).to.be.eq(prev_user_stkAave_balance.sub(user1_deposit))

            expect(new_user_balance).to.be.eq(prev_user_balance.add(user1_deposit))
            expect(new_total_supply).to.be.eq(prev_total_supply.add(user1_deposit).add(stkAave_claim).sub(stkAave_claim_reserve))
            expect(new_total_assets).to.be.eq(prev_total_assets.add(user1_deposit).add(stkAave_claim).sub(stkAave_claim_reserve))

            expect(new_user_scaled_balance).to.be.eq(prev_user_scaled_balance.add(expected_scaledAmount))
            expect(new_total_scaled_supply).to.be.eq(prev_total_scaled_supply.add(expected_scaledAmount))

            expect(new_total_supply).to.be.eq(new_total_assets)

            expect(new_index).to.be.eq(expected_new_index)

            await expect(deposit_tx).to.emit(stkAave, 'Transfer').withArgs(
                depositor1.address,
                vault.address,
                user1_deposit
            );

            await expect(deposit_tx).to.emit(vault, 'Mint').withArgs(
                depositor1.address,
                expected_scaledAmount,
                expected_user_index
            );

            await expect(deposit_tx).to.emit(vault, 'Transfer').withArgs(
                ethers.constants.AddressZero,
                depositor1.address,
                user1_deposit
            );
            
            await expect(deposit_tx).to.emit(vault, 'Deposit').withArgs(
                depositor1.address,
                depositor1.address,
                user1_deposit,
                user1_deposit
            );

        });

        it(' should allow multiple users to deposit correctly', async () => {

            const prev_vault_stkAave_balance = await stkAave.balanceOf(vault.address)

            const prev_user1_scaled_balance = await vault.scaledBalanceOf(depositor1.address)
            const prev_user2_scaled_balance = await vault.scaledBalanceOf(depositor2.address)
            const prev_user3_scaled_balance = await vault.scaledBalanceOf(depositor3.address)
            const prev_total_scaled_supply = await vault.totalScaledSupply()

            const prev_total_assets = await vault.totalAssets()

            const prev_user1_balance = await vault.balanceOf(depositor1.address)

            const deposit_tx1 = await vault.connect(depositor1).mint(user1_deposit, depositor1.address)

            const new_vault_stkAave_balance1 = await stkAave.balanceOf(vault.address)

            const new_user1_scaled_balance1 = await vault.scaledBalanceOf(depositor1.address)
            const new_user2_scaled_balance1 = await vault.scaledBalanceOf(depositor2.address)
            const new_user3_scaled_balance1 = await vault.scaledBalanceOf(depositor3.address)
            const new_total_scaled_supply1 = await vault.totalScaledSupply()

            const new_total_assets1 = await vault.totalAssets()

            // Part stkAave reward claim & re-stake
            const stkAave_claim1 = new_vault_stkAave_balance1.sub(prev_vault_stkAave_balance).sub(user1_deposit)
            const stkAave_claim_reserve1 = stkAave_claim1.mul(await vault.reserveRatio()).div(MAX_BPS)
            // --------------------------------------------------

            const expected_user1_index = (prev_total_assets.add(stkAave_claim1.sub(stkAave_claim_reserve1))).mul(RAY).add(prev_total_scaled_supply.div(2)).div(prev_total_scaled_supply)
            const expected_new_index1 = new_total_assets1.mul(RAY).add(new_total_scaled_supply1.div(2)).div(new_total_scaled_supply1)

            const expected_scaledAmount1 = user1_deposit.mul(RAY).add(expected_user1_index.div(2)).div(expected_user1_index)

            const new_index = await vault.getCurrentIndex()

            expect(await vault.balanceOf(depositor1.address)).to.be.eq(prev_user1_balance.add(user1_deposit))

            expect(new_user1_scaled_balance1).to.be.eq(prev_user1_scaled_balance.add(expected_scaledAmount1))
            expect(new_user2_scaled_balance1).to.be.eq(prev_user2_scaled_balance)
            expect(new_user3_scaled_balance1).to.be.eq(prev_user3_scaled_balance)
            expect(new_total_scaled_supply1).to.be.eq(prev_total_scaled_supply.add(expected_scaledAmount1))

            expect(new_index).to.be.eq(expected_new_index1)

            await expect(deposit_tx1).to.emit(stkAave, 'Transfer').withArgs(
                depositor1.address,
                vault.address,
                user1_deposit
            );

            await expect(deposit_tx1).to.emit(vault, 'Mint').withArgs(
                depositor1.address,
                expected_scaledAmount1,
                expected_user1_index
            );

            await expect(deposit_tx1).to.emit(vault, 'Transfer').withArgs(
                ethers.constants.AddressZero,
                depositor1.address,
                user1_deposit
            );
            
            await expect(deposit_tx1).to.emit(vault, 'Deposit').withArgs(
                depositor1.address,
                depositor1.address,
                user1_deposit,
                user1_deposit
            );

            const prev_total_assets2 = await vault.totalAssets()

            const prev_user2_balance = await vault.balanceOf(depositor2.address)

            const deposit_tx2 = await vault.connect(depositor2).mint(user2_deposit, depositor2.address)

            const new_vault_stkAave_balance2 = await stkAave.balanceOf(vault.address)

            const new_user1_scaled_balance2 = await vault.scaledBalanceOf(depositor1.address)
            const new_user2_scaled_balance2 = await vault.scaledBalanceOf(depositor2.address)
            const new_user3_scaled_balance2 = await vault.scaledBalanceOf(depositor3.address)
            const new_total_scaled_supply2 = await vault.totalScaledSupply()

            const new_total_assets2 = await vault.totalAssets()

            // Part stkAave reward claim & re-stake
            const stkAave_claim2 = new_vault_stkAave_balance2.sub(new_vault_stkAave_balance1).sub(user2_deposit)
            const stkAave_claim_reserve2 = stkAave_claim2.mul(await vault.reserveRatio()).div(MAX_BPS)
            // --------------------------------------------------

            const expected_user2_index = (prev_total_assets2.add(stkAave_claim2.sub(stkAave_claim_reserve2))).mul(RAY).add(new_total_scaled_supply1.div(2)).div(new_total_scaled_supply1)
            const expected_new_index2 = new_total_assets2.mul(RAY).add(new_total_scaled_supply1.div(2)).div(new_total_scaled_supply2)

            const expected_scaledAmount2 = user2_deposit.mul(RAY).add(new_total_scaled_supply1.div(2)).div(expected_user2_index)

            const new_index2 = await vault.getCurrentIndex()

            expect(await vault.balanceOf(depositor2.address)).to.be.eq(prev_user2_balance.add(user2_deposit))

            expect(new_user1_scaled_balance2).to.be.eq(new_user1_scaled_balance1)
            expect(new_user2_scaled_balance2).to.be.eq(new_user2_scaled_balance1.add(expected_scaledAmount2))
            expect(new_user3_scaled_balance2).to.be.eq(new_user3_scaled_balance1)
            expect(new_total_scaled_supply2).to.be.eq(new_total_scaled_supply1.add(expected_scaledAmount2))

            expect(new_index2).to.be.eq(expected_new_index2)

            await expect(deposit_tx2).to.emit(stkAave, 'Transfer').withArgs(
                depositor2.address,
                vault.address,
                user2_deposit
            );

            await expect(deposit_tx2).to.emit(vault, 'Mint').withArgs(
                depositor2.address,
                expected_scaledAmount2,
                expected_user2_index
            );

            await expect(deposit_tx2).to.emit(vault, 'Transfer').withArgs(
                ethers.constants.AddressZero,
                depositor2.address,
                user2_deposit
            );
            
            await expect(deposit_tx2).to.emit(vault, 'Deposit').withArgs(
                depositor2.address,
                depositor2.address,
                user2_deposit,
                user2_deposit
            );

            const prev_total_assets3 = await vault.totalAssets()

            const prev_user3_balance = await vault.balanceOf(depositor3.address)

            const deposit_tx3 = await vault.connect(depositor3).mint(user3_deposit, depositor3.address)

            const new_vault_stkAave_balance3 = await stkAave.balanceOf(vault.address)

            const new_user1_scaled_balance3 = await vault.scaledBalanceOf(depositor1.address)
            const new_user2_scaled_balance3 = await vault.scaledBalanceOf(depositor2.address)
            const new_user3_scaled_balance3 = await vault.scaledBalanceOf(depositor3.address)
            const new_total_scaled_supply3 = await vault.totalScaledSupply()

            const new_total_assets3 = await vault.totalAssets()

            // Part stkAave reward claim & re-stake
            const stkAave_claim3 = new_vault_stkAave_balance3.sub(new_vault_stkAave_balance2).sub(user3_deposit)
            const stkAave_claim_reserve3 = stkAave_claim3.mul(await vault.reserveRatio()).div(MAX_BPS)
            // --------------------------------------------------

            const expected_user3_index = (prev_total_assets3.add(stkAave_claim3.sub(stkAave_claim_reserve3))).mul(RAY).add(new_total_scaled_supply2.div(2)).div(new_total_scaled_supply2)
            const expected_new_index3 = new_total_assets3.mul(RAY).add(new_total_scaled_supply3.div(2)).div(new_total_scaled_supply3)

            const expected_scaledAmount3 = user3_deposit.mul(RAY).add(expected_user3_index.div(2)).div(expected_user3_index)

            const new_index3 = await vault.getCurrentIndex()

            expect(await vault.balanceOf(depositor3.address)).to.be.eq(prev_user3_balance.add(user3_deposit))

            expect(new_user1_scaled_balance3).to.be.eq(new_user1_scaled_balance2)
            expect(new_user2_scaled_balance3).to.be.eq(new_user2_scaled_balance2)
            expect(new_user3_scaled_balance3).to.be.eq(new_user3_scaled_balance2.add(expected_scaledAmount3))
            expect(new_total_scaled_supply3).to.be.eq(new_total_scaled_supply2.add(expected_scaledAmount3))

            expect(new_index3).to.be.eq(expected_new_index3)

            await expect(deposit_tx3).to.emit(stkAave, 'Transfer').withArgs(
                depositor3.address,
                vault.address,
                user3_deposit
            );

            await expect(deposit_tx3).to.emit(vault, 'Mint').withArgs(
                depositor3.address,
                expected_scaledAmount3,
                expected_user3_index
            );

            await expect(deposit_tx3).to.emit(vault, 'Transfer').withArgs(
                ethers.constants.AddressZero,
                depositor3.address,
                user3_deposit
            );
            
            await expect(deposit_tx3).to.emit(vault, 'Deposit').withArgs(
                depositor3.address,
                depositor3.address,
                user3_deposit,
                user3_deposit
            );

        });

        it(' should fail if given the address 0x0', async () => {

            await expect(
                vault.connect(depositor1).mint(user1_deposit, ethers.constants.AddressZero)
            ).to.be.revertedWith('AddressZero')

        });

        it(' should fail if given amount 0', async () => {

            await expect(
                vault.connect(depositor1).mint(0, depositor1.address)
            ).to.be.revertedWith('NullAmount')

        });

    });

    describe('withdraw', async () => {

        const user1_deposit = ethers.utils.parseEther('150')
        const user2_deposit = ethers.utils.parseEther('85')
        const user3_deposit = ethers.utils.parseEther('250')

        const user1_withdraw = ethers.utils.parseEther('80')

        beforeEach(async () => {

            const seed_deposit = ethers.utils.parseEther('0.001')
            await stkAave.connect(admin).approve(vault.address, seed_deposit)
            await vault.connect(admin).init(votingManager.address)

            await stkAave.connect(admin).transfer(depositor1.address, user1_deposit)
            await stkAave.connect(admin).transfer(depositor2.address, user2_deposit)
            await stkAave.connect(admin).transfer(depositor3.address, user3_deposit)

            await stkAave.connect(depositor1).approve(vault.address, MAX_UINT256)
            await stkAave.connect(depositor2).approve(vault.address, user2_deposit)
            await stkAave.connect(depositor3).approve(vault.address, user3_deposit)

            await vault.connect(depositor1).deposit(user1_deposit, depositor1.address)
            await vault.connect(depositor2).deposit(user2_deposit, depositor2.address)

        });

        it(' should withdraw correctly & burn the shares (& emit the correct Event)', async () => {

            const prev_user_stkAave_balance = await stkAave.balanceOf(depositor1.address)
            const prev_vault_stkAave_balance = await stkAave.balanceOf(vault.address)

            const prev_user_balance = await vault.balanceOf(depositor1.address)
            const prev_total_supply = await vault.totalSupply()
            const prev_total_assets = await vault.totalAssets()

            const prev_user_scaled_balance = await vault.scaledBalanceOf(depositor1.address)
            const prev_total_scaled_supply = await vault.totalScaledSupply()

            const withdraw_tx = await vault.connect(depositor1).withdraw(user1_withdraw, depositor1.address, depositor1.address)
            
            const new_user_stkAave_balance = await stkAave.balanceOf(depositor1.address)
            const new_vault_stkAave_balance = await stkAave.balanceOf(vault.address)

            const new_user_balance = await vault.balanceOf(depositor1.address)
            const new_total_supply = await vault.totalSupply()
            const new_total_assets = await vault.totalAssets()

            const new_user_scaled_balance = await vault.scaledBalanceOf(depositor1.address)
            const new_total_scaled_supply = await vault.totalScaledSupply()

            // Part stkAave reward claim & re-stake
            const stkAave_claim = (new_vault_stkAave_balance.add(user1_withdraw)).sub(prev_vault_stkAave_balance)
            const stkAave_claim_reserve = stkAave_claim.mul(await vault.reserveRatio()).div(MAX_BPS)
            const user_claim_share = stkAave_claim.sub(stkAave_claim_reserve).mul(prev_user_scaled_balance).div(prev_total_scaled_supply)
            // --------------------------------------------------

            const expected_user_index = (prev_total_assets.add(stkAave_claim.sub(stkAave_claim_reserve))).mul(RAY).add(prev_total_scaled_supply.div(2)).div(prev_total_scaled_supply)
            const expected_new_index = new_total_assets.mul(RAY).add(new_total_scaled_supply.div(2)).div(new_total_scaled_supply)

            const expected_scaledAmount = user1_withdraw.mul(RAY).add(expected_user_index.div(2)).div(expected_user_index)

            const new_index = await vault.getCurrentIndex()

            expect(new_user_stkAave_balance).to.be.eq(prev_user_stkAave_balance.add(user1_withdraw))

            expect(new_user_balance).to.be.eq(prev_user_balance.add(user_claim_share).sub(user1_withdraw))
            expect(new_total_supply).to.be.eq(prev_total_supply.sub(user1_withdraw).add(stkAave_claim).sub(stkAave_claim_reserve))
            expect(new_total_assets).to.be.eq(prev_total_assets.sub(user1_withdraw).add(stkAave_claim).sub(stkAave_claim_reserve))

            expect(new_user_scaled_balance).to.be.eq(prev_user_scaled_balance.sub(expected_scaledAmount))
            expect(new_total_scaled_supply).to.be.eq(prev_total_scaled_supply.sub(expected_scaledAmount))

            expect(new_total_supply).to.be.eq(new_total_assets)

            expect(new_index).to.be.eq(expected_new_index)

            await expect(withdraw_tx).to.emit(stkAave, 'Transfer').withArgs(
                vault.address,
                depositor1.address,
                user1_withdraw
            );

            await expect(withdraw_tx).to.emit(vault, 'Burn').withArgs(
                depositor1.address,
                expected_scaledAmount,
                expected_user_index
            );

            await expect(withdraw_tx).to.emit(vault, 'Transfer').withArgs(
                depositor1.address,
                ethers.constants.AddressZero,
                user1_withdraw
            );
            
            await expect(withdraw_tx).to.emit(vault, 'Withdraw').withArgs(
                depositor1.address,
                depositor1.address,
                depositor1.address,
                user1_withdraw,
                user1_withdraw
            );

        });

        it(' should withdraw all using MAX_UINT256 as parameter', async () => {

            const prev_user_stkAave_balance = await stkAave.balanceOf(depositor2.address)
            const prev_vault_stkAave_balance = await stkAave.balanceOf(vault.address)

            const prev_user_balance = await vault.balanceOf(depositor2.address)
            const prev_total_supply = await vault.totalSupply()
            const prev_total_assets = await vault.totalAssets()

            const prev_user_scaled_balance = await vault.scaledBalanceOf(depositor2.address)
            const prev_total_scaled_supply = await vault.totalScaledSupply()

            const withdraw_tx = await vault.connect(depositor2).withdraw(ethers.constants.MaxUint256, depositor2.address, depositor2.address)
            
            const new_user_stkAave_balance = await stkAave.balanceOf(depositor2.address)
            const new_vault_stkAave_balance = await stkAave.balanceOf(vault.address)

            const new_user_balance = await vault.balanceOf(depositor2.address)
            const new_total_supply = await vault.totalSupply()
            const new_total_assets = await vault.totalAssets()

            const new_user_scaled_balance = await vault.scaledBalanceOf(depositor2.address)
            const new_total_scaled_supply = await vault.totalScaledSupply()

            // Part stkAave reward claim & re-stake
            const receipt = await withdraw_tx.wait()
            const iface = stkAave_staking.interface;
            const topic = iface.getEventTopic('Staked')
            const staking_log = receipt.logs.filter(x => x.topics.indexOf(topic) >= 0);
            const staking_events = staking_log.map((log) => (iface.parseLog(log)).args)
            const stkAave_claim = staking_events[0].amount
            const stkAave_claim_reserve = stkAave_claim.mul(await vault.reserveRatio()).div(MAX_BPS)
            const user_claim_share = stkAave_claim.sub(stkAave_claim_reserve).mul(prev_user_scaled_balance).div(prev_total_scaled_supply)
            // --------------------------------------------------

            const expected_withdraw = prev_user_balance.add(user_claim_share)

            const expected_user_index = (prev_total_assets.add(stkAave_claim.sub(stkAave_claim_reserve))).mul(RAY).add(prev_total_scaled_supply.div(2)).div(prev_total_scaled_supply)
            const expected_new_index = new_total_assets.mul(RAY).add(new_total_scaled_supply.div(2)).div(new_total_scaled_supply)

            const new_index = await vault.getCurrentIndex()

            expect(new_user_stkAave_balance).to.be.eq(prev_user_stkAave_balance.add(expected_withdraw))

            const effective_withdraw = new_user_stkAave_balance.sub(prev_user_stkAave_balance)
            expect(new_vault_stkAave_balance).to.be.eq(prev_vault_stkAave_balance.add(stkAave_claim).sub(effective_withdraw))

            expect(new_user_balance).to.be.eq(0)
            expect(new_total_supply).to.be.eq(prev_total_supply.sub(effective_withdraw).add(stkAave_claim).sub(stkAave_claim_reserve))
            expect(new_total_assets).to.be.eq(prev_total_assets.sub(effective_withdraw).add(stkAave_claim).sub(stkAave_claim_reserve))

            expect(new_user_scaled_balance).to.be.eq(0)
            expect(new_total_scaled_supply).to.be.eq(prev_total_scaled_supply.sub(prev_user_scaled_balance))

            expect(new_total_supply).to.be.eq(new_total_assets)

            expect(new_index).to.be.eq(expected_new_index)

            await expect(withdraw_tx).to.emit(stkAave, 'Transfer').withArgs(
                vault.address,
                depositor2.address,
                effective_withdraw
            );

            await expect(withdraw_tx).to.emit(vault, 'Burn').withArgs(
                depositor2.address,
                prev_user_scaled_balance,
                expected_user_index
            );

            await expect(withdraw_tx).to.emit(vault, 'Transfer').withArgs(
                depositor2.address,
                ethers.constants.AddressZero,
                effective_withdraw
            );
            
            await expect(withdraw_tx).to.emit(vault, 'Withdraw').withArgs(
                depositor2.address,
                depositor2.address,
                depositor2.address,
                effective_withdraw,
                effective_withdraw
            );

        });

        it(' should withdraw & send to the correct receiver', async () => {

            const prev_user1_stkAave_balance = await stkAave.balanceOf(depositor1.address)
            const prev_user3_stkAave_balance = await stkAave.balanceOf(depositor3.address)
            const prev_vault_stkAave_balance = await stkAave.balanceOf(vault.address)

            const prev_user1_balance = await vault.balanceOf(depositor1.address)
            const prev_user3_balance = await vault.balanceOf(depositor3.address)
            const prev_total_supply = await vault.totalSupply()
            const prev_total_assets = await vault.totalAssets()

            const prev_user1_scaled_balance = await vault.scaledBalanceOf(depositor1.address)
            const prev_user3_scaled_balance = await vault.scaledBalanceOf(depositor3.address)
            const prev_total_scaled_supply = await vault.totalScaledSupply()

            const withdraw_tx = await vault.connect(depositor1).withdraw(user1_withdraw, depositor3.address, depositor1.address)
            
            const new_user1_stkAave_balance = await stkAave.balanceOf(depositor1.address)
            const new_user3_stkAave_balance = await stkAave.balanceOf(depositor3.address)
            const new_vault_stkAave_balance = await stkAave.balanceOf(vault.address)

            const new_user1_balance = await vault.balanceOf(depositor1.address)
            const new_user3_balance = await vault.balanceOf(depositor3.address)
            const new_total_supply = await vault.totalSupply()
            const new_total_assets = await vault.totalAssets()

            const new_user1_scaled_balance = await vault.scaledBalanceOf(depositor1.address)
            const new_user3_scaled_balance = await vault.scaledBalanceOf(depositor3.address)
            const new_total_scaled_supply = await vault.totalScaledSupply()

            // Part stkAave reward claim & re-stake
            const stkAave_claim = (new_vault_stkAave_balance.add(user1_withdraw)).sub(prev_vault_stkAave_balance)
            const stkAave_claim_reserve = stkAave_claim.mul(await vault.reserveRatio()).div(MAX_BPS)
            const user_claim_share = stkAave_claim.sub(stkAave_claim_reserve).mul(prev_user1_scaled_balance).div(prev_total_scaled_supply)
            // --------------------------------------------------

            const expected_user_index = (prev_total_assets.add(stkAave_claim.sub(stkAave_claim_reserve))).mul(RAY).add(prev_total_scaled_supply.div(2)).div(prev_total_scaled_supply)
            const expected_new_index = new_total_assets.mul(RAY).add(new_total_scaled_supply.div(2)).div(new_total_scaled_supply)

            const expected_scaledAmount = user1_withdraw.mul(RAY).add(expected_user_index.div(2)).div(expected_user_index)

            const new_index = await vault.getCurrentIndex()

            expect(new_user1_stkAave_balance).to.be.eq(prev_user1_stkAave_balance)
            expect(new_user3_stkAave_balance).to.be.eq(prev_user3_stkAave_balance.add(user1_withdraw))

            expect(new_user1_balance).to.be.eq(prev_user1_balance.add(user_claim_share).sub(user1_withdraw))
            expect(new_user3_balance).to.be.eq(prev_user3_balance)
            expect(new_total_supply).to.be.eq(prev_total_supply.sub(user1_withdraw).add(stkAave_claim).sub(stkAave_claim_reserve))
            expect(new_total_assets).to.be.eq(prev_total_assets.sub(user1_withdraw).add(stkAave_claim).sub(stkAave_claim_reserve))

            expect(new_user1_scaled_balance).to.be.eq(prev_user1_scaled_balance.sub(expected_scaledAmount))
            expect(new_user3_scaled_balance).to.be.eq(prev_user3_scaled_balance)
            expect(new_total_scaled_supply).to.be.eq(prev_total_scaled_supply.sub(expected_scaledAmount))

            expect(new_total_supply).to.be.eq(new_total_assets)

            expect(new_index).to.be.eq(expected_new_index)

            await expect(withdraw_tx).to.emit(stkAave, 'Transfer').withArgs(
                vault.address,
                depositor3.address,
                user1_withdraw
            );

            await expect(withdraw_tx).to.emit(vault, 'Burn').withArgs(
                depositor1.address,
                expected_scaledAmount,
                expected_user_index
            );

            await expect(withdraw_tx).to.emit(vault, 'Transfer').withArgs(
                depositor1.address,
                ethers.constants.AddressZero,
                user1_withdraw
            );
            
            await expect(withdraw_tx).to.emit(vault, 'Withdraw').withArgs(
                depositor1.address,
                depositor3.address,
                depositor1.address,
                user1_withdraw,
                user1_withdraw
            );

        });

        it(' should allow to withdraw from other user if given the allowance', async () => {

            await vault.connect(depositor1).approve(depositor3.address, user1_withdraw)

            const prev_user1_stkAave_balance = await stkAave.balanceOf(depositor1.address)
            const prev_user3_stkAave_balance = await stkAave.balanceOf(depositor3.address)
            const prev_vault_stkAave_balance = await stkAave.balanceOf(vault.address)

            const prev_user1_balance = await vault.balanceOf(depositor1.address)
            const prev_total_supply = await vault.totalSupply()
            const prev_total_assets = await vault.totalAssets()

            const prev_user1_scaled_balance = await vault.scaledBalanceOf(depositor1.address)
            const prev_total_scaled_supply = await vault.totalScaledSupply()

            const withdraw_tx = await vault.connect(depositor3).withdraw(user1_withdraw, depositor3.address, depositor1.address)
            
            const new_user1_stkAave_balance = await stkAave.balanceOf(depositor1.address)
            const new_user3_stkAave_balance = await stkAave.balanceOf(depositor3.address)
            const new_vault_stkAave_balance = await stkAave.balanceOf(vault.address)

            const new_user1_balance = await vault.balanceOf(depositor1.address)
            const new_total_supply = await vault.totalSupply()
            const new_total_assets = await vault.totalAssets()

            const new_total_scaled_supply = await vault.totalScaledSupply()

            // Part stkAave reward claim & re-stake
            const stkAave_claim = (new_vault_stkAave_balance.add(user1_withdraw)).sub(prev_vault_stkAave_balance)
            const stkAave_claim_reserve = stkAave_claim.mul(await vault.reserveRatio()).div(MAX_BPS)
            const user_claim_share = stkAave_claim.sub(stkAave_claim_reserve).mul(prev_user1_scaled_balance).div(prev_total_scaled_supply)
            // --------------------------------------------------

            const expected_user_index = (prev_total_assets.add(stkAave_claim.sub(stkAave_claim_reserve))).mul(RAY).add(prev_total_scaled_supply.div(2)).div(prev_total_scaled_supply)
            const expected_new_index = new_total_assets.mul(RAY).add(new_total_scaled_supply.div(2)).div(new_total_scaled_supply)

            const expected_scaledAmount = user1_withdraw.mul(RAY).add(expected_user_index.div(2)).div(expected_user_index)

            const new_index = await vault.getCurrentIndex()

            expect(new_user1_stkAave_balance).to.be.eq(prev_user1_stkAave_balance)
            expect(new_user3_stkAave_balance).to.be.eq(prev_user3_stkAave_balance.add(user1_withdraw))

            expect(new_user1_balance).to.be.eq(prev_user1_balance.add(user_claim_share).sub(user1_withdraw))
            expect(new_total_supply).to.be.eq(prev_total_supply.sub(user1_withdraw).add(stkAave_claim).sub(stkAave_claim_reserve))
            expect(new_total_assets).to.be.eq(prev_total_assets.sub(user1_withdraw).add(stkAave_claim).sub(stkAave_claim_reserve))

            expect(new_total_supply).to.be.eq(new_total_assets)

            expect(new_index).to.be.eq(expected_new_index)

            await expect(withdraw_tx).to.emit(stkAave, 'Transfer').withArgs(
                vault.address,
                depositor3.address,
                user1_withdraw
            );

            await expect(withdraw_tx).to.emit(vault, 'Burn').withArgs(
                depositor1.address,
                expected_scaledAmount,
                expected_user_index
            );

            await expect(withdraw_tx).to.emit(vault, 'Transfer').withArgs(
                depositor1.address,
                ethers.constants.AddressZero,
                user1_withdraw
            );
            
            await expect(withdraw_tx).to.emit(vault, 'Withdraw').withArgs(
                depositor3.address,
                depositor3.address,
                depositor1.address,
                user1_withdraw,
                user1_withdraw
            );

        });

        it(' should fail if trying to withdraw more than deposit', async () => {
            
            const big_withdraw = ethers.utils.parseEther('175')

            await expect(
                vault.connect(depositor1).withdraw(big_withdraw, depositor1.address, depositor1.address)
            ).to.be.revertedWith('ERC20_AmountExceedBalance')

        });

        it(' should fail if no fund was deposited', async () => {

            await expect(
                vault.connect(depositor3).withdraw(user1_withdraw, depositor3.address, depositor3.address)
            ).to.be.revertedWith('ERC20_AmountExceedBalance')

        });

        it(' should fail if not enough funds available for withdraw', async () => {

            const available_balance = (await stkAave.balanceOf(vault.address)).sub(await vault.reserveAmount())
            const buffer_amount = (await vault.totalAssets()).mul(await vault.bufferRatio()).div(MAX_BPS)
            const max_rent_amount = available_balance.sub(buffer_amount)

            await vault.connect(admin).addPodManager(podManager.address)
            await vault.connect(podManager).rentStkAave(fakePod.address, max_rent_amount)

            await expect(
                vault.connect(depositor1).withdraw(user1_withdraw, depositor3.address, depositor1.address)
            ).to.be.revertedWith('NotEnoughAvailableFunds')


        });

        it(' should fail if no allowance was given to withdraw from other depositor', async () => {

            await expect(
                vault.connect(depositor3).withdraw(user1_withdraw, depositor3.address, depositor1.address)
            ).to.be.revertedWith('ERC20_AmountOverAllowance')

            await vault.connect(depositor1).approve(depositor3.address, user1_withdraw.div(2))

            await expect(
                vault.connect(depositor3).withdraw(user1_withdraw, depositor3.address, depositor1.address)
            ).to.be.revertedWith('ERC20_AmountOverAllowance')

        });

        it(' should fail if given the address 0x0', async () => {

            await expect(
                vault.connect(depositor1).withdraw(user1_withdraw, ethers.constants.AddressZero, depositor1.address)
            ).to.be.revertedWith('AddressZero')

            await expect(
                vault.connect(depositor1).withdraw(user1_withdraw, depositor1.address, ethers.constants.AddressZero)
            ).to.be.revertedWith('AddressZero')

        });

        it(' should fail if given amount 0', async () => {

            await expect(
                vault.connect(depositor1).withdraw(0, depositor1.address, depositor1.address)
            ).to.be.revertedWith('NullAmount')

        });

    });

    describe('redeem', async () => {

        const user1_deposit = ethers.utils.parseEther('150')
        const user2_deposit = ethers.utils.parseEther('85')
        const user3_deposit = ethers.utils.parseEther('250')

        const user1_withdraw = ethers.utils.parseEther('80')

        beforeEach(async () => {

            const seed_deposit = ethers.utils.parseEther('0.001')
            await stkAave.connect(admin).approve(vault.address, seed_deposit)
            await vault.connect(admin).init(votingManager.address)

            await stkAave.connect(admin).transfer(depositor1.address, user1_deposit)
            await stkAave.connect(admin).transfer(depositor2.address, user2_deposit)
            await stkAave.connect(admin).transfer(depositor3.address, user3_deposit)

            await stkAave.connect(depositor1).approve(vault.address, MAX_UINT256)
            await stkAave.connect(depositor2).approve(vault.address, user2_deposit)
            await stkAave.connect(depositor3).approve(vault.address, user3_deposit)

            await vault.connect(depositor1).deposit(user1_deposit, depositor1.address)
            await vault.connect(depositor2).deposit(user2_deposit, depositor2.address)

        });

        it(' should withdraw correctly & burn the shares (& emit the correct Event)', async () => {

            const prev_user_stkAave_balance = await stkAave.balanceOf(depositor1.address)
            const prev_vault_stkAave_balance = await stkAave.balanceOf(vault.address)

            const prev_user_balance = await vault.balanceOf(depositor1.address)
            const prev_total_supply = await vault.totalSupply()
            const prev_total_assets = await vault.totalAssets()

            const prev_user_scaled_balance = await vault.scaledBalanceOf(depositor1.address)
            const prev_total_scaled_supply = await vault.totalScaledSupply()

            const withdraw_tx = await vault.connect(depositor1).redeem(user1_withdraw, depositor1.address, depositor1.address)
            
            const new_user_stkAave_balance = await stkAave.balanceOf(depositor1.address)
            const new_vault_stkAave_balance = await stkAave.balanceOf(vault.address)

            const new_user_balance = await vault.balanceOf(depositor1.address)
            const new_total_supply = await vault.totalSupply()
            const new_total_assets = await vault.totalAssets()

            const new_user_scaled_balance = await vault.scaledBalanceOf(depositor1.address)
            const new_total_scaled_supply = await vault.totalScaledSupply()

            // Part stkAave reward claim & re-stake
            const stkAave_claim = (new_vault_stkAave_balance.add(user1_withdraw)).sub(prev_vault_stkAave_balance)
            const stkAave_claim_reserve = stkAave_claim.mul(await vault.reserveRatio()).div(MAX_BPS)
            const user_claim_share = stkAave_claim.sub(stkAave_claim_reserve).mul(prev_user_scaled_balance).div(prev_total_scaled_supply)
            // --------------------------------------------------

            const expected_user_index = (prev_total_assets.add(stkAave_claim.sub(stkAave_claim_reserve))).mul(RAY).add(prev_total_scaled_supply.div(2)).div(prev_total_scaled_supply)
            const expected_new_index = new_total_assets.mul(RAY).add(new_total_scaled_supply.div(2)).div(new_total_scaled_supply)

            const expected_scaledAmount = user1_withdraw.mul(RAY).add(expected_user_index.div(2)).div(expected_user_index)

            const new_index = await vault.getCurrentIndex()

            expect(new_user_stkAave_balance).to.be.eq(prev_user_stkAave_balance.add(user1_withdraw))

            expect(new_user_balance).to.be.eq(prev_user_balance.add(user_claim_share).sub(user1_withdraw))
            expect(new_total_supply).to.be.eq(prev_total_supply.sub(user1_withdraw).add(stkAave_claim).sub(stkAave_claim_reserve))
            expect(new_total_assets).to.be.eq(prev_total_assets.sub(user1_withdraw).add(stkAave_claim).sub(stkAave_claim_reserve))

            expect(new_user_scaled_balance).to.be.eq(prev_user_scaled_balance.sub(expected_scaledAmount))
            expect(new_total_scaled_supply).to.be.eq(prev_total_scaled_supply.sub(expected_scaledAmount))

            expect(new_total_supply).to.be.eq(new_total_assets)

            expect(new_index).to.be.eq(expected_new_index)

            await expect(withdraw_tx).to.emit(stkAave, 'Transfer').withArgs(
                vault.address,
                depositor1.address,
                user1_withdraw
            );

            await expect(withdraw_tx).to.emit(vault, 'Burn').withArgs(
                depositor1.address,
                expected_scaledAmount,
                expected_user_index
            );

            await expect(withdraw_tx).to.emit(vault, 'Transfer').withArgs(
                depositor1.address,
                ethers.constants.AddressZero,
                user1_withdraw
            );
            
            await expect(withdraw_tx).to.emit(vault, 'Withdraw').withArgs(
                depositor1.address,
                depositor1.address,
                depositor1.address,
                user1_withdraw,
                user1_withdraw
            );

        });

        it(' should withdraw all using MAX_UINT256 as parameter', async () => {

            const prev_user_stkAave_balance = await stkAave.balanceOf(depositor2.address)
            const prev_vault_stkAave_balance = await stkAave.balanceOf(vault.address)

            const prev_user_balance = await vault.balanceOf(depositor2.address)
            const prev_total_supply = await vault.totalSupply()
            const prev_total_assets = await vault.totalAssets()

            const prev_user_scaled_balance = await vault.scaledBalanceOf(depositor2.address)
            const prev_total_scaled_supply = await vault.totalScaledSupply()

            const withdraw_tx = await vault.connect(depositor2).redeem(ethers.constants.MaxUint256, depositor2.address, depositor2.address)
            
            const new_user_stkAave_balance = await stkAave.balanceOf(depositor2.address)
            const new_vault_stkAave_balance = await stkAave.balanceOf(vault.address)

            const new_user_balance = await vault.balanceOf(depositor2.address)
            const new_total_supply = await vault.totalSupply()
            const new_total_assets = await vault.totalAssets()

            const new_user_scaled_balance = await vault.scaledBalanceOf(depositor2.address)
            const new_total_scaled_supply = await vault.totalScaledSupply()

            // Part stkAave reward claim & re-stake
            const receipt = await withdraw_tx.wait()
            const iface = stkAave_staking.interface;
            const topic = iface.getEventTopic('Staked')
            const staking_log = receipt.logs.filter(x => x.topics.indexOf(topic) >= 0);
            const staking_events = staking_log.map((log) => (iface.parseLog(log)).args)
            const stkAave_claim = staking_events[0].amount
            const stkAave_claim_reserve = stkAave_claim.mul(await vault.reserveRatio()).div(MAX_BPS)
            const user_claim_share = stkAave_claim.sub(stkAave_claim_reserve).mul(prev_user_scaled_balance).div(prev_total_scaled_supply)
            // --------------------------------------------------

            const expected_withdraw = prev_user_balance.add(user_claim_share)

            const expected_user_index = (prev_total_assets.add(stkAave_claim.sub(stkAave_claim_reserve))).mul(RAY).add(prev_total_scaled_supply.div(2)).div(prev_total_scaled_supply)
            const expected_new_index = new_total_assets.mul(RAY).add(new_total_scaled_supply.div(2)).div(new_total_scaled_supply)

            const new_index = await vault.getCurrentIndex()

            expect(new_user_stkAave_balance).to.be.eq(prev_user_stkAave_balance.add(expected_withdraw))

            const effective_withdraw = new_user_stkAave_balance.sub(prev_user_stkAave_balance)
            expect(new_vault_stkAave_balance).to.be.eq(prev_vault_stkAave_balance.add(stkAave_claim).sub(effective_withdraw))

            expect(new_user_balance).to.be.eq(0)
            expect(new_total_supply).to.be.eq(prev_total_supply.sub(effective_withdraw).add(stkAave_claim).sub(stkAave_claim_reserve))
            expect(new_total_assets).to.be.eq(prev_total_assets.sub(effective_withdraw).add(stkAave_claim).sub(stkAave_claim_reserve))

            expect(new_user_scaled_balance).to.be.eq(0)
            expect(new_total_scaled_supply).to.be.eq(prev_total_scaled_supply.sub(prev_user_scaled_balance))

            expect(new_total_supply).to.be.eq(new_total_assets)

            expect(new_index).to.be.eq(expected_new_index)

            await expect(withdraw_tx).to.emit(stkAave, 'Transfer').withArgs(
                vault.address,
                depositor2.address,
                effective_withdraw
            );

            await expect(withdraw_tx).to.emit(vault, 'Burn').withArgs(
                depositor2.address,
                prev_user_scaled_balance,
                expected_user_index
            );

            await expect(withdraw_tx).to.emit(vault, 'Transfer').withArgs(
                depositor2.address,
                ethers.constants.AddressZero,
                effective_withdraw
            );
            
            await expect(withdraw_tx).to.emit(vault, 'Withdraw').withArgs(
                depositor2.address,
                depositor2.address,
                depositor2.address,
                effective_withdraw,
                effective_withdraw
            );

        });

        it(' should withdraw & send to the correct receiver', async () => {

            const prev_user1_stkAave_balance = await stkAave.balanceOf(depositor1.address)
            const prev_user3_stkAave_balance = await stkAave.balanceOf(depositor3.address)
            const prev_vault_stkAave_balance = await stkAave.balanceOf(vault.address)

            const prev_user1_balance = await vault.balanceOf(depositor1.address)
            const prev_user3_balance = await vault.balanceOf(depositor3.address)
            const prev_total_supply = await vault.totalSupply()
            const prev_total_assets = await vault.totalAssets()

            const prev_user1_scaled_balance = await vault.scaledBalanceOf(depositor1.address)
            const prev_user3_scaled_balance = await vault.scaledBalanceOf(depositor3.address)
            const prev_total_scaled_supply = await vault.totalScaledSupply()

            const withdraw_tx = await vault.connect(depositor1).redeem(user1_withdraw, depositor3.address, depositor1.address)
            
            const new_user1_stkAave_balance = await stkAave.balanceOf(depositor1.address)
            const new_user3_stkAave_balance = await stkAave.balanceOf(depositor3.address)
            const new_vault_stkAave_balance = await stkAave.balanceOf(vault.address)

            const new_user1_balance = await vault.balanceOf(depositor1.address)
            const new_user3_balance = await vault.balanceOf(depositor3.address)
            const new_total_supply = await vault.totalSupply()
            const new_total_assets = await vault.totalAssets()

            const new_user1_scaled_balance = await vault.scaledBalanceOf(depositor1.address)
            const new_user3_scaled_balance = await vault.scaledBalanceOf(depositor3.address)
            const new_total_scaled_supply = await vault.totalScaledSupply()

            // Part stkAave reward claim & re-stake
            const stkAave_claim = (new_vault_stkAave_balance.add(user1_withdraw)).sub(prev_vault_stkAave_balance)
            const stkAave_claim_reserve = stkAave_claim.mul(await vault.reserveRatio()).div(MAX_BPS)
            const user_claim_share = stkAave_claim.sub(stkAave_claim_reserve).mul(prev_user1_scaled_balance).div(prev_total_scaled_supply)
            // --------------------------------------------------

            const expected_user_index = (prev_total_assets.add(stkAave_claim.sub(stkAave_claim_reserve))).mul(RAY).add(prev_total_scaled_supply.div(2)).div(prev_total_scaled_supply)
            const expected_new_index = new_total_assets.mul(RAY).add(new_total_scaled_supply.div(2)).div(new_total_scaled_supply)

            const expected_scaledAmount = user1_withdraw.mul(RAY).add(expected_user_index.div(2)).div(expected_user_index)

            const new_index = await vault.getCurrentIndex()

            expect(new_user1_stkAave_balance).to.be.eq(prev_user1_stkAave_balance)
            expect(new_user3_stkAave_balance).to.be.eq(prev_user3_stkAave_balance.add(user1_withdraw))

            expect(new_user1_balance).to.be.closeTo(prev_user1_balance.add(user_claim_share).sub(user1_withdraw), 100) // because of stkAave rewards claim
            expect(new_user3_balance).to.be.eq(prev_user3_balance)
            expect(new_total_supply).to.be.eq(prev_total_supply.sub(user1_withdraw).add(stkAave_claim).sub(stkAave_claim_reserve))
            expect(new_total_assets).to.be.eq(prev_total_assets.sub(user1_withdraw).add(stkAave_claim).sub(stkAave_claim_reserve))

            expect(new_user1_scaled_balance).to.be.eq(prev_user1_scaled_balance.sub(expected_scaledAmount))
            expect(new_user3_scaled_balance).to.be.eq(prev_user3_scaled_balance)
            expect(new_total_scaled_supply).to.be.eq(prev_total_scaled_supply.sub(expected_scaledAmount))

            expect(new_total_supply).to.be.eq(new_total_assets)

            expect(new_index).to.be.eq(expected_new_index)

            await expect(withdraw_tx).to.emit(stkAave, 'Transfer').withArgs(
                vault.address,
                depositor3.address,
                user1_withdraw
            );

            await expect(withdraw_tx).to.emit(vault, 'Burn').withArgs(
                depositor1.address,
                expected_scaledAmount,
                expected_user_index
            );

            await expect(withdraw_tx).to.emit(vault, 'Transfer').withArgs(
                depositor1.address,
                ethers.constants.AddressZero,
                user1_withdraw
            );
            
            await expect(withdraw_tx).to.emit(vault, 'Withdraw').withArgs(
                depositor1.address,
                depositor3.address,
                depositor1.address,
                user1_withdraw,
                user1_withdraw
            );

        });

        it(' should allow to withdraw from other user if given the allowance', async () => {

            await vault.connect(depositor1).approve(depositor3.address, user1_withdraw)

            const prev_user1_stkAave_balance = await stkAave.balanceOf(depositor1.address)
            const prev_user3_stkAave_balance = await stkAave.balanceOf(depositor3.address)
            const prev_vault_stkAave_balance = await stkAave.balanceOf(vault.address)

            const prev_user1_balance = await vault.balanceOf(depositor1.address)
            const prev_total_supply = await vault.totalSupply()
            const prev_total_assets = await vault.totalAssets()

            const prev_user1_scaled_balance = await vault.scaledBalanceOf(depositor1.address)
            const prev_total_scaled_supply = await vault.totalScaledSupply()

            const withdraw_tx = await vault.connect(depositor3).redeem(user1_withdraw, depositor3.address, depositor1.address)
            
            const new_user1_stkAave_balance = await stkAave.balanceOf(depositor1.address)
            const new_user3_stkAave_balance = await stkAave.balanceOf(depositor3.address)
            const new_vault_stkAave_balance = await stkAave.balanceOf(vault.address)

            const new_user1_balance = await vault.balanceOf(depositor1.address)
            const new_total_supply = await vault.totalSupply()
            const new_total_assets = await vault.totalAssets()

            const new_total_scaled_supply = await vault.totalScaledSupply()

            // Part stkAave reward claim & re-stake
            const stkAave_claim = (new_vault_stkAave_balance.add(user1_withdraw)).sub(prev_vault_stkAave_balance)
            const stkAave_claim_reserve = stkAave_claim.mul(await vault.reserveRatio()).div(MAX_BPS)
            const user_claim_share = stkAave_claim.sub(stkAave_claim_reserve).mul(prev_user1_scaled_balance).div(prev_total_scaled_supply)
            // --------------------------------------------------

            const expected_user_index = (prev_total_assets.add(stkAave_claim.sub(stkAave_claim_reserve))).mul(RAY).add(prev_total_scaled_supply.div(2)).div(prev_total_scaled_supply)
            const expected_new_index = new_total_assets.mul(RAY).add(new_total_scaled_supply.div(2)).div(new_total_scaled_supply)

            const expected_scaledAmount = user1_withdraw.mul(RAY).add(expected_user_index.div(2)).div(expected_user_index)

            const new_index = await vault.getCurrentIndex()

            expect(new_user1_stkAave_balance).to.be.eq(prev_user1_stkAave_balance)
            expect(new_user3_stkAave_balance).to.be.eq(prev_user3_stkAave_balance.add(user1_withdraw))

            expect(new_user1_balance).to.be.eq(prev_user1_balance.add(user_claim_share).sub(user1_withdraw))
            expect(new_total_supply).to.be.eq(prev_total_supply.sub(user1_withdraw).add(stkAave_claim).sub(stkAave_claim_reserve))
            expect(new_total_assets).to.be.eq(prev_total_assets.sub(user1_withdraw).add(stkAave_claim).sub(stkAave_claim_reserve))

            expect(new_total_supply).to.be.eq(new_total_assets)

            expect(new_index).to.be.eq(expected_new_index)

            await expect(withdraw_tx).to.emit(stkAave, 'Transfer').withArgs(
                vault.address,
                depositor3.address,
                user1_withdraw
            );

            await expect(withdraw_tx).to.emit(vault, 'Burn').withArgs(
                depositor1.address,
                expected_scaledAmount,
                expected_user_index
            );

            await expect(withdraw_tx).to.emit(vault, 'Transfer').withArgs(
                depositor1.address,
                ethers.constants.AddressZero,
                user1_withdraw
            );
            
            await expect(withdraw_tx).to.emit(vault, 'Withdraw').withArgs(
                depositor3.address,
                depositor3.address,
                depositor1.address,
                user1_withdraw,
                user1_withdraw
            );

        });

        it(' should fail if trying to withdraw more than deposit', async () => {
            
            const big_withdraw = ethers.utils.parseEther('175')

            await expect(
                vault.connect(depositor1).redeem(big_withdraw, depositor1.address, depositor1.address)
            ).to.be.revertedWith('ERC20_AmountExceedBalance')

        });

        it(' should fail if no fund was deposited', async () => {

            await expect(
                vault.connect(depositor3).redeem(user1_withdraw, depositor3.address, depositor3.address)
            ).to.be.revertedWith('ERC20_AmountExceedBalance')

        });

        it(' should fail if not enough funds available for withdraw', async () => {

            const available_balance = (await stkAave.balanceOf(vault.address)).sub(await vault.reserveAmount())
            const buffer_amount = (await vault.totalAssets()).mul(await vault.bufferRatio()).div(MAX_BPS)
            const max_rent_amount = available_balance.sub(buffer_amount)

            await vault.connect(admin).addPodManager(podManager.address)
            await vault.connect(podManager).rentStkAave(fakePod.address, max_rent_amount)

            await expect(
                vault.connect(depositor1).redeem(user1_withdraw, depositor3.address, depositor1.address)
            ).to.be.revertedWith('NotEnoughAvailableFunds')


        });

        it(' should fail if no allowance was given to withdraw from other depositor', async () => {

            await expect(
                vault.connect(depositor3).redeem(user1_withdraw, depositor3.address, depositor1.address)
            ).to.be.revertedWith('ERC20_AmountOverAllowance')

            await vault.connect(depositor1).approve(depositor3.address, user1_withdraw.div(2))

            await expect(
                vault.connect(depositor3).redeem(user1_withdraw, depositor3.address, depositor1.address)
            ).to.be.revertedWith('ERC20_AmountOverAllowance')

        });

        it(' should fail if given the address 0x0', async () => {

            await expect(
                vault.connect(depositor1).redeem(user1_withdraw, ethers.constants.AddressZero, depositor1.address)
            ).to.be.revertedWith('AddressZero')

            await expect(
                vault.connect(depositor1).redeem(user1_withdraw, depositor1.address, ethers.constants.AddressZero)
            ).to.be.revertedWith('AddressZero')

        });

        it(' should fail if given amount 0', async () => {

            await expect(
                vault.connect(depositor1).redeem(0, depositor1.address, depositor1.address)
            ).to.be.revertedWith('NullAmount')

        });

    });

    describe('updateStkAaveRewards', async () => {

        const user1_deposit = ethers.utils.parseEther('250')
        const user2_deposit = ethers.utils.parseEther('315')
        const user3_deposit = ethers.utils.parseEther('20')

        const user1_withdraw = ethers.utils.parseEther('110')

        beforeEach(async () => {

            const seed_deposit = ethers.utils.parseEther('0.001')
            await stkAave.connect(admin).approve(vault.address, seed_deposit)
            await vault.connect(admin).init(votingManager.address)

            await stkAave.connect(admin).transfer(depositor1.address, user1_deposit)
            await stkAave.connect(admin).transfer(depositor2.address, user2_deposit)
            await stkAave.connect(admin).transfer(depositor3.address, user3_deposit)

            await stkAave.connect(depositor1).approve(vault.address, MAX_UINT256)
            await stkAave.connect(depositor2).approve(vault.address, user2_deposit)
            await stkAave.connect(depositor3).approve(vault.address, user3_deposit)

            await vault.connect(depositor1).deposit(user1_deposit, depositor1.address)
            await vault.connect(depositor2).deposit(user2_deposit, depositor2.address)

            await advanceTime(WEEK.toNumber())

        });

        it(' should claim all the rewards correctly & set the correct amount for reserve', async () => {

            const prev_vault_balance = await stkAave.balanceOf(vault.address)
            const prev_vault_reserve = await vault.reserveAmount()

            const update_tx = await vault.connect(admin).updateStkAaveRewards()

            const new_vault_balance = await stkAave.balanceOf(vault.address)
            const new_vault_reserve = await vault.reserveAmount()

            const tx_block = (await update_tx).blockNumber

            expect(await stkAave_staking.getTotalRewardsBalance(vault.address, { blockTag: tx_block })).to.be.eq(0)

            // We trust stkAave events for the amount claimed
            // but will compare it to transfers emitted
            const receipt = await update_tx.wait()
            const iface = stkAave_staking.interface;
            const claim_topic = iface.getEventTopic('RewardsClaimed')
            const staking_topic = iface.getEventTopic('Staked')
            const claim_log = receipt.logs.filter(x => x.topics.indexOf(claim_topic) >= 0);
            const staking_log = receipt.logs.filter(x => x.topics.indexOf(staking_topic) >= 0);
            const claim_events = claim_log.map((log) => (iface.parseLog(log)).args)
            const staking_events = staking_log.map((log) => (iface.parseLog(log)).args)
            const aave_claim = claim_events[0].amount
            const stkAave_staked = staking_events[0].amount

            expect(new_vault_balance).to.be.eq(prev_vault_balance.add(stkAave_staked))

            const expected_reserve_increase = stkAave_staked.mul(await vault.reserveRatio()).div(MAX_BPS)

            expect(new_vault_reserve).to.be.eq(prev_vault_reserve.add(expected_reserve_increase))

            await expect(update_tx).to.emit(aave, 'Transfer').withArgs(
                "0x25F2226B597E8F9514B3F68F00f494cF4f286491", // Aave Ecosystem Reserve
                vault.address,
                aave_claim
            );

            await expect(update_tx).to.emit(stkAave_staking, 'RewardsClaimed').withArgs(
                vault.address,
                vault.address,
                aave_claim
            );

            await expect(update_tx).to.emit(aave, 'Transfer').withArgs(
                vault.address,
                stkAave.address,
                aave_claim
            );

            await expect(update_tx).to.emit(stkAave, 'Transfer').withArgs(
                ethers.constants.AddressZero,
                vault.address,
                stkAave_staked
            );

            await expect(update_tx).to.emit(stkAave_staking, 'Staked').withArgs(
                vault.address,
                vault.address,
                stkAave_staked
            );

        });

        it(' should update the user balances correctly', async () => {

            const prev_vault_balance = await stkAave.balanceOf(vault.address)
            const prev_user1_balance = await vault.balanceOf(depositor1.address)
            const prev_user2_balance = await vault.balanceOf(depositor2.address)
            const prev_total_supply = await vault.totalSupply()
            const prev_user1_scaled_balance = await vault.scaledBalanceOf(depositor1.address)
            const prev_user2_scaled_balance = await vault.scaledBalanceOf(depositor2.address)
            const prev_scaled_supply = await vault.totalScaledSupply()

            await vault.connect(admin).updateStkAaveRewards()

            const new_vault_balance = await stkAave.balanceOf(vault.address)
            const new_user1_balance = await vault.balanceOf(depositor1.address)
            const new_user2_balance = await vault.balanceOf(depositor2.address)
            const new_total_supply = await vault.totalSupply()

            const claimed_amount = new_vault_balance.sub(prev_vault_balance)
            const total_user_amount = claimed_amount.sub(claimed_amount.mul(await vault.reserveRatio()).div(MAX_BPS))

            const user1_share = total_user_amount.mul(prev_user1_scaled_balance).div(prev_scaled_supply)
            const user2_share = total_user_amount.mul(prev_user2_scaled_balance).div(prev_scaled_supply)

            expect(new_total_supply).to.be.eq(prev_total_supply.add(total_user_amount))

            expect(new_user1_balance).to.be.closeTo(prev_user1_balance.add(user1_share),100)
            expect(new_user2_balance).to.be.closeTo(prev_user2_balance.add(user2_share),100)

        });

        it(' should also stake any extra AAVE in the contract', async () => {

            const extra_Aave = ethers.utils.parseEther('50')

            await stkAave_staking.connect(admin).cooldown()
            await advanceTime(864000)
            await stkAave_staking.connect(admin).redeem(admin.address, extra_Aave)
            await aave.connect(admin).transfer(vault.address, extra_Aave)

            const prev_vault_balance = await stkAave.balanceOf(vault.address)
            const prev_vault_reserve = await vault.reserveAmount()

            const update_tx = await vault.connect(admin).updateStkAaveRewards()

            const new_vault_balance = await stkAave.balanceOf(vault.address)
            const new_vault_reserve = await vault.reserveAmount()

            const tx_block = (await update_tx).blockNumber

            expect(await stkAave_staking.getTotalRewardsBalance(vault.address, { blockTag: tx_block })).to.be.eq(0)

            const receipt = await update_tx.wait()
            const iface = stkAave_staking.interface;
            const claim_topic = iface.getEventTopic('RewardsClaimed')
            const staking_topic = iface.getEventTopic('Staked')
            const claim_log = receipt.logs.filter(x => x.topics.indexOf(claim_topic) >= 0);
            const staking_log = receipt.logs.filter(x => x.topics.indexOf(staking_topic) >= 0);
            const claim_events = claim_log.map((log) => (iface.parseLog(log)).args)
            const staking_events = staking_log.map((log) => (iface.parseLog(log)).args)
            const aave_claim = claim_events[0].amount
            const stkAave_staked = staking_events[0].amount

            expect(stkAave_staked).to.be.eq(aave_claim.add(extra_Aave))

            expect(new_vault_balance).to.be.eq(prev_vault_balance.add(stkAave_staked))

            const expected_reserve_increase = aave_claim.mul(await vault.reserveRatio()).div(MAX_BPS)

            expect(new_vault_reserve).to.be.eq(prev_vault_reserve.add(expected_reserve_increase))

            await expect(update_tx).to.emit(aave, 'Transfer').withArgs(
                "0x25F2226B597E8F9514B3F68F00f494cF4f286491", // Aave Ecosystem Reserve
                vault.address,
                aave_claim
            );

            await expect(update_tx).to.emit(stkAave_staking, 'RewardsClaimed').withArgs(
                vault.address,
                vault.address,
                aave_claim
            );

            await expect(update_tx).to.emit(aave, 'Transfer').withArgs(
                vault.address,
                stkAave.address,
                aave_claim.add(extra_Aave)
            );

            await expect(update_tx).to.emit(stkAave, 'Transfer').withArgs(
                ethers.constants.AddressZero,
                vault.address,
                stkAave_staked
            );

            await expect(update_tx).to.emit(stkAave_staking, 'Staked').withArgs(
                vault.address,
                vault.address,
                stkAave_staked
            );

        });

        it(' should be triggered by all methods calling it', async () => {

            const prev_vault_balance = await stkAave.balanceOf(vault.address)
            const prev_vault_reserve = await vault.reserveAmount()

            const deposit_tx = await vault.connect(depositor3).deposit(user3_deposit, depositor3.address)

            const new_vault_balance = await stkAave.balanceOf(vault.address)
            const new_vault_reserve = await vault.reserveAmount()

            const tx_block = (await deposit_tx).blockNumber

            expect(await stkAave_staking.getTotalRewardsBalance(vault.address, { blockTag: tx_block })).to.be.eq(0)

            const claimed_amount = new_vault_balance.sub(prev_vault_balance).sub(user3_deposit)

            const expected_reserve_increase = claimed_amount.mul(await vault.reserveRatio()).div(MAX_BPS)
            expect(new_vault_reserve).to.be.eq(prev_vault_reserve.add(expected_reserve_increase))

            await expect(deposit_tx).to.emit(stkAave_staking, 'RewardsClaimed').withArgs(
                vault.address,
                vault.address,
                claimed_amount
            );

            await expect(deposit_tx).to.emit(stkAave_staking, 'Staked').withArgs(
                vault.address,
                vault.address,
                claimed_amount
            );

            const withdraw_tx = await vault.connect(depositor1).withdraw(user1_withdraw, depositor1.address, depositor1.address)

            const new_vault_balance2 = await stkAave.balanceOf(vault.address)
            const new_vault_reserve2 = await vault.reserveAmount()

            const tx_block2 = (await withdraw_tx).blockNumber

            expect(await stkAave_staking.getTotalRewardsBalance(vault.address, { blockTag: tx_block2 })).to.be.eq(0)

            const claimed_amount2 = new_vault_balance2.sub(new_vault_balance.sub(user1_withdraw))

            const expected_reserve_increase2 = claimed_amount2.mul(await vault.reserveRatio()).div(MAX_BPS)
            expect(new_vault_reserve2).to.be.eq(new_vault_reserve.add(expected_reserve_increase2))

            await expect(withdraw_tx).to.emit(stkAave_staking, 'RewardsClaimed').withArgs(
                vault.address,
                vault.address,
                claimed_amount2
            );

            await expect(withdraw_tx).to.emit(stkAave_staking, 'Staked').withArgs(
                vault.address,
                vault.address,
                claimed_amount2
            );

        });

    });

    describe('approve', async () => {

        const user1_deposit = ethers.utils.parseEther('250')
        const user2_deposit = ethers.utils.parseEther('315')
        const user3_deposit = ethers.utils.parseEther('20')

        const approve_amount = ethers.utils.parseEther('100')
        const change_allowance = ethers.utils.parseEther('25')

        beforeEach(async () => {

            const seed_deposit = ethers.utils.parseEther('0.001')
            await stkAave.connect(admin).approve(vault.address, seed_deposit)
            await vault.connect(admin).init(votingManager.address)

            await stkAave.connect(admin).transfer(depositor1.address, user1_deposit)
            await stkAave.connect(admin).transfer(depositor2.address, user2_deposit)
            await stkAave.connect(admin).transfer(depositor3.address, user3_deposit)

            await stkAave.connect(depositor1).approve(vault.address, MAX_UINT256)
            await stkAave.connect(depositor2).approve(vault.address, user2_deposit)
            await stkAave.connect(depositor3).approve(vault.address, user3_deposit)

            await vault.connect(depositor1).deposit(user1_deposit, depositor1.address)
            await vault.connect(depositor2).deposit(user2_deposit, depositor2.address)

            await advanceTime(WEEK.toNumber())

        });

        it(' should update allowance correctly', async () => {

            const approve_tx = await vault.connect(depositor1).approve(depositor3.address, approve_amount)

            let newAllowance = await vault.connect(depositor1).allowance(depositor1.address, depositor3.address)

            expect(newAllowance).to.be.eq(approve_amount)

            await expect(approve_tx)
                .to.emit(vault, 'Approval')
                .withArgs(depositor1.address, depositor3.address, approve_amount);

        });

        it(' should increase allowance correctly', async () => {

            await vault.connect(depositor1).approve(depositor3.address, approve_amount)

            let oldAllowance = await vault.connect(depositor1).allowance(depositor1.address, depositor3.address)

            const increase_tx = await vault.connect(depositor1).increaseAllowance(depositor3.address, change_allowance)

            let newAllowance = await vault.connect(depositor1).allowance(depositor1.address, depositor3.address)

            expect(newAllowance.sub(oldAllowance)).to.be.eq(change_allowance)

            await expect(increase_tx)
                .to.emit(vault, 'Approval')
                .withArgs(depositor1.address, depositor3.address, oldAllowance.add(change_allowance));

        });

        it(' should decrease allowance correctly', async () => {

            await vault.connect(depositor1).approve(depositor3.address, approve_amount)

            let oldAllowance = await vault.connect(depositor1).allowance(depositor1.address, depositor3.address)

            const decrease_tx = await vault.connect(depositor1).decreaseAllowance(depositor3.address, change_allowance)

            let newAllowance = await vault.connect(depositor1).allowance(depositor1.address, depositor3.address)

            expect(oldAllowance.sub(newAllowance)).to.be.eq(change_allowance)

            await expect(decrease_tx)
                .to.emit(vault, 'Approval')
                .withArgs(depositor1.address, depositor3.address, oldAllowance.sub(change_allowance));

        });

        it(' should block approval to address 0x0', async () => {

            await expect(
                vault.connect(depositor1).approve(ethers.constants.AddressZero, approve_amount)
            ).to.be.revertedWith('ERC20_ApproveAddressZero')

        });

        it(' should fail to decrease allowance under 0', async () => {

            await vault.connect(depositor1).approve(depositor3.address, approve_amount)

            await expect(
                vault.connect(depositor1).decreaseAllowance(depositor3.address, approve_amount.mul(2))
            ).to.be.revertedWith('ERC20_AllowanceUnderflow')

        });

    });

    describe('transfer & transferFrom', async () => {

        const user1_deposit = ethers.utils.parseEther('250')
        const user2_deposit = ethers.utils.parseEther('315')
        const user3_deposit = ethers.utils.parseEther('20')

        const approve_amount = ethers.utils.parseEther('150')
        const transfer_amount = ethers.utils.parseEther('100')

        beforeEach(async () => {

            const seed_deposit = ethers.utils.parseEther('0.001')
            await stkAave.connect(admin).approve(vault.address, seed_deposit)
            await vault.connect(admin).init(votingManager.address)

            await stkAave.connect(admin).transfer(depositor1.address, user1_deposit)
            await stkAave.connect(admin).transfer(depositor2.address, user2_deposit)
            await stkAave.connect(admin).transfer(depositor3.address, user3_deposit)

            await stkAave.connect(depositor1).approve(vault.address, MAX_UINT256)
            await stkAave.connect(depositor2).approve(vault.address, user2_deposit)
            await stkAave.connect(depositor3).approve(vault.address, user3_deposit)

            await vault.connect(depositor1).deposit(user1_deposit, depositor1.address)
            await vault.connect(depositor2).deposit(user2_deposit, depositor2.address)

            await advanceTime(WEEK.toNumber())

        });

        it(' transfer - should transfer the funds correctly & update the scaledBalance correctly (& emit Event)', async () => {

            const prev_sender_balance = await vault.balanceOf(depositor1.address)
            const prev_receiver_balance = await vault.balanceOf(depositor2.address)

            const prev_sender_scaled_balance = await vault.scaledBalanceOf(depositor1.address)
            const prev_receiver_scaled_balance = await vault.scaledBalanceOf(depositor2.address)

            const prev_scaled_supply = await vault.totalScaledSupply()
            const prev_total_supply = await vault.totalSupply()

            const current_index = await vault.getCurrentIndex()

            const transfer_tx = await vault.connect(depositor1).transfer(depositor2.address, transfer_amount)

            const expected_scaled_transfer_amount = transfer_amount.mul(RAY).add(current_index.div(2)).div(current_index)

            const new_sender_balance = await vault.balanceOf(depositor1.address)
            const new_receiver_balance = await vault.balanceOf(depositor2.address)

            const new_sender_scaled_balance = await vault.scaledBalanceOf(depositor1.address)
            const new_receiver_scaled_balance = await vault.scaledBalanceOf(depositor2.address)

            expect(new_sender_balance).to.be.eq(prev_sender_balance.sub(transfer_amount))
            expect(new_receiver_balance).to.be.eq(prev_receiver_balance.add(transfer_amount))

            expect(new_sender_scaled_balance).to.be.eq(prev_sender_scaled_balance.sub(expected_scaled_transfer_amount))
            expect(new_receiver_scaled_balance).to.be.eq(prev_receiver_scaled_balance.add(expected_scaled_transfer_amount))

            expect(await vault.totalScaledSupply()).to.be.eq(prev_scaled_supply)
            expect(await vault.totalSupply()).to.be.eq(prev_total_supply)

            await expect(transfer_tx).to.emit(vault, 'Transfer').withArgs(
                depositor1.address,
                depositor2.address,
                transfer_amount
            );

        });

        it(' transferFrom - should transfer the funds correctly & update the scaledBalance correctly & update the allowance correctly (& emit Event)', async () => {
            
            await vault.connect(depositor1).approve(depositor3.address, user1_deposit)

            const prev_allowance = await vault.allowance(depositor1.address, depositor3.address)

            const prev_sender_balance = await vault.balanceOf(depositor1.address)
            const prev_receiver_balance = await vault.balanceOf(depositor3.address)

            const prev_sender_scaled_balance = await vault.scaledBalanceOf(depositor1.address)
            const prev_receiver_scaled_balance = await vault.scaledBalanceOf(depositor3.address)

            const prev_scaled_supply = await vault.totalScaledSupply()
            const prev_total_supply = await vault.totalSupply()

            const current_index = await vault.getCurrentIndex()

            const transfer_tx = await vault.connect(depositor3).transferFrom(depositor1.address, depositor3.address, transfer_amount)

            const expected_scaled_transfer_amount = transfer_amount.mul(RAY).add(current_index.div(2)).div(current_index)

            const new_allowance = await vault.allowance(depositor1.address, depositor3.address)

            const new_sender_balance = await vault.balanceOf(depositor1.address)
            const new_receiver_balance = await vault.balanceOf(depositor3.address)

            const new_sender_scaled_balance = await vault.scaledBalanceOf(depositor1.address)
            const new_receiver_scaled_balance = await vault.scaledBalanceOf(depositor3.address)

            expect(new_allowance).to.be.eq(prev_allowance.sub(transfer_amount))

            expect(new_sender_balance).to.be.eq(prev_sender_balance.sub(transfer_amount))
            expect(new_receiver_balance).to.be.eq(prev_receiver_balance.add(transfer_amount))

            expect(new_sender_scaled_balance).to.be.eq(prev_sender_scaled_balance.sub(expected_scaled_transfer_amount))
            expect(new_receiver_scaled_balance).to.be.eq(prev_receiver_scaled_balance.add(expected_scaled_transfer_amount))

            expect(await vault.totalScaledSupply()).to.be.eq(prev_scaled_supply)
            expect(await vault.totalSupply()).to.be.eq(prev_total_supply)

            await expect(transfer_tx).to.emit(vault, 'Transfer').withArgs(
                depositor1.address,
                depositor3.address,
                transfer_amount
            );

        });

        it(' transferFrom - should not update the allowance if MAX_UINT256 was approved', async () => {
            
            await vault.connect(depositor1).approve(depositor3.address, ethers.constants.MaxUint256)

            expect(await vault.allowance(depositor1.address, depositor3.address)).to.be.eq(ethers.constants.MaxUint256)

            await vault.connect(depositor3).transferFrom(depositor1.address, depositor3.address, transfer_amount)

            expect(await vault.allowance(depositor1.address, depositor3.address)).to.be.eq(ethers.constants.MaxUint256)

        });

        it(' should fail if given the address 0x0', async () => {

            await vault.connect(depositor1).approve(depositor3.address, ethers.constants.MaxUint256)

            await expect(
                vault.connect(depositor1).transfer(ethers.constants.AddressZero, transfer_amount)
            ).to.be.revertedWith('ERC20_AddressZero')

            await expect(
                vault.connect(depositor3).transferFrom(ethers.constants.AddressZero, depositor3.address, transfer_amount)
            ).to.be.reverted

            await expect(
                vault.connect(depositor3).transferFrom(depositor1.address, ethers.constants.AddressZero, transfer_amount)
            ).to.be.revertedWith('ERC20_AddressZero')

        });

        it(' should fail if given a null amount', async () => {

            await vault.connect(depositor1).approve(depositor3.address, ethers.constants.MaxUint256)

            await expect(
                vault.connect(depositor1).transfer(depositor2.address, 0)
            ).to.be.revertedWith('ERC20_NullAmount')

            await expect(
                vault.connect(depositor3).transferFrom(depositor1.address, depositor3.address, 0)
            ).to.be.revertedWith('ERC20_NullAmount')

        });

        it(' should fail if not enough balance for the transfer', async () => {

            await vault.connect(depositor1).approve(depositor3.address, ethers.constants.MaxUint256)

            // Bigger than balance
            await expect(
                vault.connect(depositor1).transfer(depositor2.address, user1_deposit.mul(2))
            ).to.be.revertedWith('ERC20_AmountExceedBalance')

            // Bigger than balance
            await expect(
                vault.connect(depositor3).transferFrom(depositor1.address, depositor3.address, user1_deposit.mul(2))
            ).to.be.revertedWith('ERC20_AmountExceedBalance')

            // No balance
            await expect(
                vault.connect(depositor3).transfer(depositor2.address, transfer_amount)
            ).to.be.revertedWith('ERC20_AmountExceedBalance')

        });

        it(' should fail if not given enough allowance', async () => {

            await vault.connect(depositor1).approve(depositor3.address, transfer_amount)

            await expect(
                vault.connect(depositor3).transferFrom(depositor1.address, depositor3.address, user1_deposit)
            ).to.be.revertedWith('ERC20_AmountOverAllowance')

        });

        it(' should fail if trying to self-transfer', async () => {

            await expect(
                vault.connect(depositor1).transfer(depositor1.address, transfer_amount)
            ).to.be.revertedWith('ERC20_SelfTransfer')

            await vault.connect(depositor1).approve(depositor1.address, ethers.constants.MaxUint256)
            await expect(
                vault.connect(depositor1).transferFrom(depositor1.address, depositor1.address, transfer_amount)
            ).to.be.revertedWith('ERC20_SelfTransfer')

        });

    });

    describe('rentStkAave', async () => {
        
        const user1_deposit = ethers.utils.parseEther('1500')
        const user2_deposit = ethers.utils.parseEther('850')
        const user3_deposit = ethers.utils.parseEther('2100')

        const rent_amount = ethers.utils.parseEther('3200')
        const rent_amount2 = ethers.utils.parseEther('400')

        beforeEach(async () => {

            const seed_deposit = ethers.utils.parseEther('0.001')
            await stkAave.connect(admin).approve(vault.address, seed_deposit)
            await vault.connect(admin).init(votingManager.address)

            await stkAave.connect(admin).transfer(depositor1.address, user1_deposit)
            await stkAave.connect(admin).transfer(depositor2.address, user2_deposit)
            await stkAave.connect(admin).transfer(depositor3.address, user3_deposit)

            await stkAave.connect(depositor1).approve(vault.address, MAX_UINT256)
            await stkAave.connect(depositor2).approve(vault.address, user2_deposit)
            await stkAave.connect(depositor3).approve(vault.address, user3_deposit)

            await vault.connect(depositor1).deposit(user1_deposit, depositor1.address)
            await vault.connect(depositor2).deposit(user2_deposit, depositor2.address)
            await vault.connect(depositor3).deposit(user3_deposit, depositor3.address)

            await vault.connect(admin).addPodManager(podManager.address)

            await stkAave.connect(pod1).approve(vault.address, MAX_UINT256)
            await stkAave.connect(pod2).approve(vault.address, MAX_UINT256)

            await advanceTime(WEEK.mul(4).toNumber())

        });

        it(' should send the stkAave & track the rented amount correctly (& emit Event)', async () => {

            const prev_vault_balance = await stkAave.balanceOf(vault.address)
            const prev_pod_balance = await stkAave.balanceOf(pod1.address)

            const prev_total_rented = await vault.totalRentedAmount()
            const prev_rented_manager = (await vault.podManagers(podManager.address)).totalRented

            const rent_tx = await vault.connect(podManager).rentStkAave(pod1.address, rent_amount)

            // Part stkAave reward claim & re-stake
            const receipt = await rent_tx.wait()
            const iface = stkAave_staking.interface;
            const topic = iface.getEventTopic('Staked')
            const staking_log = receipt.logs.filter(x => x.topics.indexOf(topic) >= 0);
            const staking_events = staking_log.map((log) => (iface.parseLog(log)).args)
            const stkAave_claim = staking_events[0].amount
            // --------------------------------------------------

            const new_vault_balance = await stkAave.balanceOf(vault.address)
            const new_pod_balance = await stkAave.balanceOf(pod1.address)

            const new_total_rented = await vault.totalRentedAmount()
            const new_rented_manager = (await vault.podManagers(podManager.address)).totalRented

            expect(new_vault_balance).to.be.eq(prev_vault_balance.add(stkAave_claim).sub(rent_amount))
            expect(new_pod_balance).to.be.eq(prev_pod_balance.add(rent_amount))

            expect(new_total_rented).to.be.eq(prev_total_rented.add(rent_amount))
            expect(new_rented_manager).to.be.eq(prev_rented_manager.add(rent_amount))

            await expect(rent_tx).to.emit(vault, 'RentToPod').withArgs(
                podManager.address,
                pod1.address,
                rent_amount
            );

            await expect(rent_tx).to.emit(stkAave, 'Transfer').withArgs(
                vault.address,
                pod1.address,
                rent_amount
            );

        });

        it(' should allow multiple Pods to rent at the same time', async () => {

            const prev_pod1_balance = await stkAave.balanceOf(pod1.address)
            const prev_pod2_balance = await stkAave.balanceOf(pod2.address)

            const prev_total_rented = await vault.totalRentedAmount()
            const prev_rented_manager = (await vault.podManagers(podManager.address)).totalRented

            const rent_tx = await vault.connect(podManager).rentStkAave(pod1.address, rent_amount)

            const new_pod1_balance = await stkAave.balanceOf(pod1.address)
            const new_pod2_balance = await stkAave.balanceOf(pod2.address)

            const new_total_rented = await vault.totalRentedAmount()
            const new_rented_manager = (await vault.podManagers(podManager.address)).totalRented

            expect(new_pod1_balance).to.be.eq(prev_pod1_balance.add(rent_amount))
            expect(new_pod2_balance).to.be.eq(prev_pod2_balance)

            expect(new_total_rented).to.be.eq(prev_total_rented.add(rent_amount))
            expect(new_rented_manager).to.be.eq(prev_rented_manager.add(rent_amount))

            await expect(rent_tx).to.emit(vault, 'RentToPod').withArgs(
                podManager.address,
                pod1.address,
                rent_amount
            );

            await expect(rent_tx).to.emit(stkAave, 'Transfer').withArgs(
                vault.address,
                pod1.address,
                rent_amount
            );

            const rent_tx2 = await vault.connect(podManager).rentStkAave(pod2.address, rent_amount2)

            const new_pod1_balance2 = await stkAave.balanceOf(pod1.address)
            const new_pod2_balance2 = await stkAave.balanceOf(pod2.address)

            const new_total_rented2 = await vault.totalRentedAmount()
            const new_rented_manager2 = await (await vault.podManagers(podManager.address)).totalRented

            expect(new_pod1_balance2).to.be.eq(new_pod1_balance)
            expect(new_pod2_balance2).to.be.eq(new_pod2_balance.add(rent_amount2))

            expect(new_total_rented2).to.be.eq(new_total_rented.add(rent_amount2))
            expect(new_rented_manager2).to.be.eq(new_rented_manager.add(rent_amount2))

            await expect(rent_tx2).to.emit(vault, 'RentToPod').withArgs(
                podManager.address,
                pod2.address,
                rent_amount2
            );

            await expect(rent_tx2).to.emit(stkAave, 'Transfer').withArgs(
                vault.address,
                pod2.address,
                rent_amount2
            );

        });

        it(' should not allow to rent the buffer amount', async () => {

            const total_assets = await vault.totalAssets()

            await expect(
                vault.connect(podManager).rentStkAave(pod1.address, total_assets)
            ).to.be.revertedWith('NotEnoughAvailableFunds')

        });

        it(' should only be usable by Pod Managers', async () => {

            await expect(
                vault.connect(depositor1).rentStkAave(depositor1.address, rent_amount)
            ).to.be.revertedWith('CallerNotAllowedManager')

        });

        it(' should fail if given address 0x0', async () => {

            await expect(
                vault.connect(podManager).rentStkAave(ethers.constants.AddressZero, rent_amount)
            ).to.be.revertedWith('AddressZero')

        });

        it(' should fail if given address 0', async () => {

            await expect(
                vault.connect(podManager).rentStkAave(pod1.address, 0)
            ).to.be.revertedWith('NullAmount')

        });

    });
    
    describe('notifyRentedAmount', async () => {

        const user1_deposit = ethers.utils.parseEther('1500')
        const user2_deposit = ethers.utils.parseEther('850')
        const user3_deposit = ethers.utils.parseEther('2100')

        const rent_amount = ethers.utils.parseEther('3200')

        const notify_amount = ethers.utils.parseEther('75')

        beforeEach(async () => {

            const seed_deposit = ethers.utils.parseEther('0.001')
            await stkAave.connect(admin).approve(vault.address, seed_deposit)
            await vault.connect(admin).init(votingManager.address)

            await stkAave.connect(admin).transfer(depositor1.address, user1_deposit)
            await stkAave.connect(admin).transfer(depositor2.address, user2_deposit)
            await stkAave.connect(admin).transfer(depositor3.address, user3_deposit)

            await stkAave.connect(depositor1).approve(vault.address, MAX_UINT256)
            await stkAave.connect(depositor2).approve(vault.address, user2_deposit)
            await stkAave.connect(depositor3).approve(vault.address, user3_deposit)

            await vault.connect(depositor1).deposit(user1_deposit, depositor1.address)
            await vault.connect(depositor2).deposit(user2_deposit, depositor2.address)
            await vault.connect(depositor3).deposit(user3_deposit, depositor3.address)

            await vault.connect(admin).addPodManager(podManager.address)

            await stkAave.connect(pod1).approve(vault.address, MAX_UINT256)
            await stkAave.connect(pod2).approve(vault.address, MAX_UINT256)

            await advanceTime(WEEK.mul(4).toNumber())

            await vault.connect(podManager).rentStkAave(pod1.address, rent_amount)

        });

        it(' should add the correct amount to the total rented (& emit Event)', async () => {

            const prev_total_rented = await vault.totalRentedAmount()
            const prev_rented_manager = (await vault.podManagers(podManager.address)).totalRented

            const notify_tx = await vault.connect(podManager).notifyRentedAmount(pod1.address, notify_amount)

            const new_total_rented = await vault.totalRentedAmount()
            const new_rented_manager = (await vault.podManagers(podManager.address)).totalRented

            expect(new_total_rented).to.be.eq(prev_total_rented.add(notify_amount))
            expect(new_rented_manager).to.be.eq(prev_rented_manager.add(notify_amount))

            await expect(notify_tx).to.emit(vault, 'NotifyRentedAmount').withArgs(
                podManager.address,
                pod1.address,
                notify_amount
            );

        });

        it(' should fail if the Manager has no current debt', async () => {

            await expect(
                vault.connect(depositor1).notifyRentedAmount(pod1.address, notify_amount)
            ).to.be.revertedWith('NotUndebtedManager')

        });

        it(' should fail if given address 0x0', async () => {

            await expect(
                vault.connect(podManager).notifyRentedAmount(ethers.constants.AddressZero, notify_amount)
            ).to.be.revertedWith('AddressZero')

        });

        it(' should fail if given address 0', async () => {

            await expect(
                vault.connect(podManager).notifyRentedAmount(pod1.address, 0)
            ).to.be.revertedWith('NullAmount')

        });

    });

    describe('pullRentedStkAave', async () => {

        const user1_deposit = ethers.utils.parseEther('1500')
        const user2_deposit = ethers.utils.parseEther('850')
        const user3_deposit = ethers.utils.parseEther('2100')

        const rent_amount = ethers.utils.parseEther('3200')
        const rent_amount2 = ethers.utils.parseEther('400')

        const notify_amount = ethers.utils.parseEther('75')

        const pull_amount = ethers.utils.parseEther('1500')

        beforeEach(async () => {

            const seed_deposit = ethers.utils.parseEther('0.001')
            await stkAave.connect(admin).approve(vault.address, seed_deposit)
            await vault.connect(admin).init(votingManager.address)

            await stkAave.connect(admin).transfer(depositor1.address, user1_deposit)
            await stkAave.connect(admin).transfer(depositor2.address, user2_deposit)
            await stkAave.connect(admin).transfer(depositor3.address, user3_deposit)

            await stkAave.connect(depositor1).approve(vault.address, MAX_UINT256)
            await stkAave.connect(depositor2).approve(vault.address, user2_deposit)
            await stkAave.connect(depositor3).approve(vault.address, user3_deposit)

            await vault.connect(depositor1).deposit(user1_deposit, depositor1.address)
            await vault.connect(depositor2).deposit(user2_deposit, depositor2.address)
            await vault.connect(depositor3).deposit(user3_deposit, depositor3.address)

            await vault.connect(admin).addPodManager(podManager.address)
            await vault.connect(admin).addPodManager(otherPodManager.address)

            await stkAave.connect(pod1).approve(vault.address, MAX_UINT256)
            await stkAave.connect(pod2).approve(vault.address, MAX_UINT256)

            await advanceTime(WEEK.mul(4).toNumber())

            await vault.connect(podManager).rentStkAave(pod1.address, rent_amount)
            await vault.connect(podManager).rentStkAave(pod2.address, rent_amount2)

            await advanceTime(WEEK.mul(2).toNumber())

            await vault.connect(podManager).notifyRentedAmount(pod1.address, notify_amount)

            await advanceTime(WEEK.toNumber())

        });

        it(' should pull the stkAave from the Pod correctly & updated the tracked rented amount (& emit event)', async () => {

            const prev_vault_balance = await stkAave.balanceOf(vault.address)
            const prev_pod_balance = await stkAave.balanceOf(pod1.address)

            const prev_total_rented = await vault.totalRentedAmount()
            const prev_rented_manager = (await vault.podManagers(podManager.address)).totalRented

            const pull_tx = await vault.connect(podManager).pullRentedStkAave(pod1.address, pull_amount)

            // Part stkAave reward claim & re-stake
            const receipt = await pull_tx.wait()
            const iface = stkAave_staking.interface;
            const topic = iface.getEventTopic('Staked')
            const staking_log = receipt.logs.filter(x => x.topics.indexOf(topic) >= 0);
            const staking_events = staking_log.map((log) => (iface.parseLog(log)).args)
            const stkAave_claim = staking_events[0].amount
            // --------------------------------------------------

            const new_vault_balance = await stkAave.balanceOf(vault.address)
            const new_pod_balance = await stkAave.balanceOf(pod1.address)

            const new_total_rented = await vault.totalRentedAmount()
            const new_rented_manager = (await vault.podManagers(podManager.address)).totalRented

            expect(new_vault_balance).to.be.eq(prev_vault_balance.add(stkAave_claim).add(pull_amount))
            expect(new_pod_balance).to.be.eq(prev_pod_balance.sub(pull_amount))

            expect(new_total_rented).to.be.eq(prev_total_rented.sub(pull_amount))
            expect(new_rented_manager).to.be.eq(prev_rented_manager.sub(pull_amount))

            await expect(pull_tx).to.emit(vault, 'PullFromPod').withArgs(
                podManager.address,
                pod1.address,
                pull_amount
            );

            await expect(pull_tx).to.emit(stkAave, 'Transfer').withArgs(
                pod1.address,
                vault.address,
                pull_amount
            );

        });

        it(' should allow to pull all rented stkAave from the Pods for a given manager', async () => {

            const prev_total_rented = await vault.totalRentedAmount()

            await vault.connect(podManager).pullRentedStkAave(pod1.address, rent_amount.add(notify_amount))
            await vault.connect(podManager).pullRentedStkAave(pod2.address, rent_amount2)

            expect(await vault.totalRentedAmount()).to.be.eq(prev_total_rented.sub(rent_amount.add(rent_amount2).add(notify_amount)))
            expect((await vault.podManagers(podManager.address)).totalRented).to.be.eq(0)

        });

        it(' should allow to pull on a blocked Pod Manager', async () => {

            await vault.connect(admin).blockPodManager(podManager.address)

            const prev_vault_balance = await stkAave.balanceOf(vault.address)
            const prev_pod_balance = await stkAave.balanceOf(pod1.address)

            const prev_total_rented = await vault.totalRentedAmount()
            const prev_rented_manager = (await vault.podManagers(podManager.address)).totalRented

            const pull_tx = await vault.connect(podManager).pullRentedStkAave(pod1.address, pull_amount)

            // Part stkAave reward claim & re-stake
            const receipt = await pull_tx.wait()
            const iface = stkAave_staking.interface;
            const topic = iface.getEventTopic('Staked')
            const staking_log = receipt.logs.filter(x => x.topics.indexOf(topic) >= 0);
            const staking_events = staking_log.map((log) => (iface.parseLog(log)).args)
            const stkAave_claim = staking_events[0].amount
            // --------------------------------------------------

            const new_vault_balance = await stkAave.balanceOf(vault.address)
            const new_pod_balance = await stkAave.balanceOf(pod1.address)

            const new_total_rented = await vault.totalRentedAmount()
            const new_rented_manager = (await vault.podManagers(podManager.address)).totalRented

            expect(new_vault_balance).to.be.eq(prev_vault_balance.add(stkAave_claim).add(pull_amount))
            expect(new_pod_balance).to.be.eq(prev_pod_balance.sub(pull_amount))

            expect(new_total_rented).to.be.eq(prev_total_rented.sub(pull_amount))
            expect(new_rented_manager).to.be.eq(prev_rented_manager.sub(pull_amount))

            await expect(pull_tx).to.emit(vault, 'PullFromPod').withArgs(
                podManager.address,
                pod1.address,
                pull_amount
            );

            await expect(pull_tx).to.emit(stkAave, 'Transfer').withArgs(
                pod1.address,
                vault.address,
                pull_amount
            );

        });

        it(' should fail if trying to pull more than the current rented amount', async () => {

            await expect(
                vault.connect(podManager).pullRentedStkAave(pod1.address, rent_amount.mul(2))
            ).to.be.revertedWith('AmountExceedsDebt')

        });

        it(' should fail if the maanger had no current rented amount', async () => {

            await expect(
                vault.connect(otherPodManager).pullRentedStkAave(pod2.address, pull_amount)
            ).to.be.revertedWith('NotUndebtedManager')

        });

        it(' should fail if given address 0x0', async () => {

            await expect(
                vault.connect(podManager).pullRentedStkAave(ethers.constants.AddressZero, rent_amount)
            ).to.be.revertedWith('AddressZero')

        });

        it(' should fail if given address 0', async () => {

            await expect(
                vault.connect(podManager).pullRentedStkAave(pod1.address, 0)
            ).to.be.revertedWith('NullAmount')

        });

    });

});