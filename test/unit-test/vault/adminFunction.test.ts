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

describe('DullahanVault contract tests - Admin functions', () => {
    let admin: SignerWithAddress

    let newAdmin: SignerWithAddress

    let vault: DullahanVault

    let reserveManager: SignerWithAddress
    let votingManager: SignerWithAddress

    let otherReserveManager: SignerWithAddress
    let otherVotingManager: SignerWithAddress

    let podManager: SignerWithAddress
    let podManager2: SignerWithAddress
    let fakePod: SignerWithAddress

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

        [admin, newAdmin, reserveManager, votingManager, otherReserveManager, otherVotingManager, podManager, podManager2, fakePod, depositor1, depositor2, depositor3] = await ethers.getSigners();

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

    describe('transferAdmin', async () => {

        it(' should set the correct _pendingOwner', async () => {

            const tx = await vault.connect(admin).transferAdmin(newAdmin.address)

            await expect(tx).to.emit(vault, "NewPendingAdmin")
            .withArgs(ethers.constants.AddressZero, newAdmin.address);

            expect(await vault.pendingAdmin()).to.be.eq(newAdmin.address)

        });

        it(' should fail if address 0 is given', async () => {

            await expect(
                vault.connect(admin).transferAdmin(ethers.constants.AddressZero)
            ).to.be.revertedWith('AddressZero')

        });

        it(' should fail if not called by owner', async () => {

            await expect(
                vault.connect(newAdmin).transferAdmin(newAdmin.address)
            ).to.be.revertedWith('CallerNotAdmin')

            await expect(
                vault.connect(depositor1).transferAdmin(newAdmin.address)
            ).to.be.revertedWith('CallerNotAdmin')

        });

        it(' should fail if giving the current owner as parameter', async () => {

            await expect(
                vault.connect(admin).transferAdmin(admin.address)
            ).to.be.revertedWith('CannotBeAdmin')

        });

    });

    describe('acceptAdmin', async () => {

        beforeEach(async () => {

            await vault.connect(admin).transferAdmin(newAdmin.address)

        });

        it(' should update the owner correctly', async () => {

            const tx = await vault.connect(newAdmin).acceptAdmin()

            await expect(tx).to.emit(vault, "AdminTransferred")
            .withArgs(admin.address, newAdmin.address);

            await expect(tx).to.emit(vault, "NewPendingAdmin")
            .withArgs(newAdmin.address, ethers.constants.AddressZero);

            expect(await vault.admin()).to.be.eq(newAdmin.address)

        });

        it(' should fail if not called by the pending owner', async () => {

            await expect(
                vault.connect(admin).acceptAdmin()
            ).to.be.revertedWith('CallerNotPendingAdmin')

            await expect(
                vault.connect(depositor1).acceptAdmin()
            ).to.be.revertedWith('CallerNotPendingAdmin')

        });

    });
    
    describe('addPodManager', async () => {

        it(' should add the new Pod Manager correctly (& emit Event)', async () => {

            expect((await vault.podManagers(podManager.address)).rentingAllowed).to.be.false

            const add_tx = await vault.connect(admin).addPodManager(podManager.address)

            expect((await vault.podManagers(podManager.address)).rentingAllowed).to.be.true
            expect((await vault.podManagers(podManager.address)).totalRented).to.be.eq(0)

            await expect(add_tx).to.emit(vault, "NewPodManager").withArgs(podManager.address);

        });

        it(' should allow to list multiple managers', async () => {

            expect((await vault.podManagers(podManager.address)).rentingAllowed).to.be.false
            expect((await vault.podManagers(podManager2.address)).rentingAllowed).to.be.false

            const add_tx1 = await vault.connect(admin).addPodManager(podManager.address)

            expect((await vault.podManagers(podManager.address)).rentingAllowed).to.be.true
            expect((await vault.podManagers(podManager2.address)).rentingAllowed).to.be.false
            expect((await vault.podManagers(podManager.address)).totalRented).to.be.eq(0)

            await expect(add_tx1).to.emit(vault, "NewPodManager").withArgs(podManager.address);

            const add_tx2 = await vault.connect(admin).addPodManager(podManager2.address)

            expect((await vault.podManagers(podManager.address)).rentingAllowed).to.be.true
            expect((await vault.podManagers(podManager2.address)).rentingAllowed).to.be.true
            expect((await vault.podManagers(podManager2.address)).totalRented).to.be.eq(0)

            await expect(add_tx2).to.emit(vault, "NewPodManager").withArgs(podManager2.address);



        });

        it(' should fail if already in the list', async () => {

            await vault.connect(admin).addPodManager(podManager.address)

            await expect(
                vault.connect(admin).addPodManager(podManager.address)
            ).to.be.revertedWith('ManagerAlreadyListed')

        });

        it(' should fail if given address 0x0', async () => {

            await expect(
                vault.connect(admin).addPodManager(ethers.constants.AddressZero)
            ).to.be.revertedWith('AddressZero')

        });

        it(' should block non-admin caller', async () => {

            await expect(
                vault.connect(podManager).addPodManager(podManager.address)
            ).to.be.revertedWith('CallerNotAdmin')

        });

    });
    
    describe('blockPodManager', async () => {

        beforeEach(async () => {

            await vault.connect(admin).addPodManager(podManager.address)
            await vault.connect(admin).addPodManager(podManager2.address)

        });

        it(' should block the podManager correctly (& emit Event)', async () => {

            expect((await vault.podManagers(podManager.address)).rentingAllowed).to.be.true
            expect((await vault.podManagers(podManager2.address)).rentingAllowed).to.be.true

            const add_tx = await vault.connect(admin).blockPodManager(podManager.address)

            expect((await vault.podManagers(podManager.address)).rentingAllowed).to.be.false
            expect((await vault.podManagers(podManager2.address)).rentingAllowed).to.be.true

            await expect(add_tx).to.emit(vault, "BlockedPodManager").withArgs(podManager.address);

        });

        it(' should fail if already blocked', async () => {

            await vault.connect(admin).blockPodManager(podManager.address)

            await expect(
                vault.connect(admin).blockPodManager(podManager.address)
            ).to.be.revertedWith('ManagerNotListed')

        });

        it(' should fail if not in the list', async () => {

            await expect(
                vault.connect(admin).blockPodManager(depositor1.address)
            ).to.be.revertedWith('ManagerNotListed')

        });

        it(' should fail if given address 0x0', async () => {

            await expect(
                vault.connect(admin).blockPodManager(ethers.constants.AddressZero)
            ).to.be.revertedWith('AddressZero')

        });

        it(' should block non-admin caller', async () => {

            await expect(
                vault.connect(podManager).blockPodManager(podManager2.address)
            ).to.be.revertedWith('CallerNotAdmin')

        });

    });

    describe('pause', async () => {

        const user1_deposit = ethers.utils.parseEther('250')
        const user2_deposit = ethers.utils.parseEther('350')
        
        const user1_withdraw = ethers.utils.parseEther('50')

        beforeEach(async () => {

            await stkAave.connect(admin).transfer(depositor1.address, user1_deposit)
            await stkAave.connect(admin).transfer(depositor2.address, user2_deposit)

            await stkAave.connect(depositor1).approve(vault.address, MAX_UINT256)
            await stkAave.connect(depositor2).approve(vault.address, MAX_UINT256)

            await vault.connect(depositor1).deposit(user1_deposit, depositor1.address)

        });

        it(' should block pausable methods', async () => {

            await vault.connect(admin).pause()

            await expect(
                vault.connect(depositor2).deposit(user2_deposit, depositor2.address)
            ).to.be.revertedWith('Pausable: paused')

            await expect(
                vault.connect(depositor2).mint(user2_deposit, depositor2.address)
            ).to.be.revertedWith('Pausable: paused')

            await expect(
                vault.connect(depositor1).withdraw(user1_withdraw, depositor1.address, depositor1.address)
            ).to.be.revertedWith('Pausable: paused')

            await expect(
                vault.connect(depositor1).redeem(user1_withdraw, depositor1.address, depositor1.address)
            ).to.be.revertedWith('Pausable: paused')

            await expect(
                vault.connect(depositor1).transfer(depositor2.address, user1_withdraw)
            ).to.be.revertedWith('Pausable: paused')

        });

        it(' should fail if already paused', async () => {

            await vault.connect(admin).pause()

            await expect(
                vault.connect(admin).pause()
            ).to.be.revertedWith('Pausable: paused')

        });

        it(' should block non-admin caller', async () => {

            await expect(
                vault.connect(depositor1).pause()
            ).to.be.revertedWith('CallerNotAdmin')

        });

    });

    describe('unpause', async () => {

        const user1_deposit = ethers.utils.parseEther('250')
        const user2_deposit = ethers.utils.parseEther('350')
        
        const user1_withdraw = ethers.utils.parseEther('50')

        beforeEach(async () => {

            await stkAave.connect(admin).transfer(depositor1.address, user1_deposit.mul(3))
            await stkAave.connect(admin).transfer(depositor2.address, user2_deposit.mul(3))

            await stkAave.connect(depositor1).approve(vault.address, MAX_UINT256)
            await stkAave.connect(depositor2).approve(vault.address, MAX_UINT256)

            await vault.connect(depositor1).deposit(user1_deposit.mul(3), depositor1.address)
            
            await vault.connect(admin).pause()

        });

        it(' should un-block pausable methods', async () => {

            await vault.connect(admin).unpause()

            await expect(
                vault.connect(depositor2).deposit(user2_deposit, depositor2.address)
            ).not.to.be.reverted

            await expect(
                vault.connect(depositor2).mint(user2_deposit, depositor2.address)
            ).not.to.be.reverted

            await expect(
                vault.connect(depositor1).withdraw(user1_withdraw, depositor1.address, depositor1.address)
            ).not.to.be.reverted

            await expect(
                vault.connect(depositor1).redeem(user1_withdraw, depositor1.address, depositor1.address)
            ).not.to.be.reverted

            await expect(
                vault.connect(depositor1).transfer(depositor2.address, user1_withdraw)
            ).not.to.be.reverted

        });

        it(' should fail if not paused', async () => {

            await vault.connect(admin).unpause()

            await expect(
                vault.connect(admin).unpause()
            ).to.be.revertedWith('Pausable: not paused')

        });

        it(' should block non-admin caller', async () => {

            await expect(
                vault.connect(depositor1).unpause()
            ).to.be.revertedWith('CallerNotAdmin')

        });

    });

    describe('updateVotingPowerManager', async () => {

        it(' should update parameter correctly (& emit Event)', async () => {

            const update_tx = await vault.connect(admin).updateVotingPowerManager(otherVotingManager.address)

            expect(await vault.votingPowerManager()).to.be.eq(otherVotingManager.address)

            await expect(update_tx).to.emit(vault, 'UpdatedVotingPowerManager').withArgs(
                votingManager.address,
                otherVotingManager.address
            );

        });

        it(' should fail if given invalid parameter', async () => {

            await expect(
                vault.connect(admin).updateVotingPowerManager(ethers.constants.AddressZero)
            ).to.be.revertedWith('AddressZero')

            await expect(
                vault.connect(admin).updateVotingPowerManager(votingManager.address)
            ).to.be.revertedWith('SameAddress')

        });

        it(' should only be callable by admin', async () => {

            await expect(
                vault.connect(depositor1).updateVotingPowerManager(otherVotingManager.address)
            ).to.be.revertedWith('CallerNotAdmin')

        });

    });

    describe('updateReserveManager', async () => {

        it(' should update parameter correctly (& emit Event)', async () => {

            const update_tx = await vault.connect(admin).updateReserveManager(otherReserveManager.address)

            expect(await vault.reserveManager()).to.be.eq(otherReserveManager.address)

            await expect(update_tx).to.emit(vault, 'UpdatedReserveManager').withArgs(
                reserveManager.address,
                otherReserveManager.address
            );

        });

        it(' should fail if given invalid parameter', async () => {

            await expect(
                vault.connect(admin).updateReserveManager(ethers.constants.AddressZero)
            ).to.be.revertedWith('AddressZero')

            await expect(
                vault.connect(admin).updateReserveManager(reserveManager.address)
            ).to.be.revertedWith('SameAddress')

        });

        it(' should only be callable by admin', async () => {

            await expect(
                vault.connect(depositor1).updateReserveManager(otherReserveManager.address)
            ).to.be.revertedWith('CallerNotAdmin')

        });

    });

    describe('updateBufferRatio', async () => {

        const new_ratio = 250

        it(' should update parameter correctly (& emit Event)', async () => {

            const old_ratio = await vault.bufferRatio()

            const update_tx = await vault.connect(admin).updateBufferRatio(new_ratio)

            expect(await vault.bufferRatio()).to.be.eq(new_ratio)

            await expect(update_tx).to.emit(vault, 'UpdatedBufferRatio').withArgs(
                old_ratio,
                new_ratio
            );

        });

        it(' should fail if given invalid parameter', async () => {

            const invalid_ratio = 2000

            await expect(
                vault.connect(admin).updateBufferRatio(invalid_ratio)
            ).to.be.revertedWith('InvalidParameter')

        });

        it(' should only be callable by admin', async () => {

            await expect(
                vault.connect(depositor1).updateBufferRatio(new_ratio)
            ).to.be.revertedWith('CallerNotAdmin')

        });

    });
    
    describe('depositToReserve', async () => {

        const user1_deposit = ethers.utils.parseEther('500')
        const reserve_deposit = ethers.utils.parseEther('120')

        beforeEach(async () => {

            await stkAave.connect(admin).transfer(depositor1.address, user1_deposit)
            await stkAave.connect(depositor1).approve(vault.address, user1_deposit)
            await vault.connect(depositor1).deposit(user1_deposit, depositor1.address)

            await stkAave.connect(admin).approve(vault.address, ethers.constants.MaxUint256)

        });

        it(' should deposit to reserve correctly', async () => {

            const prev_balance = await stkAave.balanceOf(vault.address)
            const prev_reserve = await vault.reserveAmount()

            const tx = await vault.connect(admin).depositToReserve(reserve_deposit)

            // Part stkAave reward claim & re-stake
            const receipt = await tx.wait()
            const iface = stkAave_staking.interface;
            const topic = iface.getEventTopic('Staked')
            const staking_log = receipt.logs.filter(x => x.topics.indexOf(topic) >= 0);
            const staking_events = staking_log.map((log) => (iface.parseLog(log)).args)
            const stkAave_claim = staking_events[0].shares
            const stkAave_claim_reserve = stkAave_claim.mul(await vault.reserveRatio()).div(MAX_BPS)
            // --------------------------------------------------

            const new_balance = await stkAave.balanceOf(vault.address)
            const new_reserve = await vault.reserveAmount()

            expect(new_balance).to.be.eq(prev_balance.add(reserve_deposit).add(stkAave_claim))
            expect(new_reserve).to.be.eq(prev_reserve.add(reserve_deposit).add(stkAave_claim_reserve))

            await expect(tx).to.emit(vault, "ReserveDeposit").withArgs(admin.address, reserve_deposit);

        });

        it(' should fail if given a null amount', async () => {

            await expect(
                vault.connect(admin).depositToReserve(0)
            ).to.be.revertedWith('NullAmount')

        });

        it(' should block non-admin caller', async () => {

            await expect(
                vault.connect(depositor1).depositToReserve(reserve_deposit)
            ).to.be.revertedWith('CallerNotAdmin')

        });

    });
    
    describe('withdrawFromReserve', async () => {

        const user1_deposit = ethers.utils.parseEther('500')
        const user2_deposit = ethers.utils.parseEther('120')

        let reserve_withdraw: BigNumber

        beforeEach(async () => {

            await stkAave.connect(admin).transfer(depositor1.address, user1_deposit)
            await stkAave.connect(admin).transfer(depositor2.address, user2_deposit)
            await stkAave.connect(depositor1).approve(vault.address, user1_deposit)
            await stkAave.connect(depositor2).approve(vault.address, user2_deposit)
            await vault.connect(depositor1).deposit(user1_deposit, depositor1.address)
            await vault.connect(depositor2).deposit(user2_deposit, depositor2.address)

            await advanceTime(WEEK.mul(4).toNumber())

            await vault.updateStkAaveRewards()

            reserve_withdraw = (await vault.reserveAmount()).mul(3).div(4)

        });

        it(' should deposit to reserve correctly', async () => {

            const prev_balance = await stkAave.balanceOf(vault.address)
            const prev_reserve = await vault.reserveAmount()

            const tx = await vault.connect(admin).withdrawFromReserve(reserve_withdraw, admin.address)

            // Part stkAave reward claim & re-stake
            const receipt = await tx.wait()
            const iface = stkAave_staking.interface;
            const topic = iface.getEventTopic('Staked')
            const staking_log = receipt.logs.filter(x => x.topics.indexOf(topic) >= 0);
            const staking_events = staking_log.map((log) => (iface.parseLog(log)).args)
            const stkAave_claim = staking_events[0].shares
            const stkAave_claim_reserve = stkAave_claim.mul(await vault.reserveRatio()).div(MAX_BPS)
            // --------------------------------------------------

            const new_balance = await stkAave.balanceOf(vault.address)
            const new_reserve = await vault.reserveAmount()

            expect(new_balance).to.be.eq(prev_balance.sub(reserve_withdraw).add(stkAave_claim))
            expect(new_reserve).to.be.eq(prev_reserve.sub(reserve_withdraw).add(stkAave_claim_reserve))

            await expect(tx).to.emit(vault, "ReserveWithdraw").withArgs(admin.address, reserve_withdraw);

        });

        it(' should fail if amount exceeds reserve amount', async () => {

            const current_reserve = await vault.reserveAmount()

            await expect(
                vault.connect(admin).withdrawFromReserve(current_reserve.mul(2), admin.address)
            ).to.be.revertedWith('ReserveTooLow')

        });

        it(' should fail if given a null amount', async () => {

            await expect(
                vault.connect(admin).withdrawFromReserve(0, admin.address)
            ).to.be.revertedWith('NullAmount')

        });

        it(' should fail if given address 0x0', async () => {

            await expect(
                vault.connect(admin).withdrawFromReserve(reserve_withdraw, ethers.constants.AddressZero)
            ).to.be.revertedWith('AddressZero')

        });

        it(' should block non-admin caller', async () => {

            await expect(
                vault.connect(depositor1).withdrawFromReserve(reserve_withdraw, admin.address)
            ).to.be.revertedWith('CallerNotAdmin')

        });

    });

    describe('recoverERC20', async () => {

        const lost_amount = ethers.utils.parseEther('1000');
        const user1_deposit = ethers.utils.parseEther('1250')

        const other_token_address = "0x6B175474E89094C44Da98b954EedeAC495271d0F" // DAI
        const other_token_holder = "0x075e72a5eDf65F0A5f44699c7654C1a76941Ddc8"
        let other_token: IERC20

        beforeEach(async () => {

            other_token = IERC20__factory.connect(other_token_address, provider);

            await getERC20(admin, other_token_holder, other_token, admin.address, ethers.utils.parseEther('10000'));

            await stkAave.connect(admin).transfer(depositor1.address, user1_deposit)
            await stkAave.connect(depositor1).approve(vault.address, user1_deposit)
            await vault.connect(depositor1).deposit(user1_deposit, depositor1.address)

        });

        it(' should retrieve the lost tokens and send it to the admin', async () => {

            await other_token.connect(admin).transfer(vault.address, lost_amount)

            const old_balance = await other_token.balanceOf(admin.address);

            const tx = await vault.connect(admin).recoverERC20(other_token.address)

            const new_balance = await other_token.balanceOf(admin.address);

            expect(await other_token.balanceOf(vault.address)).to.be.eq(0)
            expect(new_balance).to.be.eq(old_balance.add(lost_amount))

            await expect(tx).to.emit(vault, "TokenRecovered").withArgs(other_token.address, lost_amount);

        });

        it(' should fail if no token to revocer', async () => {

            await expect(
                vault.connect(admin).recoverERC20(other_token.address)
            ).to.be.revertedWith('NullAmount')

        });

        it(' should fail if trying to recover underlying asset', async () => {

            await expect(
                vault.connect(admin).recoverERC20(stkAave.address)
            ).to.be.revertedWith('CannotRecoverToken')

            await expect(
                vault.connect(admin).recoverERC20(aave.address)
            ).to.be.revertedWith('CannotRecoverToken')

        });

        it(' should block non-admin caller', async () => {

            await expect(
                vault.connect(depositor1).recoverERC20(other_token.address)
            ).to.be.revertedWith('CallerNotAdmin')

        });

    });

});