const hre = require("hardhat");
import { ethers } from "hardhat";
import chai from "chai";
import { BigNumber } from "ethers";
import { solidity } from "ethereum-waffle";
import { DullahanVault } from "../../typechain/DullahanVault";
import { DullahanRewardsStaking } from "../../typechain/DullahanRewardsStaking";
import { DullahanPodManager } from "../../typechain/DullahanPodManager";
import { DullahanPod } from "../../typechain/DullahanPod";
import { DullahanPod__factory } from "../../typechain/factories/DullahanPod__factory";
import { DullahanRegistry } from "../../typechain/modules/DullahanRegistry";
import { DullahanDiscountCalculator } from "../../typechain/modules/DullahanDiscountCalculator";
import { DullahanFeeModule } from "../../typechain/modules/DullahanFeeModule";
import { OracleModule } from "../../typechain/modules/OracleModule";
import { IERC20 } from "../../typechain/oz/interfaces/IERC20";
import { IERC20__factory } from "../../typechain/factories/oz/interfaces/IERC20__factory";
import { IStakedAave } from "../../typechain/interfaces/IStakedAave";
import { IStakedAave__factory } from "../../typechain/factories/interfaces/IStakedAave__factory";
import { IGovernancePowerDelegationToken } from "../../typechain/interfaces/IGovernancePowerDelegationToken";
import { IGovernancePowerDelegationToken__factory } from "../../typechain/factories/interfaces/IGovernancePowerDelegationToken__factory";
import { IAavePool } from "../../typechain/interfaces/IAavePool";
import { IAavePool__factory } from "../../typechain/factories/interfaces/IAavePool__factory";
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
    STK_AAVE,
    GHO,
    aGHO,
    DEBT_GHO,
    AAVE_POOL,
    AAVE_REWARD_CONTROLLER,
    ORACLE_ADDRESS,
    TEST_TOKEN_1,
    TEST_TOKEN_2,
    TEST_TOKEN_3,
    A_TOKEN_1,
    A_TOKEN_2,
    A_TOKEN_3
} from "../utils/testnet-constants"

chai.use(solidity);
const { expect } = chai;
const { provider } = ethers;

let vaultFactory: ContractFactory
let stakingFactory: ContractFactory
let oracleModuleFactory: ContractFactory
let registryFactory: ContractFactory
let managerFactory: ContractFactory
let podFactory: ContractFactory
let calculatorModuleFactory: ContractFactory
let feeModuleFactory: ContractFactory

const MAX_BPS = BigNumber.from('10000')
const MAX_UINT256 = ethers.constants.MaxUint256
const WEEK = BigNumber.from(7 * 86400);
const RAY = ethers.utils.parseEther('1000000000')
const UNIT = ethers.utils.parseEther('1')

const aave_amount = ethers.utils.parseEther('5000000')
const random_amount = ethers.utils.parseEther('15000000')

const DISTRIBUTION_DURATION = BigNumber.from(7 * 86400);

describe('Dullahan full system tests - Goerli version', () => {
    let admin: SignerWithAddress

    let vault: DullahanVault

    let staking: DullahanRewardsStaking

    let manager: DullahanPodManager

    let podImpl: DullahanPod

    let registry: DullahanRegistry

    let oracleModule: OracleModule
    let feeModule: DullahanFeeModule
    let calculatorModule: DullahanDiscountCalculator

    let feeChest: SignerWithAddress

    let reserveManager: SignerWithAddress
    let votingManager: SignerWithAddress

    let podOwner: SignerWithAddress

    let depositor1: SignerWithAddress
    let depositor2: SignerWithAddress
    let depositor3: SignerWithAddress

    let aave: IERC20
    let stkAave: IERC20
    let stkAave_staking: IStakedAave
    let stkAave_voting_power: IGovernancePowerDelegationToken

    let gho: IERC20
    let aGho: IERC20
    let debtGho: IERC20

    let token1: IERC20
    let token2: IERC20
    let token3: IERC20

    let aToken1: IERC20
    let aToken2: IERC20
    let aToken3: IERC20

    let aavePool: IAavePool

    const reserve_ratio = BigNumber.from(100)

    const start_fee = BigNumber.from('270000000')

    before(async () => {
        await resetForkGoerli();

        [admin, feeChest, reserveManager, votingManager, podOwner, depositor1, depositor2, depositor3] = await ethers.getSigners();

        vaultFactory = await ethers.getContractFactory("DullahanVault");
        stakingFactory = await ethers.getContractFactory("DullahanRewardsStaking");
        managerFactory = await ethers.getContractFactory("DullahanPodManager");
        podFactory = await ethers.getContractFactory("DullahanPod");
        oracleModuleFactory = await ethers.getContractFactory("OracleModule");
        registryFactory = await ethers.getContractFactory("DullahanRegistry");
        calculatorModuleFactory = await ethers.getContractFactory("DullahanDiscountCalculator");
        feeModuleFactory = await ethers.getContractFactory("DullahanFeeModule");

        aave = IERC20__factory.connect(AAVE, provider);
        stkAave = IERC20__factory.connect(STK_AAVE, provider);
        stkAave_staking = IStakedAave__factory.connect(STK_AAVE, provider);
        stkAave_voting_power = IGovernancePowerDelegationToken__factory.connect(STK_AAVE, provider);

        gho = IERC20__factory.connect(GHO, provider);
        aGho = IERC20__factory.connect(aGHO, provider);
        debtGho = IERC20__factory.connect(DEBT_GHO, provider);

        token1 = IERC20__factory.connect(TEST_TOKEN_1, provider);
        token2 = IERC20__factory.connect(TEST_TOKEN_2, provider);
        token3 = IERC20__factory.connect(TEST_TOKEN_3, provider);

        aToken1 = IERC20__factory.connect(A_TOKEN_1, provider);
        aToken2 = IERC20__factory.connect(A_TOKEN_2, provider);
        aToken3 = IERC20__factory.connect(A_TOKEN_3, provider);

        aavePool = IAavePool__factory.connect(AAVE_POOL, provider);

        await mintTokenStorage(AAVE, admin, aave_amount, 0);

        await mintTokenStorage(TEST_TOKEN_1, admin, random_amount, 0);
        await mintTokenStorage(TEST_TOKEN_3, admin, random_amount, 0);
        const token2_holder = "0xF8f5824FeC7CaFdc6aCefF219dE762b6f85B90b1"
        await getERC20(admin, token2_holder, token2, admin.address, ethers.utils.parseEther('1000'));

        await aave.connect(admin).approve(stkAave_staking.address, aave_amount);
        await stkAave_staking.connect(admin).stake(admin.address, aave_amount);

    });

    beforeEach(async () => {

        oracleModule = (await oracleModuleFactory.connect(admin).deploy(
            ORACLE_ADDRESS,
            GHO
        )) as OracleModule;
        await oracleModule.deployed();

        calculatorModule = (await calculatorModuleFactory.connect(admin).deploy()) as DullahanDiscountCalculator;
        await calculatorModule.deployed();

        registry = (await registryFactory.connect(admin).deploy(
            AAVE,
            STK_AAVE,
            GHO,
            DEBT_GHO,
            AAVE_POOL,
            AAVE_REWARD_CONTROLLER
        )) as DullahanRegistry;
        await registry.deployed();

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

        feeModule = (await feeModuleFactory.connect(admin).deploy(
            vault.address,
            start_fee
        )) as DullahanFeeModule;
        await feeModule.deployed();

        const seed_deposit = ethers.utils.parseEther('0.001')
        await stkAave.connect(admin).approve(vault.address, seed_deposit)
        await vault.connect(admin).init(votingManager.address)

        staking = (await stakingFactory.connect(admin).deploy(
            vault.address
        )) as DullahanRewardsStaking;
        await staking.deployed();

        podImpl = (await podFactory.connect(admin).deploy()) as DullahanPod;
        await podImpl.deployed();

        manager = (await managerFactory.connect(admin).deploy(
            vault.address,
            staking.address,
            feeChest.address,
            podImpl.address,
            registry.address,
            feeModule.address,
            oracleModule.address,
            calculatorModule.address
        )) as DullahanPodManager;
        await manager.deployed();

        await vault.connect(admin).approve(staking.address, ethers.constants.MaxUint256)
        await staking.connect(admin).init()

        await vault.connect(admin).addPodManager(manager.address)
        await staking.connect(admin).addRewardDepositor(manager.address)

        const user1_deposit = ethers.utils.parseEther('1500')
        const user2_deposit = ethers.utils.parseEther('850')
        const user3_deposit = ethers.utils.parseEther('2500')

        await stkAave.connect(admin).transfer(depositor1.address, user1_deposit)
        await stkAave.connect(admin).transfer(depositor2.address, user2_deposit)
        await stkAave.connect(admin).transfer(depositor3.address, user3_deposit)

        await stkAave.connect(depositor1).approve(vault.address, MAX_UINT256)
        await stkAave.connect(depositor2).approve(vault.address, user2_deposit)
        await stkAave.connect(depositor3).approve(vault.address, user3_deposit)

        await vault.connect(depositor1).deposit(user1_deposit, depositor1.address)
        await vault.connect(depositor2).deposit(user2_deposit, depositor2.address)
        await vault.connect(depositor3).deposit(user3_deposit, depositor3.address)

        await vault.connect(depositor1).approve(staking.address, MAX_UINT256)
        await vault.connect(depositor2).approve(staking.address, MAX_UINT256)
        await vault.connect(depositor3).approve(staking.address, MAX_UINT256)

        await staking.connect(depositor1).stake(ethers.constants.MaxUint256, depositor1.address)
        await staking.connect(depositor2).stake(ethers.constants.MaxUint256, depositor2.address)
        await staking.connect(depositor3).stake(ethers.constants.MaxUint256, depositor3.address)

        await manager.connect(admin).addCollateral(token1.address, aToken1.address)
        await manager.connect(admin).addCollateral(token2.address, aToken2.address)
        await manager.connect(admin).addCollateral(token3.address, aToken3.address)

    });

    describe('createPod', async () => {

        it(' should create a new Pod correctly', async () => {

            const create_tx = await manager.connect(podOwner).createPod(token1.address)

            const podList = await manager.getAllPods()
            const new_pod = DullahanPod__factory.connect(podList[podList.length - 1], provider);

            expect(await new_pod.initialized()).to.be.true

            expect(await new_pod.manager()).to.be.eq(manager.address)
            expect(await new_pod.vault()).to.be.eq(vault.address)
            expect(await new_pod.registry()).to.be.eq(registry.address)
            expect(await new_pod.collateral()).to.be.eq(token1.address)
            expect(await new_pod.aToken()).to.be.eq(aToken1.address)
            expect(await new_pod.podOwner()).to.be.eq(podOwner.address)
            expect(await new_pod.delegate()).to.be.eq(votingManager.address)
            expect(await new_pod.aave()).to.be.eq(aave.address)
            expect(await new_pod.stkAave()).to.be.eq(stkAave.address)

            const pod_data = await manager.pods(new_pod.address)

            expect(pod_data.podAddress).to.be.eq(new_pod.address)
            expect(pod_data.podOwner).to.be.eq(podOwner.address)
            expect(pod_data.collateral).to.be.eq(token1.address)

            expect(await stkAave.allowance(new_pod.address, vault.address)).to.be.eq(MAX_UINT256)

            expect(await stkAave_voting_power.getDelegateeByType(new_pod.address, 0)).to.be.eq(votingManager.address)
            expect(await stkAave_voting_power.getDelegateeByType(new_pod.address, 1)).to.be.eq(votingManager.address)

            await expect(create_tx).to.emit(manager, "PodCreation")
            .withArgs(token1.address, podOwner.address, new_pod.address);

            await expect(create_tx).to.emit(new_pod, "PodInitialized")
            .withArgs(
                manager.address,
                token1.address,
                podOwner.address,
                vault.address,
                registry.address,
                votingManager.address
            );

        });

    });

    describe('depositCollateral', async () => {

        const deposit_amount = ethers.utils.parseEther('1500')

        let pod: DullahanPod

        beforeEach(async () => {

            await manager.connect(podOwner).createPod(token1.address)

            const podList = await manager.getAllPods()
            pod = DullahanPod__factory.connect(podList[podList.length - 1], provider);

            await token1.connect(admin).transfer(podOwner.address, deposit_amount.mul(2))

            await token1.connect(podOwner).approve(pod.address, deposit_amount)

        });

        it(' should deposit the collateral in the Aave Pool correctly', async () => {

            const previous_pod_balance = await token1.balanceOf(pod.address)
            const previous_user_balance = await token1.balanceOf(podOwner.address)
            const previous_market_balance = await token1.balanceOf(aToken1.address)

            const previous_pod_aToken_balance = await aToken1.balanceOf(pod.address)

            const deposit_tx = await pod.connect(podOwner).depositCollateral(deposit_amount)

            const tx_block = (await deposit_tx).blockNumber
            const tx_timestamp = BigNumber.from((await ethers.provider.getBlock((await deposit_tx).blockNumber || 0)).timestamp)

            const new_pod_balance = await token1.balanceOf(pod.address)
            const new_user_balance = await token1.balanceOf(podOwner.address)
            const new_market_balance = await token1.balanceOf(aToken1.address)

            const new_pod_aToken_balance = await aToken1.balanceOf(pod.address, { blockTag: tx_block })

            expect(new_pod_balance).to.be.eq(previous_pod_balance)
            expect(new_user_balance).to.be.eq(previous_user_balance.sub(deposit_amount))
            expect(new_market_balance).to.be.eq(previous_market_balance.add(deposit_amount))

            expect(new_pod_aToken_balance).to.be.eq(previous_pod_aToken_balance.add(deposit_amount))

            expect(await manager.lastIndexUpdate()).to.be.eq(tx_timestamp)

            const aave_pool_pod_status = await aavePool.getUserAccountData(pod.address)

            expect(aave_pool_pod_status.totalCollateralBase).to.be.eq(150000000000) // because 1500 DAI & Base is 8 decimals in Aave Oracle
            expect(aave_pool_pod_status.totalDebtBase).to.be.eq(0)
            
            await expect(deposit_tx).to.emit(token1, "Transfer")
            .withArgs(podOwner.address, pod.address, deposit_amount);

            await expect(deposit_tx).to.emit(token1, "Approval")
            .withArgs(pod.address, AAVE_POOL, deposit_amount);

            await expect(deposit_tx).to.emit(token1, "Transfer")
            .withArgs(pod.address, aToken1.address, deposit_amount);

            await expect(deposit_tx).to.emit(pod, "CollateralDeposited")
            .withArgs(token1.address, deposit_amount);

        });

    });

    describe('mintGho', async () => {

        const deposit_amount = ethers.utils.parseEther('1500')
        const borrow_amount = ethers.utils.parseEther('700')

        let pod: DullahanPod

        beforeEach(async () => {

            await manager.connect(podOwner).createPod(token1.address)

            const podList = await manager.getAllPods()
            pod = DullahanPod__factory.connect(podList[podList.length - 1], provider);

            await token1.connect(admin).transfer(podOwner.address, deposit_amount.mul(2))

            await token1.connect(podOwner).approve(pod.address, deposit_amount)
            await pod.connect(podOwner).depositCollateral(deposit_amount)

        });

        it(' should borrow GHO correctly', async () => {

            const previous_pod_balance = await gho.balanceOf(pod.address)
            const previous_user_balance = await gho.balanceOf(podOwner.address)

            const previous_pod_debt = await debtGho.balanceOf(pod.address)

            const previous_pod_stkAave_balance = await stkAave.balanceOf(pod.address)

            const previous_pod_rented_amount = (await manager.pods(pod.address)).rentedAmount

            const previous_manager_balance = await gho.balanceOf(manager.address)
            const previous_manager_reserve = await manager.reserveAmount()

            const mint_tx = await pod.connect(podOwner).mintGho(borrow_amount, podOwner.address)

            const tx_block = (await mint_tx).blockNumber
            const tx_timestamp = BigNumber.from((await ethers.provider.getBlock((await mint_tx).blockNumber || 0)).timestamp)

            const new_pod_balance = await gho.balanceOf(pod.address)
            const new_user_balance = await gho.balanceOf(podOwner.address)

            const new_pod_debt = await debtGho.balanceOf(pod.address, { blockTag: tx_block })

            const fee_ratio = await manager.mintFeeRatio()
            const expected_amount = borrow_amount.mul(MAX_BPS.sub(fee_ratio)).div(MAX_BPS)
            const expected_fee_amount = borrow_amount.mul(fee_ratio).div(MAX_BPS)

            expect(new_pod_balance).to.be.eq(previous_pod_balance)
            expect(new_user_balance).to.be.eq(previous_user_balance.add(expected_amount))

            expect(new_pod_debt).to.be.eq(previous_pod_debt.add(borrow_amount))

            const new_manager_balance = await gho.balanceOf(manager.address)
            const new_manager_reserve = await manager.reserveAmount()

            expect(new_manager_balance).to.be.eq(previous_manager_balance.add(expected_fee_amount))
            expect(new_manager_reserve).to.be.eq(previous_manager_reserve.add(expected_fee_amount))

            const new_pod_stkAaave_balance = await stkAave.balanceOf(pod.address)

            const new_pod_rented_amount = (await manager.pods(pod.address)).rentedAmount

            const expected_rented_amount = ethers.utils.parseEther('7')

            expect(new_pod_stkAaave_balance).to.be.eq(previous_pod_stkAave_balance.add(expected_rented_amount))
            expect(new_pod_rented_amount).to.be.eq(previous_pod_rented_amount.add(expected_rented_amount))

            expect(await manager.lastIndexUpdate()).to.be.eq(tx_timestamp)

            await expect(mint_tx).to.emit(gho, "Transfer")
            .withArgs(pod.address, manager.address, expected_fee_amount);

            await expect(mint_tx).to.emit(stkAave, "Transfer")
            .withArgs(vault.address, pod.address, expected_rented_amount);

            await expect(mint_tx).to.emit(pod, "GhoMinted")
            .withArgs(expected_amount);

            await expect(mint_tx).to.emit(gho, "Transfer")
            .withArgs(pod.address, podOwner.address, expected_amount);

        });

    });

    describe('repayGho', async () => {

        const deposit_amount = ethers.utils.parseEther('1500')
        const borrow_amount = ethers.utils.parseEther('700')
        const repay_amount = ethers.utils.parseEther('150')

        let pod: DullahanPod

        beforeEach(async () => {

            await manager.connect(podOwner).createPod(token1.address)

            const podList = await manager.getAllPods()
            pod = DullahanPod__factory.connect(podList[podList.length - 1], provider);

            await token1.connect(admin).transfer(podOwner.address, deposit_amount.mul(2))

            await token1.connect(podOwner).approve(pod.address, deposit_amount)
            await pod.connect(podOwner).depositCollateral(deposit_amount)

            await pod.connect(podOwner).mintGho(borrow_amount, podOwner.address)

            await advanceTime(WEEK.mul(8).toNumber())

        });

        it(' should repay GHO correctly & free stkAAVE', async () => {

            await gho.connect(podOwner).approve(pod.address, repay_amount)

            await manager.connect(podOwner).updatePodState(pod.address)

            const previous_owed_fees = await manager.podOwedFees(pod.address)
            const previous_pod_debt = await debtGho.balanceOf(pod.address)

            const prev_reserve = await manager.reserveAmount()
            const prev_accrued_fees = (await manager.pods(pod.address)).accruedFees

            const previous_pod_stkAave_balance = await stkAave.balanceOf(pod.address)

            const previous_pod_rented_amount = (await manager.pods(pod.address)).rentedAmount

            const prev_pod_state = await manager.pods(pod.address)

            const repay_tx = await pod.connect(podOwner).repayGho(repay_amount)

            const tx_block = (await repay_tx).blockNumber
            const tx_timestamp = BigNumber.from((await ethers.provider.getBlock((await repay_tx).blockNumber || 0)).timestamp)

            const new_owed_fees = await manager.podOwedFees(pod.address)
            const new_pod_debt = await debtGho.balanceOf(pod.address)

            const last_global_index = await manager.lastUpdatedIndex()

            const expected_accrued_fees = prev_pod_state.rentedAmount.mul(
                last_global_index.sub(prev_pod_state.lastIndex)
            ).div(UNIT)
            const total_fees_repayed = previous_owed_fees.add(expected_accrued_fees)

            const expected_debt_repayed = repay_amount.sub(total_fees_repayed)

            const new_pod_stkAave_balance = await stkAave.balanceOf(pod.address)

            expect(new_owed_fees).to.be.eq(0)
            //expect(new_pod_debt).to.be.eq(previous_pod_debt.sub(expected_debt_repayed))

            await expect(repay_tx).to.emit(gho, "Transfer")
            .withArgs(podOwner.address, pod.address, repay_amount);

            await expect(repay_tx).to.emit(gho, "Transfer")
            .withArgs(pod.address, manager.address, total_fees_repayed);

            /*await expect(repay_tx).to.emit(gho, "Transfer")
            .withArgs(pod.address, aavePool.address, expected_debt_repayed);*/

            /*await expect(repay_tx).to.emit(debtGho, "Transfer")
            .withArgs(pod.address, ethers.constants.AddressZero, expected_debt_repayed);*/

            await expect(repay_tx).to.emit(pod, "GhoRepayed")
            .withArgs(repay_amount);

            const new_reserve = await manager.reserveAmount()
            const new_accrued_fees = (await manager.pods(pod.address)).accruedFees

            expect(new_accrued_fees).to.be.eq(prev_accrued_fees.sub(previous_owed_fees))
            expect(new_reserve).to.be.eq(prev_reserve.add(total_fees_repayed))

            await expect(repay_tx).to.emit(manager, "PaidFees")
            .withArgs(pod.address, total_fees_repayed);

            // We trust stkAave events for the amount claimed
            // but will compare it to transfers emitted
            const receipt = await repay_tx.wait()
            const iface = stkAave_staking.interface;
            const staking_topic = iface.getEventTopic('Staked')
            const staking_log = receipt.logs.filter(x => x.topics.indexOf(staking_topic) >= 0);
            const staking_events = staking_log.map((log) => (iface.parseLog(log)).args)
            const stkAave_staked = staking_events.length != 0 ? staking_events[0].amount : 0

            const gho_per_stkAave = ethers.utils.parseEther('100')

            const new_pod_rented_amount = (await manager.pods(pod.address)).rentedAmount
            const expected_current_rented_amount = new_pod_debt.mul(UNIT).add(gho_per_stkAave.div(2)).div(gho_per_stkAave)

            const returned_amount = previous_pod_stkAave_balance.add(stkAave_staked).sub(expected_current_rented_amount)

            expect(new_pod_stkAave_balance).to.be.eq(expected_current_rented_amount)
            expect(new_pod_rented_amount).to.be.eq(expected_current_rented_amount)

            await expect(repay_tx).to.emit(stkAave, "Transfer")
            .withArgs(pod.address, vault.address, returned_amount);

        });

        it(' should repay all GHO & return all stkAAVE', async () => {

            const holder = "0x61702cfe4f3d57CDeCDa15732ce7ccFF0529F2e0"
            await getERC20(admin, holder, gho, admin.address, ethers.utils.parseEther('50000'));

            await gho.connect(admin).transfer(podOwner.address, ethers.utils.parseEther('50000'))

            await gho.connect(podOwner).approve(pod.address, ethers.constants.MaxUint256)

            await pod.connect(podOwner).repayGho(ethers.constants.MaxUint256)

            expect(await manager.podOwedFees(pod.address)).to.be.eq(0)
            expect(await debtGho.balanceOf(pod.address)).to.be.eq(0)

            expect(await stkAave.balanceOf(pod.address)).to.be.eq(0)
            expect((await manager.pods(pod.address)).rentedAmount).to.be.eq(0)

        });

    });

    describe('withdrawCollateral', async () => {

        const deposit_amount = ethers.utils.parseEther('1500')
        const borrow_amount = ethers.utils.parseEther('700')
        const repay_amount = ethers.utils.parseEther('150')
        const withdraw_amount = ethers.utils.parseEther('200')

        let pod: DullahanPod

        beforeEach(async () => {

            const holder = "0x61702cfe4f3d57CDeCDa15732ce7ccFF0529F2e0"
            await getERC20(admin, holder, gho, admin.address, ethers.utils.parseEther('50000'));

            await gho.connect(admin).transfer(podOwner.address, ethers.utils.parseEther('50000'))

            await manager.connect(podOwner).createPod(token1.address)

            const podList = await manager.getAllPods()
            pod = DullahanPod__factory.connect(podList[podList.length - 1], provider);

            await token1.connect(admin).transfer(podOwner.address, deposit_amount.mul(2))

            await token1.connect(podOwner).approve(pod.address, deposit_amount)
            await pod.connect(podOwner).depositCollateral(deposit_amount)

            await pod.connect(podOwner).mintGho(borrow_amount, podOwner.address)

            await advanceTime(WEEK.mul(8).toNumber())

            await gho.connect(podOwner).approve(pod.address, ethers.constants.MaxUint256)

            await pod.connect(podOwner).repayGho(ethers.constants.MaxUint256)

        });

        it(' should withdraw collateral', async () => {

            const previous_pod_balance = await token1.balanceOf(pod.address)
            const previous_user_balance = await token1.balanceOf(podOwner.address)
            const previous_market_balance = await token1.balanceOf(aToken1.address)

            const previous_pod_aToken_balance = await aToken1.balanceOf(pod.address)

            const withdraw_tx = await pod.connect(podOwner).withdrawCollateral(withdraw_amount, podOwner.address)

            const tx_block = (await withdraw_tx).blockNumber
            const tx_timestamp = BigNumber.from((await ethers.provider.getBlock((await withdraw_tx).blockNumber || 0)).timestamp)

            const new_pod_balance = await token1.balanceOf(pod.address)
            const new_user_balance = await token1.balanceOf(podOwner.address)
            const new_market_balance = await token1.balanceOf(aToken1.address)

            const new_pod_aToken_balance = await aToken1.balanceOf(pod.address, { blockTag: tx_block })

            expect(new_pod_balance).to.be.eq(previous_pod_balance)
            expect(new_user_balance).to.be.eq(previous_user_balance.add(withdraw_amount))
            expect(new_market_balance).to.be.eq(previous_market_balance.sub(withdraw_amount))

            //expect(new_pod_aToken_balance).to.be.eq(previous_pod_aToken_balance.sub(withdraw_amount))

            expect(await manager.lastIndexUpdate()).to.be.eq(tx_timestamp)

            await expect(withdraw_tx).to.emit(token1, "Transfer")
            .withArgs(aToken1.address, podOwner.address, withdraw_amount);

            await expect(withdraw_tx).to.emit(pod, "CollateralWithdrawn")
            .withArgs(token1.address, withdraw_amount);

        
        });

        it(' should withdraw all collateral', async () => {

            await pod.connect(podOwner).withdrawCollateral(ethers.constants.MaxUint256, podOwner.address)
            
            expect(await aToken1.balanceOf(pod.address)).to.be.eq(0)
            expect(await token1.balanceOf(pod.address)).to.be.eq(0)
        
        });

    });

    describe('repayGhoAndWithdrawCollateral', async () => {

        const deposit_amount = ethers.utils.parseEther('1500')
        const borrow_amount = ethers.utils.parseEther('700')
        const repay_amount = ethers.utils.parseEther('150')
        const withdraw_amount = ethers.utils.parseEther('200')

        let pod: DullahanPod

        beforeEach(async () => {

            const holder = "0x61702cfe4f3d57CDeCDa15732ce7ccFF0529F2e0"
            await getERC20(admin, holder, gho, admin.address, ethers.utils.parseEther('50000'));

            await gho.connect(admin).transfer(podOwner.address, ethers.utils.parseEther('50000'))

            await manager.connect(podOwner).createPod(token1.address)

            const podList = await manager.getAllPods()
            pod = DullahanPod__factory.connect(podList[podList.length - 1], provider);

            await token1.connect(admin).transfer(podOwner.address, deposit_amount.mul(2))

            await token1.connect(podOwner).approve(pod.address, deposit_amount)
            await pod.connect(podOwner).depositCollateral(deposit_amount)

            await pod.connect(podOwner).mintGho(borrow_amount, podOwner.address)

            await advanceTime(WEEK.mul(8).toNumber())

            await gho.connect(podOwner).approve(pod.address, ethers.constants.MaxUint256)

        });

        it(' should repay fees & debt & withdraw collateral', async () => {

            await gho.connect(podOwner).approve(pod.address, repay_amount)

            await manager.connect(podOwner).updatePodState(pod.address)

            const previous_owed_fees = await manager.podOwedFees(pod.address)
            const previous_pod_debt = await debtGho.balanceOf(pod.address)

            const prev_reserve = await manager.reserveAmount()
            const prev_accrued_fees = (await manager.pods(pod.address)).accruedFees

            const previous_pod_stkAave_balance = await stkAave.balanceOf(pod.address)

            const previous_pod_balance = await token1.balanceOf(pod.address)
            const previous_user_balance = await token1.balanceOf(podOwner.address)
            const previous_market_balance = await token1.balanceOf(aToken1.address)

            const previous_pod_rented_amount = (await manager.pods(pod.address)).rentedAmount

            const prev_pod_state = await manager.pods(pod.address)

            const repay_tx = await pod.connect(podOwner).repayGhoAndWithdrawCollateral(repay_amount, withdraw_amount, podOwner.address)

            const tx_block = (await repay_tx).blockNumber
            const tx_timestamp = BigNumber.from((await ethers.provider.getBlock((await repay_tx).blockNumber || 0)).timestamp)

            const new_owed_fees = await manager.podOwedFees(pod.address)
            const new_pod_debt = await debtGho.balanceOf(pod.address)

            const last_global_index = await manager.lastUpdatedIndex()

            const expected_accrued_fees = prev_pod_state.rentedAmount.mul(
                last_global_index.sub(prev_pod_state.lastIndex)
            ).div(UNIT)
            const total_fees_repayed = previous_owed_fees.add(expected_accrued_fees)

            const expected_debt_repayed = repay_amount.sub(total_fees_repayed)

            const new_pod_stkAave_balance = await stkAave.balanceOf(pod.address)

            expect(new_owed_fees).to.be.eq(0)
            //expect(new_pod_debt).to.be.eq(previous_pod_debt.sub(expected_debt_repayed))

            await expect(repay_tx).to.emit(gho, "Transfer")
            .withArgs(podOwner.address, pod.address, repay_amount);

            await expect(repay_tx).to.emit(gho, "Transfer")
            .withArgs(pod.address, manager.address, total_fees_repayed);

            /*await expect(repay_tx).to.emit(gho, "Transfer")
            .withArgs(pod.address, aavePool.address, expected_debt_repayed);*/

            /*await expect(repay_tx).to.emit(debtGho, "Transfer")
            .withArgs(pod.address, ethers.constants.AddressZero, expected_debt_repayed);*/

            await expect(repay_tx).to.emit(pod, "GhoRepayed")
            .withArgs(repay_amount);

            const new_reserve = await manager.reserveAmount()
            const new_accrued_fees = (await manager.pods(pod.address)).accruedFees

            expect(new_accrued_fees).to.be.eq(prev_accrued_fees.sub(previous_owed_fees))
            expect(new_reserve).to.be.eq(prev_reserve.add(total_fees_repayed))

            await expect(repay_tx).to.emit(manager, "PaidFees")
            .withArgs(pod.address, total_fees_repayed);

            // We trust stkAave events for the amount claimed
            // but will compare it to transfers emitted
            const receipt = await repay_tx.wait()
            const iface = stkAave_staking.interface;
            const staking_topic = iface.getEventTopic('Staked')
            const staking_log = receipt.logs.filter(x => x.topics.indexOf(staking_topic) >= 0);
            const staking_events = staking_log.map((log) => (iface.parseLog(log)).args)
            const stkAave_staked = staking_events.length != 0 ? staking_events[0].amount : 0

            const gho_per_stkAave = ethers.utils.parseEther('100')

            const new_pod_rented_amount = (await manager.pods(pod.address)).rentedAmount
            const expected_current_rented_amount = new_pod_debt.mul(UNIT).add(gho_per_stkAave.div(2)).div(gho_per_stkAave)

            const returned_amount = previous_pod_stkAave_balance.add(stkAave_staked).sub(expected_current_rented_amount)

            expect(new_pod_stkAave_balance).to.be.eq(expected_current_rented_amount)
            expect(new_pod_rented_amount).to.be.eq(expected_current_rented_amount)

            await expect(repay_tx).to.emit(stkAave, "Transfer")
            .withArgs(pod.address, vault.address, returned_amount);const new_pod_balance = await token1.balanceOf(pod.address)
            const new_user_balance = await token1.balanceOf(podOwner.address)
            const new_market_balance = await token1.balanceOf(aToken1.address)

            const new_pod_aToken_balance = await aToken1.balanceOf(pod.address, { blockTag: tx_block })

            expect(new_pod_balance).to.be.eq(previous_pod_balance)
            expect(new_user_balance).to.be.eq(previous_user_balance.add(withdraw_amount))
            expect(new_market_balance).to.be.eq(previous_market_balance.sub(withdraw_amount))

            //expect(new_pod_aToken_balance).to.be.eq(previous_pod_aToken_balance.sub(withdraw_amount))

            expect(await manager.lastIndexUpdate()).to.be.eq(tx_timestamp)

            await expect(repay_tx).to.emit(token1, "Transfer")
            .withArgs(aToken1.address, podOwner.address, withdraw_amount);

            await expect(repay_tx).to.emit(pod, "CollateralWithdrawn")
            .withArgs(token1.address, withdraw_amount);

        });

        it(' should repay all & withdraw all collateral', async () => {

            await pod.connect(podOwner).repayGhoAndWithdrawCollateral(
                ethers.constants.MaxUint256,
                ethers.constants.MaxUint256,
                podOwner.address
            )

            expect(await manager.podOwedFees(pod.address)).to.be.eq(0)
            expect(await debtGho.balanceOf(pod.address)).to.be.eq(0)

            expect(await stkAave.balanceOf(pod.address)).to.be.eq(0)
            expect((await manager.pods(pod.address)).rentedAmount).to.be.eq(0)
            
            expect(await aToken1.balanceOf(pod.address)).to.be.eq(0)
            expect(await token1.balanceOf(pod.address)).to.be.eq(0)

        });

    });

    describe('processReserve', async () => {

        const deposit_amount = ethers.utils.parseEther('1500')
        const deposit_amount2 = ethers.utils.parseEther('350')
        const borrow_amount = ethers.utils.parseEther('700')
        const borrow_amount2 = ethers.utils.parseEther('1200')
        const repay_amount = ethers.utils.parseEther('500')

        let pod: DullahanPod
        let pod2: DullahanPod

        beforeEach(async () => {

            const holder = "0x61702cfe4f3d57CDeCDa15732ce7ccFF0529F2e0"
            await getERC20(admin, holder, gho, admin.address, ethers.utils.parseEther('50000'));

            await gho.connect(admin).transfer(podOwner.address, ethers.utils.parseEther('50000'))

            await manager.connect(podOwner).createPod(token1.address)
            await manager.connect(podOwner).createPod(token2.address)

            const podList = await manager.getAllPods()
            pod = DullahanPod__factory.connect(podList[podList.length - 2], provider);
            pod2 = DullahanPod__factory.connect(podList[podList.length - 1], provider);

            await token1.connect(admin).transfer(podOwner.address, deposit_amount.mul(2))
            await token2.connect(admin).transfer(podOwner.address, deposit_amount2.mul(2))

            await token1.connect(podOwner).approve(pod.address, deposit_amount)
            await pod.connect(podOwner).depositCollateral(deposit_amount)

            await token2.connect(podOwner).approve(pod2.address, deposit_amount2)
            await pod2.connect(podOwner).depositCollateral(deposit_amount2)

            await pod.connect(podOwner).mintGho(borrow_amount, podOwner.address)
            await pod2.connect(podOwner).mintGho(borrow_amount2, podOwner.address)

            await advanceTime(WEEK.mul(32).toNumber())

            await gho.connect(podOwner).approve(pod.address, ethers.constants.MaxUint256)
            await gho.connect(podOwner).approve(pod2.address, ethers.constants.MaxUint256)

            await pod.connect(podOwner).repayGho(repay_amount)
            await pod2.connect(podOwner).repayGho(repay_amount)

        });

        it(' should process reserve correctly and queue it as rewards', async () => {

            const protocol_fee_ratio = await manager.protocolFeeRatio()

            const prev_reserve = await manager.reserveAmount()

            const prev_manager_balance = await gho.balanceOf(manager.address)
            const prev_chest_balance = await gho.balanceOf(feeChest.address)
            const prev_staking_balance = await gho.balanceOf(staking.address)

            const process_tx = await manager.connect(admin).processReserve()

            const tx_ts = BigNumber.from((await provider.getBlock((await process_tx).blockNumber || 0)).timestamp)

            const new_reserve = await manager.reserveAmount()

            const new_manager_balance = await gho.balanceOf(manager.address)
            const new_chest_balance = await gho.balanceOf(feeChest.address)
            const new_staking_balance = await gho.balanceOf(staking.address)

            const expected_protocol_fees = prev_reserve.mul(protocol_fee_ratio).div(MAX_BPS)
            const expected_total_rewards = prev_reserve.sub(expected_protocol_fees)
            
            expect(new_reserve).to.be.eq(0)

            expect(new_manager_balance).to.be.eq(prev_manager_balance.sub(prev_reserve))
            expect(new_chest_balance).to.be.eq(prev_chest_balance.add(expected_protocol_fees))
            expect(new_staking_balance).to.be.eq(prev_staking_balance.add(expected_total_rewards))

            const expected_drop_per_sec = expected_total_rewards.div(DISTRIBUTION_DURATION)

            const new_reward_state = await staking.rewardStates(gho.address)

            expect(new_reward_state.ratePerSecond).to.be.eq(expected_drop_per_sec)
            expect(new_reward_state.currentRewardAmount).to.be.eq(expected_total_rewards)
            expect(new_reward_state.lastUpdate).to.be.eq(tx_ts)
            expect(new_reward_state.distributionEndTimestamp).to.be.eq(tx_ts.add(DISTRIBUTION_DURATION))
            expect(new_reward_state.queuedRewardAmount).to.be.eq(0)
            expect(new_reward_state.rewardPerToken).to.be.eq(0)

            expect(await staking.lastRewardUpdateTimestamp(gho.address)).to.be.eq(tx_ts)

            const reward_list = await staking.getRewardList()
            expect(reward_list[reward_list.length - 1]).to.be.eq(gho.address)

            await expect(process_tx).to.emit(gho, "Transfer")
            .withArgs(manager.address, feeChest.address, expected_protocol_fees);

            await expect(process_tx).to.emit(gho, "Transfer")
            .withArgs(manager.address, staking.address, expected_total_rewards);

            await expect(process_tx).to.emit(manager, "ReserveProcessed")
            .withArgs(expected_total_rewards);

            await expect(process_tx).to.emit(staking, "NewRewards")
            .withArgs(gho.address, expected_total_rewards, tx_ts.add(DISTRIBUTION_DURATION));

        });
    
    });

});