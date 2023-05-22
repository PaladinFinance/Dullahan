const hre = require("hardhat");
import { ethers } from "hardhat";
import chai from "chai";
import { BigNumber } from "ethers";
import { solidity } from "ethereum-waffle";
import { DullahanPod } from "../../../typechain/DullahanPod";
import { DullahanPod__factory } from "../../../typechain/factories/DullahanPod__factory";
import { MockERC20 } from "../../../typechain/test/MockERC20";
import { MockManager } from "../../../typechain/test/MockManager";
import { MockMarket } from "../../../typechain/test/MockMarket";
import { MockRewards } from "../../../typechain/test/MockRewards";
import { MockVault2 } from "../../../typechain/test/MockVault2";
import { DullahanRegistry } from "../../../typechain/modules/DullahanRegistry";
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

describe('DullahanPod contract tests - Pod Owner functions', () => {
    let admin: SignerWithAddress

    let implementation: DullahanPod
    let pod: DullahanPod

    let vault: MockVault2
    let collat: MockERC20
    let aCollat: MockERC20
    let gho: MockERC20
    let ghoDebt: MockERC20

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

    before(async () => {
        await resetFork();

        [admin, delegate, podOwner, otherUser] = await ethers.getSigners();

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

        await market.connect(admin).addToken(collat.address, aCollat.address)

    });

    it(' should block from using the Implementation', async () => {
        expect(implementation.address).to.properAddress

        expect(await implementation.initialized()).to.be.false

        const dead_address = "0x000000000000000000000000000000000000dEaD"

        expect(await implementation.manager()).to.be.eq(dead_address)
        expect(await implementation.vault()).to.be.eq(dead_address)
        expect(await implementation.registry()).to.be.eq(dead_address)
        expect(await implementation.collateral()).to.be.eq(dead_address)
        expect(await implementation.podOwner()).to.be.eq(dead_address)
        expect(await implementation.delegate()).to.be.eq(dead_address)

        await expect(
            implementation.connect(admin).init(
                manager.address,
                vault.address,
                registry.address,
                podOwner.address,
                collat.address,
                aCollat.address,
                delegate.address
            )
        ).to.be.revertedWith('CannotInitialize')

        await expect(
            implementation.connect(podOwner).depositCollateral(50)
        ).to.be.revertedWith('NotInitialized')

        await expect(
            implementation.connect(podOwner).withdrawCollateral(50, podOwner.address)
        ).to.be.revertedWith('NotInitialized')

        await expect(
            implementation.connect(podOwner).claimAaveExtraRewards(podOwner.address)
        ).to.be.revertedWith('NotInitialized')

        await expect(
            implementation.connect(podOwner).compoundStkAave()
        ).to.be.revertedWith('NotInitialized')

        await expect(
            implementation.connect(podOwner).mintGho(50, podOwner.address)
        ).to.be.revertedWith('NotInitialized')

        await expect(
            implementation.connect(podOwner).repayGho(50)
        ).to.be.revertedWith('NotInitialized')

        await expect(
            implementation.connect(podOwner).rentStkAave()
        ).to.be.revertedWith('NotInitialized')

        await expect(
            implementation.connect(podOwner).liquidateCollateral(50, podOwner.address)
        ).to.be.revertedWith('NotInitialized')

        await expect(
            implementation.connect(podOwner).updateDelegation(podOwner.address)
        ).to.be.revertedWith('NotInitialized')

        await expect(
            implementation.connect(podOwner).updateRegistry(podOwner.address)
        ).to.be.revertedWith('NotInitialized')

    });

    it(' should be cloned & not initialized', async () => {
        expect(pod.address).to.properAddress

        expect(await pod.initialized()).to.be.false

        expect(await pod.manager()).to.be.eq(ethers.constants.AddressZero)
        expect(await pod.vault()).to.be.eq(ethers.constants.AddressZero)
        expect(await pod.registry()).to.be.eq(ethers.constants.AddressZero)
        expect(await pod.collateral()).to.be.eq(ethers.constants.AddressZero)
        expect(await pod.aToken()).to.be.eq(ethers.constants.AddressZero)
        expect(await pod.podOwner()).to.be.eq(ethers.constants.AddressZero)
        expect(await pod.delegate()).to.be.eq(ethers.constants.AddressZero)

    });

    describe('init', async () => {

        it(' should initialize correctly & set the storage (& emit correct Event)', async () => {

            const init_tx = await pod.connect(admin).init(
                manager.address,
                vault.address,
                registry.address,
                podOwner.address,
                collat.address,
                aCollat.address,
                delegate.address
            )

            expect(await pod.initialized()).to.be.true

            expect(await pod.manager()).to.be.eq(manager.address)
            expect(await pod.vault()).to.be.eq(vault.address)
            expect(await pod.registry()).to.be.eq(registry.address)
            expect(await pod.collateral()).to.be.eq(collat.address)
            expect(await pod.aToken()).to.be.eq(aCollat.address)
            expect(await pod.podOwner()).to.be.eq(podOwner.address)
            expect(await pod.delegate()).to.be.eq(delegate.address)
            expect(await pod.aave()).to.be.eq(aave.address)
            expect(await pod.stkAave()).to.be.eq(stkAave.address)

            await expect(init_tx).to.emit(pod, "PodInitialized")
            .withArgs(
                manager.address,
                collat.address,
                podOwner.address,
                vault.address,
                registry.address,
                delegate.address
            );

        });

        it(' should give the correct allowance to the Vault', async () => {

            await pod.connect(admin).init(
                manager.address,
                vault.address,
                registry.address,
                podOwner.address,
                collat.address,
                aCollat.address,
                delegate.address
            )

            expect(await stkAave.allowance(pod.address, vault.address)).to.be.eq(MAX_UINT256)

        });

        it(' should set the correct voting power delegate', async () => {

            await pod.connect(admin).init(
                manager.address,
                vault.address,
                registry.address,
                podOwner.address,
                collat.address,
                aCollat.address,
                delegate.address
            )

            expect(await stkAave_voting_power.getDelegateeByType(pod.address, 0)).to.be.eq(delegate.address)
            expect(await stkAave_voting_power.getDelegateeByType(pod.address, 1)).to.be.eq(delegate.address)

        });

        it(' should fail if already initialized', async () => {

            await pod.connect(admin).init(
                manager.address,
                vault.address,
                registry.address,
                podOwner.address,
                collat.address,
                aCollat.address,
                delegate.address
            )

            await expect(
                pod.connect(admin).init(
                    manager.address,
                    vault.address,
                    registry.address,
                    podOwner.address,
                    collat.address,
                    aCollat.address,
                    delegate.address
                )
            ).to.be.revertedWith('AlreadyInitialized')

        });

        it(' should fail if given address 0x0', async () => {

            await expect(
                pod.connect(admin).init(
                    ethers.constants.AddressZero,
                    vault.address,
                    registry.address,
                    podOwner.address,
                    collat.address,
                    aCollat.address,
                    delegate.address
                )
            ).to.be.revertedWith('AddressZero')

            await expect(
                pod.connect(admin).init(
                    manager.address,
                    ethers.constants.AddressZero,
                    registry.address,
                    podOwner.address,
                    collat.address,
                    aCollat.address,
                    delegate.address
                )
            ).to.be.revertedWith('AddressZero')

            await expect(
                pod.connect(admin).init(
                    manager.address,
                    vault.address,
                    ethers.constants.AddressZero,
                    podOwner.address,
                    collat.address,
                    aCollat.address,
                    delegate.address
                )
            ).to.be.revertedWith('AddressZero')

            await expect(
                pod.connect(admin).init(
                    manager.address,
                    vault.address,
                    registry.address,
                    ethers.constants.AddressZero,
                    collat.address,
                    aCollat.address,
                    delegate.address
                )
            ).to.be.revertedWith('AddressZero')

            await expect(
                pod.connect(admin).init(
                    manager.address,
                    vault.address,
                    registry.address,
                    podOwner.address,
                    ethers.constants.AddressZero,
                    aCollat.address,
                    delegate.address
                )
            ).to.be.revertedWith('AddressZero')

            await expect(
                pod.connect(admin).init(
                    manager.address,
                    vault.address,
                    registry.address,
                    podOwner.address,
                    collat.address,
                    ethers.constants.AddressZero,
                    delegate.address
                )
            ).to.be.revertedWith('AddressZero')

            await expect(
                pod.connect(admin).init(
                    manager.address,
                    vault.address,
                    registry.address,
                    podOwner.address,
                    collat.address,
                    aCollat.address,
                    ethers.constants.AddressZero
                )
            ).to.be.revertedWith('AddressZero')

        });

    });

    describe('depositCollateral', async () => {

        const deposit_amount = ethers.utils.parseEther('500')

        beforeEach(async () => {

            await pod.connect(admin).init(
                manager.address,
                vault.address,
                registry.address,
                podOwner.address,
                collat.address,
                aCollat.address,
                delegate.address
            )

            await collat.connect(admin).mint(podOwner.address, deposit_amount.mul(2))

            await collat.connect(podOwner).approve(pod.address, deposit_amount)

        });

        it(' should deposit correctly & do the correct trasnfers (& emit correct Event)', async () => {

            const previous_pod_balance = await collat.balanceOf(pod.address)
            const previous_user_balance = await collat.balanceOf(podOwner.address)
            const previous_market_balance = await collat.balanceOf(market.address)

            const previous_pod_aToken_balance = await aCollat.balanceOf(pod.address)

            const deposit_tx = await pod.connect(podOwner).depositCollateral(deposit_amount)

            const new_pod_balance = await collat.balanceOf(pod.address)
            const new_user_balance = await collat.balanceOf(podOwner.address)
            const new_market_balance = await collat.balanceOf(market.address)

            const new_pod_aToken_balance = await aCollat.balanceOf(pod.address)

            expect(new_pod_balance).to.be.eq(previous_pod_balance)
            expect(new_user_balance).to.be.eq(previous_user_balance.sub(deposit_amount))
            expect(new_market_balance).to.be.eq(previous_market_balance.add(deposit_amount))

            expect(new_pod_aToken_balance).to.be.eq(previous_pod_aToken_balance.add(deposit_amount))
            
            await expect(deposit_tx).to.emit(collat, "Transfer")
            .withArgs(podOwner.address, pod.address, deposit_amount);

            await expect(deposit_tx).to.emit(collat, "Approval")
            .withArgs(pod.address, market.address, deposit_amount);

            await expect(deposit_tx).to.emit(collat, "Transfer")
            .withArgs(pod.address, market.address, deposit_amount);

            await expect(deposit_tx).to.emit(pod, "CollateralDeposited")
            .withArgs(collat.address, deposit_amount);

        });

        it(' should update the state of the pod in the Manager', async () => {

            const deposit_tx = await pod.connect(podOwner).depositCollateral(deposit_amount)

            const tx_block = (await deposit_tx).blockNumber

            expect(await manager.podStateUpdate(pod.address)).to.be.eq(tx_block)

        });

        it(' should fail if given a null amount', async () => {

            await expect(
                pod.connect(podOwner).depositCollateral(0)
            ).to.be.revertedWith('NullAmount')

        });

        it(' should only be callable by the Pod owner', async () => {

            await expect(
                pod.connect(admin).depositCollateral(deposit_amount)
            ).to.be.revertedWith('NotPodOwner')

            await expect(
                pod.connect(otherUser).depositCollateral(deposit_amount)
            ).to.be.revertedWith('NotPodOwner')

        });

    });

    describe('withdrawCollateral', async () => {

        const deposit_amount = ethers.utils.parseEther('500')

        const withdraw_amount = ethers.utils.parseEther('150')

        beforeEach(async () => {

            await pod.connect(admin).init(
                manager.address,
                vault.address,
                registry.address,
                podOwner.address,
                collat.address,
                aCollat.address,
                delegate.address
            )

            await collat.connect(admin).mint(podOwner.address, deposit_amount.mul(2))

            await collat.connect(podOwner).approve(pod.address, deposit_amount)

            await pod.connect(podOwner).depositCollateral(deposit_amount)

        });

        it(' should withdraw correctly from market & send back to user (& emit correct Event)', async () => {

            const previous_pod_balance = await collat.balanceOf(pod.address)
            const previous_user_balance = await collat.balanceOf(podOwner.address)
            const previous_market_balance = await collat.balanceOf(market.address)

            const previous_pod_aToken_balance = await aCollat.balanceOf(pod.address)

            const withdraw_tx = await pod.connect(podOwner).withdrawCollateral(withdraw_amount, podOwner.address)

            const new_pod_balance = await collat.balanceOf(pod.address)
            const new_user_balance = await collat.balanceOf(podOwner.address)
            const new_market_balance = await collat.balanceOf(market.address)

            const new_pod_aToken_balance = await aCollat.balanceOf(pod.address)

            expect(new_pod_balance).to.be.eq(previous_pod_balance)
            expect(new_user_balance).to.be.eq(previous_user_balance.add(withdraw_amount))
            expect(new_market_balance).to.be.eq(previous_market_balance.sub(withdraw_amount))

            expect(new_pod_aToken_balance).to.be.eq(previous_pod_aToken_balance.sub(withdraw_amount))

            await expect(withdraw_tx).to.emit(collat, "Transfer")
            .withArgs(market.address, podOwner.address, withdraw_amount);

            await expect(withdraw_tx).to.emit(pod, "CollateralWithdrawn")
            .withArgs(collat.address, withdraw_amount);

        });

        it(' should update the state of the pod in the Manager', async () => {

            const withdraw_tx = await pod.connect(podOwner).withdrawCollateral(withdraw_amount, podOwner.address)

            const tx_block = (await withdraw_tx).blockNumber

            expect(await manager.podStateUpdate(pod.address)).to.be.eq(tx_block)

        });

        it(' should withdraw all collateral if given MAX UINT256', async () => {

            await market.connect(admin).increaseUserDeposit(
                collat.address,
                pod.address,
                (await aCollat.balanceOf(pod.address)).mul(2).div(10)
            )

            const previous_pod_balance = await collat.balanceOf(pod.address)
            const previous_user_balance = await collat.balanceOf(podOwner.address)
            const previous_market_balance = await collat.balanceOf(market.address)

            const previous_pod_aToken_balance = await aCollat.balanceOf(pod.address)

            const withdraw_tx = await pod.connect(podOwner).withdrawCollateral(MAX_UINT256, podOwner.address)

            const new_pod_balance = await collat.balanceOf(pod.address)
            const new_user_balance = await collat.balanceOf(podOwner.address)
            const new_market_balance = await collat.balanceOf(market.address)

            const new_pod_aToken_balance = await aCollat.balanceOf(pod.address)

            expect(new_pod_balance).to.be.eq(previous_pod_balance)
            expect(new_user_balance).to.be.eq(previous_user_balance.add(previous_pod_aToken_balance))
            expect(new_market_balance).to.be.eq(previous_market_balance.sub(previous_pod_aToken_balance))

            expect(new_pod_aToken_balance).to.be.eq(previous_pod_aToken_balance.sub(previous_pod_aToken_balance))
            expect(new_pod_aToken_balance).to.be.eq(0)

            await expect(withdraw_tx).to.emit(collat, "Transfer")
            .withArgs(market.address, podOwner.address, previous_pod_aToken_balance);

            await expect(withdraw_tx).to.emit(pod, "CollateralWithdrawn")
            .withArgs(collat.address, previous_pod_aToken_balance);

        });

        it(' should block withdraws if the Pod owes fees', async () => {

            const borrow_amount = ethers.utils.parseEther('200')
            const fees_amount = ethers.utils.parseEther('10')

            await stkAave.connect(admin).transfer(vault.address, ethers.utils.parseEther('5000'))

            await pod.connect(podOwner).mintGho(borrow_amount, podOwner.address)

            await manager.connect(admin).setPodOwedFees(pod.address, fees_amount)

            await expect(
                pod.connect(podOwner).withdrawCollateral(withdraw_amount, podOwner.address)
            ).to.be.revertedWith('CollateralBlocked')

        });

        it(' should allow to withdraw after repaying owed fees', async () => {

            const borrow_amount = ethers.utils.parseEther('200')
            const fees_amount = ethers.utils.parseEther('10')

            await stkAave.connect(admin).transfer(vault.address, ethers.utils.parseEther('5000'))

            await pod.connect(podOwner).mintGho(borrow_amount, podOwner.address)

            await manager.connect(admin).setPodOwedFees(pod.address, fees_amount)

            await gho.connect(admin).mint(podOwner.address, fees_amount)
            await gho.connect(podOwner).approve(pod.address, fees_amount)
            await pod.connect(podOwner).repayGho(fees_amount)

            const previous_pod_balance = await collat.balanceOf(pod.address)
            const previous_user_balance = await collat.balanceOf(podOwner.address)
            const previous_market_balance = await collat.balanceOf(market.address)

            const previous_pod_aToken_balance = await aCollat.balanceOf(pod.address)

            const withdraw_tx = await pod.connect(podOwner).withdrawCollateral(withdraw_amount, podOwner.address)

            const new_pod_balance = await collat.balanceOf(pod.address)
            const new_user_balance = await collat.balanceOf(podOwner.address)
            const new_market_balance = await collat.balanceOf(market.address)

            const new_pod_aToken_balance = await aCollat.balanceOf(pod.address)

            expect(new_pod_balance).to.be.eq(previous_pod_balance)
            expect(new_user_balance).to.be.eq(previous_user_balance.add(withdraw_amount))
            expect(new_market_balance).to.be.eq(previous_market_balance.sub(withdraw_amount))

            expect(new_pod_aToken_balance).to.be.eq(previous_pod_aToken_balance.sub(withdraw_amount))

            await expect(withdraw_tx).to.emit(collat, "Transfer")
            .withArgs(market.address, podOwner.address, withdraw_amount);

            await expect(withdraw_tx).to.emit(pod, "CollateralWithdrawn")
            .withArgs(collat.address, withdraw_amount);

        });

        it(' should allow to withdraw & send to another receiver', async () => {

            const previous_pod_balance = await collat.balanceOf(pod.address)
            const previous_receiver_balance = await collat.balanceOf(otherUser.address)
            const previous_user_balance = await collat.balanceOf(podOwner.address)
            const previous_market_balance = await collat.balanceOf(market.address)

            const previous_pod_aToken_balance = await aCollat.balanceOf(pod.address)

            const withdraw_tx = await pod.connect(podOwner).withdrawCollateral(withdraw_amount, otherUser.address)

            const new_pod_balance = await collat.balanceOf(pod.address)
            const new_receiver_balance = await collat.balanceOf(otherUser.address)
            const new_user_balance = await collat.balanceOf(podOwner.address)
            const new_market_balance = await collat.balanceOf(market.address)

            const new_pod_aToken_balance = await aCollat.balanceOf(pod.address)

            expect(new_pod_balance).to.be.eq(previous_pod_balance)
            expect(new_user_balance).to.be.eq(previous_user_balance)
            expect(new_receiver_balance).to.be.eq(previous_receiver_balance.add(withdraw_amount))
            expect(new_market_balance).to.be.eq(previous_market_balance.sub(withdraw_amount))

            expect(new_pod_aToken_balance).to.be.eq(previous_pod_aToken_balance.sub(withdraw_amount))

            await expect(withdraw_tx).to.emit(collat, "Transfer")
            .withArgs(market.address, otherUser.address, withdraw_amount);

            await expect(withdraw_tx).to.emit(pod, "CollateralWithdrawn")
            .withArgs(collat.address, withdraw_amount);

        });

        it(' should not allow to withdraw more than deposited', async () => {

            await expect(
                pod.connect(podOwner).withdrawCollateral(deposit_amount.mul(2), podOwner.address)
            ).to.be.reverted

        });

        it(' should fail if given address 0x0', async () => {

            await expect(
                pod.connect(podOwner).withdrawCollateral(withdraw_amount, ethers.constants.AddressZero)
            ).to.be.revertedWith('AddressZero')

        });
        
        it(' should fail if given a null amount', async () => {

            await expect(
                pod.connect(podOwner).withdrawCollateral(0, podOwner.address)
            ).to.be.revertedWith('NullAmount')

        });

        it(' should only be callable by the Pod owner', async () => {

            await expect(
                pod.connect(admin).withdrawCollateral(withdraw_amount, podOwner.address)
            ).to.be.revertedWith('NotPodOwner')

            await expect(
                pod.connect(otherUser).withdrawCollateral(withdraw_amount, podOwner.address)
            ).to.be.revertedWith('NotPodOwner')

        });

    });

    describe('claimAaveExtraRewards', async () => {

        const deposit_amount = ethers.utils.parseEther('500')

        const rewards_amount1 = ethers.utils.parseEther('75')
        const rewards_amount2 = ethers.utils.parseEther('0.125')

        beforeEach(async () => {

            await pod.connect(admin).init(
                manager.address,
                vault.address,
                registry.address,
                podOwner.address,
                collat.address,
                aCollat.address,
                delegate.address
            )

            await collat.connect(admin).mint(podOwner.address, deposit_amount.mul(2))

            await collat.connect(podOwner).approve(pod.address, deposit_amount)

            await pod.connect(podOwner).depositCollateral(deposit_amount)

            await rewardsController.connect(admin).setUserRewards(rewardToken1.address, pod.address, rewards_amount1)
            await rewardsController.connect(admin).setUserRewards(rewardToken2.address, pod.address, rewards_amount2)

            await rewardToken1.connect(admin).transfer(rewardsController.address, rewards_amount1)
            await rewardToken2.connect(admin).transfer(rewardsController.address, rewards_amount2)

        });

        it(' should claim rewards correctly from the Markets Reward Controller', async () => {

            const prev_user_balance1 = await rewardToken1.balanceOf(podOwner.address)
            const prev_user_balance2 = await rewardToken2.balanceOf(podOwner.address)

            const prev_pod_balance1 = await rewardToken1.balanceOf(pod.address)
            const prev_pod_balance2 = await rewardToken2.balanceOf(pod.address)

            await pod.connect(podOwner).claimAaveExtraRewards(podOwner.address)

            expect(await rewardToken1.balanceOf(podOwner.address)).to.be.eq(prev_user_balance1.add(rewards_amount1))
            expect(await rewardToken2.balanceOf(podOwner.address)).to.be.eq(prev_user_balance2.add(rewards_amount2))

            expect(await rewardToken1.balanceOf(pod.address)).to.be.eq(prev_pod_balance1)
            expect(await rewardToken2.balanceOf(pod.address)).to.be.eq(prev_pod_balance2)

        });

        it(' should fail if given address 0x0', async () => {

            await expect(
                pod.connect(podOwner).claimAaveExtraRewards(ethers.constants.AddressZero)
            ).to.be.revertedWith('AddressZero')

        });

        it(' should only be callable by the Pod owner', async () => {

            await expect(
                pod.connect(admin).claimAaveExtraRewards(podOwner.address)
            ).to.be.revertedWith('NotPodOwner')

            await expect(
                pod.connect(otherUser).claimAaveExtraRewards(podOwner.address)
            ).to.be.revertedWith('NotPodOwner')

        });

    });

    describe('compoundStkAave', async () => {

        const deposit_amount = ethers.utils.parseEther('500')
        const borrow_amount = ethers.utils.parseEther('200')

        beforeEach(async () => {

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

            await collat.connect(admin).mint(podOwner.address, deposit_amount.mul(2))

            await collat.connect(podOwner).approve(pod.address, deposit_amount)
            await pod.connect(podOwner).depositCollateral(deposit_amount)

            await pod.connect(podOwner).mintGho(borrow_amount, podOwner.address)

            await advanceTime(WEEK.mul(2).toNumber())

        });

        it(' should claim correctly from the Safety Module & restake correctly', async () => {

            const prev_pod_balance = await stkAave.balanceOf(pod.address)

            const update_tx = await pod.connect(podOwner).compoundStkAave()

            const tx_block = (await update_tx).blockNumber

            expect(await stkAave_staking.getTotalRewardsBalance(pod.address, { blockTag: tx_block })).to.be.eq(0)

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
            const stkAave_staked = staking_events[0].shares

            expect(stkAave_staked).to.be.gt(0)
            expect(await stkAave.balanceOf(pod.address)).to.be.eq(prev_pod_balance.add(stkAave_staked))

            await expect(update_tx).to.emit(aave, 'Transfer').withArgs(
                "0x25F2226B597E8F9514B3F68F00f494cF4f286491", // Aave Ecosystem Reserve
                pod.address,
                aave_claim
            );

            await expect(update_tx).to.emit(stkAave_staking, 'RewardsClaimed').withArgs(
                pod.address,
                pod.address,
                aave_claim
            );

            await expect(update_tx).to.emit(aave, 'Transfer').withArgs(
                pod.address,
                stkAave.address,
                aave_claim
            );

            await expect(update_tx).to.emit(stkAave, 'Transfer').withArgs(
                ethers.constants.AddressZero,
                pod.address,
                stkAave_staked
            );

            await expect(update_tx).to.emit(stkAave_staking, 'Staked').withArgs(
                pod.address,
                pod.address,
                stkAave_staked,
                stkAave_staked
            );

        });

        it(' should notify the correct amount to the Manager', async () => {

            const prev_pod_balance = await stkAave.balanceOf(pod.address)

            const update_tx = await pod.connect(podOwner).compoundStkAave()

            const tx_block = (await update_tx).blockNumber

            expect(await stkAave_staking.getTotalRewardsBalance(pod.address, { blockTag: tx_block })).to.be.eq(0)

            // We trust stkAave events for the amount claimed
            // but will compare it to transfers emitted
            const receipt = await update_tx.wait()
            const iface = stkAave_staking.interface;
            const staking_topic = iface.getEventTopic('Staked')
            const staking_log = receipt.logs.filter(x => x.topics.indexOf(staking_topic) >= 0);
            const staking_events = staking_log.map((log) => (iface.parseLog(log)).args)
            const stkAave_staked = staking_events[0].shares

            expect(await stkAave.balanceOf(pod.address)).to.be.eq(prev_pod_balance.add(stkAave_staked))

        });

        it(' should not claim or notify if there is nothing to claim or restake', async () => {

            await manager.connect(admin).clonePod(implementation.address)
            const podList = await manager.getCreatedPods()
            const otherPod = DullahanPod__factory.connect(podList[podList.length - 1], provider);

            await otherPod.connect(admin).init(
                manager.address,
                vault.address,
                registry.address,
                podOwner.address,
                collat.address,
                aCollat.address,
                delegate.address
            )

            const prev_pod_balance = await stkAave.balanceOf(otherPod.address)
            const prev_rented_amount = await manager.podRentedAmount(otherPod.address)

            const update_tx = await otherPod.connect(podOwner).compoundStkAave()

            expect(await stkAave.balanceOf(otherPod.address)).to.be.eq(prev_pod_balance)
            expect(await manager.podRentedAmount(otherPod.address)).to.be.eq(prev_rented_amount)

            await expect(update_tx).not.to.emit(stkAave_staking, 'RewardsClaimed')
            await expect(update_tx).not.to.emit(stkAave_staking, 'Staked')

        });

    });

    describe('mintGho', async () => {

        const deposit_amount = ethers.utils.parseEther('500')
        const borrow_amount = ethers.utils.parseEther('200')

        beforeEach(async () => {

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

            await collat.connect(admin).mint(podOwner.address, deposit_amount.mul(2))

            await collat.connect(podOwner).approve(pod.address, deposit_amount)
            await pod.connect(podOwner).depositCollateral(deposit_amount)

        });

        it(' should mint the correct amount from the Market (& emit correct Event)', async () => {

            const previous_pod_balance = await gho.balanceOf(pod.address)
            const previous_user_balance = await gho.balanceOf(podOwner.address)

            const previous_pod_debt = await ghoDebt.balanceOf(pod.address)

            const mint_tx = await pod.connect(podOwner).mintGho(borrow_amount, podOwner.address)

            const new_pod_balance = await gho.balanceOf(pod.address)
            const new_user_balance = await gho.balanceOf(podOwner.address)

            const new_pod_debt = await ghoDebt.balanceOf(pod.address)

            const fee_ratio = await manager.mintFeeRatio()
            const expected_amount = borrow_amount.mul(MAX_BPS.sub(fee_ratio)).div(MAX_BPS)

            expect(new_pod_balance).to.be.eq(previous_pod_balance)
            expect(new_user_balance).to.be.eq(previous_user_balance.add(expected_amount))

            expect(new_pod_debt).to.be.eq(previous_pod_debt.add(borrow_amount))

            await expect(mint_tx).to.emit(pod, "GhoMinted")
            .withArgs(expected_amount);

        });

        it(' should rent the correct amount of stkAave (& emit correct Event)', async () => {

            const previous_pod_balance = await stkAave.balanceOf(pod.address)

            const previous_pod_rented_amount = await manager.podRentedAmount(pod.address)

            const mint_tx = await pod.connect(podOwner).mintGho(borrow_amount, podOwner.address)

            const new_pod_balance = await stkAave.balanceOf(pod.address)

            const new_pod_rented_amount = await manager.podRentedAmount(pod.address)

            const ratio = await manager.ghoToStkAaveRatio()
            const expected_rented_amount = borrow_amount.mul(UNIT).div(ratio)

            expect(new_pod_balance).to.be.eq(previous_pod_balance.add(expected_rented_amount))
            expect(new_pod_rented_amount).to.be.eq(previous_pod_rented_amount.add(expected_rented_amount))

            await expect(mint_tx).to.emit(stkAave, "Transfer")
            .withArgs(vault.address, pod.address, expected_rented_amount);

        });

        it(' should take the correct minting fee & notify it to the Manager', async () => {

            const previous_manager_balance = await gho.balanceOf(manager.address)
            const previous_manager_reserve = await manager.reserveAmount()

            const mint_tx = await pod.connect(podOwner).mintGho(borrow_amount, podOwner.address)

            const new_manager_balance = await gho.balanceOf(manager.address)
            const new_manager_reserve = await manager.reserveAmount()

            const fee_ratio = await manager.mintFeeRatio()
            const expected_fee_amount = borrow_amount.mul(fee_ratio).div(MAX_BPS)

            expect(new_manager_balance).to.be.eq(previous_manager_balance.add(expected_fee_amount))
            expect(new_manager_reserve).to.be.eq(previous_manager_reserve.add(expected_fee_amount))

            await expect(mint_tx).to.emit(gho, "Transfer")
            .withArgs(pod.address, manager.address, expected_fee_amount);

        });

        it(' should take all available stkAave if not enough to cover borrow amount', async () => {
            
            const bigger_borrow_amount = ethers.utils.parseEther('5000')

            const small_stkAave_balance = ethers.utils.parseEther('15')
            await vault.connect(admin).withdrawStkAave(
                await stkAave.balanceOf(vault.address)
            )
            await stkAave.connect(admin).transfer(vault.address, small_stkAave_balance)
            
            const previous_pod_balance = await stkAave.balanceOf(pod.address)

            const previous_pod_rented_amount = await manager.podRentedAmount(pod.address)

            const mint_tx = await pod.connect(podOwner).mintGho(bigger_borrow_amount, podOwner.address)

            const new_pod_balance = await stkAave.balanceOf(pod.address)

            const new_pod_rented_amount = await manager.podRentedAmount(pod.address)

            expect(new_pod_balance).to.be.eq(previous_pod_balance.add(small_stkAave_balance))
            expect(new_pod_rented_amount).to.be.eq(previous_pod_rented_amount.add(small_stkAave_balance))

            await expect(mint_tx).to.emit(stkAave, "Transfer")
            .withArgs(vault.address, pod.address, small_stkAave_balance);

        });

        it(' should allow to mint to another receiver', async () => {

            const previous_pod_balance = await gho.balanceOf(pod.address)
            const previous_user_balance = await gho.balanceOf(podOwner.address)
            const previous_recevier_balance = await gho.balanceOf(otherUser.address)

            const previous_pod_debt = await ghoDebt.balanceOf(pod.address)

            const mint_tx = await pod.connect(podOwner).mintGho(borrow_amount, otherUser.address)

            const new_pod_balance = await gho.balanceOf(pod.address)
            const new_user_balance = await gho.balanceOf(podOwner.address)
            const new_receiver_balance = await gho.balanceOf(otherUser.address)

            const new_pod_debt = await ghoDebt.balanceOf(pod.address)

            const fee_ratio = await manager.mintFeeRatio()
            const expected_amount = borrow_amount.mul(MAX_BPS.sub(fee_ratio)).div(MAX_BPS)

            expect(new_pod_balance).to.be.eq(previous_pod_balance)
            expect(new_user_balance).to.be.eq(previous_user_balance)
            expect(new_receiver_balance).to.be.eq(previous_recevier_balance.add(expected_amount))

            expect(new_pod_debt).to.be.eq(previous_pod_debt.add(borrow_amount))

            await expect(mint_tx).to.emit(pod, "GhoMinted")
            .withArgs(expected_amount);

        });

        it(' should update Pod state in Manager', async () => {

            const mint_tx = await pod.connect(podOwner).mintGho(borrow_amount, podOwner.address)

            const tx_block = (await mint_tx).blockNumber

            expect(await manager.podStateUpdate(pod.address)).to.be.eq(tx_block)

        });

        it(' should fail if amount in under MIN_MINT_AMOUNT', async () => {

            const under_min_amount = BigNumber.from('5000000')

            await expect(
                pod.connect(podOwner).mintGho(under_min_amount, podOwner.address)
            ).to.be.revertedWith('MintAmountUnderMinimum')

        });

        it(' should fail if given address 0x0', async () => {

            await expect(
                pod.connect(podOwner).mintGho(borrow_amount, ethers.constants.AddressZero)
            ).to.be.revertedWith('AddressZero')

        });
        
        it(' should fail if given a null amount', async () => {

            await expect(
                pod.connect(podOwner).mintGho(0, podOwner.address)
            ).to.be.revertedWith('NullAmount')

        });

        it(' should only be callable by the Pod owner', async () => {

            await expect(
                pod.connect(admin).mintGho(borrow_amount, podOwner.address)
            ).to.be.revertedWith('NotPodOwner')

            await expect(
                pod.connect(otherUser).mintGho(borrow_amount, podOwner.address)
            ).to.be.revertedWith('NotPodOwner')

        });

    });

    describe('repayGho', async () => {

        const deposit_amount = ethers.utils.parseEther('500')
        const borrow_amount = ethers.utils.parseEther('200')
        const repay_amount = ethers.utils.parseEther('100')
        const extra_debt_amount = ethers.utils.parseEther('50')
        const fee_amount = ethers.utils.parseEther('15')

        beforeEach(async () => {

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

            await collat.connect(admin).mint(podOwner.address, deposit_amount.mul(2))

            await collat.connect(podOwner).approve(pod.address, deposit_amount)
            await pod.connect(podOwner).depositCollateral(deposit_amount)

            await pod.connect(podOwner).mintGho(borrow_amount, podOwner.address)

            await advanceTime(WEEK.mul(2).toNumber())

            await market.increaseUserDebt(pod.address, extra_debt_amount)

            await manager.setPodOwedFees(pod.address, fee_amount)

        });

        it(' should repay 1st the fees then the debt (& emit correct Event)', async () => {

            await gho.connect(podOwner).approve(pod.address, repay_amount)

            const previous_owed_fees = await manager.podOwedFees(pod.address)
            const previous_pod_debt = await ghoDebt.balanceOf(pod.address)

            const repay_tx = await pod.connect(podOwner).repayGho(repay_amount)

            const new_owed_fees = await manager.podOwedFees(pod.address)
            const new_pod_debt = await ghoDebt.balanceOf(pod.address)

            const expected_debt_repayed = repay_amount.sub(previous_owed_fees)

            expect(new_owed_fees).to.be.eq(0)
            expect(new_pod_debt).to.be.eq(previous_pod_debt.sub(expected_debt_repayed))

            await expect(repay_tx).to.emit(gho, "Transfer")
            .withArgs(podOwner.address, pod.address, repay_amount);

            await expect(repay_tx).to.emit(gho, "Transfer")
            .withArgs(pod.address, manager.address, previous_owed_fees);

            await expect(repay_tx).to.emit(gho, "Transfer")
            .withArgs(pod.address, ethers.constants.AddressZero, expected_debt_repayed);

            await expect(repay_tx).to.emit(pod, "GhoRepayed")
            .withArgs(repay_amount);

        });

        it(' should only repay fees if the amount is too small', async () => {

            await gho.connect(podOwner).approve(pod.address, repay_amount)

            const previous_owed_fees = await manager.podOwedFees(pod.address)
            const previous_pod_debt = await ghoDebt.balanceOf(pod.address)

            const small_repay_amount = previous_owed_fees.div(2)

            const repay_tx = await pod.connect(podOwner).repayGho(small_repay_amount)

            const new_owed_fees = await manager.podOwedFees(pod.address)
            const new_pod_debt = await ghoDebt.balanceOf(pod.address)

            expect(new_owed_fees).to.be.eq(previous_owed_fees.sub(small_repay_amount))
            expect(new_pod_debt).to.be.eq(previous_pod_debt)

            await expect(repay_tx).to.emit(gho, "Transfer")
            .withArgs(podOwner.address, pod.address, small_repay_amount);

            await expect(repay_tx).to.emit(gho, "Transfer")
            .withArgs(pod.address, manager.address, small_repay_amount);

            await expect(repay_tx).to.emit(pod, "GhoRepayed")
            .withArgs(small_repay_amount);

        });

        it(' should repay all the fees & the debt if given MAX UINT256', async () => {

            await gho.connect(admin).mint(podOwner.address, ethers.utils.parseEther('500'))

            await gho.connect(podOwner).approve(pod.address, MAX_UINT256)

            const previous_owed_fees = await manager.podOwedFees(pod.address)
            const previous_pod_debt = await ghoDebt.balanceOf(pod.address)

            const repay_tx = await pod.connect(podOwner).repayGho(MAX_UINT256)

            expect(await manager.podOwedFees(pod.address)).to.be.eq(0)
            expect(await ghoDebt.balanceOf(pod.address)).to.be.eq(0)

            const total_amount = previous_owed_fees.add(previous_pod_debt)

            await expect(repay_tx).to.emit(gho, "Transfer")
            .withArgs(podOwner.address, pod.address, total_amount);

            await expect(repay_tx).to.emit(gho, "Transfer")
            .withArgs(pod.address, manager.address, previous_owed_fees);

            await expect(repay_tx).to.emit(gho, "Transfer")
            .withArgs(pod.address, ethers.constants.AddressZero, previous_pod_debt);

            await expect(repay_tx).to.emit(pod, "GhoRepayed")
            .withArgs(total_amount);

        });

        it(' should update Pod state in Manager', async () => {

            await gho.connect(podOwner).approve(pod.address, repay_amount)

            const repay_tx = await pod.connect(podOwner).repayGho(repay_amount)

            const tx_block = (await repay_tx).blockNumber

            expect(await manager.podStateUpdate(pod.address)).to.be.eq(tx_block)

        });

        it(' should return all non necessary stkAave to the Vault', async () => {

            await gho.connect(podOwner).approve(pod.address, repay_amount)

            const previous_pod_balance = await stkAave.balanceOf(pod.address)

            const repay_tx = await pod.connect(podOwner).repayGho(repay_amount)

            const tx_block = (await repay_tx).blockNumber

            expect(await stkAave_staking.getTotalRewardsBalance(pod.address, { blockTag: tx_block })).to.be.eq(0)

            // We trust stkAave events for the amount claimed
            // but will compare it to transfers emitted
            const receipt = await repay_tx.wait()
            const iface = stkAave_staking.interface;
            const staking_topic = iface.getEventTopic('Staked')
            const staking_log = receipt.logs.filter(x => x.topics.indexOf(staking_topic) >= 0);
            const staking_events = staking_log.map((log) => (iface.parseLog(log)).args)
            const stkAave_staked = staking_events[0].shares

            const new_pod_balance = await stkAave.balanceOf(pod.address)

            const new_pod_rented_amount = await manager.podRentedAmount(pod.address)
            
            const new_pod_debt = await ghoDebt.balanceOf(pod.address)

            const ratio = await manager.ghoToStkAaveRatio()
            const expected_current_rented_amount = new_pod_debt.mul(UNIT).div(ratio)

            const returned_amount = previous_pod_balance.add(stkAave_staked).sub(expected_current_rented_amount)

            expect(new_pod_balance).to.be.eq(expected_current_rented_amount)
            expect(new_pod_rented_amount).to.be.eq(expected_current_rented_amount)

            await expect(repay_tx).to.emit(stkAave, "Transfer")
            .withArgs(pod.address, vault.address, returned_amount);

        });

        it(' should notify the Manager for paid fees correctly', async () => {

            await gho.connect(podOwner).approve(pod.address, repay_amount)

            const previous_owed_fees = await manager.podOwedFees(pod.address)

            const previous_reserve = await manager.reserveAmount()

            await pod.connect(podOwner).repayGho(repay_amount)

            const new_reserve = await manager.reserveAmount()

            expect(new_reserve).to.be.eq(previous_reserve.add(previous_owed_fees))

        });
        
        it(' should fail if given a null amount', async () => {

            await expect(
                pod.connect(podOwner).repayGho(0)
            ).to.be.revertedWith('NullAmount')

        });

        it(' should only be callable by the Pod owner', async () => {

            await expect(
                pod.connect(admin).repayGho(repay_amount)
            ).to.be.revertedWith('NotPodOwner')

            await expect(
                pod.connect(otherUser).repayGho(repay_amount)
            ).to.be.revertedWith('NotPodOwner')

        });

    });

    describe('repayGhoAndWithdrawCollateral', async () => {

        const deposit_amount = ethers.utils.parseEther('500')
        const borrow_amount = ethers.utils.parseEther('200')

        const repay_amount = ethers.utils.parseEther('100')
        const extra_debt_amount = ethers.utils.parseEther('50')
        const fee_amount = ethers.utils.parseEther('15')

        const withdraw_amount = ethers.utils.parseEther('75')

        beforeEach(async () => {

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

            await collat.connect(admin).mint(podOwner.address, deposit_amount.mul(2))

            await collat.connect(podOwner).approve(pod.address, deposit_amount)
            await pod.connect(podOwner).depositCollateral(deposit_amount)

            await pod.connect(podOwner).mintGho(borrow_amount, podOwner.address)

            await advanceTime(WEEK.mul(2).toNumber())

            await market.increaseUserDebt(pod.address, extra_debt_amount)

            await manager.setPodOwedFees(pod.address, fee_amount)

        });

        it(' should repay correctly the fees & debt, and allwo to withdraw some collateral', async () => {

            await gho.connect(podOwner).approve(pod.address, repay_amount)

            const previous_owed_fees = await manager.podOwedFees(pod.address)
            const previous_pod_debt = await ghoDebt.balanceOf(pod.address)

            const previous_pod_balance = await collat.balanceOf(pod.address)
            const previous_user_balance = await collat.balanceOf(podOwner.address)
            const previous_market_balance = await collat.balanceOf(market.address)

            const previous_pod_aToken_balance = await aCollat.balanceOf(pod.address)

            const repay_withdraw_tx = await pod.connect(podOwner).repayGhoAndWithdrawCollateral(repay_amount, withdraw_amount, podOwner.address)

            const new_owed_fees = await manager.podOwedFees(pod.address)
            const new_pod_debt = await ghoDebt.balanceOf(pod.address)

            const expected_debt_repayed = repay_amount.sub(previous_owed_fees)

            expect(new_owed_fees).to.be.eq(0)
            expect(new_pod_debt).to.be.eq(previous_pod_debt.sub(expected_debt_repayed))

            await expect(repay_withdraw_tx).to.emit(gho, "Transfer")
            .withArgs(podOwner.address, pod.address, repay_amount);

            await expect(repay_withdraw_tx).to.emit(gho, "Transfer")
            .withArgs(pod.address, manager.address, previous_owed_fees);

            await expect(repay_withdraw_tx).to.emit(gho, "Transfer")
            .withArgs(pod.address, ethers.constants.AddressZero, expected_debt_repayed);

            await expect(repay_withdraw_tx).to.emit(pod, "GhoRepayed")
            .withArgs(repay_amount);

            const new_pod_balance = await collat.balanceOf(pod.address)
            const new_user_balance = await collat.balanceOf(podOwner.address)
            const new_market_balance = await collat.balanceOf(market.address)

            const new_pod_aToken_balance = await aCollat.balanceOf(pod.address)

            expect(new_pod_balance).to.be.eq(previous_pod_balance)
            expect(new_user_balance).to.be.eq(previous_user_balance.add(withdraw_amount))
            expect(new_market_balance).to.be.eq(previous_market_balance.sub(withdraw_amount))

            expect(new_pod_aToken_balance).to.be.eq(previous_pod_aToken_balance.sub(withdraw_amount))

            await expect(repay_withdraw_tx).to.emit(collat, "Transfer")
            .withArgs(market.address, podOwner.address, withdraw_amount);

            await expect(repay_withdraw_tx).to.emit(pod, "CollateralWithdrawn")
            .withArgs(collat.address, withdraw_amount);

        });

        it(' should repay all & withdraw all if given MAX_UINT256 on both parameters', async () => {

            await gho.connect(admin).mint(podOwner.address, ethers.utils.parseEther('500'))

            await market.connect(admin).increaseUserDeposit(
                collat.address,
                pod.address,
                (await aCollat.balanceOf(pod.address)).mul(2).div(10)
            )

            await gho.connect(podOwner).approve(pod.address, MAX_UINT256)

            const previous_owed_fees = await manager.podOwedFees(pod.address)
            const previous_pod_debt = await ghoDebt.balanceOf(pod.address)

            const previous_pod_balance = await collat.balanceOf(pod.address)
            const previous_user_balance = await collat.balanceOf(podOwner.address)
            const previous_market_balance = await collat.balanceOf(market.address)

            const previous_pod_aToken_balance = await aCollat.balanceOf(pod.address)

            const repay_withdraw_tx = await pod.connect(podOwner).repayGhoAndWithdrawCollateral(MAX_UINT256, MAX_UINT256, podOwner.address)

            expect(await manager.podOwedFees(pod.address)).to.be.eq(0)
            expect(await ghoDebt.balanceOf(pod.address)).to.be.eq(0)

            const total_amount = previous_owed_fees.add(previous_pod_debt)

            await expect(repay_withdraw_tx).to.emit(gho, "Transfer")
            .withArgs(podOwner.address, pod.address, total_amount);

            await expect(repay_withdraw_tx).to.emit(gho, "Transfer")
            .withArgs(pod.address, manager.address, previous_owed_fees);

            await expect(repay_withdraw_tx).to.emit(gho, "Transfer")
            .withArgs(pod.address, ethers.constants.AddressZero, previous_pod_debt);

            await expect(repay_withdraw_tx).to.emit(pod, "GhoRepayed")
            .withArgs(total_amount);

            const new_pod_balance = await collat.balanceOf(pod.address)
            const new_user_balance = await collat.balanceOf(podOwner.address)
            const new_market_balance = await collat.balanceOf(market.address)

            const new_pod_aToken_balance = await aCollat.balanceOf(pod.address)

            expect(new_pod_balance).to.be.eq(previous_pod_balance)
            expect(new_user_balance).to.be.eq(previous_user_balance.add(previous_pod_aToken_balance))
            expect(new_market_balance).to.be.eq(previous_market_balance.sub(previous_pod_aToken_balance))

            expect(new_pod_aToken_balance).to.be.eq(previous_pod_aToken_balance.sub(previous_pod_aToken_balance))
            expect(new_pod_aToken_balance).to.be.eq(0)

            await expect(repay_withdraw_tx).to.emit(collat, "Transfer")
            .withArgs(market.address, podOwner.address, previous_pod_aToken_balance);

            await expect(repay_withdraw_tx).to.emit(pod, "CollateralWithdrawn")
            .withArgs(collat.address, previous_pod_aToken_balance);

        });

        it(' should fail if given address 0x0', async () => {

            await expect(
                pod.connect(podOwner).repayGhoAndWithdrawCollateral(repay_amount, withdraw_amount, ethers.constants.AddressZero)
            ).to.be.revertedWith('AddressZero')

        });
        
        it(' should fail if given a null amount', async () => {

            await expect(
                pod.connect(podOwner).repayGhoAndWithdrawCollateral(repay_amount, 0, podOwner.address)
            ).to.be.revertedWith('NullAmount')

            await expect(
                pod.connect(podOwner).repayGhoAndWithdrawCollateral(0, withdraw_amount, podOwner.address)
            ).to.be.revertedWith('NullAmount')

        });

        it(' should only be callable by the Pod owner', async () => {

            await expect(
                pod.connect(admin).repayGhoAndWithdrawCollateral(repay_amount, withdraw_amount, podOwner.address)
            ).to.be.revertedWith('NotPodOwner')

            await expect(
                pod.connect(otherUser).repayGhoAndWithdrawCollateral(repay_amount, withdraw_amount, podOwner.address)
            ).to.be.revertedWith('NotPodOwner')

        });

    });

    describe('rentStkAave', async () => {

        const deposit_amount = ethers.utils.parseEther('500')
        const borrow_amount = ethers.utils.parseEther('200')

        beforeEach(async () => {

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

            await collat.connect(admin).mint(podOwner.address, deposit_amount.mul(2))

            await collat.connect(podOwner).approve(pod.address, deposit_amount)
            await pod.connect(podOwner).depositCollateral(deposit_amount)

            await pod.connect(podOwner).mintGho(borrow_amount, podOwner.address)

            await advanceTime(WEEK.mul(2).toNumber())

        });

        it(' should claim stkAave rewards & get more stkAave to match total GHO debt', async () => {

            const extra_debt_amount = ethers.utils.parseEther('25')

            await market.connect(admin).increaseUserDebt(pod.address, extra_debt_amount)

            const previous_pod_balance = await stkAave.balanceOf(pod.address)

            const previous_pod_rented_amount = await manager.podRentedAmount(pod.address)

            const rent_tx = await pod.connect(podOwner).rentStkAave()
            const tx_block = (await rent_tx).blockNumber

            expect(await stkAave_staking.getTotalRewardsBalance(pod.address, { blockTag: tx_block })).to.be.eq(0)

            // We trust stkAave events for the amount claimed
            // but will compare it to transfers emitted
            const receipt = await rent_tx.wait()
            const iface = stkAave_staking.interface;
            const staking_topic = iface.getEventTopic('Staked')
            const staking_log = receipt.logs.filter(x => x.topics.indexOf(staking_topic) >= 0);
            const staking_events = staking_log.map((log) => (iface.parseLog(log)).args)
            const stkAave_staked = staking_events[0].shares

            const new_pod_balance = await stkAave.balanceOf(pod.address)

            const new_pod_rented_amount = await manager.podRentedAmount(pod.address)

            const ratio = await manager.ghoToStkAaveRatio()
            const expected_rented_amount = extra_debt_amount.mul(UNIT).div(ratio).sub(stkAave_staked)

            const total_received_stkAave = expected_rented_amount.add(stkAave_staked)

            expect(new_pod_balance).to.be.eq(previous_pod_balance.add(total_received_stkAave))
            expect(new_pod_rented_amount).to.be.eq(previous_pod_rented_amount.add(total_received_stkAave))

            await expect(rent_tx).to.emit(pod, "RentedStkAave")

            await expect(rent_tx).to.emit(stkAave, "Transfer")
            .withArgs(vault.address, pod.address, expected_rented_amount);

        });

        it(' should not get more if stkAave already match GHO debt or is more than needed', async () => {
            
            const repay_amount = ethers.utils.parseEther('100')

            await gho.connect(podOwner).approve(pod.address, repay_amount)
            await pod.connect(podOwner).repayGho(repay_amount)

            const previous_pod_balance = await stkAave.balanceOf(pod.address)

            const previous_pod_rented_amount = await manager.podRentedAmount(pod.address)

            const rent_tx = await pod.connect(podOwner).rentStkAave()
            const tx_block = (await rent_tx).blockNumber

            expect(await stkAave_staking.getTotalRewardsBalance(pod.address, { blockTag: tx_block })).to.be.eq(0)

            // We trust stkAave events for the amount claimed
            // but will compare it to transfers emitted
            const receipt = await rent_tx.wait()
            const iface = stkAave_staking.interface;
            const staking_topic = iface.getEventTopic('Staked')
            const staking_log = receipt.logs.filter(x => x.topics.indexOf(staking_topic) >= 0);
            const staking_events = staking_log.map((log) => (iface.parseLog(log)).args)
            const stkAave_staked = staking_events[0].shares

            const new_pod_balance = await stkAave.balanceOf(pod.address)

            const new_pod_rented_amount = await manager.podRentedAmount(pod.address)

            expect(new_pod_balance).to.be.eq(previous_pod_balance.add(stkAave_staked))
            expect(new_pod_rented_amount).to.be.eq(previous_pod_rented_amount.add(stkAave_staked))

            await expect(rent_tx).to.emit(pod, "RentedStkAave")

        });

        it(' should update Pod state in Manager', async () => {

            const tx = await pod.connect(podOwner).rentStkAave()

            const tx_block = (await tx).blockNumber

            expect(await manager.podStateUpdate(pod.address)).to.be.eq(tx_block)

        });

        it(' should only be callable by the Pod owner', async () => {

            await expect(
                pod.connect(admin).rentStkAave()
            ).to.be.revertedWith('NotPodOwner')

            await expect(
                pod.connect(otherUser).rentStkAave()
            ).to.be.revertedWith('NotPodOwner')

        });

    });

});