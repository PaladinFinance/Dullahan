const hre = require("hardhat");
import { ethers } from "hardhat";
import chai from "chai";
import { BigNumber } from "ethers";
import { solidity } from "ethereum-waffle";
import { DullahanPodManager } from "../../../typechain/DullahanPodManager";
import { MockERC20 } from "../../../typechain/test/MockERC20";
import { MockPod } from "../../../typechain/test/MockPod";
import { MockMarket } from "../../../typechain/test/MockMarket";
import { MockRewards } from "../../../typechain/test/MockRewards";
import { MockStakingRewards } from "../../../typechain/test/MockStakingRewards";
import { MockOracle } from "../../../typechain/test/MockOracle";
import { MockFeeModule } from "../../../typechain/test/MockFeeModule";
import { MockCalculator } from "../../../typechain/test/MockCalculator";
import { MockVault2 } from "../../../typechain/test/MockVault2";
import { DullahanRegistry } from "../../../typechain/modules/DullahanRegistry";
import { OracleModule } from "../../../typechain/modules/OracleModule";
import { MockPod__factory } from "../../../typechain/factories/test/MockPod__factory";
import { IERC20 } from "../../../typechain/oz/interfaces/IERC20";
import { IERC20__factory } from "../../../typechain/factories/oz/interfaces/IERC20__factory";
import { IStakedAave } from "../../../typechain/interfaces/IStakedAave";
import { IStakedAave__factory } from "../../../typechain/factories/interfaces/IStakedAave__factory";
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
    REWARD_TOKEN_2,
} from "../../utils/constants"

chai.use(solidity);
const { expect } = chai;
const { provider } = ethers;

let managerFactory: ContractFactory
let podFactory: ContractFactory
let registryFactory: ContractFactory
let tokenFactory: ContractFactory
let rewardsFactory: ContractFactory
let marketFactory: ContractFactory
let vaultFactory: ContractFactory
let oracleFactory: ContractFactory
let feeModuleFactory: ContractFactory
let stakingFactory: ContractFactory
let oracleModuleFactory: ContractFactory
let calculatorModuleFactory: ContractFactory

const UNIT = ethers.utils.parseEther('1')
const MAX_BPS = BigNumber.from('10000')
const MAX_UINT256 = ethers.constants.MaxUint256
const WEEK = BigNumber.from(7 * 86400);

describe('DullahanPodManager contract tests - user functions', () => {
    let admin: SignerWithAddress

    let manager: DullahanPodManager

    let podImpl: MockPod

    let vault: MockVault2
    let staking: MockStakingRewards

    let collat: MockERC20
    let aCollat: MockERC20
    let collat2: MockERC20
    let aCollat2: MockERC20

    let gho: MockERC20
    let ghoDebt: MockERC20

    let oracle: MockOracle
    let feeModule: MockFeeModule
    let oracleModule: OracleModule
    let calculatorModule: MockCalculator

    let feeChest: SignerWithAddress

    let market: MockMarket
    let rewardsController: MockRewards

    let aave: IERC20
    let stkAave: IERC20
    let stkAave_staking: IStakedAave

    let registry: DullahanRegistry

    let delegate: SignerWithAddress
    let delegate2: SignerWithAddress
    let podOwner: SignerWithAddress
    let otherUser: SignerWithAddress

    let newDelegate: SignerWithAddress
    let newDelegate2: SignerWithAddress

    let liquidator: SignerWithAddress

    const stkAave_calculation_ratio = ethers.utils.parseEther('50')

    before(async () => {
        await resetFork();

        [admin, feeChest, delegate, delegate2, podOwner, otherUser, newDelegate, newDelegate2, liquidator] = await ethers.getSigners();

        managerFactory = await ethers.getContractFactory("DullahanPodManager");
        podFactory = await ethers.getContractFactory("MockPod");
        tokenFactory = await ethers.getContractFactory("MockERC20");
        marketFactory = await ethers.getContractFactory("MockMarket");
        rewardsFactory = await ethers.getContractFactory("MockRewards");
        vaultFactory = await ethers.getContractFactory("MockVault2");
        registryFactory = await ethers.getContractFactory("DullahanRegistry");
        oracleFactory = await ethers.getContractFactory("MockOracle");
        feeModuleFactory = await ethers.getContractFactory("MockFeeModule");
        stakingFactory = await ethers.getContractFactory("MockStakingRewards");
        oracleModuleFactory = await ethers.getContractFactory("OracleModule");
        calculatorModuleFactory = await ethers.getContractFactory("MockCalculator");

        aave = IERC20__factory.connect(AAVE, provider);
        stkAave = IERC20__factory.connect(STK_AAVE, provider);
        stkAave_staking = IStakedAave__factory.connect(STK_AAVE, provider);

        await getERC20(admin, HOLDER_AAVE, aave, admin.address, AMOUNT_AAVE);

        await aave.connect(admin).approve(stkAave_staking.address, AMOUNT_AAVE);
        await stkAave_staking.connect(admin).stake(admin.address, AMOUNT_AAVE);

    });

    beforeEach(async () => {

        collat = (await tokenFactory.connect(admin).deploy("Collateral","COL")) as MockERC20;
        await collat.deployed();
        collat2 = (await tokenFactory.connect(admin).deploy("Collateral 2","COL2")) as MockERC20;
        await collat2.deployed();
        aCollat = (await tokenFactory.connect(admin).deploy("aToken Collateral","aCOL")) as MockERC20;
        await aCollat.deployed();
        aCollat2 = (await tokenFactory.connect(admin).deploy("aToken Collateral 2","aCOL2")) as MockERC20;
        await aCollat2.deployed();
        
        gho = (await tokenFactory.connect(admin).deploy("Mock GHO","GHO")) as MockERC20;
        await gho.deployed();
        ghoDebt = (await tokenFactory.connect(admin).deploy("Debt GHO","dGHO")) as MockERC20;
        await ghoDebt.deployed();

        oracle = (await oracleFactory.connect(admin).deploy()) as MockOracle;
        await oracle.deployed();
        feeModule = (await feeModuleFactory.connect(admin).deploy()) as MockFeeModule;
        await feeModule.deployed();
        calculatorModule = (await calculatorModuleFactory.connect(admin).deploy()) as MockCalculator;
        await calculatorModule.deployed();
        oracleModule = (await oracleModuleFactory.connect(admin).deploy(
            oracle.address,
            gho.address
        )) as OracleModule;
        await oracleModule.deployed();

        market = (await marketFactory.connect(admin).deploy(
            gho.address,
            ghoDebt.address
        )) as MockMarket;
        await market.deployed();

        rewardsController = (await rewardsFactory.connect(admin).deploy(
            REWARD_TOKEN_1,
            REWARD_TOKEN_2
        )) as MockRewards;
        await rewardsController.deployed();

        registry = (await registryFactory.connect(admin).deploy(
            aave.address,
            stkAave.address,
            gho.address,
            ghoDebt.address,
            market.address,
            rewardsController.address
        )) as DullahanRegistry;
        await registry.deployed();

        vault = (await vaultFactory.connect(admin).deploy(
            aave.address,
            stkAave.address
        )) as MockVault2;
        await vault.deployed();

        staking = (await stakingFactory.connect(admin).deploy()) as MockStakingRewards;
        await staking.deployed();

        podImpl = (await podFactory.connect(admin).deploy()) as MockPod;
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

        await vault.connect(admin).setManager(manager.address)
        await vault.connect(admin).setDelegates(delegate.address, delegate2.address)

        await market.connect(admin).addToken(collat.address, aCollat.address)
        await market.connect(admin).addToken(collat2.address, aCollat2.address)

        await manager.connect(admin).addCollateral(collat.address, aCollat.address)
        await manager.connect(admin).addCollateral(collat2.address, aCollat2.address)

    });

    it(' should be deployed & have correct parameters', async () => {
        expect(manager.address).to.properAddress

        expect(await manager.owner()).to.be.eq(admin.address)

        expect(await manager.vault()).to.be.eq(vault.address)
        expect(await manager.rewardsStaking()).to.be.eq(staking.address)
        expect(await manager.protocolFeeChest()).to.be.eq(feeChest.address)
        expect(await manager.podImplementation()).to.be.eq(podImpl.address)
        expect(await manager.registry()).to.be.eq(registry.address)
        expect(await manager.feeModule()).to.be.eq(feeModule.address)
        expect(await manager.oracleModule()).to.be.eq(oracleModule.address)
        expect(await manager.discountCalculator()).to.be.eq(calculatorModule.address)

        expect(await manager.extraLiquidationRatio()).to.be.eq(500)
        expect(await manager.mintFeeRatio()).to.be.eq(50)
        expect(await manager.protocolFeeRatio()).to.be.eq(1000)

    });

    describe('createPod', async () => {

        it(' should clone the Pod implementation & initialize it with correct parameters (& emit correct Event)', async () => {

            const clone_tx = await manager.connect(podOwner).createPod(collat.address)

            const podList = await manager.getAllPods()
            const new_pod = MockPod__factory.connect(podList[podList.length - 1], provider);

            expect(await new_pod.initialized()).to.be.true

            expect(await new_pod.manager()).to.be.eq(manager.address)
            expect(await new_pod.vault()).to.be.eq(vault.address)
            expect(await new_pod.registry()).to.be.eq(registry.address)
            expect(await new_pod.collateral()).to.be.eq(collat.address)
            expect(await new_pod.aToken()).to.be.eq(aCollat.address)
            expect(await new_pod.podOwner()).to.be.eq(podOwner.address)
            expect(await new_pod.votingPowerDelegate()).to.be.eq(delegate.address)
            expect(await new_pod.proposalPowerDelegate()).to.be.eq(delegate2.address)
            expect(await new_pod.aave()).to.be.eq(aave.address)
            expect(await new_pod.stkAave()).to.be.eq(stkAave.address)

            await expect(clone_tx).to.emit(manager, "PodCreation")
            .withArgs(collat.address, podOwner.address, new_pod.address);

        });

        it(' should list the new Pod & store the correct parameters', async () => {

            await manager.connect(podOwner).createPod(collat.address)

            const podList = await manager.getAllPods()
            const new_pod = MockPod__factory.connect(podList[podList.length - 1], provider);

            const pod_data = await manager.pods(new_pod.address)

            expect(pod_data.podAddress).to.be.eq(new_pod.address)
            expect(pod_data.podOwner).to.be.eq(podOwner.address)
            expect(pod_data.collateral).to.be.eq(collat.address)

        });

        it(' should allow to create other Pods', async () => {

            const clone_tx = await manager.connect(podOwner).createPod(collat.address)

            const clone_tx2 = await manager.connect(otherUser).createPod(collat2.address)

            const podList = await manager.getAllPods()
            const new_pod = MockPod__factory.connect(podList[podList.length - 2], provider);
            const new_pod2 = MockPod__factory.connect(podList[podList.length - 1], provider);

            const pod_data = await manager.pods(new_pod.address)

            expect(pod_data.podAddress).to.be.eq(new_pod.address)
            expect(pod_data.podOwner).to.be.eq(podOwner.address)
            expect(pod_data.collateral).to.be.eq(collat.address)

            const pod_data2 = await manager.pods(new_pod2.address)

            expect(pod_data2.podAddress).to.be.eq(new_pod2.address)
            expect(pod_data2.podOwner).to.be.eq(otherUser.address)
            expect(pod_data2.collateral).to.be.eq(collat2.address)

            await expect(clone_tx).to.emit(manager, "PodCreation")
            .withArgs(collat.address, podOwner.address, new_pod.address);

            await expect(clone_tx2).to.emit(manager, "PodCreation")
            .withArgs(collat2.address, otherUser.address, new_pod2.address);

        });

        it(' should update the global state correctly', async () => {

            const clone_tx = await manager.connect(podOwner).createPod(collat.address)

            const tx_timestamp = (await ethers.provider.getBlock((await clone_tx).blockNumber || 0)).timestamp

            expect(await manager.lastIndexUpdate()).to.be.eq(tx_timestamp)

        });

        it(' should fail if collateral is not allowed', async () => {

            await expect(
                manager.connect(podOwner).createPod(REWARD_TOKEN_1)
            ).to.be.revertedWith('CollateralNotAllowed')

        });

        it(' should fail if given address 0x0', async () => {

            await expect(
                manager.connect(podOwner).createPod(ethers.constants.AddressZero)
            ).to.be.revertedWith('AddressZero')

        });

    });

    describe('updateGlobalState', async () => {

        let pod: MockPod
        let pod2: MockPod

        beforeEach(async () => {

            await manager.connect(podOwner).createPod(collat.address)
            await manager.connect(podOwner).createPod(collat.address)
            const podList = await manager.getAllPods()
            pod = MockPod__factory.connect(podList[podList.length - 2], provider);
            pod2 = MockPod__factory.connect(podList[podList.length - 1], provider);

            await advanceTime(WEEK.mul(3).toNumber())

        });

        it(' should increase the index correctly & store the new state', async () => {

            const current_fee_per_sec = await feeModule.getCurrentFeePerSecond()

            const last_update_ts = await manager.lastIndexUpdate()
            const last_index = await manager.lastUpdatedIndex()

            const update_tx = await manager.connect(podOwner).updateGlobalState()

            const tx_timestamp = BigNumber.from((await ethers.provider.getBlock((await update_tx).blockNumber || 0)).timestamp)

            expect(await manager.lastIndexUpdate()).to.be.eq(tx_timestamp)

            const expected_index_increase = current_fee_per_sec.mul(tx_timestamp.sub(last_update_ts))

            expect(await manager.lastUpdatedIndex()).to.be.eq(last_index.add(expected_index_increase))

        });

    });

    describe('updatePodState', async () => {

        let pod: MockPod
        let pod2: MockPod

        beforeEach(async () => {

            const stkAave_vault_balance = ethers.utils.parseEther('1000')
            await stkAave.connect(admin).transfer(vault.address, stkAave_vault_balance)

            const previous_debt = ethers.utils.parseEther('3500')
            const previous_debt2 = ethers.utils.parseEther('1500')

            await manager.connect(podOwner).createPod(collat.address)
            await manager.connect(podOwner).createPod(collat.address)
            const podList = await manager.getAllPods()
            pod = MockPod__factory.connect(podList[podList.length - 2], provider);
            pod2 = MockPod__factory.connect(podList[podList.length - 1], provider);

            await pod.connect(podOwner).getStkAave(previous_debt)
            await ghoDebt.connect(admin).mint(pod.address, previous_debt)

            await pod2.connect(podOwner).getStkAave(previous_debt2)
            await ghoDebt.connect(admin).mint(pod2.address, previous_debt2)

            await advanceTime(WEEK.mul(3).toNumber())

        });

        it(' should update the global state correctly', async () => {

            const current_fee_per_sec = await feeModule.getCurrentFeePerSecond()

            const last_update_ts = await manager.lastIndexUpdate()
            const last_index = await manager.lastUpdatedIndex()

            const update_tx = await manager.connect(podOwner).updatePodState(pod.address)

            const tx_timestamp = BigNumber.from((await ethers.provider.getBlock((await update_tx).blockNumber || 0)).timestamp)

            expect(await manager.lastIndexUpdate()).to.be.eq(tx_timestamp)

            const expected_index_increase = current_fee_per_sec.mul(tx_timestamp.sub(last_update_ts))

            expect(await manager.lastUpdatedIndex()).to.be.eq(last_index.add(expected_index_increase))

        });

        it(' should update the Pod state correctly', async () => {

            const prev_pod_state = await manager.pods(pod.address)

            const update_tx = await manager.connect(podOwner).updatePodState(pod.address)

            const tx_timestamp = BigNumber.from((await ethers.provider.getBlock((await update_tx).blockNumber || 0)).timestamp)

            const new_pod_state = await manager.pods(pod.address)

            const last_global_index = await manager.lastUpdatedIndex()

            const expected_accrued_fees = prev_pod_state.rentedAmount.mul(
                last_global_index.sub(prev_pod_state.lastIndex)
            ).div(UNIT)

            expect(new_pod_state.lastIndex).to.be.eq(last_global_index)
            expect(new_pod_state.lastUpdate).to.be.eq(tx_timestamp)
            expect(new_pod_state.accruedFees).to.be.eq(prev_pod_state.accruedFees.add(expected_accrued_fees))

            expect(await manager.podOwedFees(pod.address)).to.be.eq(prev_pod_state.accruedFees.add(expected_accrued_fees))

        });

        it(' should not update the other Pod state', async () => {

            const prev_pod_state = await manager.pods(pod2.address)

            await manager.connect(podOwner).updatePodState(pod.address)

            const new_pod_state = await manager.pods(pod2.address)

            expect(new_pod_state.lastIndex).to.be.eq(prev_pod_state.lastIndex)
            expect(new_pod_state.lastUpdate).to.be.eq(prev_pod_state.lastUpdate)
            expect(new_pod_state.accruedFees).to.be.eq(prev_pod_state.accruedFees)

        });

    });

    describe('freeStkAave', async () => {

        let pod: MockPod
        let pod2: MockPod

        const stkAave_calculation_ratio = ethers.utils.parseEther('50')

        beforeEach(async () => {

            const stkAave_vault_balance = ethers.utils.parseEther('1000')
            await stkAave.connect(admin).transfer(vault.address, stkAave_vault_balance)

            const previous_debt = ethers.utils.parseEther('3500')
            const previous_debt2 = ethers.utils.parseEther('1500')

            await manager.connect(podOwner).createPod(collat.address)
            await manager.connect(podOwner).createPod(collat.address)
            const podList = await manager.getAllPods()
            pod = MockPod__factory.connect(podList[podList.length - 2], provider);
            pod2 = MockPod__factory.connect(podList[podList.length - 1], provider);

            await pod.connect(podOwner).getStkAave(previous_debt)
            await pod2.connect(podOwner).getStkAave(previous_debt2)

            await advanceTime(WEEK.mul(3).toNumber())

            const reduce_debt = ethers.utils.parseEther('750')
            await ghoDebt.connect(admin).burn(pod.address, reduce_debt)

        });

        it(' should pull back stkAave & update the tracked rent amount correctly (& emit correct Event)', async () => {

            const prev_rented_amount = (await manager.pods(pod.address)).rentedAmount
            const prev_pod_balance = await stkAave.balanceOf(pod.address)
            const prev_manager_balance = await stkAave.balanceOf(manager.address)
            const prev_vault_balance = await stkAave.balanceOf(vault.address)

            const pod_total_debt = await ghoDebt.balanceOf(pod.address)

            const free_tx = await manager.connect(otherUser).freeStkAave(pod.address)

            const receipt = await free_tx.wait()
            const iface = stkAave_staking.interface;
            const staking_topic = iface.getEventTopic('Staked')
            const staking_log = receipt.logs.filter(x => x.topics.indexOf(staking_topic) >= 0);
            const staking_events = staking_log.map((log) => (iface.parseLog(log)).args)
            const stkAave_staked = staking_events[0].shares

            const new_rented_amount = (await manager.pods(pod.address)).rentedAmount
            const new_pod_balance = await stkAave.balanceOf(pod.address)
            const new_manager_balance = await stkAave.balanceOf(manager.address)
            const new_vault_balance = await stkAave.balanceOf(vault.address)

            const expected_total_needed_stkAave = pod_total_debt.mul(UNIT).div(stkAave_calculation_ratio)

            const expected_stkAave_freed = prev_pod_balance.add(stkAave_staked).sub(expected_total_needed_stkAave)

            expect(new_pod_balance).to.be.eq(prev_pod_balance.add(stkAave_staked).sub(expected_stkAave_freed))
            expect(new_manager_balance).to.be.eq(prev_manager_balance)
            expect(new_vault_balance).to.be.eq(prev_vault_balance.add(expected_stkAave_freed))

            expect(new_rented_amount).to.be.eq(prev_rented_amount.add(stkAave_staked).sub(expected_stkAave_freed))

            await expect(free_tx).to.emit(stkAave, "Transfer")
            .withArgs(pod.address, vault.address, expected_stkAave_freed);

            await expect(free_tx).to.emit(manager, "FreedStkAave")
            .withArgs(pod.address, expected_stkAave_freed);

        });

        it(' should free all the stkAave if no more GHO debt in the Pod', async () => {

            await ghoDebt.connect(admin).burn(pod2.address, ethers.utils.parseEther('1500'))

            const prev_pod_balance = await stkAave.balanceOf(pod2.address)
            const prev_manager_balance = await stkAave.balanceOf(manager.address)
            const prev_vault_balance = await stkAave.balanceOf(vault.address)

            const free_tx = await manager.connect(otherUser).freeStkAave(pod2.address)

            const receipt = await free_tx.wait()
            const iface = stkAave_staking.interface;
            const staking_topic = iface.getEventTopic('Staked')
            const staking_log = receipt.logs.filter(x => x.topics.indexOf(staking_topic) >= 0);
            const staking_events = staking_log.map((log) => (iface.parseLog(log)).args)
            const stkAave_staked = staking_events[0].shares

            const expected_stkAave_freed = prev_pod_balance.add(stkAave_staked)

            expect(await stkAave.balanceOf(pod2.address)).to.be.eq(0)
            expect(await stkAave.balanceOf(manager.address)).to.be.eq(prev_manager_balance)
            expect(await stkAave.balanceOf(vault.address)).to.be.eq(prev_vault_balance.add(expected_stkAave_freed))

            expect((await manager.pods(pod2.address)).rentedAmount).to.be.eq(0)

            await expect(free_tx).to.emit(stkAave, "Transfer")
            .withArgs(pod2.address, vault.address, expected_stkAave_freed);

            await expect(free_tx).to.emit(manager, "FreedStkAave")
            .withArgs(pod2.address, expected_stkAave_freed);

        });

        it(' should not free any stkAave if more is needed in the Pod', async () => {

            await ghoDebt.connect(admin).mint(pod2.address, ethers.utils.parseEther('300'))

            const prev_pod_balance = await stkAave.balanceOf(pod2.address)
            const prev_manager_balance = await stkAave.balanceOf(manager.address)
            const prev_vault_balance = await stkAave.balanceOf(vault.address)

            const free_tx = await manager.connect(otherUser).freeStkAave(pod2.address)

            const receipt = await free_tx.wait()
            const iface = stkAave_staking.interface;
            const staking_topic = iface.getEventTopic('Staked')
            const staking_log = receipt.logs.filter(x => x.topics.indexOf(staking_topic) >= 0);
            const staking_events = staking_log.map((log) => (iface.parseLog(log)).args)
            const stkAave_staked = staking_events[0].shares

            expect(await stkAave.balanceOf(pod2.address)).to.be.eq(prev_pod_balance.add(stkAave_staked))
            expect(await stkAave.balanceOf(manager.address)).to.be.eq(prev_manager_balance)
            expect(await stkAave.balanceOf(vault.address)).to.be.eq(prev_vault_balance)

            await expect(free_tx).not.to.emit(manager, "FreedStkAave")

        });

        it(' should have trigger the compound stkAave on Pod', async () => {

            const free_tx = await manager.connect(otherUser).freeStkAave(pod.address)

            const tx_block = (await free_tx).blockNumber

            expect(await stkAave_staking.getTotalRewardsBalance(pod.address, { blockTag: tx_block })).to.be.eq(0)

            // We trust stkAave events for the amount claimed
            // but will compare it to transfers emitted
            const receipt = await free_tx.wait()
            const iface = stkAave_staking.interface;
            const staking_topic = iface.getEventTopic('Staked')
            const staking_log = receipt.logs.filter(x => x.topics.indexOf(staking_topic) >= 0);
            const staking_events = staking_log.map((log) => (iface.parseLog(log)).args)
            const stkAave_staked = staking_events[0].shares

            expect(stkAave_staked).to.be.gt(0)

            await expect(free_tx).to.emit(stkAave_staking, 'Staked').withArgs(
                pod.address,
                pod.address,
                stkAave_staked,
                stkAave_staked
            );

        });

        it(' should update the Pod state', async () => {

            const tx = await manager.connect(otherUser).freeStkAave(pod.address)

            const tx_timestamp = (await ethers.provider.getBlock((await tx).blockNumber || 0)).timestamp

            expect((await manager.pods(pod.address)).lastUpdate).to.be.eq(tx_timestamp)

        });

        it(' should fail if given an invalid Pod', async () => {

            await expect(
                manager.connect(otherUser).freeStkAave(otherUser.address)
            ).to.be.revertedWith('PodInvalid')

            await expect(
                manager.connect(otherUser).freeStkAave(ethers.constants.AddressZero)
            ).to.be.revertedWith('PodInvalid')

        });

    });

    describe('liquidatePod', async () => {

        let pod: MockPod
        let pod2: MockPod

        // Prices taken at arbitrary block, with block's ETH price :
        const collat1_price = ethers.utils.parseEther('0.00085') // consider 1 DAI == 1 $USD
        const collat2_price = ethers.utils.parseEther('1') // because Oracle base currency is in ETH
        const gho_price = ethers.utils.parseEther('0.00085') // because (in docs) hardcoded 1 GHO == 1 $USD

        beforeEach(async () => {

            const stkAave_vault_balance = ethers.utils.parseEther('1000')
            await stkAave.connect(admin).transfer(vault.address, stkAave_vault_balance)

            await oracle.connect(admin).setAssetPrice(collat.address, collat1_price)
            await oracle.connect(admin).setAssetPrice(collat2.address, collat2_price)
            await oracle.connect(admin).setAssetPrice(gho.address, gho_price)

            const collat_amount = ethers.utils.parseEther('8000')
            const collat_amount2 = ethers.utils.parseEther('5')

            const previous_debt = ethers.utils.parseEther('3500')
            const previous_debt2 = ethers.utils.parseEther('1500')

            /*await feeModule.connect(admin).setFeePerSec(
                ethers.utils.parseEther('0.00005')
            )*/

            await manager.connect(podOwner).createPod(collat.address)
            await manager.connect(otherUser).createPod(collat2.address)
            const podList = await manager.getAllPods()
            pod = MockPod__factory.connect(podList[podList.length - 2], provider);
            pod2 = MockPod__factory.connect(podList[podList.length - 1], provider);

            await collat.connect(admin).mint(podOwner.address, collat_amount)
            await collat2.connect(admin).mint(otherUser.address, collat_amount2)

            await collat.connect(podOwner).approve(pod.address, collat_amount)
            await collat2.connect(otherUser).approve(pod2.address, collat_amount2)

            await pod.connect(podOwner).depositCollateral(collat_amount)
            await pod2.connect(otherUser).depositCollateral(collat_amount2)

            await pod.connect(podOwner).getStkAave(previous_debt)
            await pod2.connect(podOwner).getStkAave(previous_debt2)

            await advanceTime(WEEK.mul(6).toNumber())

            await manager.connect(admin).updatePodState(pod.address)
            await manager.connect(admin).updatePodState(pod2.address)

            await ghoDebt.connect(admin).burn(pod.address, previous_debt)

            await gho.connect(admin).mint(liquidator.address, ethers.utils.parseEther('10000'))
            await gho.connect(liquidator).approve(manager.address, ethers.constants.MaxUint256)

        });

        it(' should return true if the Pod is liquidable', async () => {

            expect(
                await manager.isPodLiquidable(pod.address)
            ).to.be.true

            expect(
                await manager.isPodLiquidable(pod2.address)
            ).to.be.false

        });

        it(' should estimate the liquidation amounts correctly', async () => {

            const current_block = await ethers.provider.getBlockNumber()

            const liquidation_amounts = await manager.estimatePodLiquidationexternal(pod.address, { blockTag: current_block })

            const pod_owed_fees = await manager.podCurrentOwedFees(pod.address)

            const collat_amount_for_fees = pod_owed_fees.mul(gho_price).div(collat1_price)

            const collat_amount_with_penality = collat_amount_for_fees.add(
                collat_amount_for_fees.mul(await manager.extraLiquidationRatio()).div(MAX_BPS)
            )

            const expected_liquidator_paid_amount = pod_owed_fees

            expect(liquidation_amounts.collateralAmount).to.be.eq(collat_amount_with_penality)
            expect(liquidation_amounts.feeAmount).to.be.eq(expected_liquidator_paid_amount)

        });

        it(' should estimate the liquidation amounts correctly if there is enough collateral remaining', async () => {

            const small_remaining_collat = ethers.utils.parseEther('0.004')

            await advanceTime(WEEK.mul(6).toNumber())

            await ghoDebt.connect(admin).burn(pod2.address, await ghoDebt.balanceOf(pod2.address))
            await aCollat2.connect(admin).burn(pod2.address, (await aCollat2.balanceOf(pod2.address)).sub(small_remaining_collat))

            const current_block = await ethers.provider.getBlockNumber()

            const liquidation_amounts = await manager.estimatePodLiquidationexternal(pod2.address, { blockTag: current_block })

            const calculated_possible_fees = (
                (small_remaining_collat.mul(MAX_BPS)).div(MAX_BPS.add(await manager.extraLiquidationRatio()))
            ).mul(collat2_price).div(gho_price)

            expect(liquidation_amounts.collateralAmount).to.be.eq(small_remaining_collat)
            expect(liquidation_amounts.feeAmount).to.be.eq(calculated_possible_fees)

        });

        it(' should liquidate the collateral correctly & pull the fees from the Liquidator (& emit the correct Event)', async () => {

            const prev_pod_state = await manager.pods(pod.address)

            const prev_collat_balance_liquidator = await collat.balanceOf(liquidator.address)
            const prev_aCollat_balance_pod = await aCollat.balanceOf(pod.address)

            const prev_gho_balance_liquidator = await gho.balanceOf(liquidator.address)
            const prev_gho_balance_manager = await gho.balanceOf(manager.address)

            const prev_reserve = await manager.reserveAmount()

            const liquidate_tx = await manager.connect(liquidator).liquidatePod(pod.address)

            const tx_block = (await liquidate_tx).blockNumber

            const current_index = await manager.getCurrentIndex({ blockTag: tx_block })

            const expected_fee_amount = prev_pod_state.accruedFees.add(
                (current_index.sub(prev_pod_state.lastIndex)).mul(prev_pod_state.rentedAmount).div(UNIT)
            )

            const collat_amount_for_fees = expected_fee_amount.mul(gho_price).div(collat1_price)

            const expected_collat_amount = collat_amount_for_fees.add(
                collat_amount_for_fees.mul(await manager.extraLiquidationRatio()).div(MAX_BPS)
            )

            const new_pod_state = await manager.pods(pod.address)

            const new_collat_balance_liquidator = await collat.balanceOf(liquidator.address)
            const new_aCollat_balance_pod = await aCollat.balanceOf(pod.address)

            const new_gho_balance_liquidator = await gho.balanceOf(liquidator.address)
            const new_gho_balance_manager = await gho.balanceOf(manager.address)

            const new_reserve = await manager.reserveAmount()

            expect(new_pod_state.accruedFees).to.be.eq(0)

            expect(new_reserve).to.be.eq(prev_reserve.add(expected_fee_amount))

            expect(new_collat_balance_liquidator).to.be.eq(prev_collat_balance_liquidator.add(expected_collat_amount))
            expect(new_aCollat_balance_pod).to.be.eq(prev_aCollat_balance_pod.sub(expected_collat_amount))

            expect(new_gho_balance_liquidator).to.be.eq(prev_gho_balance_liquidator.sub(expected_fee_amount))
            expect(new_gho_balance_manager).to.be.eq(prev_gho_balance_manager.add(expected_fee_amount))

            await expect(liquidate_tx).to.emit(manager, "LiquidatedPod")
            .withArgs(pod.address, collat.address, expected_collat_amount, expected_fee_amount);

            await expect(liquidate_tx).to.emit(gho, "Transfer")
            .withArgs(liquidator.address, manager.address, expected_fee_amount);

            await expect(liquidate_tx).to.emit(collat, "Transfer")
            .withArgs(pod.address, liquidator.address, expected_collat_amount);

        });

        it(' should liquidate all the collateral correctly if not enough left & pull the correct fees from the Liquidator (& emit the correct Event)', async () => {

            const small_remaining_collat = ethers.utils.parseEther('0.004')

            await advanceTime(WEEK.mul(6).toNumber())

            await ghoDebt.connect(admin).burn(pod2.address, await ghoDebt.balanceOf(pod2.address))
            await aCollat2.connect(admin).burn(pod2.address, (await aCollat2.balanceOf(pod2.address)).sub(small_remaining_collat))

            const prev_collat_balance_liquidator = await collat2.balanceOf(liquidator.address)
            const prev_aCollat_balance_pod = await aCollat2.balanceOf(pod2.address)

            const prev_gho_balance_liquidator = await gho.balanceOf(liquidator.address)
            const prev_gho_balance_manager = await gho.balanceOf(manager.address)

            const prev_reserve = await manager.reserveAmount()

            const liquidate_tx = await manager.connect(liquidator).liquidatePod(pod2.address)

            const expected_collat_amount = small_remaining_collat

            const expected_fee_amount = (
                (small_remaining_collat.mul(MAX_BPS)).div(MAX_BPS.add(await manager.extraLiquidationRatio()))
            ).mul(collat2_price).div(gho_price)

            const new_pod_state = await manager.pods(pod2.address)

            const new_collat_balance_liquidator = await collat2.balanceOf(liquidator.address)
            const new_aCollat_balance_pod = await aCollat2.balanceOf(pod2.address)

            const new_gho_balance_liquidator = await gho.balanceOf(liquidator.address)
            const new_gho_balance_manager = await gho.balanceOf(manager.address)

            const new_reserve = await manager.reserveAmount()

            expect(new_pod_state.accruedFees).to.be.eq(0)

            expect(new_reserve).to.be.eq(prev_reserve.add(expected_fee_amount))

            expect(new_collat_balance_liquidator).to.be.eq(prev_collat_balance_liquidator.add(expected_collat_amount))
            expect(new_aCollat_balance_pod).to.be.eq(prev_aCollat_balance_pod.sub(expected_collat_amount))
            expect(new_aCollat_balance_pod).to.be.eq(0)

            expect(new_gho_balance_liquidator).to.be.eq(prev_gho_balance_liquidator.sub(expected_fee_amount))
            expect(new_gho_balance_manager).to.be.eq(prev_gho_balance_manager.add(expected_fee_amount))

            await expect(liquidate_tx).to.emit(manager, "LiquidatedPod")
            .withArgs(pod2.address, collat2.address, expected_collat_amount, expected_fee_amount);

            await expect(liquidate_tx).to.emit(gho, "Transfer")
            .withArgs(liquidator.address, manager.address, expected_fee_amount);

            await expect(liquidate_tx).to.emit(collat2, "Transfer")
            .withArgs(pod2.address, liquidator.address, expected_collat_amount);

        });

        it(' should compound the stkAave rewards correctly for the Pod & free the Pod stkAave balance correctly', async () => {

            const prev_pod_balance = await stkAave.balanceOf(pod.address)
            const prev_manager_balance = await stkAave.balanceOf(manager.address)
            const prev_vault_balance = await stkAave.balanceOf(vault.address)

            const liquidate_tx = await manager.connect(liquidator).liquidatePod(pod.address)

            const receipt = await liquidate_tx.wait()
            const iface = stkAave_staking.interface;
            const staking_topic = iface.getEventTopic('Staked')
            const staking_log = receipt.logs.filter(x => x.topics.indexOf(staking_topic) >= 0);
            const staking_events = staking_log.map((log) => (iface.parseLog(log)).args)
            const stkAave_staked = staking_events[0].shares

            const expected_stkAave_freed = prev_pod_balance.add(stkAave_staked)

            expect(await stkAave.balanceOf(pod.address)).to.be.eq(0)
            expect(await stkAave.balanceOf(manager.address)).to.be.eq(prev_manager_balance)
            expect(await stkAave.balanceOf(vault.address)).to.be.eq(prev_vault_balance.add(expected_stkAave_freed))

            expect((await manager.pods(pod.address)).rentedAmount).to.be.eq(0)

            await expect(liquidate_tx).to.emit(stkAave, "Transfer")
            .withArgs(pod.address, vault.address, expected_stkAave_freed);

            await expect(liquidate_tx).to.emit(manager, "FreedStkAave")
            .withArgs(pod.address, expected_stkAave_freed);

        });

        it(' should update the Pod state', async () => {

            const tx = manager.connect(liquidator).liquidatePod(pod.address)

            const tx_timestamp = (await ethers.provider.getBlock((await tx).blockNumber || 0)).timestamp

            expect((await manager.pods(pod.address)).lastUpdate).to.be.eq(tx_timestamp)

        });

        it(' should fail if Pod is not liquidable', async () => {

            await expect(
                manager.connect(liquidator).liquidatePod(pod2.address)
            ).to.be.revertedWith('PodNotLiquidable')

        });

        it(' should fail if given an invalid Pod', async () => {

            await expect(
                manager.connect(liquidator).liquidatePod(otherUser.address)
            ).to.be.revertedWith('PodInvalid')

        });

    });

    describe('updatePodDelegation', async () => {

        let pod: MockPod

        beforeEach(async () => {
            
            await manager.connect(podOwner).createPod(collat.address)
            const podList = await manager.getAllPods()
            pod = MockPod__factory.connect(podList[podList.length - 1], provider);

            await vault.connect(admin).setDelegates(newDelegate.address, newDelegate2.address)
    
        });
        
        it(' should update the Pod delegate correctly', async () => {
            
            expect(await pod.votingPowerDelegate()).to.be.eq(delegate.address)
            expect(await pod.proposalPowerDelegate()).to.be.eq(delegate2.address)

            await manager.connect(admin).updatePodDelegation(pod.address)
            
            expect(await pod.votingPowerDelegate()).to.be.eq(newDelegate.address)
            expect(await pod.proposalPowerDelegate()).to.be.eq(newDelegate2.address)
    
        });
        
        it(' should fail if the given Pod address is invalid', async () => {
            
            await expect(
                manager.connect(admin).updatePodDelegation(otherUser.address)
            ).to.be.revertedWith('PodInvalid')
    
        });

    });

    describe('updateMultiplePodsDelegation', async () => {

        let pod: MockPod
        let pod2: MockPod
        let pod3: MockPod

        beforeEach(async () => {
            
            await manager.connect(podOwner).createPod(collat.address)
            await manager.connect(podOwner).createPod(collat.address)
            await manager.connect(podOwner).createPod(collat.address)
            const podList = await manager.getAllPods()
            pod = MockPod__factory.connect(podList[podList.length - 3], provider);
            pod2 = MockPod__factory.connect(podList[podList.length - 2], provider);
            pod3 = MockPod__factory.connect(podList[podList.length - 1], provider);

            await vault.connect(admin).setDelegates(newDelegate.address, newDelegate2.address)
    
        });
        
        it(' should update the Pods delegate correctly', async () => {
            
            expect(await pod.votingPowerDelegate()).to.be.eq(delegate.address)
            expect(await pod2.votingPowerDelegate()).to.be.eq(delegate.address)
            expect(await pod3.votingPowerDelegate()).to.be.eq(delegate.address)
            
            expect(await pod.proposalPowerDelegate()).to.be.eq(delegate2.address)
            expect(await pod2.proposalPowerDelegate()).to.be.eq(delegate2.address)
            expect(await pod3.proposalPowerDelegate()).to.be.eq(delegate2.address)

            await manager.connect(admin).updateMultiplePodsDelegation([pod.address, pod2.address])
            
            expect(await pod.votingPowerDelegate()).to.be.eq(newDelegate.address)
            expect(await pod2.votingPowerDelegate()).to.be.eq(newDelegate.address)
            expect(await pod3.votingPowerDelegate()).to.be.eq(delegate.address)
            
            expect(await pod.proposalPowerDelegate()).to.be.eq(newDelegate2.address)
            expect(await pod2.proposalPowerDelegate()).to.be.eq(newDelegate2.address)
            expect(await pod3.proposalPowerDelegate()).to.be.eq(delegate2.address)
    
        });
        
        it(' should fail if given an invalid Pod address', async () => {
            
            await expect(
                manager.connect(admin).updateMultiplePodsDelegation([pod.address, otherUser.address])
            ).to.be.revertedWith('PodInvalid')
    
        });

    });

    describe('processReserve', async () => {

        let pod: MockPod
        let pod2: MockPod

        beforeEach(async () => {

            await manager.connect(admin).updateProcessThreshold(ethers.utils.parseEther('5000'))

            const stkAave_vault_balance = ethers.utils.parseEther('1000')
            await stkAave.connect(admin).transfer(vault.address, stkAave_vault_balance)

            const previous_debt = ethers.utils.parseEther('350')
            const previous_debt2 = ethers.utils.parseEther('150')

            await feeModule.connect(admin).setFeePerSec(
                ethers.utils.parseEther('0.00005')
            )

            await manager.connect(podOwner).createPod(collat.address)
            await manager.connect(otherUser).createPod(collat.address)
            const podList = await manager.getAllPods()
            pod = MockPod__factory.connect(podList[podList.length - 2], provider);
            pod2 = MockPod__factory.connect(podList[podList.length - 1], provider);

            await pod.connect(podOwner).getStkAave(previous_debt)
            await pod2.connect(podOwner).getStkAave(previous_debt2)

            await advanceTime(WEEK.mul(6).toNumber())

            await manager.connect(admin).updatePodState(pod.address)
            await manager.connect(admin).updatePodState(pod2.address)

            const paid_fees1 = await manager.podOwedFees(pod.address)
            const paid_fees2 = await manager.podOwedFees(pod2.address)
            await pod.connect(podOwner).payFee(paid_fees1)
            await pod2.connect(otherUser).payFee(paid_fees2)
            // need to mimic fees payed since MockPod does not
            await gho.connect(admin).mint(manager.address, paid_fees1.add(paid_fees2))

        });

        it(' should process the reserve correctly & queue the correct amount of rewards (& emit correct Event)', async () => {

            const protocol_fee_ratio = await manager.protocolFeeRatio()

            const prev_reserve = await manager.reserveAmount()

            const prev_manager_balance = await gho.balanceOf(manager.address)
            const prev_chest_balance = await gho.balanceOf(feeChest.address)
            const prev_staking_balance = await gho.balanceOf(staking.address)

            const process_tx = await manager.connect(otherUser).processReserve()

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

            await expect(process_tx).to.emit(gho, "Transfer")
            .withArgs(manager.address, feeChest.address, expected_protocol_fees);

            await expect(process_tx).to.emit(gho, "Transfer")
            .withArgs(manager.address, staking.address, expected_total_rewards);

            await expect(process_tx).to.emit(manager, "ReserveProcessed")
            .withArgs(expected_total_rewards);

        });

        it(' should update the global state correctly', async () => {

            const clone_tx = await manager.connect(podOwner).createPod(collat.address)

            const tx_timestamp = (await ethers.provider.getBlock((await clone_tx).blockNumber || 0)).timestamp

            expect(await manager.lastIndexUpdate()).to.be.eq(tx_timestamp)

        });

        it(' should not process of the reserve is already empty', async () => {

            await manager.connect(otherUser).processReserve()

            const prev_reserve = await manager.reserveAmount()
            
            expect(prev_reserve).to.be.eq(0)

            const prev_manager_balance = await gho.balanceOf(manager.address)
            const prev_chest_balance = await gho.balanceOf(feeChest.address)
            const prev_staking_balance = await gho.balanceOf(staking.address)

            const process_tx = await manager.connect(otherUser).processReserve()

            const new_reserve = await manager.reserveAmount()

            const new_manager_balance = await gho.balanceOf(manager.address)
            const new_chest_balance = await gho.balanceOf(feeChest.address)
            const new_staking_balance = await gho.balanceOf(staking.address)
            
            expect(new_reserve).to.be.eq(0)

            expect(new_manager_balance).to.be.eq(prev_manager_balance)
            expect(new_chest_balance).to.be.eq(prev_chest_balance)
            expect(new_staking_balance).to.be.eq(prev_staking_balance)

            await expect(process_tx).not.to.emit(gho, "Transfer")

            await expect(process_tx).not.to.emit(manager, "ReserveProcessed")

        });

    });

});