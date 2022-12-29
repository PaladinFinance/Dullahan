const hre = require("hardhat");
import { ethers } from "hardhat";
import chai from "chai";
import { BigNumber } from "ethers";
import { solidity } from "ethereum-waffle";
import { DullahanPod } from "../../typechain/DullahanPod";
import { DullahanPod__factory } from "../../typechain/factories/DullahanPod__factory";
import { MockERC20 } from "../../typechain/test/MockERC20";
import { MockManager } from "../../typechain/test/MockManager";
import { MockMarket } from "../../typechain/test/MockMarket";
import { MockRewards } from "../../typechain/test/MockRewards";
import { MockVault2 } from "../../typechain/test/MockVault2";
import { DullahanRegistry } from "../../typechain/modules/DullahanRegistry";
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
    resetFork
} from "../utils/utils";

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
} from "../utils/constants"

chai.use(solidity);
const { expect } = chai;
const { provider } = ethers;

let podFactory: ContractFactory
let registryFactory: ContractFactory
let tokenFactory: ContractFactory
let managerFactory: ContractFactory
let rewardsFactory: ContractFactory
let marketFactory: ContractFactory
let vaultFactory: ContractFactory

const UNIT = ethers.utils.parseEther('1')
const MAX_BPS = BigNumber.from('10000')
const MAX_UINT256 = ethers.constants.MaxUint256
const WEEK = BigNumber.from(7 * 86400);
const RAY = ethers.utils.parseEther('1000000000')

describe('DullahanPod contract tests - Pod Manager functions', () => {
    let admin: SignerWithAddress

    let implementation: DullahanPod
    let pod: DullahanPod
    let pod2: DullahanPod

    let vault: MockVault2
    let collat: MockERC20
    let aCollat: MockERC20
    let gho: MockERC20
    let ghoDebt: MockERC20

    let podManager: SignerWithAddress

    let manager: MockManager

    let market: MockMarket

    let rewardsController: MockRewards

    let aave: IERC20
    let stkAave: IERC20
    let stkAave_staking: IStakedAave
    let stkAave_voting_power: IGovernancePowerDelegationToken

    let registry: DullahanRegistry

    let delegate: SignerWithAddress
    let podOwner: SignerWithAddress
    let otherUser: SignerWithAddress

    let rewardToken1: IERC20
    let rewardToken2: IERC20

    let newDelegate: SignerWithAddress
    let newRegistry: SignerWithAddress

    before(async () => {
        await resetFork();

        [admin, podManager, delegate, podOwner, otherUser, newDelegate, newRegistry] = await ethers.getSigners();

        podFactory = await ethers.getContractFactory("DullahanPod");
        tokenFactory = await ethers.getContractFactory("MockERC20");
        managerFactory = await ethers.getContractFactory("MockManager");
        marketFactory = await ethers.getContractFactory("MockMarket");
        rewardsFactory = await ethers.getContractFactory("MockRewards");
        vaultFactory = await ethers.getContractFactory("MockVault2");
        registryFactory = await ethers.getContractFactory("DullahanRegistry");

        aave = IERC20__factory.connect(AAVE, provider);
        stkAave = IERC20__factory.connect(STK_AAVE, provider);
        stkAave_staking = IStakedAave__factory.connect(STK_AAVE, provider);
        stkAave_voting_power = IGovernancePowerDelegationToken__factory.connect(STK_AAVE, provider);

        await getERC20(admin, HOLDER_AAVE, aave, admin.address, AMOUNT_AAVE);

        await aave.connect(admin).approve(stkAave_staking.address, AMOUNT_AAVE);
        await stkAave_staking.connect(admin).stake(admin.address, AMOUNT_AAVE);

        rewardToken1 = IERC20__factory.connect(REWARD_TOKEN_1, provider);
        rewardToken2 = IERC20__factory.connect(REWARD_TOKEN_2, provider);

        await getERC20(admin, HOLDER_REWARD_1, rewardToken1, admin.address, AMOUNT_REWARD_1);
        await getERC20(admin, HOLDER_REWARD_2, rewardToken2, admin.address, AMOUNT_REWARD_2);

    });

    beforeEach(async () => {

        collat = (await tokenFactory.connect(admin).deploy("Collateral","COL")) as MockERC20;
        await collat.deployed();
        aCollat = (await tokenFactory.connect(admin).deploy("aToken Collateral","aCOL")) as MockERC20;
        await aCollat.deployed();
        gho = (await tokenFactory.connect(admin).deploy("Mock GHO","GHO")) as MockERC20;
        await gho.deployed();
        ghoDebt = (await tokenFactory.connect(admin).deploy("Debt GHO","dGHO")) as MockERC20;
        await ghoDebt.deployed();

        market = (await marketFactory.connect(admin).deploy(
            gho.address,
            ghoDebt.address
        )) as MockMarket;
        await market.deployed();

        rewardsController = (await rewardsFactory.connect(admin).deploy(
            rewardToken1.address,
            rewardToken2.address
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

        manager = (await managerFactory.connect(admin).deploy(
            vault.address,
            registry.address,
            stkAave.address,
            gho.address,
            ghoDebt.address
        )) as MockManager;
        await manager.deployed();

        await vault.connect(admin).setManager(manager.address)

        implementation = (await podFactory.connect(admin).deploy()) as DullahanPod;
        await implementation.deployed();

        await manager.connect(admin).clonePod(implementation.address)
        const podList = await manager.getCreatedPods()
        pod = DullahanPod__factory.connect(podList[podList.length - 1], provider);

        await manager.connect(admin).clonePod(implementation.address)
        const podList2 = await manager.getCreatedPods()
        pod2 = DullahanPod__factory.connect(podList2[podList2.length - 1], provider);

        await market.connect(admin).addToken(collat.address, aCollat.address)

        await stkAave.connect(admin).transfer(vault.address, ethers.utils.parseEther('5000'))

        await pod.connect(admin).init(
            manager.address,
            vault.address,
            registry.address,
            podOwner.address,
            collat.address,
            aCollat.address,
            delegate.address
        )

        await pod2.connect(admin).init(
            podManager.address,
            vault.address,
            registry.address,
            podOwner.address,
            collat.address,
            aCollat.address,
            delegate.address
        )

        await collat.connect(admin).mint(podOwner.address, ethers.utils.parseEther('10000'))

    });

    describe('liquidateCollateral', async () => {

        const deposit_amount = ethers.utils.parseEther('500')

        beforeEach(async () => {

            await collat.connect(admin).mint(podOwner.address, deposit_amount.mul(2))

            await collat.connect(podOwner).approve(pod.address, deposit_amount)

            await pod.connect(podOwner).depositCollateral(deposit_amount)

        });

        it(' should liquidate correctly (& emit correct Event)', async () => {

            const liquidate_amount = ethers.utils.parseEther('150')
            const receiver = otherUser

            const previous_pod_balance = await collat.balanceOf(pod.address)
            const previous_podOwner_balance = await collat.balanceOf(podOwner.address)
            const previous_receiver_balance = await collat.balanceOf(receiver.address)
            const previous_manager_balance = await collat.balanceOf(podManager.address)
            const previous_market_balance = await collat.balanceOf(market.address)

            const previous_pod_aToken_balance = await aCollat.balanceOf(pod.address)

            //const liquidate_tx = await pod.connect(podManager).liquidateCollateral(liquidate_amount, receiver.address)
            const liquidate_tx = await manager.connect(admin).liquidatePod(pod.address, liquidate_amount, receiver.address)

            const new_pod_balance = await collat.balanceOf(pod.address)
            const new_podOwner_balance = await collat.balanceOf(podOwner.address)
            const new_receiver_balance = await collat.balanceOf(receiver.address)
            const new_manager_balance = await collat.balanceOf(podManager.address)
            const new_market_balance = await collat.balanceOf(market.address)

            const new_pod_aToken_balance = await aCollat.balanceOf(pod.address)

            expect(new_pod_balance).to.be.eq(previous_pod_balance)
            expect(new_podOwner_balance).to.be.eq(previous_podOwner_balance)
            expect(new_manager_balance).to.be.eq(previous_manager_balance)
            expect(new_receiver_balance).to.be.eq(previous_receiver_balance.add(liquidate_amount))
            expect(new_market_balance).to.be.eq(previous_market_balance.sub(liquidate_amount))

            expect(new_pod_aToken_balance).to.be.eq(previous_pod_aToken_balance.sub(liquidate_amount))

            await expect(liquidate_tx).to.emit(collat, "Transfer")
            .withArgs(market.address, pod.address, liquidate_amount);

            await expect(liquidate_tx).to.emit(collat, "Transfer")
            .withArgs(pod.address, receiver.address, liquidate_amount);

            await expect(liquidate_tx).to.emit(pod, "CollateralLiquidated")
            .withArgs(collat.address, liquidate_amount);

        });

        /*it(' should liquidate all the Pod if given MAX_UINT256', async () => { // ==> need to test it with live Aave Pool

            const liquidate_amount = ethers.constants.MaxUint256
            const receiver = otherUser

            const previous_pod_balance = await collat.balanceOf(pod.address)
            const previous_podOwner_balance = await collat.balanceOf(podOwner.address)
            const previous_receiver_balance = await collat.balanceOf(receiver.address)
            const previous_manager_balance = await collat.balanceOf(podManager.address)
            const previous_market_balance = await collat.balanceOf(market.address)

            const previous_pod_aToken_balance = await aCollat.balanceOf(pod.address)

            //const liquidate_tx = await pod.connect(podManager).liquidateCollateral(liquidate_amount, receiver.address)
            const liquidate_tx = await manager.connect(admin).liquidatePod(pod.address, liquidate_amount, receiver.address)

            const new_pod_balance = await collat.balanceOf(pod.address)
            const new_podOwner_balance = await collat.balanceOf(podOwner.address)
            const new_receiver_balance = await collat.balanceOf(receiver.address)
            const new_manager_balance = await collat.balanceOf(podManager.address)
            const new_market_balance = await collat.balanceOf(market.address)

            const new_pod_aToken_balance = await aCollat.balanceOf(pod.address)

            expect(new_pod_balance).to.be.eq(previous_pod_balance)
            expect(new_podOwner_balance).to.be.eq(previous_podOwner_balance)
            expect(new_manager_balance).to.be.eq(previous_manager_balance)
            expect(new_receiver_balance).to.be.eq(previous_receiver_balance.add(previous_pod_aToken_balance))
            expect(new_market_balance).to.be.eq(previous_market_balance.sub(previous_pod_aToken_balance))

            expect(new_pod_aToken_balance).to.be.eq(0)

            await expect(liquidate_tx).to.emit(collat, "Transfer")
            .withArgs(market.address, pod.address, previous_pod_aToken_balance);

            await expect(liquidate_tx).to.emit(collat, "Transfer")
            .withArgs(pod.address, receiver.address, previous_pod_aToken_balance);

            await expect(liquidate_tx).to.emit(pod, "CollateralLiquidated")
            .withArgs(collat.address, previous_pod_aToken_balance);

        });*/

        it(' should not do anything if given the amount 0', async () => {

            const receiver = otherUser

            const previous_pod_balance = await collat.balanceOf(pod.address)
            const previous_podOwner_balance = await collat.balanceOf(podOwner.address)
            const previous_receiver_balance = await collat.balanceOf(receiver.address)
            const previous_manager_balance = await collat.balanceOf(podManager.address)
            const previous_market_balance = await collat.balanceOf(market.address)

            const previous_pod_aToken_balance = await aCollat.balanceOf(pod.address)

            //const liquidate_tx = await pod.connect(podManager).liquidateCollateral(liquidate_amount, receiver.address)
            const liquidate_tx = await manager.connect(admin).liquidatePod(pod.address, 0, receiver.address)

            const new_pod_balance = await collat.balanceOf(pod.address)
            const new_podOwner_balance = await collat.balanceOf(podOwner.address)
            const new_receiver_balance = await collat.balanceOf(receiver.address)
            const new_manager_balance = await collat.balanceOf(podManager.address)
            const new_market_balance = await collat.balanceOf(market.address)

            const new_pod_aToken_balance = await aCollat.balanceOf(pod.address)

            expect(new_pod_balance).to.be.eq(previous_pod_balance)
            expect(new_podOwner_balance).to.be.eq(previous_podOwner_balance)
            expect(new_manager_balance).to.be.eq(previous_manager_balance)
            expect(new_receiver_balance).to.be.eq(previous_receiver_balance)
            expect(new_market_balance).to.be.eq(previous_market_balance)

            expect(new_pod_aToken_balance).to.be.eq(previous_pod_aToken_balance)

            await expect(liquidate_tx).not.to.emit(collat, "Transfer")

            await expect(liquidate_tx).not.to.emit(pod, "CollateralLiquidated")

        });

        it(' should only be callable by the Pod manager', async () => {

            const liquidate_amount = ethers.utils.parseEther('150')

            await expect(
                pod.connect(admin).liquidateCollateral(liquidate_amount, admin.address)
            ).to.be.revertedWith('NotPodManager')

            await expect(
                pod.connect(podOwner).liquidateCollateral(liquidate_amount, admin.address)
            ).to.be.revertedWith('NotPodManager')

        });

    });

    describe('updateDelegation', async () => {

        it(' should update the delegation correctly (& emit correct Event)', async () => {
            
            const update_tx = await pod2.connect(podManager).updateDelegation(newDelegate.address)

            expect(await pod2.delegate()).to.be.eq(newDelegate.address)

            expect(await stkAave_voting_power.getDelegateeByType(pod2.address, 0)).to.be.eq(newDelegate.address)
            expect(await stkAave_voting_power.getDelegateeByType(pod2.address, 1)).to.be.eq(newDelegate.address)

            await expect(update_tx).to.emit(pod2, "UpdatedDelegate")
            .withArgs(delegate.address, newDelegate.address);

        });

        it(' should fail if given the same address', async () => {

            await expect(
                pod2.connect(podManager).updateDelegation(delegate.address)
            ).to.be.revertedWith('SameAddress')

        });

        it(' should fail if given address 0x0', async () => {

            await expect(
                pod2.connect(podManager).updateDelegation(ethers.constants.AddressZero)
            ).to.be.revertedWith('AddressZero')

        });

        it(' should only be callable by the Pod manager', async () => {

            await expect(
                pod2.connect(admin).updateDelegation(newDelegate.address)
            ).to.be.revertedWith('NotPodManager')

            await expect(
                pod2.connect(podOwner).updateDelegation(newDelegate.address)
            ).to.be.revertedWith('NotPodManager')

        });

    });

    describe('updateRegistry', async () => {

        it(' should update the registry correctly (& emit correct Event)', async () => {
            
            const update_tx = await pod2.connect(podManager).updateRegistry(newRegistry.address)

            expect(await pod2.registry()).to.be.eq(newRegistry.address)

            await expect(update_tx).to.emit(pod2, "UpdatedRegistry")
            .withArgs(registry.address, newRegistry.address);

        });

        it(' should fail if given the same address', async () => {

            await expect(
                pod2.connect(podManager).updateRegistry(registry.address)
            ).to.be.revertedWith('SameAddress')

        });

        it(' should fail if given address 0x0', async () => {

            await expect(
                pod2.connect(podManager).updateRegistry(ethers.constants.AddressZero)
            ).to.be.revertedWith('AddressZero')

        });

        it(' should only be callable by the Pod manager', async () => {

            await expect(
                pod2.connect(admin).updateRegistry(newRegistry.address)
            ).to.be.revertedWith('NotPodManager')

            await expect(
                pod2.connect(podOwner).updateRegistry(newRegistry.address)
            ).to.be.revertedWith('NotPodManager')

        });

    });

});