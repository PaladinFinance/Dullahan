const hre = require("hardhat");
import { ethers } from "hardhat";
import chai from "chai";
import { BigNumber } from "ethers";
import { solidity } from "ethereum-waffle";
import { DullahanVault } from "../../../typechain/DullahanVault";
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
    AMOUNT_AAVE
} from "../../utils/constants"

chai.use(solidity);
const { expect } = chai;
const { provider } = ethers;

let vaultFactory: ContractFactory

const UNIT = ethers.utils.parseEther('1')
const MAX_BPS = BigNumber.from('10000')
const MAX_UINT256 = ethers.constants.MaxUint256
const WEEK = BigNumber.from(7 * 86400);
const RAY = ethers.utils.parseEther('1000000000')

describe('DullahanVault contract tests - Pod Manager functions', () => {
    let admin: SignerWithAddress

    let vault: DullahanVault

    let reserveManager: SignerWithAddress
    let votingManager: SignerWithAddress

    let podManager: SignerWithAddress
    let otherPodManager: SignerWithAddress
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

    const seed_deposit = ethers.utils.parseEther('0.001')

    before(async () => {
        await resetFork();

        [admin, reserveManager, votingManager, podManager, otherPodManager, pod1, pod2, depositor1, depositor2, depositor3] = await ethers.getSigners();

        vaultFactory = await ethers.getContractFactory("DullahanVault");

        aave = IERC20__factory.connect(AAVE, provider);
        stkAave = IERC20__factory.connect(STK_AAVE, provider);
        stkAave_staking = IStakedAave__factory.connect(STK_AAVE, provider);
        stkAave_voting_power = IGovernancePowerDelegationToken__factory.connect(STK_AAVE, provider);

        await getERC20(admin, HOLDER_AAVE, aave, admin.address, AMOUNT_AAVE);

        await aave.connect(admin).approve(stkAave_staking.address, AMOUNT_AAVE);
        await stkAave_staking.connect(admin).stake(admin.address, AMOUNT_AAVE);

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

        await stkAave.connect(admin).approve(vault.address, seed_deposit)
        await vault.connect(admin).init(votingManager.address)

    });

    it(' should be deployed & have correct parameters', async () => {
        expect(vault.address).to.properAddress

        expect(await vault.admin()).to.be.eq(admin.address)

        expect(await vault.AAVE()).to.be.eq(AAVE)
        expect(await vault.STK_AAVE()).to.be.eq(STK_AAVE)
        expect(await vault.asset()).to.be.eq(STK_AAVE)

        expect(await vault.reserveRatio()).to.be.eq(reserve_ratio)
        expect(await vault.reserveManager()).to.be.eq(reserveManager.address)

        expect(await vault.votingPowerManager()).to.be.eq(votingManager.address)

        expect(await vault.name()).to.be.eq("Dullahan stkAave")
        expect(await vault.symbol()).to.be.eq("dstkAAVE")
        expect(await vault.decimals()).to.be.eq(18)

        expect(await vault.initialized()).to.be.true

        expect(await vault.totalAssets()).to.be.eq(seed_deposit)
        expect(await vault.totalSupply()).to.be.eq(seed_deposit)

        expect(await vault.getCurrentIndex()).to.be.eq(RAY)

    });
    
    describe('rentStkAave', async () => {
        
        const user1_deposit = ethers.utils.parseEther('1500')
        const user2_deposit = ethers.utils.parseEther('850')
        const user3_deposit = ethers.utils.parseEther('2100')

        const rent_amount = ethers.utils.parseEther('3200')
        const rent_amount2 = ethers.utils.parseEther('400')

        beforeEach(async () => {

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
            const stkAave_claim = staking_events[0].shares
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
            const stkAave_claim = staking_events[0].shares
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
            const stkAave_claim = staking_events[0].shares
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