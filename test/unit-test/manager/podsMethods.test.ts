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
import { MockOracle } from "../../../typechain/test/MockOracle";
import { MockFeeModule } from "../../../typechain/test/MockFeeModule";
import { MockCalculator } from "../../../typechain/test/MockCalculator";
import { MockVault2 } from "../../../typechain/test/MockVault2";
import { MockStakingRewards } from "../../../typechain/test/MockStakingRewards";
import { DullahanRegistry } from "../../../typechain/modules/DullahanRegistry";
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
let calculatorModuleFactory: ContractFactory
let feeModuleFactory: ContractFactory
let stakingFactory: ContractFactory

const UNIT = ethers.utils.parseEther('1')
const MAX_BPS = BigNumber.from('10000')
const MAX_UINT256 = ethers.constants.MaxUint256
const WEEK = BigNumber.from(7 * 86400);

describe('DullahanPodManager contract tests - Pods only functions', () => {
    let admin: SignerWithAddress

    let manager: DullahanPodManager

    let podImpl: MockPod
    let pod: MockPod
    let pod2: MockPod
    let pod3: MockPod

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
    let calculatorModule: MockCalculator

    let feeChest: SignerWithAddress

    let market: MockMarket
    let rewardsController: MockRewards

    let aave: IERC20
    let stkAave: IERC20
    let stkAave_staking: IStakedAave

    let registry: DullahanRegistry

    let delegate: SignerWithAddress
    let podOwner: SignerWithAddress
    let otherUser: SignerWithAddress

    const stkAave_calculation_ratio = ethers.utils.parseEther('50')

    before(async () => {
        await resetFork();

        [admin, feeChest, delegate, podOwner, otherUser] = await ethers.getSigners();

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
            oracle.address,
            calculatorModule.address
        )) as DullahanPodManager;
        await manager.deployed();

        await vault.connect(admin).setManager(manager.address)
        await vault.connect(admin).setDelegate(delegate.address)

        await market.connect(admin).addToken(collat.address, aCollat.address)
        await market.connect(admin).addToken(collat2.address, aCollat2.address)

        await manager.connect(admin).addCollateral(collat.address, aCollat.address)
        await manager.connect(admin).addCollateral(collat2.address, aCollat2.address)
            
        await manager.connect(podOwner).createPod(collat.address)
        await manager.connect(podOwner).createPod(collat.address)
        await manager.connect(podOwner).createPod(collat.address)
        const podList = await manager.getAllPods()
        pod = MockPod__factory.connect(podList[podList.length - 3], provider);
        pod2 = MockPod__factory.connect(podList[podList.length - 2], provider);
        pod3 = MockPod__factory.connect(podList[podList.length - 1], provider);

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
        expect(await manager.oracleModule()).to.be.eq(oracle.address)
        expect(await manager.discountCalculator()).to.be.eq(calculatorModule.address)

        expect(await manager.extraLiquidationRatio()).to.be.eq(500)
        expect(await manager.mintFeeRatio()).to.be.eq(50)
        expect(await manager.protocolFeeRatio()).to.be.eq(1000)

    });

    describe('getStkAave', async () => {

        const stkAave_vault_balance = ethers.utils.parseEther('1000')

        const previous_debt = ethers.utils.parseEther('1500')
        const added_debt = ethers.utils.parseEther('250')

        beforeEach(async () => {

            await ghoDebt.connect(admin).mint(pod.address, previous_debt)

            await stkAave.connect(admin).transfer(vault.address, stkAave_vault_balance)

        });
        
        it(' should calculate and rent stkAave to the Pod (& emit correct Event)', async () => {

            const prev_pod_stkAave_balance = await stkAave.balanceOf(pod.address)
            const prev_manager_stkAave_balance = await stkAave.balanceOf(manager.address)
            const prev_vault_stkAave_balance = await stkAave.balanceOf(vault.address)

            const prev_pod_rented_amount = (await manager.pods(pod.address)).rentedAmount

            const total_expected_debt = previous_debt.add(added_debt)

            const tx = await pod.connect(podOwner).getStkAave(added_debt)

            const expected_rent_amount = total_expected_debt.mul(UNIT).div(stkAave_calculation_ratio)

            const new_pod_stkAave_balance = await stkAave.balanceOf(pod.address)
            const new_manager_stkAave_balance = await stkAave.balanceOf(manager.address)
            const new_vault_stkAave_balance = await stkAave.balanceOf(vault.address)

            const new_pod_rented_amount = (await manager.pods(pod.address)).rentedAmount

            expect(new_pod_stkAave_balance).to.be.eq(prev_pod_stkAave_balance.add(expected_rent_amount))
            expect(new_manager_stkAave_balance).to.be.eq(prev_manager_stkAave_balance)
            expect(new_vault_stkAave_balance).to.be.eq(prev_vault_stkAave_balance.sub(expected_rent_amount))

            expect(new_pod_rented_amount).to.be.eq(prev_pod_rented_amount.add(expected_rent_amount))

            await expect(tx).to.emit(stkAave, "Transfer")
            .withArgs(vault.address, pod.address, expected_rent_amount);

            await expect(tx).to.emit(manager, "RentedStkAave")
            .withArgs(pod.address, expected_rent_amount);

        });
        
        it(' should update the Pod state correctly', async () => {

            const tx = await pod.connect(podOwner).getStkAave(added_debt)

            const tx_timestamp = (await ethers.provider.getBlock((await tx).blockNumber || 0)).timestamp

            expect((await manager.pods(pod.address)).lastUpdate).to.be.eq(tx_timestamp)

        });
        
        it(' should not rent stkAave if the Vault has no available', async () => {

            await vault.connect(admin).withdrawStkAave(stkAave_vault_balance)

            const prev_pod_stkAave_balance = await stkAave.balanceOf(pod.address)
            const prev_manager_stkAave_balance = await stkAave.balanceOf(manager.address)
            const prev_vault_stkAave_balance = await stkAave.balanceOf(vault.address)

            const prev_pod_rented_amount = (await manager.pods(pod.address)).rentedAmount

            const tx = await pod.connect(podOwner).getStkAave(added_debt)

            const new_pod_stkAave_balance = await stkAave.balanceOf(pod.address)
            const new_manager_stkAave_balance = await stkAave.balanceOf(manager.address)
            const new_vault_stkAave_balance = await stkAave.balanceOf(vault.address)

            const new_pod_rented_amount = (await manager.pods(pod.address)).rentedAmount

            expect(new_pod_stkAave_balance).to.be.eq(prev_pod_stkAave_balance)
            expect(new_manager_stkAave_balance).to.be.eq(prev_manager_stkAave_balance)
            expect(new_vault_stkAave_balance).to.be.eq(prev_vault_stkAave_balance)

            expect(new_pod_rented_amount).to.be.eq(prev_pod_rented_amount)

            await expect(tx).not.to.emit(stkAave, "Transfer")

            await expect(tx).not.to.emit(manager, "RentedStkAave")

        });
        
        it(' should take all available if Vault does not have enough for calculated amount', async () => {

            const vault_small_available_amount = ethers.utils.parseEther('10')

            await vault.connect(admin).withdrawStkAave(stkAave_vault_balance.sub(vault_small_available_amount))

            const prev_pod_stkAave_balance = await stkAave.balanceOf(pod.address)
            const prev_manager_stkAave_balance = await stkAave.balanceOf(manager.address)
            const prev_vault_stkAave_balance = await stkAave.balanceOf(vault.address)

            const prev_pod_rented_amount = (await manager.pods(pod.address)).rentedAmount

            const tx = await pod.connect(podOwner).getStkAave(added_debt)

            const expected_rent_amount = vault_small_available_amount

            const new_pod_stkAave_balance = await stkAave.balanceOf(pod.address)
            const new_manager_stkAave_balance = await stkAave.balanceOf(manager.address)
            const new_vault_stkAave_balance = await stkAave.balanceOf(vault.address)

            const new_pod_rented_amount = (await manager.pods(pod.address)).rentedAmount

            expect(new_pod_stkAave_balance).to.be.eq(prev_pod_stkAave_balance.add(expected_rent_amount))
            expect(new_manager_stkAave_balance).to.be.eq(prev_manager_stkAave_balance)
            expect(new_vault_stkAave_balance).to.be.eq(prev_vault_stkAave_balance.sub(expected_rent_amount))

            expect(new_pod_rented_amount).to.be.eq(prev_pod_rented_amount.add(expected_rent_amount))

            await expect(tx).to.emit(stkAave, "Transfer")
            .withArgs(vault.address, pod.address, expected_rent_amount);

            await expect(tx).to.emit(manager, "RentedStkAave")
            .withArgs(pod.address, expected_rent_amount);

        });
        
        it(' should only rent the needed amount - Pod already renting', async () => {

            await pod2.connect(podOwner).getStkAave(previous_debt)

            const prev_pod_stkAave_balance = await stkAave.balanceOf(pod2.address)
            const prev_manager_stkAave_balance = await stkAave.balanceOf(manager.address)
            const prev_vault_stkAave_balance = await stkAave.balanceOf(vault.address)

            const prev_pod_rented_amount = (await manager.pods(pod2.address)).rentedAmount

            const total_expected_debt = previous_debt.add(added_debt)

            const tx = await pod2.connect(podOwner).getStkAave(added_debt)

            const expected_needed_total_amount = total_expected_debt.mul(UNIT).div(stkAave_calculation_ratio)
            const expected_rent_amount = expected_needed_total_amount.sub(prev_pod_stkAave_balance)

            const new_pod_stkAave_balance = await stkAave.balanceOf(pod2.address)
            const new_manager_stkAave_balance = await stkAave.balanceOf(manager.address)
            const new_vault_stkAave_balance = await stkAave.balanceOf(vault.address)

            const new_pod_rented_amount = (await manager.pods(pod2.address)).rentedAmount

            expect(new_pod_stkAave_balance).to.be.eq(prev_pod_stkAave_balance.add(expected_rent_amount))
            expect(new_manager_stkAave_balance).to.be.eq(prev_manager_stkAave_balance)
            expect(new_vault_stkAave_balance).to.be.eq(prev_vault_stkAave_balance.sub(expected_rent_amount))

            expect(new_pod_rented_amount).to.be.eq(prev_pod_rented_amount.add(expected_rent_amount))

            await expect(tx).to.emit(stkAave, "Transfer")
            .withArgs(vault.address, pod2.address, expected_rent_amount);

            await expect(tx).to.emit(manager, "RentedStkAave")
            .withArgs(pod2.address, expected_rent_amount);

        });
        
        it(' should only be callable by valid Pods', async () => {

            await expect(
                manager.connect(podOwner).getStkAave(added_debt)
            ).to.be.revertedWith('CallerNotValidPod')

        });

    });

    describe('notifyStkAaveClaim', async () => {

        const stkAave_vault_balance = ethers.utils.parseEther('1000')

        const previous_debt = ethers.utils.parseEther('1500')

        beforeEach(async () => {
            await stkAave.connect(admin).transfer(vault.address, stkAave_vault_balance)

            await pod.connect(podOwner).getStkAave(previous_debt)

            await advanceTime(WEEK.mul(4).toNumber())

        });
        
        it(' should should update the Pod rented amount based on notified claim amount (& emit correct Event)', async () => {

            const prev_pod_stkAave_balance = await stkAave.balanceOf(pod.address)

            const prev_pod_rented_amount = (await manager.pods(pod.address)).rentedAmount

            const tx = await pod.connect(podOwner).compoundStkAave()

            const new_pod_stkAave_balance = await stkAave.balanceOf(pod.address)

            const new_pod_rented_amount = (await manager.pods(pod.address)).rentedAmount

            const balance_increase = new_pod_stkAave_balance.sub(prev_pod_stkAave_balance)

            expect(new_pod_rented_amount).to.be.eq(prev_pod_rented_amount.add(balance_increase))

            await expect(tx).to.emit(manager, "RentedStkAave")
            .withArgs(pod.address, balance_increase);

        });
        
        it(' should notify the Vault correctly', async () => {

            const prev_vault_tracked_amount = await vault.managerRentedAmounts(manager.address)

            const prev_pod_stkAave_balance = await stkAave.balanceOf(pod.address)

            await pod.connect(podOwner).compoundStkAave()

            const new_pod_stkAave_balance = await stkAave.balanceOf(pod.address)

            const balance_increase = new_pod_stkAave_balance.sub(prev_pod_stkAave_balance)

            const new_vault_tracked_amount = await vault.managerRentedAmounts(manager.address)

            expect(new_vault_tracked_amount).to.be.eq(prev_vault_tracked_amount.add(balance_increase))

        });
        
        it(' should update the Pod state correctly', async () => {

            const tx = await pod.connect(podOwner).compoundStkAave()

            const tx_timestamp = (await ethers.provider.getBlock((await tx).blockNumber || 0)).timestamp

            expect((await manager.pods(pod.address)).lastUpdate).to.be.eq(tx_timestamp)

        });
        
        it(' should only be callable by valid Pods', async () => {

            await expect(
                manager.connect(podOwner).notifyStkAaveClaim(ethers.utils.parseEther('12'))
            ).to.be.revertedWith('CallerNotValidPod')

        });

    });

    describe('notifyPayFee', async () => {

        const stkAave_vault_balance = ethers.utils.parseEther('10000')

        const previous_debt = ethers.utils.parseEther('35000')
        const previous_debt2 = ethers.utils.parseEther('15000')

        const pay_fees_amount = ethers.utils.parseEther('45.5')
        const pay_fees_amount2 = ethers.utils.parseEther('25')

        beforeEach(async () => {
            await stkAave.connect(admin).transfer(vault.address, stkAave_vault_balance)

            await pod.connect(podOwner).getStkAave(previous_debt)

            await pod2.connect(podOwner).getStkAave(previous_debt2)

            await advanceTime(WEEK.mul(5).toNumber())

            await manager.connect(admin).updatePodState(pod.address)
            await manager.connect(admin).updatePodState(pod2.address)

        });
        
        it(' should update the Pod owed fees correctly & add fees to the Reserve (& emit correct Event)', async () => {

            const prev_reserve = await manager.reserveAmount()
            const prev_owed_fees = (await manager.pods(pod.address)).accruedFees

            const tx = await pod.connect(podOwner).payFee(pay_fees_amount)

            const new_reserve = await manager.reserveAmount()
            const new_owed_fees = (await manager.pods(pod.address)).accruedFees

            expect(new_owed_fees).to.be.eq(prev_owed_fees.sub(pay_fees_amount))
            expect(new_reserve).to.be.eq(prev_reserve.add(pay_fees_amount))

            await expect(tx).to.emit(manager, "PaidFees")
            .withArgs(pod.address, pay_fees_amount);

        });
        
        it(' should allow multiple Pods to notify', async () => {

            const prev_reserve = await manager.reserveAmount()
            const prev_owed_fees1 = (await manager.pods(pod.address)).accruedFees
            const prev_owed_fees2 = (await manager.pods(pod2.address)).accruedFees

            const tx = await pod.connect(podOwner).payFee(pay_fees_amount)

            const new_reserve = await manager.reserveAmount()
            const new_owed_fees1 = (await manager.pods(pod.address)).accruedFees

            expect(new_owed_fees1).to.be.eq(prev_owed_fees1.sub(pay_fees_amount))
            expect((await manager.pods(pod2.address)).accruedFees).to.be.eq(prev_owed_fees2)
            expect(new_reserve).to.be.eq(prev_reserve.add(pay_fees_amount))

            const tx2 = await pod2.connect(podOwner).payFee(pay_fees_amount2)

            const new_owed_fees2 = (await manager.pods(pod2.address)).accruedFees

            expect(new_owed_fees2).to.be.eq(prev_owed_fees2.sub(pay_fees_amount2))
            expect((await manager.pods(pod.address)).accruedFees).to.be.eq(new_owed_fees1)
            expect(await manager.reserveAmount()).to.be.eq(new_reserve.add(pay_fees_amount2))

            await expect(tx).to.emit(manager, "PaidFees")
            .withArgs(pod.address, pay_fees_amount);

            await expect(tx2).to.emit(manager, "PaidFees")
            .withArgs(pod2.address, pay_fees_amount2);

        });

        it(' should process the reserve if it is more than treshold', async () => {

            const bigger_pay_fees_amount = ethers.utils.parseEther('1100')

            await advanceTime(WEEK.mul(100).toNumber())

            await manager.connect(admin).updatePodState(pod.address)

            const protocol_fee_ratio = await manager.protocolFeeRatio()

            const prev_reserve = await manager.reserveAmount()
            const expected_updated_reserve_amount = prev_reserve.add(bigger_pay_fees_amount)

            const prev_owed_fees = (await manager.pods(pod.address)).accruedFees
            const prev_chest_balance = await gho.balanceOf(feeChest.address)
            const prev_staking_balance = await gho.balanceOf(staking.address)

            await gho.connect(admin).mint(manager.address, bigger_pay_fees_amount)
            const tx = await pod.connect(podOwner).payFee(bigger_pay_fees_amount)

            const new_reserve = await manager.reserveAmount()

            const new_owed_fees = (await manager.pods(pod.address)).accruedFees

            const new_manager_balance = await gho.balanceOf(manager.address)
            const new_chest_balance = await gho.balanceOf(feeChest.address)
            const new_staking_balance = await gho.balanceOf(staking.address)

            const expected_protocol_fees = expected_updated_reserve_amount.mul(protocol_fee_ratio).div(MAX_BPS)
            const expected_total_rewards = expected_updated_reserve_amount.sub(expected_protocol_fees)
            
            expect(new_reserve).to.be.eq(0)
            expect(new_manager_balance).to.be.eq(0)

            expect(new_chest_balance).to.be.eq(prev_chest_balance.add(expected_protocol_fees))
            expect(new_staking_balance).to.be.eq(prev_staking_balance.add(expected_total_rewards))


            expect(new_owed_fees).to.be.eq(prev_owed_fees.sub(bigger_pay_fees_amount))

            await expect(tx).to.emit(manager, "PaidFees")
            .withArgs(pod.address, bigger_pay_fees_amount);

            await expect(tx).to.emit(gho, "Transfer")
            .withArgs(manager.address, feeChest.address, expected_protocol_fees);

            await expect(tx).to.emit(gho, "Transfer")
            .withArgs(manager.address, staking.address, expected_total_rewards);

            await expect(tx).to.emit(manager, "ReserveProcessed")
            .withArgs(expected_total_rewards);

        });
        
        it(' should only be callable by valid Pods', async () => {

            await expect(
                manager.connect(podOwner).notifyPayFee(ethers.utils.parseEther('12'))
            ).to.be.revertedWith('CallerNotValidPod')

        });

    });

    describe('notifyMintingFee', async () => {

        const minting_fee = ethers.utils.parseEther('250')
        const bigger_minting_fee = ethers.utils.parseEther('750')
        
        it(' should add the notified amount to the reserve correctly (& emit correct Event)', async () => {

            const prev_reserve = await manager.reserveAmount()

            const tx = await pod.connect(podOwner).payMintFee(minting_fee)

            const new_reserve = await manager.reserveAmount()

            expect(new_reserve).to.be.eq(prev_reserve.add(minting_fee))

            await expect(tx).to.emit(manager, "MintingFees")
            .withArgs(pod.address, minting_fee);

        });
        
        it(' should allow multiple Pods to notify', async () => {

            const minting_fee2 = ethers.utils.parseEther('13')
            const minting_fee3 = ethers.utils.parseEther('50')

            const start_reserve = await manager.reserveAmount()

            const tx = await pod.connect(podOwner).payMintFee(minting_fee)

            expect(await manager.reserveAmount()).to.be.eq(start_reserve.add(minting_fee))

            const tx2 = await pod2.connect(podOwner).payMintFee(minting_fee2)

            expect(await manager.reserveAmount()).to.be.eq(start_reserve.add(minting_fee.add(minting_fee2)))

            const tx3 = await pod3.connect(podOwner).payMintFee(minting_fee3)

            expect(await manager.reserveAmount()).to.be.eq(start_reserve.add(minting_fee.add(minting_fee2).add(minting_fee3)))

            await expect(tx).to.emit(manager, "MintingFees")
            .withArgs(pod.address, minting_fee);

            await expect(tx2).to.emit(manager, "MintingFees")
            .withArgs(pod2.address, minting_fee2);

            await expect(tx3).to.emit(manager, "MintingFees")
            .withArgs(pod3.address, minting_fee3);

        });

        it(' should process the reserve if it is more than treshold', async () => {

            const protocol_fee_ratio = await manager.protocolFeeRatio()

            const prev_reserve = await manager.reserveAmount()
            const expected_updated_reserve_amount = prev_reserve.add(bigger_minting_fee)

            const prev_chest_balance = await gho.balanceOf(feeChest.address)
            const prev_staking_balance = await gho.balanceOf(staking.address)

            await gho.connect(admin).mint(manager.address, bigger_minting_fee)
            const tx = await pod.connect(podOwner).payMintFee(bigger_minting_fee)

            const new_reserve = await manager.reserveAmount()

            const new_manager_balance = await gho.balanceOf(manager.address)
            const new_chest_balance = await gho.balanceOf(feeChest.address)
            const new_staking_balance = await gho.balanceOf(staking.address)

            const expected_protocol_fees = expected_updated_reserve_amount.mul(protocol_fee_ratio).div(MAX_BPS)
            const expected_total_rewards = expected_updated_reserve_amount.sub(expected_protocol_fees)
            
            expect(new_reserve).to.be.eq(0)
            expect(new_manager_balance).to.be.eq(0)

            expect(new_chest_balance).to.be.eq(prev_chest_balance.add(expected_protocol_fees))
            expect(new_staking_balance).to.be.eq(prev_staking_balance.add(expected_total_rewards))

            await expect(tx).to.emit(gho, "Transfer")
            .withArgs(manager.address, feeChest.address, expected_protocol_fees);

            await expect(tx).to.emit(gho, "Transfer")
            .withArgs(manager.address, staking.address, expected_total_rewards);

            await expect(tx).to.emit(manager, "ReserveProcessed")
            .withArgs(expected_total_rewards);

        });
        
        it(' should only be callable by valid Pods', async () => {

            await expect(
                manager.connect(podOwner).notifyMintingFee(ethers.utils.parseEther('12'))
            ).to.be.revertedWith('CallerNotValidPod')

        });

    });

});