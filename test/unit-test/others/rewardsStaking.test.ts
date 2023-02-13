const hre = require("hardhat");
import { ethers } from "hardhat";
import chai from "chai";
import { BigNumber } from "ethers";
import { solidity } from "ethereum-waffle";
import { DullahanRewardsStaking } from "../../../typechain/DullahanRewardsStaking";
import { MockScalingERC20 } from "../../../typechain/test/MockScalingERC20";
import { IERC20 } from "../../../typechain/oz/interfaces/IERC20";
import { IERC20__factory } from "../../../typechain/factories/oz/interfaces/IERC20__factory";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ContractFactory } from "@ethersproject/contracts";

import {
    getERC20,
    advanceTime,
    resetFork
} from "../../utils/utils";

import {
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

let stakingFactory: ContractFactory
let mockTokenFactory: ContractFactory

const UNIT = ethers.utils.parseEther('1')
const WEEK = BigNumber.from(7 * 86400);
const RAY = ethers.utils.parseEther('1000000000')

const DISTRIBUTION_DURATION = BigNumber.from(7 * 86400);

describe('DullahanRewardsStaking contract tests', () => {
    let admin: SignerWithAddress

    let staking: DullahanRewardsStaking
    let token: MockScalingERC20

    let rewardToken1: IERC20
    let rewardToken2: IERC20

    let rewardManager: SignerWithAddress
    let rewardManager2: SignerWithAddress

    let depositor1: SignerWithAddress
    let depositor2: SignerWithAddress
    let depositor3: SignerWithAddress

    const depositor1_amount = ethers.utils.parseEther('1500')
    const depositor2_amount = ethers.utils.parseEther('750')
    const depositor3_amount = ethers.utils.parseEther('2450')

    before(async () => {
        await resetFork();

        [admin, rewardManager, rewardManager2, depositor1, depositor2, depositor3] = await ethers.getSigners();

        stakingFactory = await ethers.getContractFactory("DullahanRewardsStaking");
        mockTokenFactory = await ethers.getContractFactory("MockScalingERC20");

        rewardToken1 = IERC20__factory.connect(REWARD_TOKEN_1, provider);
        rewardToken2 = IERC20__factory.connect(REWARD_TOKEN_2, provider);

        await getERC20(admin, HOLDER_REWARD_1, rewardToken1, rewardManager.address, AMOUNT_REWARD_1);
        await getERC20(admin, HOLDER_REWARD_2, rewardToken2, rewardManager2.address, AMOUNT_REWARD_2);

    });

    beforeEach(async () => {

        token = (await mockTokenFactory.connect(admin).deploy(
            "Dullahan stkAave",
            "dstkAAVE"
        )) as MockScalingERC20;
        await token.deployed();

        staking = (await stakingFactory.connect(admin).deploy(
            token.address
        )) as DullahanRewardsStaking;
        await staking.deployed();

        await token.connect(admin).mint(ethers.utils.parseEther('10'), admin.address)
        await token.connect(admin).mint(depositor1_amount, depositor1.address)
        await token.connect(admin).mint(depositor2_amount, depositor2.address)
        await token.connect(admin).mint(depositor3_amount, depositor3.address)

    });

    it(' should be deployed & have correct parameters', async () => {
        expect(staking.address).to.properAddress

        expect(await staking.initialized()).to.be.false

        expect(await staking.owner()).to.be.eq(admin.address)

        expect(await staking.vault()).to.be.eq(token.address)

        expect(await staking.totalScaledAmount()).to.be.eq(0)
        expect(await staking.totalAssets()).to.be.eq(0)

        expect(await staking.getRewardList()).to.be.empty

    });

    describe('init', async () => {

        const seed_deposit = ethers.utils.parseEther('0.001')

        beforeEach(async () => {

            await token.connect(admin).approve(staking.address, seed_deposit)

        });

        it(' should initialize the contract and make the inital deposit (& emit the correct Event)', async () => {

            const init_tx = await staking.connect(admin).init()

            expect(await staking.initialized()).to.be.true

            expect(await staking.totalScaledAmount()).to.be.eq(seed_deposit)
            expect(await token.balanceOf(staking.address)).to.be.eq(seed_deposit)
            expect(await staking.userScaledBalances(admin.address)).to.be.eq(seed_deposit)

            await expect(init_tx).to.emit(staking, 'Initialized')

        });

        it(' should stake correctly & update the state (& emit correct Event)', async () => {

            const old_user_balance = await token.balanceOf(admin.address)
            const old_staking_balance = await token.balanceOf(staking.address)

            const old_user_scaled_balance = await staking.userScaledBalances(admin.address)
            const old_total_scaled_supply = await staking.totalScaledAmount()

            const old_user_staked_amount = await staking.userCurrentStakedAmount(admin.address)

            const init_tx = await staking.connect(admin).init()

            const new_user_balance = await token.balanceOf(admin.address)
            const new_staking_balance = await token.balanceOf(staking.address)

            const expected_index = RAY; // because initial staking

            const expected_scaled_amount = seed_deposit.mul(RAY).add(expected_index.div(2)).div(expected_index)

            const new_user_scaled_balance = await staking.userScaledBalances(admin.address)
            const new_total_scaled_supply = await staking.totalScaledAmount()

            const new_user_staked_amount = await staking.userCurrentStakedAmount(admin.address)

            expect(new_user_balance).to.be.eq(old_user_balance.sub(seed_deposit))
            expect(new_staking_balance).to.be.eq(old_staking_balance.add(seed_deposit))

            expect(new_user_scaled_balance).to.be.eq(old_user_scaled_balance.add(expected_scaled_amount))
            expect(new_total_scaled_supply).to.be.eq(old_total_scaled_supply.add(expected_scaled_amount))

            expect(new_user_staked_amount).to.be.eq(old_user_staked_amount.add(seed_deposit))

            await expect(init_tx).to.emit(staking, "Staked")
            .withArgs(admin.address, admin.address, seed_deposit, expected_scaled_amount);

            await expect(init_tx).to.emit(token, "Transfer")
            .withArgs(admin.address, staking.address, seed_deposit);

        });

        it(' should only be able to initialize once', async () => {

            await staking.connect(admin).init()

            await expect(
                staking.connect(admin).init()
            ).to.be.revertedWith('AlreadyInitialized')

        });

        it(' should only be callable by admin', async () => {

            await expect(
                staking.connect(depositor1).init()
            ).to.be.revertedWith('Ownable: caller is not the owner')

        });

        it(' should block all methods when contract is not initialized', async () => {

            await expect(
                staking.connect(depositor1).stake(ethers.utils.parseEther('5'), depositor1.address)
            ).to.be.revertedWith('NotInitialized')

            await expect(
                staking.connect(depositor1).unstake(ethers.utils.parseEther('5'), depositor1.address)
            ).to.be.revertedWith('NotInitialized')

            await expect(
                staking.connect(depositor1).updateRewardState(rewardToken1.address)
            ).to.be.revertedWith('NotInitialized')

            await expect(
                staking.connect(depositor1).updateAllRewardState()
            ).to.be.revertedWith('NotInitialized')

            await expect(
                staking.connect(depositor1).claimRewards(rewardToken1.address, depositor1.address)
            ).to.be.revertedWith('NotInitialized')

            await expect(
                staking.connect(depositor1).claimAllRewards(depositor1.address)
            ).to.be.revertedWith('NotInitialized')

        });

    });

    describe('addRewardDepositor', async () => {

        it(' should add the reward depositor correctly (& emit correct Event)', async () => {

            expect(await staking.rewardDepositors(rewardManager.address)).to.be.false

            const add_tx = await staking.connect(admin).addRewardDepositor(rewardManager.address)

            expect(await staking.rewardDepositors(rewardManager.address)).to.be.true

            await expect(add_tx).to.emit(staking, "AddedRewardDepositor")
            .withArgs(rewardManager.address);

        });

        it(' should fail if already added', async () => {

            await staking.connect(admin).addRewardDepositor(rewardManager.address)

            await expect(
                staking.connect(admin).addRewardDepositor(rewardManager.address)
            ).to.be.revertedWith('AlreadyListedDepositor')

        });

        it(' should fail if given the address 0x0', async () => {

            await expect(
                staking.connect(admin).addRewardDepositor(ethers.constants.AddressZero)
            ).to.be.revertedWith('AddressZero')

        });

        it(' should only be callable for owner', async () => {

            await expect(
                staking.connect(rewardManager).addRewardDepositor(rewardManager.address)
            ).to.be.revertedWith('Ownable: caller is not the owner')

        });

    });

    describe('removeRewardDepositor', async () => {

        beforeEach(async () => {

            await staking.connect(admin).addRewardDepositor(rewardManager.address)
            await staking.connect(admin).addRewardDepositor(rewardManager2.address)

        });

        it(' should remove the reward depositor correctly (& emit correct Event)', async () => {

            expect(await staking.rewardDepositors(rewardManager.address)).to.be.true
            expect(await staking.rewardDepositors(rewardManager2.address)).to.be.true

            const remove_tx = await staking.connect(admin).removeRewardDepositor(rewardManager.address)

            expect(await staking.rewardDepositors(rewardManager.address)).to.be.false
            expect(await staking.rewardDepositors(rewardManager2.address)).to.be.true

            await expect(remove_tx).to.emit(staking, "RemovedRewardDepositor")
            .withArgs(rewardManager.address);

        });

        it(' should fail if not listed', async () => {

            await expect(
                staking.connect(admin).removeRewardDepositor(depositor1.address)
            ).to.be.revertedWith('NotListedDepositor')

        });

        it(' should fail if already removed', async () => {

            await staking.connect(admin).removeRewardDepositor(rewardManager2.address)

            await expect(
                staking.connect(admin).removeRewardDepositor(rewardManager2.address)
            ).to.be.revertedWith('NotListedDepositor')

        });

        it(' should fail if given the address 0x0', async () => {

            await expect(
                staking.connect(admin).removeRewardDepositor(ethers.constants.AddressZero)
            ).to.be.revertedWith('AddressZero')

        });

        it(' should only be callable for owner', async () => {

            await expect(
                staking.connect(rewardManager).removeRewardDepositor(rewardManager2.address)
            ).to.be.revertedWith('Ownable: caller is not the owner')

        });

    });

    describe('setUserAllowedClaimer', async () => {

        it(' should set the correct claimer (& emit correct Event)', async () => {

            const set_tx = await staking.connect(admin).setUserAllowedClaimer(depositor1.address, depositor2.address)

            expect(await staking.allowedClaimer(depositor1.address)).to.be.eq(depositor2.address)

            await expect(set_tx).to.emit(staking, "SetUserAllowedClaimer")
            .withArgs(depositor1.address, depositor2.address);

        });

        it(' should update the claimer correctly', async () => {

            await staking.connect(admin).setUserAllowedClaimer(depositor1.address, depositor2.address)

            expect(await staking.allowedClaimer(depositor1.address)).to.be.eq(depositor2.address)

            const set_tx = await staking.connect(admin).setUserAllowedClaimer(depositor1.address, depositor3.address)

            expect(await staking.allowedClaimer(depositor1.address)).to.be.eq(depositor3.address)

            await expect(set_tx).to.emit(staking, "SetUserAllowedClaimer")
            .withArgs(depositor1.address, depositor3.address);

        });

        it(' should fail if given address 0x0', async () => {

            await expect(
                staking.connect(admin).setUserAllowedClaimer(depositor1.address, ethers.constants.AddressZero)
            ).to.be.revertedWith('AddressZero')

            await expect(
                staking.connect(admin).setUserAllowedClaimer(ethers.constants.AddressZero, depositor2.address)
            ).to.be.revertedWith('AddressZero')

        });

        it(' should only be callable for owner', async () => {

            await expect(
                staking.connect(depositor1).setUserAllowedClaimer(depositor2.address, depositor1.address)
            ).to.be.revertedWith('Ownable: caller is not the owner')

        });

    });

    describe('queueRewards', async () => {

        const total_amount = ethers.utils.parseEther('1500')

        beforeEach(async () => {

            await token.connect(admin).approve(staking.address, ethers.constants.MaxUint256)
            await staking.connect(admin).init()

            await staking.connect(admin).addRewardDepositor(rewardManager.address)
            await staking.connect(admin).addRewardDepositor(rewardManager2.address)

            await token.connect(depositor1).approve(staking.address, depositor1_amount)
            await token.connect(depositor2).approve(staking.address, depositor2_amount)

            await staking.connect(depositor1).stake(depositor1_amount, depositor1.address)
            await staking.connect(depositor2).stake(depositor2_amount, depositor2.address)

        });

        it(' should set the reward distribution correctly (& emit correct Event)', async () => {

            const expected_drop_per_sec = total_amount.div(DISTRIBUTION_DURATION)

            const queue_tx = await staking.connect(rewardManager).queueRewards(rewardToken1.address, total_amount)

            const tx_ts = BigNumber.from((await provider.getBlock((await queue_tx).blockNumber || 0)).timestamp)

            const new_reward_state = await staking.rewardStates(rewardToken1.address)

            expect(new_reward_state.ratePerSecond).to.be.eq(expected_drop_per_sec)
            expect(new_reward_state.currentRewardAmount).to.be.eq(total_amount)
            expect(new_reward_state.lastUpdate).to.be.eq(tx_ts)
            expect(new_reward_state.distributionEndTimestamp).to.be.eq(tx_ts.add(DISTRIBUTION_DURATION))
            expect(new_reward_state.queuedRewardAmount).to.be.eq(0)
            expect(new_reward_state.rewardPerToken).to.be.eq(0)

            expect(await staking.lastRewardUpdateTimestamp(rewardToken1.address)).to.be.eq(tx_ts)

            const reward_list = await staking.getRewardList()
            expect(reward_list[reward_list.length - 1]).to.be.eq(rewardToken1.address)

            await expect(queue_tx).to.emit(staking, "NewRewards")
            .withArgs(rewardToken1.address, total_amount, tx_ts.add(DISTRIBUTION_DURATION));

        });

        it(' should allow to queue different rewards', async () => {

            const total_amount2 = ethers.utils.parseEther('94500')

            const expected_drop_per_sec = total_amount.div(DISTRIBUTION_DURATION)

            const queue_tx = await staking.connect(rewardManager).queueRewards(rewardToken1.address, total_amount)

            const tx_ts = BigNumber.from((await provider.getBlock((await queue_tx).blockNumber || 0)).timestamp)

            const new_reward_state = await staking.rewardStates(rewardToken1.address)

            expect(new_reward_state.ratePerSecond).to.be.eq(expected_drop_per_sec)
            expect(new_reward_state.currentRewardAmount).to.be.eq(total_amount)
            expect(new_reward_state.lastUpdate).to.be.eq(tx_ts)
            expect(new_reward_state.distributionEndTimestamp).to.be.eq(tx_ts.add(DISTRIBUTION_DURATION))
            expect(new_reward_state.queuedRewardAmount).to.be.eq(0)
            expect(new_reward_state.rewardPerToken).to.be.eq(0)

            expect(await staking.lastRewardUpdateTimestamp(rewardToken1.address)).to.be.eq(tx_ts)

            const reward_list = await staking.getRewardList()
            expect(reward_list[reward_list.length - 1]).to.be.eq(rewardToken1.address)

            await expect(queue_tx).to.emit(staking, "NewRewards")
            .withArgs(rewardToken1.address, total_amount, tx_ts.add(DISTRIBUTION_DURATION));

            await advanceTime(WEEK.div(2).toNumber())

            const expected_drop_per_sec2 = total_amount2.div(DISTRIBUTION_DURATION)

            const queue_tx2 = await staking.connect(rewardManager2).queueRewards(rewardToken2.address, total_amount2)

            const tx_ts2 = BigNumber.from((await provider.getBlock((await queue_tx2).blockNumber || 0)).timestamp)

            const new_reward_state2 = await staking.rewardStates(rewardToken2.address)
            expect(new_reward_state2.ratePerSecond).to.be.eq(expected_drop_per_sec2)
            expect(new_reward_state2.currentRewardAmount).to.be.eq(total_amount2)
            expect(new_reward_state2.lastUpdate).to.be.eq(tx_ts2)
            expect(new_reward_state2.distributionEndTimestamp).to.be.eq(tx_ts2.add(DISTRIBUTION_DURATION))
            expect(new_reward_state2.queuedRewardAmount).to.be.eq(0)
            expect(new_reward_state2.rewardPerToken).to.be.eq(0)

            const new_reward_state1 = await staking.rewardStates(rewardToken1.address)
            expect(new_reward_state1.ratePerSecond).to.be.eq(new_reward_state.ratePerSecond)
            expect(new_reward_state1.currentRewardAmount).to.be.eq(new_reward_state.currentRewardAmount)
            expect(new_reward_state1.lastUpdate).to.be.eq(new_reward_state.lastUpdate)
            expect(new_reward_state1.distributionEndTimestamp).to.be.eq(new_reward_state.distributionEndTimestamp)
            expect(new_reward_state1.queuedRewardAmount).to.be.eq(new_reward_state.queuedRewardAmount)
            expect(new_reward_state1.rewardPerToken).to.be.eq(new_reward_state.rewardPerToken)

            expect(await staking.lastRewardUpdateTimestamp(rewardToken2.address)).to.be.eq(tx_ts2)

            const reward_list2 = await staking.getRewardList()
            expect(reward_list2[reward_list2.length - 1]).to.be.eq(rewardToken2.address)

            await expect(queue_tx2).to.emit(staking, "NewRewards")
            .withArgs(rewardToken2.address, total_amount2, tx_ts2.add(DISTRIBUTION_DURATION));

        });

        it(' should start another distribution if the previous one is already over', async () => {

            const other_amount = ethers.utils.parseEther('800')

            await staking.connect(rewardManager).queueRewards(rewardToken1.address, other_amount)

            await advanceTime(WEEK.mul(2).toNumber())

            const total_scaled_amount = await staking.totalScaledAmount();
            const prev_state = await staking.rewardStates(rewardToken1.address)
            const last_distrib_ts = await staking.lastRewardUpdateTimestamp(rewardToken1.address)
            const last_update_ts = prev_state.lastUpdate
            const expected_reward_per_token = prev_state.rewardPerToken.add(
                (last_distrib_ts.sub(last_update_ts)).mul(prev_state.ratePerSecond).mul(UNIT).div(total_scaled_amount)
            )

            const expected_drop_per_sec = total_amount.div(DISTRIBUTION_DURATION)

            const queue_tx = await staking.connect(rewardManager).queueRewards(rewardToken1.address, total_amount)

            const tx_ts = BigNumber.from((await provider.getBlock((await queue_tx).blockNumber || 0)).timestamp)

            const new_reward_state = await staking.rewardStates(rewardToken1.address)

            expect(new_reward_state.ratePerSecond).to.be.eq(expected_drop_per_sec)
            expect(new_reward_state.currentRewardAmount).to.be.eq(total_amount)
            expect(new_reward_state.lastUpdate).to.be.eq(tx_ts)
            expect(new_reward_state.distributionEndTimestamp).to.be.eq(tx_ts.add(DISTRIBUTION_DURATION))
            expect(new_reward_state.queuedRewardAmount).to.be.eq(0)
            expect(new_reward_state.rewardPerToken).to.be.eq(expected_reward_per_token)

            expect(await staking.lastRewardUpdateTimestamp(rewardToken1.address)).to.be.eq(tx_ts)

            const reward_list = await staking.getRewardList()
            expect(reward_list[reward_list.length - 1]).to.be.eq(rewardToken1.address)

            await expect(queue_tx).to.emit(staking, "NewRewards")
            .withArgs(rewardToken1.address, total_amount, tx_ts.add(DISTRIBUTION_DURATION));

        });

        it(' should only queue rewards if the amount is too small', async () => {

            const small_amount = ethers.utils.parseEther('75')

            await staking.connect(rewardManager).queueRewards(rewardToken1.address, total_amount)

            await advanceTime(WEEK.div(2).toNumber())

            const total_scaled_amount = await staking.totalScaledAmount();
            const prev_state = await staking.rewardStates(rewardToken1.address)

            const queue_tx = await staking.connect(rewardManager).queueRewards(rewardToken1.address, small_amount)

            const tx_ts = BigNumber.from((await provider.getBlock((await queue_tx).blockNumber || 0)).timestamp)

            const expected_reward_per_token = prev_state.rewardPerToken.add(
                (tx_ts.sub(prev_state.lastUpdate)).mul(prev_state.ratePerSecond).mul(UNIT).div(total_scaled_amount)
            )

            const new_reward_state = await staking.rewardStates(rewardToken1.address)

            expect(new_reward_state.ratePerSecond).to.be.eq(prev_state.ratePerSecond)
            expect(new_reward_state.currentRewardAmount).to.be.eq(prev_state.currentRewardAmount)
            expect(new_reward_state.lastUpdate).to.be.eq(tx_ts)
            expect(new_reward_state.distributionEndTimestamp).to.be.eq(prev_state.distributionEndTimestamp)
            expect(new_reward_state.queuedRewardAmount).to.be.eq(small_amount)
            expect(new_reward_state.rewardPerToken).to.be.eq(expected_reward_per_token)

            expect(await staking.lastRewardUpdateTimestamp(rewardToken1.address)).to.be.eq(tx_ts)

        });

        it(' should restart the distribution if queued amount is over the threshold (+ handles past remaining rewards)', async () => {

            const other_amount = ethers.utils.parseEther('1700')

            await staking.connect(rewardManager).queueRewards(rewardToken1.address, total_amount)

            await advanceTime(WEEK.mul(4).div(5).toNumber())

            const total_scaled_amount = await staking.totalScaledAmount();
            const prev_state = await staking.rewardStates(rewardToken1.address)

            const queue_tx = await staking.connect(rewardManager).queueRewards(rewardToken1.address, other_amount)

            const tx_ts = BigNumber.from((await provider.getBlock((await queue_tx).blockNumber || 0)).timestamp)

            const expected_reward_per_token = prev_state.rewardPerToken.add(
                (tx_ts.sub(prev_state.lastUpdate)).mul(prev_state.ratePerSecond).mul(UNIT).div(total_scaled_amount)
            )

            const expected_remaining_rewards = prev_state.ratePerSecond.mul(prev_state.distributionEndTimestamp.sub(tx_ts))

            const expected_total_amount = other_amount.add(expected_remaining_rewards)

            const expected_drop_per_sec = expected_total_amount.div(DISTRIBUTION_DURATION)

            const new_reward_state = await staking.rewardStates(rewardToken1.address)

            expect(new_reward_state.ratePerSecond).to.be.eq(expected_drop_per_sec)
            expect(new_reward_state.currentRewardAmount).to.be.eq(expected_total_amount)
            expect(new_reward_state.lastUpdate).to.be.eq(tx_ts)
            expect(new_reward_state.distributionEndTimestamp).to.be.eq(tx_ts.add(DISTRIBUTION_DURATION))
            expect(new_reward_state.queuedRewardAmount).to.be.eq(0)
            expect(new_reward_state.rewardPerToken).to.be.eq(expected_reward_per_token)

            expect(await staking.lastRewardUpdateTimestamp(rewardToken1.address)).to.be.eq(tx_ts)

            await expect(queue_tx).to.emit(staking, "NewRewards")
            .withArgs(rewardToken1.address, expected_total_amount, tx_ts.add(DISTRIBUTION_DURATION));

        });

        it(' should fail if given the address 0x0', async () => {

            await expect(
                staking.connect(rewardManager).queueRewards(ethers.constants.AddressZero, total_amount)
            ).to.be.revertedWith('AddressZero')

        });

        it(' should fail if given a null amount', async () => {

            await expect(
                staking.connect(rewardManager).queueRewards(rewardToken1.address, 0)
            ).to.be.revertedWith('NullAmount')

        });

        it(' should only be callable by allowed reward depositors', async () => {

            await expect(
                staking.connect(depositor1).queueRewards(rewardToken1.address, total_amount)
            ).to.be.revertedWith('CallerNotAllowed')

        });

    });

    describe('stake', async () => {

        beforeEach(async () => {

            await token.connect(admin).approve(staking.address, ethers.constants.MaxUint256)
            await staking.connect(admin).init()

            await token.connect(depositor1).approve(staking.address, ethers.constants.MaxUint256)
            await token.connect(depositor2).approve(staking.address, depositor2_amount)

        });

        it(' should stake correctly (& emit correct Event)', async () => {

            const old_user_balance = await token.balanceOf(depositor1.address)
            const old_staking_balance = await token.balanceOf(staking.address)

            const old_user_scaled_balance = await staking.userScaledBalances(depositor1.address)
            const old_total_scaled_supply = await staking.totalScaledAmount()

            const old_total_assets = await staking.totalAssets()

            const old_user_staked_amount = await staking.userCurrentStakedAmount(depositor1.address)

            const stake_tx = await staking.connect(depositor1).stake(depositor1_amount, depositor1.address)

            const new_user_balance = await token.balanceOf(depositor1.address)
            const new_staking_balance = await token.balanceOf(staking.address)

            const expected_index = old_total_assets.mul(RAY).add(old_total_scaled_supply.div(2)).div(old_total_scaled_supply)

            const expected_scaled_amount = depositor1_amount.mul(RAY).add(expected_index.div(2)).div(expected_index)

            const new_user_scaled_balance = await staking.userScaledBalances(depositor1.address)
            const new_total_scaled_supply = await staking.totalScaledAmount()

            const new_user_staked_amount = await staking.userCurrentStakedAmount(depositor1.address)

            expect(new_user_balance).to.be.eq(old_user_balance.sub(depositor1_amount))
            expect(new_staking_balance).to.be.eq(old_staking_balance.add(depositor1_amount))

            expect(new_user_scaled_balance).to.be.eq(old_user_scaled_balance.add(expected_scaled_amount))
            expect(new_total_scaled_supply).to.be.eq(old_total_scaled_supply.add(expected_scaled_amount))

            expect(new_user_staked_amount).to.be.eq(old_user_staked_amount.add(depositor1_amount))

            await expect(stake_tx).to.emit(staking, "Staked")
            .withArgs(depositor1.address, depositor1.address, depositor1_amount, expected_scaled_amount);

            await expect(stake_tx).to.emit(token, "Transfer")
            .withArgs(depositor1.address, staking.address, depositor1_amount);

        });

        it(' should update the global state & the user state correctly', async () => {

            const total_amount = ethers.utils.parseEther('1500')

            await staking.connect(admin).addRewardDepositor(rewardManager.address)
            await staking.connect(rewardManager).queueRewards(rewardToken1.address, total_amount)

            await advanceTime(WEEK.mul(2).div(7).toNumber())

            const old_reward_state = await staking.rewardStates(rewardToken1.address)

            const old_total_scaled_amount = await staking.totalScaledAmount();

            const stake_tx = await staking.connect(depositor1).stake(depositor1_amount, depositor1.address)

            const tx_ts = BigNumber.from((await provider.getBlock((await stake_tx).blockNumber || 0)).timestamp)

            const new_reward_state = await staking.rewardStates(rewardToken1.address)
            const new_user_reward_state = await staking.getUserRewardState(rewardToken1.address, depositor1.address)

            const expected_reward_per_token = old_reward_state.rewardPerToken.add(
                (tx_ts.sub(old_reward_state.lastUpdate)).mul(old_reward_state.ratePerSecond).mul(UNIT).div(old_total_scaled_amount)
            )

            expect(new_reward_state.rewardPerToken).to.be.eq(expected_reward_per_token)
            expect(new_reward_state.lastUpdate).to.be.eq(tx_ts)

            expect(new_user_reward_state.lastRewardPerToken).to.be.eq(new_reward_state.rewardPerToken)
            expect(new_user_reward_state.accruedRewards).to.be.eq(0)

        });

        it(' should allow same user to stake again', async () => {

            const other_deposit = ethers.utils.parseEther('750')
            await token.connect(admin).mint(other_deposit, depositor1.address)

            await staking.connect(depositor1).stake(depositor1_amount, depositor1.address)

            const old_user_balance = await token.balanceOf(depositor1.address)
            const old_staking_balance = await token.balanceOf(staking.address)

            const old_user_scaled_balance = await staking.userScaledBalances(depositor1.address)
            const old_total_scaled_supply = await staking.totalScaledAmount()

            const old_total_assets = await staking.totalAssets()

            const old_user_staked_amount = await staking.userCurrentStakedAmount(depositor1.address)

            const stake_tx = await staking.connect(depositor1).stake(other_deposit, depositor1.address)

            const new_user_balance = await token.balanceOf(depositor1.address)
            const new_staking_balance = await token.balanceOf(staking.address)

            const expected_index = old_total_assets.mul(RAY).add(old_total_scaled_supply.div(2)).div(old_total_scaled_supply)

            const expected_scaled_amount = other_deposit.mul(RAY).add(expected_index.div(2)).div(expected_index)

            const new_user_scaled_balance = await staking.userScaledBalances(depositor1.address)
            const new_total_scaled_supply = await staking.totalScaledAmount()

            const new_user_staked_amount = await staking.userCurrentStakedAmount(depositor1.address)

            expect(new_user_balance).to.be.eq(old_user_balance.sub(other_deposit))
            expect(new_staking_balance).to.be.eq(old_staking_balance.add(other_deposit))

            expect(new_user_scaled_balance).to.be.eq(old_user_scaled_balance.add(expected_scaled_amount))
            expect(new_total_scaled_supply).to.be.eq(old_total_scaled_supply.add(expected_scaled_amount))

            expect(new_user_staked_amount).to.be.eq(old_user_staked_amount.add(other_deposit))

            await expect(stake_tx).to.emit(staking, "Staked")
            .withArgs(depositor1.address, depositor1.address, other_deposit, expected_scaled_amount);

            await expect(stake_tx).to.emit(token, "Transfer")
            .withArgs(depositor1.address, staking.address, other_deposit);

        });

        it(' should allow other users to stake', async () => {

            await staking.connect(depositor1).stake(depositor1_amount, depositor1.address)

            const old_user_balance = await token.balanceOf(depositor2.address)
            const old_staking_balance = await token.balanceOf(staking.address)

            const old_user_scaled_balance = await staking.userScaledBalances(depositor2.address)
            const old_total_scaled_supply = await staking.totalScaledAmount()

            const old_total_assets = await staking.totalAssets()

            const old_user_staked_amount = await staking.userCurrentStakedAmount(depositor2.address)

            const stake_tx = await staking.connect(depositor2).stake(depositor2_amount, depositor2.address)

            const new_user_balance = await token.balanceOf(depositor2.address)
            const new_staking_balance = await token.balanceOf(staking.address)

            const expected_index = old_total_assets.mul(RAY).add(old_total_scaled_supply.div(2)).div(old_total_scaled_supply)

            const expected_scaled_amount = depositor2_amount.mul(RAY).add(expected_index.div(2)).div(expected_index)

            const new_user_scaled_balance = await staking.userScaledBalances(depositor2.address)
            const new_total_scaled_supply = await staking.totalScaledAmount()

            const new_user_staked_amount = await staking.userCurrentStakedAmount(depositor2.address)

            expect(new_user_balance).to.be.eq(old_user_balance.sub(depositor2_amount))
            expect(new_staking_balance).to.be.eq(old_staking_balance.add(depositor2_amount))

            expect(new_user_scaled_balance).to.be.eq(old_user_scaled_balance.add(expected_scaled_amount))
            expect(new_total_scaled_supply).to.be.eq(old_total_scaled_supply.add(expected_scaled_amount))

            expect(new_user_staked_amount).to.be.eq(old_user_staked_amount.add(depositor2_amount))

            await expect(stake_tx).to.emit(staking, "Staked")
            .withArgs(depositor2.address, depositor2.address, depositor2_amount, expected_scaled_amount);

            await expect(stake_tx).to.emit(token, "Transfer")
            .withArgs(depositor2.address, staking.address, depositor2_amount);

        });

        it(' should allow to stake full balance using MAX_UINT256', async () => {

            // to increase the balance of depositors using Scaling logic
            await token.connect(admin).updateTotalAssets(
                (await (await token.totalAssets()).mul(10500).div(10000))
            )

            const old_user_balance = await token.balanceOf(depositor1.address)
            const old_staking_balance = await token.balanceOf(staking.address)

            const old_user_scaled_balance = await staking.userScaledBalances(depositor1.address)
            const old_total_scaled_supply = await staking.totalScaledAmount()

            const old_user_staked_amount = await staking.userCurrentStakedAmount(depositor1.address)

            const stake_tx = await staking.connect(depositor1).stake(ethers.constants.MaxUint256, depositor1.address)

            const new_user_balance = await token.balanceOf(depositor1.address)
            const new_staking_balance = await token.balanceOf(staking.address)

            const expected_index = await staking.getCurrentIndex();

            const expected_scaled_amount = old_user_balance.mul(RAY).add(expected_index.div(2)).div(expected_index)

            const new_user_scaled_balance = await staking.userScaledBalances(depositor1.address)
            const new_total_scaled_supply = await staking.totalScaledAmount()

            const new_user_staked_amount = await staking.userCurrentStakedAmount(depositor1.address)

            expect(new_user_balance).to.be.eq(old_user_balance.sub(old_user_balance))
            expect(new_user_balance).to.be.eq(0)
            expect(new_staking_balance).to.be.eq(old_staking_balance.add(old_user_balance))

            expect(new_user_scaled_balance).to.be.eq(old_user_scaled_balance.add(expected_scaled_amount))
            expect(new_total_scaled_supply).to.be.eq(old_total_scaled_supply.add(expected_scaled_amount))

            expect(new_user_staked_amount).to.be.eq(old_user_staked_amount.add(old_user_balance))

            await expect(stake_tx).to.emit(staking, "Staked")
            .withArgs(depositor1.address, depositor1.address, old_user_balance, expected_scaled_amount);

            await expect(stake_tx).to.emit(token, "Transfer")
            .withArgs(depositor1.address, staking.address, old_user_balance);

        });

        it(' should update the global state & the user state correctly - multiple staking', async () => {

            const total_amount = ethers.utils.parseEther('1500')

            const first_deposit = ethers.utils.parseEther('600')
            const second_deposit = ethers.utils.parseEther('750')

            await staking.connect(admin).addRewardDepositor(rewardManager.address)
            await staking.connect(rewardManager).queueRewards(rewardToken1.address, total_amount)

            await advanceTime(WEEK.mul(2).div(7).toNumber())

            const old_reward_state = await staking.rewardStates(rewardToken1.address)

            const old_total_scaled_amount = await staking.totalScaledAmount();

            const stake_tx = await staking.connect(depositor1).stake(first_deposit, depositor1.address)

            const tx_ts = BigNumber.from((await provider.getBlock((await stake_tx).blockNumber || 0)).timestamp)

            const new_reward_state = await staking.rewardStates(rewardToken1.address)
            const new_user_reward_state = await staking.getUserRewardState(rewardToken1.address, depositor1.address)

            const new_total_scaled_amount = await staking.totalScaledAmount();

            const expected_reward_per_token = old_reward_state.rewardPerToken.add(
                (tx_ts.sub(old_reward_state.lastUpdate)).mul(old_reward_state.ratePerSecond).mul(UNIT).div(old_total_scaled_amount)
            )

            expect(new_reward_state.rewardPerToken).to.be.eq(expected_reward_per_token)
            expect(new_reward_state.lastUpdate).to.be.eq(tx_ts)

            expect(new_user_reward_state.lastRewardPerToken).to.be.eq(new_reward_state.rewardPerToken)
            expect(new_user_reward_state.accruedRewards).to.be.eq(0)
            
            await advanceTime(WEEK.mul(3).div(7).toNumber())

            const stake_tx2 = await staking.connect(depositor1).stake(second_deposit, depositor1.address)

            const tx_ts2 = BigNumber.from((await provider.getBlock((await stake_tx2).blockNumber || 0)).timestamp)

            const new_reward_state2 = await staking.rewardStates(rewardToken1.address)
            const new_user_reward_state2 = await staking.getUserRewardState(rewardToken1.address, depositor1.address)

            const expected_reward_per_token2 = new_reward_state.rewardPerToken.add(
                (tx_ts2.sub(new_reward_state.lastUpdate)).mul(new_reward_state.ratePerSecond).mul(UNIT).div(new_total_scaled_amount)
            )

            const expected_accrued = first_deposit.mul(
                expected_reward_per_token2.sub(new_user_reward_state.lastRewardPerToken)
            ).div(UNIT)

            expect(new_reward_state2.rewardPerToken).to.be.eq(expected_reward_per_token2)
            expect(new_reward_state2.lastUpdate).to.be.eq(tx_ts2)

            expect(new_user_reward_state2.lastRewardPerToken).to.be.eq(new_reward_state2.rewardPerToken)
            expect(new_user_reward_state2.accruedRewards).to.be.eq(expected_accrued)

        });

        it(' should allow to deposit for another user', async () => {

            const old_depositor_balance = await token.balanceOf(depositor1.address)
            const old_receiver_balance = await token.balanceOf(depositor3.address)
            const old_staking_balance = await token.balanceOf(staking.address)

            const old_receiver_scaled_balance = await staking.userScaledBalances(depositor3.address)
            const old_depositor_scaled_balance = await staking.userScaledBalances(depositor1.address)
            const old_total_scaled_supply = await staking.totalScaledAmount()

            const old_total_assets = await staking.totalAssets()

            const old_user_staked_amount = await staking.userCurrentStakedAmount(depositor3.address)

            const stake_tx = await staking.connect(depositor1).stake(depositor1_amount, depositor3.address)

            const new_depositor_balance = await token.balanceOf(depositor1.address)
            const new_receiver_balance = await token.balanceOf(depositor3.address)
            const new_staking_balance = await token.balanceOf(staking.address)

            const expected_index = old_total_assets.mul(RAY).add(old_total_scaled_supply.div(2)).div(old_total_scaled_supply)

            const expected_scaled_amount = depositor1_amount.mul(RAY).add(expected_index.div(2)).div(expected_index)

            const new_receiver_scaled_balance = await staking.userScaledBalances(depositor3.address)
            const new_depositor_scaled_balance = await staking.userScaledBalances(depositor1.address)
            const new_total_scaled_supply = await staking.totalScaledAmount()

            const new_user_staked_amount = await staking.userCurrentStakedAmount(depositor3.address)

            expect(new_depositor_balance).to.be.eq(old_depositor_balance.sub(depositor1_amount))
            expect(new_receiver_balance).to.be.eq(old_receiver_balance)
            expect(new_staking_balance).to.be.eq(old_staking_balance.add(depositor1_amount))

            expect(new_depositor_scaled_balance).to.be.eq(old_depositor_scaled_balance)
            expect(new_receiver_scaled_balance).to.be.eq(old_receiver_scaled_balance.add(expected_scaled_amount))
            expect(new_total_scaled_supply).to.be.eq(old_total_scaled_supply.add(expected_scaled_amount))

            expect(new_user_staked_amount).to.be.eq(old_user_staked_amount.add(depositor1_amount))

            await expect(stake_tx).to.emit(staking, "Staked")
            .withArgs(depositor1.address, depositor3.address, depositor1_amount, expected_scaled_amount);

            await expect(stake_tx).to.emit(token, "Transfer")
            .withArgs(depositor1.address, staking.address, depositor1_amount);

        });

        it(' should fail if given address 0x0', async () => {

            await expect(
                staking.connect(depositor1).stake(depositor1_amount, ethers.constants.AddressZero)
            ).to.be.revertedWith('AddressZero')

        });

        it(' should fail if given null amount', async () => {

            await expect(
                staking.connect(depositor1).stake(0, depositor1.address)
            ).to.be.revertedWith('NullAmount')

        });

    });

    describe('unstake', async () => {

        const depositor1_withdraw_scaled = ethers.utils.parseEther('800')
        const depositor2_withdraw_scaled = ethers.utils.parseEther('450')

        beforeEach(async () => {

            await token.connect(admin).approve(staking.address, ethers.constants.MaxUint256)
            await staking.connect(admin).init()

            await token.connect(depositor1).approve(staking.address, ethers.constants.MaxUint256)
            await token.connect(depositor2).approve(staking.address, depositor2_amount)

            await staking.connect(depositor1).stake(depositor1_amount, depositor1.address)

            // to increase the balance of depositors using Scaling logic
            await token.connect(admin).updateTotalAssets(
                (await (await token.totalAssets()).mul(10500).div(10000))
            )

        });

        it(' should unstake correctly (& emit correct Event)', async () => {

            const old_user_balance = await token.balanceOf(depositor1.address)
            const old_staking_balance = await token.balanceOf(staking.address)

            const old_user_scaled_balance = await staking.userScaledBalances(depositor1.address)
            const old_total_scaled_supply = await staking.totalScaledAmount()

            const old_total_assets = await staking.totalAssets()

            const old_user_staked_amount = await staking.userCurrentStakedAmount(depositor1.address)

            const unstake_tx = await staking.connect(depositor1).unstake(depositor1_withdraw_scaled, depositor1.address)

            const new_user_balance = await token.balanceOf(depositor1.address)
            const new_staking_balance = await token.balanceOf(staking.address)

            const expected_index = old_total_assets.mul(RAY).add(old_total_scaled_supply.div(2)).div(old_total_scaled_supply)

            const expected_amount = depositor1_withdraw_scaled.mul(expected_index).add(RAY.div(2)).div(RAY)

            const new_user_scaled_balance = await staking.userScaledBalances(depositor1.address)
            const new_total_scaled_supply = await staking.totalScaledAmount()

            const new_user_staked_amount = await staking.userCurrentStakedAmount(depositor1.address)

            expect(new_user_balance).to.be.eq(old_user_balance.add(expected_amount))
            expect(new_staking_balance).to.be.eq(old_staking_balance.sub(expected_amount))

            expect(new_user_scaled_balance).to.be.eq(old_user_scaled_balance.sub(depositor1_withdraw_scaled))
            expect(new_total_scaled_supply).to.be.eq(old_total_scaled_supply.sub(depositor1_withdraw_scaled))

            expect(new_user_staked_amount).to.be.eq(old_user_staked_amount.sub(expected_amount))

            expect(await staking.totalAssets()).to.be.eq(old_total_assets.sub(expected_amount))

            await expect(unstake_tx).to.emit(staking, "Unstaked")
            .withArgs(depositor1.address, depositor1.address, expected_amount, depositor1_withdraw_scaled);

            await expect(unstake_tx).to.emit(token, "Transfer")
            .withArgs(staking.address, depositor1.address, expected_amount);

        });

        it(' should update the states correctly', async () => {

            const total_amount = ethers.utils.parseEther('1500')

            await staking.connect(admin).addRewardDepositor(rewardManager.address)
            await staking.connect(rewardManager).queueRewards(rewardToken1.address, total_amount)

            await advanceTime(WEEK.mul(1).div(7).toNumber())

            await staking.connect(depositor2).stake(depositor2_amount, depositor2.address)

            await advanceTime(WEEK.mul(3).div(7).toNumber())

            const old_reward_state = await staking.rewardStates(rewardToken1.address)
            const old_user_reward_state = await staking.getUserRewardState(rewardToken1.address, depositor2.address)

            const user_scaled_balance = await staking.userScaledBalances(depositor2.address)
            const total_scaled_amount = await staking.totalScaledAmount();

            const stake_tx = await staking.connect(depositor2).unstake(depositor2_withdraw_scaled, depositor2.address)

            const tx_ts = BigNumber.from((await provider.getBlock((await stake_tx).blockNumber || 0)).timestamp)

            const new_reward_state = await staking.rewardStates(rewardToken1.address)
            const new_user_reward_state = await staking.getUserRewardState(rewardToken1.address, depositor2.address)

            const expected_reward_per_token = old_reward_state.rewardPerToken.add(
                (tx_ts.sub(old_reward_state.lastUpdate)).mul(old_reward_state.ratePerSecond).mul(UNIT).div(total_scaled_amount)
            )

            const expected_accrued = user_scaled_balance.mul(
                expected_reward_per_token.sub(old_user_reward_state.lastRewardPerToken)
            ).div(UNIT)

            expect(new_reward_state.rewardPerToken).to.be.eq(expected_reward_per_token)
            expect(new_reward_state.lastUpdate).to.be.eq(tx_ts)

            expect(new_user_reward_state.lastRewardPerToken).to.be.eq(new_reward_state.rewardPerToken)
            expect(new_user_reward_state.accruedRewards).to.be.eq(expected_accrued)

        });

        it(' should allow to withdraw the full staked amount with MAX_UINT256', async () => {

            const old_user_balance = await token.balanceOf(depositor1.address)
            const old_staking_balance = await token.balanceOf(staking.address)

            const old_user_scaled_balance = await staking.userScaledBalances(depositor1.address)
            const old_total_scaled_supply = await staking.totalScaledAmount()

            const old_total_assets = await staking.totalAssets()

            const old_user_staked_amount = await staking.userCurrentStakedAmount(depositor1.address)

            await staking.connect(depositor1).unstake(ethers.constants.MaxUint256, depositor1.address)

            const new_user_balance = await token.balanceOf(depositor1.address)
            const new_staking_balance = await token.balanceOf(staking.address)

            const expected_index = old_total_assets.mul(RAY).add(old_total_scaled_supply.div(2)).div(old_total_scaled_supply)

            const expected_amount = old_user_scaled_balance.mul(expected_index).add(RAY.div(2)).div(RAY)

            const new_user_scaled_balance = await staking.userScaledBalances(depositor1.address)
            const new_total_scaled_supply = await staking.totalScaledAmount()

            const new_user_staked_amount = await staking.userCurrentStakedAmount(depositor1.address)

            expect(new_user_balance).to.be.eq(old_user_balance.add(expected_amount))
            expect(new_staking_balance).to.be.eq(old_staking_balance.sub(expected_amount))

            expect(new_user_scaled_balance).to.be.eq(0)
            expect(new_total_scaled_supply).to.be.eq(old_total_scaled_supply.sub(old_user_scaled_balance))

            expect(new_user_staked_amount).to.be.eq(0)

            expect(await staking.totalAssets()).to.be.eq(old_total_assets.sub(expected_amount))

        });

        it(' should allow to unstake & send to another receiver', async () => {

            const old_owner_balance = await token.balanceOf(depositor1.address)
            const old_receiver_balance = await token.balanceOf(depositor3.address)
            const old_staking_balance = await token.balanceOf(staking.address)

            const old_user_scaled_balance = await staking.userScaledBalances(depositor1.address)
            const old_total_scaled_supply = await staking.totalScaledAmount()

            const old_total_assets = await staking.totalAssets()

            const old_user_staked_amount = await staking.userCurrentStakedAmount(depositor1.address)

            const unstake_tx = await staking.connect(depositor1).unstake(depositor1_withdraw_scaled, depositor3.address)

            const new_owner_balance = await token.balanceOf(depositor1.address)
            const new_receiver_balance = await token.balanceOf(depositor3.address)
            const new_staking_balance = await token.balanceOf(staking.address)

            const expected_index = old_total_assets.mul(RAY).add(old_total_scaled_supply.div(2)).div(old_total_scaled_supply)

            const expected_amount = depositor1_withdraw_scaled.mul(expected_index).add(RAY.div(2)).div(RAY)

            const new_user_scaled_balance = await staking.userScaledBalances(depositor1.address)
            const new_total_scaled_supply = await staking.totalScaledAmount()

            const new_user_staked_amount = await staking.userCurrentStakedAmount(depositor1.address)

            expect(new_owner_balance).to.be.eq(old_owner_balance)
            expect(new_receiver_balance).to.be.eq(old_receiver_balance.add(expected_amount))
            expect(new_staking_balance).to.be.eq(old_staking_balance.sub(expected_amount))

            expect(new_user_scaled_balance).to.be.eq(old_user_scaled_balance.sub(depositor1_withdraw_scaled))
            expect(new_total_scaled_supply).to.be.eq(old_total_scaled_supply.sub(depositor1_withdraw_scaled))

            expect(new_user_staked_amount).to.be.eq(old_user_staked_amount.sub(expected_amount))

            expect(await staking.totalAssets()).to.be.eq(old_total_assets.sub(expected_amount))

            await expect(unstake_tx).to.emit(staking, "Unstaked")
            .withArgs(depositor1.address, depositor3.address, expected_amount, depositor1_withdraw_scaled);

            await expect(unstake_tx).to.emit(token, "Transfer")
            .withArgs(staking.address, depositor3.address, expected_amount);

        });

        it(' should not allow to unstake more than staked (in scaled amounts)', async () => {

            const staked_amount = await staking.userScaledBalances(depositor1.address)
            
            await expect(
                staking.connect(depositor1).unstake(staked_amount.mul(2), depositor1.address)
            ).to.be.reverted

        });

        it(' should fail if given address 0x0', async () => {

            await expect(
                staking.connect(depositor1).unstake(depositor1_withdraw_scaled, ethers.constants.AddressZero)
            ).to.be.revertedWith('AddressZero')

        });

        it(' should fail if given null amount', async () => {

            await expect(
                staking.connect(depositor1).unstake(0, depositor1.address)
            ).to.be.revertedWith('NullScaledAmount')

        });

    });

    describe('updateRewardState', async () => {

        beforeEach(async () => {

            await token.connect(admin).approve(staking.address, ethers.constants.MaxUint256)
            await staking.connect(admin).init()

            const total_amount = ethers.utils.parseEther('1500')
            const total_amount2 = ethers.utils.parseEther('94500')

            await staking.connect(admin).addRewardDepositor(rewardManager.address)
            await staking.connect(admin).addRewardDepositor(rewardManager2.address)

            await staking.connect(rewardManager).queueRewards(rewardToken1.address, total_amount)
            await staking.connect(rewardManager2).queueRewards(rewardToken2.address, total_amount2)

            await token.connect(depositor1).approve(staking.address, ethers.constants.MaxUint256)
            await token.connect(depositor2).approve(staking.address, depositor2_amount)

            await staking.connect(depositor1).stake(depositor1_amount, depositor1.address)
            await staking.connect(depositor2).stake(depositor2_amount, depositor2.address)

            await advanceTime(WEEK.mul(4).div(7).toNumber())

        });

        it(' should update the reward state correctly', async () => {

            const old_reward_state = await staking.rewardStates(rewardToken1.address)

            const total_scaled_amount = await staking.totalScaledAmount();

            const update_tx = await staking.connect(depositor1).updateRewardState(rewardToken1.address)

            const tx_ts = BigNumber.from((await provider.getBlock((await update_tx).blockNumber || 0)).timestamp)

            const new_reward_state = await staking.rewardStates(rewardToken1.address)

            const expected_reward_per_token = old_reward_state.rewardPerToken.add(
                (tx_ts.sub(old_reward_state.lastUpdate)).mul(old_reward_state.ratePerSecond).mul(UNIT).div(total_scaled_amount)
            )

            expect(new_reward_state.rewardPerToken).to.be.eq(expected_reward_per_token)
            expect(new_reward_state.lastUpdate).to.be.eq(tx_ts)

        });

        it(' should not update for other reward distributions', async () => {

            const old_reward_state = await staking.rewardStates(rewardToken2.address)

            await staking.connect(depositor1).updateRewardState(rewardToken1.address)

            const new_reward_state = await staking.rewardStates(rewardToken2.address)

            expect(new_reward_state.rewardPerToken).to.be.eq(old_reward_state.rewardPerToken)
            expect(new_reward_state.lastUpdate).to.be.eq(old_reward_state.lastUpdate)

        });

    });

    describe('updateAllRewardState', async () => {

        beforeEach(async () => {

            await token.connect(admin).approve(staking.address, ethers.constants.MaxUint256)
            await staking.connect(admin).init()

            const total_amount = ethers.utils.parseEther('1500')
            const total_amount2 = ethers.utils.parseEther('94500')

            await staking.connect(admin).addRewardDepositor(rewardManager.address)
            await staking.connect(admin).addRewardDepositor(rewardManager2.address)

            await staking.connect(rewardManager).queueRewards(rewardToken1.address, total_amount)
            await staking.connect(rewardManager2).queueRewards(rewardToken2.address, total_amount2)

            await token.connect(depositor1).approve(staking.address, ethers.constants.MaxUint256)
            await token.connect(depositor2).approve(staking.address, depositor2_amount)

            await staking.connect(depositor1).stake(depositor1_amount, depositor1.address)
            await staking.connect(depositor2).stake(depositor2_amount, depositor2.address)

            await advanceTime(WEEK.mul(4).div(7).toNumber())

        });

        it(' should update all reward states correctly', async () => {

            const old_reward_state = await staking.rewardStates(rewardToken1.address)
            const old_reward_state2 = await staking.rewardStates(rewardToken2.address)

            const total_scaled_amount = await staking.totalScaledAmount();

            const update_tx = await staking.connect(depositor1).updateAllRewardState()

            const tx_ts = BigNumber.from((await provider.getBlock((await update_tx).blockNumber || 0)).timestamp)

            const new_reward_state = await staking.rewardStates(rewardToken1.address)
            const new_reward_state2 = await staking.rewardStates(rewardToken2.address)

            const expected_reward_per_token = old_reward_state.rewardPerToken.add(
                (tx_ts.sub(old_reward_state.lastUpdate)).mul(old_reward_state.ratePerSecond).mul(UNIT).div(total_scaled_amount)
            )

            expect(new_reward_state.rewardPerToken).to.be.eq(expected_reward_per_token)
            expect(new_reward_state.lastUpdate).to.be.eq(tx_ts)

            const expected_reward_per_token2 = old_reward_state2.rewardPerToken.add(
                (tx_ts.sub(old_reward_state2.lastUpdate)).mul(old_reward_state2.ratePerSecond).mul(UNIT).div(total_scaled_amount)
            )

            expect(new_reward_state2.rewardPerToken).to.be.eq(expected_reward_per_token2)
            expect(new_reward_state2.lastUpdate).to.be.eq(tx_ts)

        });

    });

    describe('claimRewards & claimRewardsForUser', async () => {

        beforeEach(async () => {

            await token.connect(admin).approve(staking.address, ethers.constants.MaxUint256)
            await staking.connect(admin).init()

            const total_amount = ethers.utils.parseEther('1500')

            await staking.connect(admin).addRewardDepositor(rewardManager.address)

            await staking.connect(rewardManager).queueRewards(rewardToken1.address, total_amount)

            await rewardToken1.connect(rewardManager).transfer(staking.address, total_amount)

            await token.connect(depositor1).approve(staking.address, ethers.constants.MaxUint256)
            await token.connect(depositor2).approve(staking.address, depositor2_amount)

            await staking.connect(depositor1).stake(depositor1_amount, depositor1.address)
            await staking.connect(depositor2).stake(depositor2_amount, depositor2.address)

            await advanceTime(WEEK.mul(4).div(7).toNumber())

        });

        it(' should claim correctly & update the reward states (& emit correct Event)', async () => {

            const old_reward_state = await staking.rewardStates(rewardToken1.address)
            const old_user_reward_state = await staking.getUserRewardState(rewardToken1.address, depositor1.address)

            const old_user_reward_balance = await rewardToken1.balanceOf(depositor1.address)

            const user_scaled_balance = await staking.userScaledBalances(depositor1.address)
            const total_scaled_amount = await staking.totalScaledAmount();

            const claim_tx = await staking.connect(depositor1).claimRewards(rewardToken1.address, depositor1.address)

            const tx_ts = BigNumber.from((await provider.getBlock((await claim_tx).blockNumber || 0)).timestamp)

            const new_reward_state = await staking.rewardStates(rewardToken1.address)
            const new_user_reward_state = await staking.getUserRewardState(rewardToken1.address, depositor1.address)

            const new_user_reward_balance = await rewardToken1.balanceOf(depositor1.address)

            const expected_reward_per_token = old_reward_state.rewardPerToken.add(
                (tx_ts.sub(old_reward_state.lastUpdate)).mul(old_reward_state.ratePerSecond).mul(UNIT).div(total_scaled_amount)
            )

            const expected_claim = user_scaled_balance.mul(
                expected_reward_per_token.sub(old_user_reward_state.lastRewardPerToken)
            ).div(UNIT)

            expect(new_reward_state.rewardPerToken).to.be.eq(expected_reward_per_token)
            expect(new_reward_state.lastUpdate).to.be.eq(tx_ts)

            expect(new_user_reward_state.lastRewardPerToken).to.be.eq(new_reward_state.rewardPerToken)
            expect(new_user_reward_state.accruedRewards).to.be.eq(0)

            expect(new_user_reward_balance).to.be.eq(old_user_reward_balance.add(expected_claim))

            await expect(claim_tx).to.emit(staking, "ClaimedRewards")
            .withArgs(rewardToken1.address, depositor1.address, depositor1.address, expected_claim);

            await expect(claim_tx).to.emit(rewardToken1, "Transfer")
            .withArgs(staking.address, depositor1.address, expected_claim);

        });

        it(' should allow other users to claim too', async () => {

            await staking.connect(depositor1).claimRewards(rewardToken1.address, depositor1.address)

            const old_reward_state = await staking.rewardStates(rewardToken1.address)
            const old_user_reward_state = await staking.getUserRewardState(rewardToken1.address, depositor2.address)

            const old_user_reward_balance = await rewardToken1.balanceOf(depositor2.address)

            const user_scaled_balance = await staking.userScaledBalances(depositor2.address)
            const total_scaled_amount = await staking.totalScaledAmount();

            const claim_tx = await staking.connect(depositor2).claimRewards(rewardToken1.address, depositor2.address)

            const tx_ts = BigNumber.from((await provider.getBlock((await claim_tx).blockNumber || 0)).timestamp)

            const new_reward_state = await staking.rewardStates(rewardToken1.address)
            const new_user_reward_state = await staking.getUserRewardState(rewardToken1.address, depositor2.address)

            const new_user_reward_balance = await rewardToken1.balanceOf(depositor2.address)

            const expected_reward_per_token = old_reward_state.rewardPerToken.add(
                (tx_ts.sub(old_reward_state.lastUpdate)).mul(old_reward_state.ratePerSecond).mul(UNIT).div(total_scaled_amount)
            )

            const expected_claim = user_scaled_balance.mul(
                expected_reward_per_token.sub(old_user_reward_state.lastRewardPerToken)
            ).div(UNIT)

            expect(new_reward_state.rewardPerToken).to.be.eq(expected_reward_per_token)
            expect(new_reward_state.lastUpdate).to.be.eq(tx_ts)

            expect(new_user_reward_state.lastRewardPerToken).to.be.eq(new_reward_state.rewardPerToken)
            expect(new_user_reward_state.accruedRewards).to.be.eq(0)

            expect(new_user_reward_balance).to.be.eq(old_user_reward_balance.add(expected_claim))

        });

        it(' should allow to send rewards to another user', async () => {

            const old_reward_state = await staking.rewardStates(rewardToken1.address)
            const old_user_reward_state = await staking.getUserRewardState(rewardToken1.address, depositor1.address)

            const old_user_reward_balance = await rewardToken1.balanceOf(depositor1.address)
            const old_receiver_reward_balance = await rewardToken1.balanceOf(depositor3.address)

            const user_scaled_balance = await staking.userScaledBalances(depositor1.address)
            const total_scaled_amount = await staking.totalScaledAmount();

            const claim_tx = await staking.connect(depositor1).claimRewards(rewardToken1.address, depositor3.address)

            const tx_ts = BigNumber.from((await provider.getBlock((await claim_tx).blockNumber || 0)).timestamp)

            const new_reward_state = await staking.rewardStates(rewardToken1.address)
            const new_user_reward_state = await staking.getUserRewardState(rewardToken1.address, depositor1.address)

            const new_user_reward_balance = await rewardToken1.balanceOf(depositor1.address)
            const new_receiver_reward_balance = await rewardToken1.balanceOf(depositor3.address)

            const expected_reward_per_token = old_reward_state.rewardPerToken.add(
                (tx_ts.sub(old_reward_state.lastUpdate)).mul(old_reward_state.ratePerSecond).mul(UNIT).div(total_scaled_amount)
            )

            const expected_claim = user_scaled_balance.mul(
                expected_reward_per_token.sub(old_user_reward_state.lastRewardPerToken)
            ).div(UNIT)

            expect(new_reward_state.rewardPerToken).to.be.eq(expected_reward_per_token)
            expect(new_reward_state.lastUpdate).to.be.eq(tx_ts)

            expect(new_user_reward_state.lastRewardPerToken).to.be.eq(new_reward_state.rewardPerToken)
            expect(new_user_reward_state.accruedRewards).to.be.eq(0)

            expect(new_user_reward_balance).to.be.eq(old_user_reward_balance)
            expect(new_receiver_reward_balance).to.be.eq(old_receiver_reward_balance.add(expected_claim))

            await expect(claim_tx).to.emit(staking, "ClaimedRewards")
            .withArgs(rewardToken1.address, depositor1.address, depositor3.address, expected_claim);

            await expect(claim_tx).to.emit(rewardToken1, "Transfer")
            .withArgs(staking.address, depositor3.address, expected_claim);

        });

        it(' should not do a transfer if no rewards to claim', async () => {

            const claim_tx = await staking.connect(depositor1).claimRewards(rewardToken2.address, depositor1.address)
            
            await expect(claim_tx).not.to.emit(staking, "ClaimedRewards")
            await expect(claim_tx).not.to.emit(rewardToken2, "Transfer")

        });

        it(' should allow to claim for another user if set as allowed claimer', async () => {

            await staking.connect(admin).setUserAllowedClaimer(depositor1.address, depositor3.address)

            const old_reward_state = await staking.rewardStates(rewardToken1.address)
            const old_user_reward_state = await staking.getUserRewardState(rewardToken1.address, depositor1.address)

            const old_user_reward_balance = await rewardToken1.balanceOf(depositor1.address)
            const old_receiver_reward_balance = await rewardToken1.balanceOf(depositor3.address)

            const user_scaled_balance = await staking.userScaledBalances(depositor1.address)
            const total_scaled_amount = await staking.totalScaledAmount();

            const claim_tx = await staking.connect(depositor3).claimRewardsForUser(rewardToken1.address, depositor1.address, depositor3.address)

            const tx_ts = BigNumber.from((await provider.getBlock((await claim_tx).blockNumber || 0)).timestamp)

            const new_reward_state = await staking.rewardStates(rewardToken1.address)
            const new_user_reward_state = await staking.getUserRewardState(rewardToken1.address, depositor1.address)

            const new_user_reward_balance = await rewardToken1.balanceOf(depositor1.address)
            const new_receiver_reward_balance = await rewardToken1.balanceOf(depositor3.address)

            const expected_reward_per_token = old_reward_state.rewardPerToken.add(
                (tx_ts.sub(old_reward_state.lastUpdate)).mul(old_reward_state.ratePerSecond).mul(UNIT).div(total_scaled_amount)
            )

            const expected_claim = user_scaled_balance.mul(
                expected_reward_per_token.sub(old_user_reward_state.lastRewardPerToken)
            ).div(UNIT)

            expect(new_reward_state.rewardPerToken).to.be.eq(expected_reward_per_token)
            expect(new_reward_state.lastUpdate).to.be.eq(tx_ts)

            expect(new_user_reward_state.lastRewardPerToken).to.be.eq(new_reward_state.rewardPerToken)
            expect(new_user_reward_state.accruedRewards).to.be.eq(0)

            expect(new_user_reward_balance).to.be.eq(old_user_reward_balance)
            expect(new_receiver_reward_balance).to.be.eq(old_receiver_reward_balance.add(expected_claim))

            await expect(claim_tx).to.emit(staking, "ClaimedRewards")
            .withArgs(rewardToken1.address, depositor1.address, depositor3.address, expected_claim);

            await expect(claim_tx).to.emit(rewardToken1, "Transfer")
            .withArgs(staking.address, depositor3.address, expected_claim);

        });

        it(' should not allow to claim for other users if not set as allowed claimer', async () => {

            await expect(
                staking.connect(depositor3).claimRewardsForUser(rewardToken1.address, depositor1.address, depositor3.address)
            ).to.be.revertedWith('ClaimNotAllowed')

            await expect(
                staking.connect(depositor3).claimRewardsForUser(rewardToken1.address, depositor2.address, depositor3.address)
            ).to.be.revertedWith('ClaimNotAllowed')

        });

        it(' should fail if given address 0x0', async () => {

            await expect(
                staking.connect(depositor1).claimRewards(rewardToken1.address, ethers.constants.AddressZero)
            ).to.be.revertedWith('AddressZero')

            await expect(
                staking.connect(depositor3).claimRewardsForUser(rewardToken1.address, ethers.constants.AddressZero, depositor3.address)
            ).to.be.revertedWith('AddressZero')

            await expect(
                staking.connect(depositor3).claimRewardsForUser(rewardToken1.address, depositor1.address, ethers.constants.AddressZero)
            ).to.be.revertedWith('AddressZero')

        });

    });

    describe('claimAllRewards & claimAllRewardsForUser', async () => {

        beforeEach(async () => {

            await token.connect(admin).approve(staking.address, ethers.constants.MaxUint256)
            await staking.connect(admin).init()

            const total_amount = ethers.utils.parseEther('1500')
            const total_amount2 = ethers.utils.parseEther('950')

            await staking.connect(admin).addRewardDepositor(rewardManager.address)
            await staking.connect(admin).addRewardDepositor(rewardManager2.address)

            await staking.connect(rewardManager).queueRewards(rewardToken1.address, total_amount)
            await staking.connect(rewardManager2).queueRewards(rewardToken2.address, total_amount2)

            await rewardToken1.connect(rewardManager).transfer(staking.address, total_amount)
            await rewardToken2.connect(rewardManager2).transfer(staking.address, total_amount2)

            await token.connect(depositor1).approve(staking.address, ethers.constants.MaxUint256)
            await token.connect(depositor2).approve(staking.address, depositor2_amount)

            await staking.connect(depositor1).stake(depositor1_amount, depositor1.address)
            await staking.connect(depositor2).stake(depositor2_amount, depositor2.address)

            await advanceTime(WEEK.mul(4).div(7).toNumber())

        });

        it(' should claim all rewards correctly & update reward states (& emit correct Event)', async () => {

            const reward_list = await staking.getRewardList()
            const old_reward_states: {[index: string]: {
                rewardPerToken: BigNumber,
                lastUpdate: BigNumber,
                ratePerSecond: BigNumber
            }} = {}
            const old_user_reward_lastRewardPerToken: {[index: string]: BigNumber} = {}
            const old_user_reward_balances: {[index: string]: BigNumber} = {}

            for(let reward of reward_list) {
                old_reward_states[reward] = await staking.rewardStates(reward)
                old_user_reward_lastRewardPerToken[reward] = (await staking.getUserRewardState(reward, depositor1.address)).lastRewardPerToken

                old_user_reward_balances[reward] = await (IERC20__factory.connect(reward, provider)).balanceOf(depositor1.address)
            }

            const user_scaled_balance = await staking.userScaledBalances(depositor1.address)
            const total_scaled_amount = await staking.totalScaledAmount();

            const claim_tx = await staking.connect(depositor1).claimAllRewards(depositor1.address)

            const tx_ts = BigNumber.from((await provider.getBlock((await claim_tx).blockNumber || 0)).timestamp)

            for(let reward of reward_list) {
                let reward_token = IERC20__factory.connect(reward, provider)

                const new_reward_state = await staking.rewardStates(reward)
                const new_user_reward_state = await staking.getUserRewardState(reward, depositor1.address)

                const new_user_reward_balance = await reward_token.balanceOf(depositor1.address)

                const expected_reward_per_token = old_reward_states[reward].rewardPerToken.add(
                    (tx_ts.sub(old_reward_states[reward].lastUpdate)).mul(old_reward_states[reward].ratePerSecond).mul(UNIT).div(total_scaled_amount)
                )

                const expected_claim = user_scaled_balance.mul(
                    expected_reward_per_token.sub(old_user_reward_lastRewardPerToken[reward])
                ).div(UNIT)

                expect(new_reward_state.rewardPerToken).to.be.eq(expected_reward_per_token)
                expect(new_reward_state.lastUpdate).to.be.eq(tx_ts)

                expect(new_user_reward_state.lastRewardPerToken).to.be.eq(new_reward_state.rewardPerToken)
                expect(new_user_reward_state.accruedRewards).to.be.eq(0)

                expect(new_user_reward_balance).to.be.eq(old_user_reward_balances[reward].add(expected_claim))

                await expect(claim_tx).to.emit(staking, "ClaimedRewards")
                .withArgs(reward, depositor1.address, depositor1.address, expected_claim);

                await expect(claim_tx).to.emit(reward_token, "Transfer")
                .withArgs(staking.address, depositor1.address, expected_claim);

            }

        });

        it(' should allow to send the rewards to another user', async () => {

            const reward_list = await staking.getRewardList()
            const old_reward_states: {[index: string]: {
                rewardPerToken: BigNumber,
                lastUpdate: BigNumber,
                ratePerSecond: BigNumber
            }} = {}
            const old_user_reward_lastRewardPerToken: {[index: string]: BigNumber} = {}
            const old_user_reward_balances: {[index: string]: BigNumber} = {}

            for(let reward of reward_list) {
                old_reward_states[reward] = await staking.rewardStates(reward)
                old_user_reward_lastRewardPerToken[reward] = (await staking.getUserRewardState(reward, depositor1.address)).lastRewardPerToken

                old_user_reward_balances[reward] = await (IERC20__factory.connect(reward, provider)).balanceOf(depositor3.address)
            }

            const user_scaled_balance = await staking.userScaledBalances(depositor1.address)
            const total_scaled_amount = await staking.totalScaledAmount();

            const claim_tx = await staking.connect(depositor1).claimAllRewards(depositor3.address)

            const tx_ts = BigNumber.from((await provider.getBlock((await claim_tx).blockNumber || 0)).timestamp)

            for(let reward of reward_list) {
                let reward_token = IERC20__factory.connect(reward, provider)

                const new_reward_state = await staking.rewardStates(reward)
                const new_user_reward_state = await staking.getUserRewardState(reward, depositor1.address)

                const new_user_reward_balance = await reward_token.balanceOf(depositor3.address)

                const expected_reward_per_token = old_reward_states[reward].rewardPerToken.add(
                    (tx_ts.sub(old_reward_states[reward].lastUpdate)).mul(old_reward_states[reward].ratePerSecond).mul(UNIT).div(total_scaled_amount)
                )

                const expected_claim = user_scaled_balance.mul(
                    expected_reward_per_token.sub(old_user_reward_lastRewardPerToken[reward])
                ).div(UNIT)

                expect(new_reward_state.rewardPerToken).to.be.eq(expected_reward_per_token)
                expect(new_reward_state.lastUpdate).to.be.eq(tx_ts)

                expect(new_user_reward_state.lastRewardPerToken).to.be.eq(new_reward_state.rewardPerToken)
                expect(new_user_reward_state.accruedRewards).to.be.eq(0)

                expect(new_user_reward_balance).to.be.eq(old_user_reward_balances[reward].add(expected_claim))

                await expect(claim_tx).to.emit(staking, "ClaimedRewards")
                .withArgs(reward, depositor1.address, depositor3.address, expected_claim);

                await expect(claim_tx).to.emit(reward_token, "Transfer")
                .withArgs(staking.address, depositor3.address, expected_claim);

            }

        });

        it(' should not do the transfer if no rewards to distribute', async () => {

            await advanceTime(WEEK.mul(2).toNumber())

            const total_amount = ethers.utils.parseEther('1500')
            await staking.connect(rewardManager).queueRewards(rewardToken1.address, total_amount)
            await rewardToken1.connect(rewardManager).transfer(staking.address, total_amount)

            

        });

        it(' should allow to claim for another user if set as allowed claimer', async () => {

            await staking.connect(admin).setUserAllowedClaimer(depositor1.address, depositor3.address)

            const reward_list = await staking.getRewardList()
            const old_reward_states: {[index: string]: {
                rewardPerToken: BigNumber,
                lastUpdate: BigNumber,
                ratePerSecond: BigNumber
            }} = {}
            const old_user_reward_lastRewardPerToken: {[index: string]: BigNumber} = {}
            const old_user_reward_balances: {[index: string]: BigNumber} = {}

            for(let reward of reward_list) {
                old_reward_states[reward] = await staking.rewardStates(reward)
                old_user_reward_lastRewardPerToken[reward] = (await staking.getUserRewardState(reward, depositor1.address)).lastRewardPerToken

                old_user_reward_balances[reward] = await (IERC20__factory.connect(reward, provider)).balanceOf(depositor3.address)
            }

            const user_scaled_balance = await staking.userScaledBalances(depositor1.address)
            const total_scaled_amount = await staking.totalScaledAmount();

            const claim_tx = await staking.connect(depositor3).claimAllRewardsForUser(depositor1.address, depositor3.address)

            const tx_ts = BigNumber.from((await provider.getBlock((await claim_tx).blockNumber || 0)).timestamp)

            for(let reward of reward_list) {
                let reward_token = IERC20__factory.connect(reward, provider)

                const new_reward_state = await staking.rewardStates(reward)
                const new_user_reward_state = await staking.getUserRewardState(reward, depositor1.address)

                const new_user_reward_balance = await reward_token.balanceOf(depositor3.address)

                const expected_reward_per_token = old_reward_states[reward].rewardPerToken.add(
                    (tx_ts.sub(old_reward_states[reward].lastUpdate)).mul(old_reward_states[reward].ratePerSecond).mul(UNIT).div(total_scaled_amount)
                )

                const expected_claim = user_scaled_balance.mul(
                    expected_reward_per_token.sub(old_user_reward_lastRewardPerToken[reward])
                ).div(UNIT)

                expect(new_reward_state.rewardPerToken).to.be.eq(expected_reward_per_token)
                expect(new_reward_state.lastUpdate).to.be.eq(tx_ts)

                expect(new_user_reward_state.lastRewardPerToken).to.be.eq(new_reward_state.rewardPerToken)
                expect(new_user_reward_state.accruedRewards).to.be.eq(0)

                expect(new_user_reward_balance).to.be.eq(old_user_reward_balances[reward].add(expected_claim))

                await expect(claim_tx).to.emit(staking, "ClaimedRewards")
                .withArgs(reward, depositor1.address, depositor3.address, expected_claim);

                await expect(claim_tx).to.emit(reward_token, "Transfer")
                .withArgs(staking.address, depositor3.address, expected_claim);

            }

        });

        it(' should not allow to claim for other users if not set as allowed claimer', async () => {

            await expect(
                staking.connect(depositor3).claimAllRewardsForUser(depositor1.address, depositor3.address)
            ).to.be.revertedWith('ClaimNotAllowed')

            await expect(
                staking.connect(depositor3).claimAllRewardsForUser(depositor2.address, depositor3.address)
            ).to.be.revertedWith('ClaimNotAllowed')

        });

        it(' should fail if given address 0x0', async () => {

            await expect(
                staking.connect(depositor1).claimAllRewards(ethers.constants.AddressZero)
            ).to.be.revertedWith('AddressZero')

            await expect(
                staking.connect(depositor3).claimAllRewardsForUser(ethers.constants.AddressZero, depositor3.address)
            ).to.be.revertedWith('AddressZero')

            await expect(
                staking.connect(depositor3).claimAllRewardsForUser(depositor2.address, ethers.constants.AddressZero)
            ).to.be.revertedWith('AddressZero')

        });

    });

});