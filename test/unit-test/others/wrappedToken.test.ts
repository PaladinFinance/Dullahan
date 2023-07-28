const hre = require("hardhat");
import { ethers } from "hardhat";
import chai from "chai";
import { BigNumber } from "ethers";
import { solidity } from "ethereum-waffle";
import { WrappedVaultToken } from "../../../typechain/WrappedVaultToken";
import { DullahanVault } from "../../../typechain/DullahanVault";
import { IStakedAave } from "../../../typechain/interfaces/IStakedAave";
import { IStakedAave__factory } from "../../../typechain/factories/interfaces/IStakedAave__factory";
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
    AAVE,
    STK_AAVE,
    HOLDER_AAVE,
    AMOUNT_AAVE
} from "../../utils/constants"

chai.use(solidity);
const { expect } = chai;
const { provider } = ethers;

let wrapperFactory: ContractFactory
let vaultFactory: ContractFactory

const UNIT = ethers.utils.parseEther('1')
const WEEK = BigNumber.from(7 * 86400);
const RAY = ethers.utils.parseEther('1000000000')

const DISTRIBUTION_DURATION = BigNumber.from(7 * 86400);

describe('WrappedVaultToken contract tests', () => {
    let admin: SignerWithAddress

    let wrapper: WrappedVaultToken
    let token: DullahanVault

    let reserveManager: SignerWithAddress
    let votingManager: SignerWithAddress
    let proposalManager: SignerWithAddress

    let podManager: SignerWithAddress

    let aave: IERC20
    let stkAave: IERC20
    let stkAave_staking: IStakedAave

    let depositor1: SignerWithAddress
    let depositor2: SignerWithAddress
    let depositor3: SignerWithAddress

    const depositor1_amount = ethers.utils.parseEther('1500')
    const depositor2_amount = ethers.utils.parseEther('750')
    const depositor3_amount = ethers.utils.parseEther('2450')

    const reserve_ratio = BigNumber.from(100)

    before(async () => {
        await resetFork();

        [admin, reserveManager, votingManager, proposalManager, podManager, depositor1, depositor2, depositor3] = await ethers.getSigners();

        wrapperFactory = await ethers.getContractFactory("WrappedVaultToken");
        vaultFactory = await ethers.getContractFactory("DullahanVault");

        aave = IERC20__factory.connect(AAVE, provider);
        stkAave = IERC20__factory.connect(STK_AAVE, provider);
        stkAave_staking = IStakedAave__factory.connect(STK_AAVE, provider);

        await getERC20(admin, HOLDER_AAVE, aave, admin.address, AMOUNT_AAVE);

        await aave.connect(admin).approve(stkAave_staking.address, AMOUNT_AAVE);
        await stkAave_staking.connect(admin).stake(admin.address, AMOUNT_AAVE);

    });

    beforeEach(async () => {

        token = (await vaultFactory.connect(admin).deploy(
            admin.address,
            reserve_ratio,
            reserveManager.address,
            AAVE,
            STK_AAVE,
            "Dullahan stkAave",
            "dstkAAVE"
        )) as DullahanVault;
        await token.deployed();

        wrapper = (await wrapperFactory.connect(admin).deploy(
            token.address,
            "Wrapped Dullahan stkAave",
            "wdstkAAVE"
        )) as WrappedVaultToken;
        await wrapper.deployed();

        const seed_deposit = ethers.utils.parseEther('0.001')
        await stkAave.connect(admin).approve(token.address, seed_deposit)
        await token.connect(admin).init(votingManager.address, proposalManager.address)

        await stkAave.connect(admin).transfer(depositor1.address, depositor1_amount)
        await stkAave.connect(admin).transfer(depositor2.address, depositor2_amount)
        await stkAave.connect(admin).transfer(depositor3.address, depositor3_amount)

        await stkAave.connect(depositor1).approve(token.address, ethers.constants.MaxUint256)
        await stkAave.connect(depositor2).approve(token.address, depositor2_amount)
        await stkAave.connect(depositor3).approve(token.address, depositor3_amount)

        await token.connect(depositor1).deposit(depositor1_amount, depositor1.address)
        await token.connect(depositor2).deposit(depositor2_amount, depositor2.address)
        await token.connect(depositor3).deposit(depositor3_amount, depositor3.address)

    });

    it(' should be deployed & have correct parameters', async () => {
        expect(wrapper.address).to.properAddress

        expect(await wrapper.vault()).to.be.eq(token.address)

        expect(await wrapper.totalSupply()).to.be.eq(0)
        expect(await wrapper.getCurrentIndex()).to.be.eq(RAY)

    });

    describe('wrap', async () => {

        it(' should make the initial wrapping correctly', async () => {

            const prev_user_balance = await wrapper.balanceOf(depositor1.address)
            const prev_user_underlying_balance = await token.balanceOf(depositor1.address)
            const prev_wrapper_underlying_balance = await token.balanceOf(wrapper.address)
            const prev_total_supply = await wrapper.totalSupply()

            await token.connect(depositor1).approve(wrapper.address, depositor1_amount)

            const wrap_tx = await wrapper.connect(depositor1).wrap(depositor1_amount)

            const exptected_mint_amount = depositor1_amount

            expect(await wrapper.balanceOf(depositor1.address)).to.be.eq(prev_user_balance.add(exptected_mint_amount))
            expect(await token.balanceOf(depositor1.address)).to.be.eq(prev_user_underlying_balance.sub(depositor1_amount))
            expect(await token.balanceOf(wrapper.address)).to.be.eq(prev_wrapper_underlying_balance.add(depositor1_amount))
            expect(await wrapper.totalSupply()).to.be.eq(prev_total_supply.add(exptected_mint_amount))

            await expect(wrap_tx).to.emit(wrapper, 'Wrapped').withArgs(
                depositor1.address,
                depositor1_amount,
                exptected_mint_amount
            )

        });

        it(' should allow other wrapping (no index change)', async () => {

            await token.connect(depositor1).approve(wrapper.address, depositor1_amount)
            await token.connect(depositor2).approve(wrapper.address, depositor2_amount)
            await token.connect(depositor3).approve(wrapper.address, depositor3_amount)
            
            const prev_wrapper_underlying_balance = await token.balanceOf(wrapper.address)
            const prev_total_supply = await wrapper.totalSupply()

            await wrapper.connect(depositor1).wrap(depositor1_amount)

            await wrapper.connect(depositor2).wrap(depositor2_amount)

            await wrapper.connect(depositor3).wrap(depositor3_amount)

            expect(await token.balanceOf(wrapper.address)).to.be.eq(prev_wrapper_underlying_balance.add(
                depositor1_amount.add(depositor2_amount).add(depositor3_amount)
            ))
            expect(await wrapper.totalSupply()).to.be.eq(prev_total_supply.add(
                depositor1_amount.add(depositor2_amount).add(depositor3_amount)
            ))

        });

        it(' should allow other wrapping (index change)', async () => {

            await token.connect(depositor1).approve(wrapper.address, depositor1_amount)
            await token.connect(depositor2).approve(wrapper.address, depositor2_amount)

            await wrapper.connect(depositor1).wrap(depositor1_amount)

            await advanceTime(WEEK.mul(3).toNumber())
            await token.connect(admin).updateStkAaveRewards()

            const prev_user_balance = await wrapper.balanceOf(depositor2.address)
            const prev_user_underlying_balance = await token.balanceOf(depositor2.address)
            const prev_wrapper_underlying_balance = await token.balanceOf(wrapper.address)
            const prev_total_supply = await wrapper.totalSupply()

            const wrap_tx = await wrapper.connect(depositor2).wrap(depositor2_amount)

            const prev_index = await wrapper.getCurrentIndex()
            const exptected_mint_amount = depositor2_amount.mul(RAY).add(prev_index.div(2)).div(prev_index)

            expect(await wrapper.balanceOf(depositor2.address)).to.be.eq(prev_user_balance.add(exptected_mint_amount))
            expect(await token.balanceOf(depositor2.address)).to.be.eq(prev_user_underlying_balance.sub(depositor2_amount))
            expect(await token.balanceOf(wrapper.address)).to.be.eq(prev_wrapper_underlying_balance.add(depositor2_amount))
            expect(await wrapper.totalSupply()).to.be.eq(prev_total_supply.add(exptected_mint_amount))

            await expect(wrap_tx).to.emit(wrapper, 'Wrapped').withArgs(
                depositor2.address,
                depositor2_amount,
                exptected_mint_amount
            )

        });

        it(' should fail if given a null amount', async () => {

            await token.connect(depositor1).approve(wrapper.address, depositor1_amount)

            await expect(
                wrapper.connect(depositor1).wrap(0)
            ).to.be.revertedWith('NullAmount')

        });

        /*it(' should fail if the converted amount is 0', async () => {

            await token.connect(depositor1).approve(wrapper.address, depositor1_amount)
            await token.connect(depositor2).approve(wrapper.address, depositor2_amount)

            await wrapper.connect(depositor1).wrap(depositor1_amount)

            await advanceTime(WEEK.mul(10).toNumber())
            await token.connect(admin).updateStkAaveRewards()

            await expect(
                wrapper.connect(depositor2).wrap(1)
            ).to.be.revertedWith('NullAmount')

        });*/

        it(' should fail if trying to wrap more than underlying balance', async () => {

            await token.connect(depositor1).approve(wrapper.address, depositor1_amount)

            await expect(
                wrapper.connect(depositor1).wrap((await token.balanceOf(depositor1.address)).mul(2))
            ).to.be.reverted

        });

    });

    describe('getCurrentIndex', async () => {

        beforeEach(async () => {

            await token.connect(depositor1).approve(wrapper.address, depositor1_amount)
            await token.connect(depositor2).approve(wrapper.address, depositor2_amount)

            await wrapper.connect(depositor1).wrap(depositor1_amount)
            await wrapper.connect(depositor2).wrap(depositor2_amount)

        });

        it(' should return the correct index', async () => {

            expect(await wrapper.getCurrentIndex()).to.be.eq(RAY)

            await advanceTime(WEEK.mul(5).toNumber())
            await token.connect(admin).updateStkAaveRewards()

            const current_assets_1 = await token.balanceOf(wrapper.address)
            const current_supply_1 = await wrapper.totalSupply()
            expect(await wrapper.getCurrentIndex()).to.be.eq(
                current_assets_1.mul(RAY).add(current_supply_1.div(2)).div(current_supply_1)
            )

            await advanceTime(WEEK.mul(10).toNumber())
            await token.connect(admin).updateStkAaveRewards()

            const current_assets_2 = await token.balanceOf(wrapper.address)
            const current_supply_2 = await wrapper.totalSupply()
            expect(await wrapper.getCurrentIndex()).to.be.eq(
                current_assets_2.mul(RAY).add(current_supply_2.div(2)).div(current_supply_2)
            )

        });

    });

    describe('convert methods', async () => {

        const test_amount = ethers.utils.parseEther('1000')

        it(' should return the same amounts if the index did not change', async () => {

            expect(
                await wrapper.convertToWdstkAave(test_amount)
            ).to.be.eq(
                await wrapper.convertToDstkAave(test_amount)
            )

            await advanceTime(WEEK.mul(3).toNumber())

            expect(
                await wrapper.convertToWdstkAave(test_amount)
            ).to.be.eq(
                await wrapper.convertToDstkAave(test_amount)
            )

        });

        it(' should change after an update of the index', async () => {

            await token.connect(depositor1).approve(wrapper.address, depositor1_amount)
            await token.connect(depositor2).approve(wrapper.address, depositor2_amount)

            await wrapper.connect(depositor1).wrap(depositor1_amount)
            await wrapper.connect(depositor2).wrap(depositor2_amount)

            await advanceTime(WEEK.mul(3).toNumber())
            await token.connect(admin).updateStkAaveRewards()

            const current_index = await wrapper.getCurrentIndex()

            const expected_dstkAave_amount = test_amount.mul(current_index).add(RAY.div(2)).div(RAY)
            const expected_wdstkAave_amount = test_amount.mul(RAY).add(current_index.div(2)).div(current_index)

            expect(
                await wrapper.convertToDstkAave(test_amount)
            ).to.be.eq(expected_dstkAave_amount)

            expect(
                await wrapper.convertToWdstkAave(test_amount)
            ).to.be.eq(expected_wdstkAave_amount)

        });

        it(' should not change after a deposit', async () => {

            await token.connect(depositor1).approve(wrapper.address, depositor1_amount)
            await token.connect(depositor2).approve(wrapper.address, depositor2_amount)
            await token.connect(depositor3).approve(wrapper.address, depositor3_amount)

            await wrapper.connect(depositor1).wrap(depositor1_amount)
            await wrapper.connect(depositor2).wrap(depositor2_amount)

            await advanceTime(WEEK.mul(3).toNumber())
            await token.connect(admin).updateStkAaveRewards()

            const prev_dstkAave_amount = await wrapper.convertToDstkAave(test_amount)
            const prev_wdstkAave_amount = await wrapper.convertToWdstkAave(test_amount)

            await wrapper.connect(depositor3).wrap(depositor3_amount)

            expect(
                await wrapper.convertToDstkAave(test_amount)
            ).to.be.eq(prev_dstkAave_amount)

            expect(
                await wrapper.convertToWdstkAave(test_amount)
            ).to.be.eq(prev_wdstkAave_amount)

        });

    });

    describe('unwrap', async () => {

        beforeEach(async () => {

            await token.connect(depositor1).approve(wrapper.address, depositor1_amount)
            await token.connect(depositor2).approve(wrapper.address, depositor2_amount)

            await wrapper.connect(depositor1).wrap(depositor1_amount)
            await wrapper.connect(depositor2).wrap(depositor2_amount)

            await advanceTime(WEEK.mul(3).toNumber())
            await token.connect(admin).updateStkAaveRewards()

        });

        it(' should unwrap correctly', async () => {

            const unwrap_amount = ethers.utils.parseEther('150')

            const prev_user_balance = await wrapper.balanceOf(depositor1.address)
            const prev_user_underlying_balance = await token.balanceOf(depositor1.address)
            const prev_wrapper_underlying_balance = await token.balanceOf(wrapper.address)
            const prev_total_supply = await wrapper.totalSupply()

            const prev_index = await wrapper.getCurrentIndex()

            const wrap_tx = await wrapper.connect(depositor1).unwrap(unwrap_amount)
            
            const exptected_underlying_amount = unwrap_amount.mul(prev_index).add(RAY.div(2)).div(RAY)

            expect(await wrapper.balanceOf(depositor1.address)).to.be.eq(prev_user_balance.sub(unwrap_amount))
            expect(await token.balanceOf(depositor1.address)).to.be.eq(prev_user_underlying_balance.add(exptected_underlying_amount))
            expect(await token.balanceOf(wrapper.address)).to.be.eq(prev_wrapper_underlying_balance.sub(exptected_underlying_amount))
            expect(await wrapper.totalSupply()).to.be.eq(prev_total_supply.sub(unwrap_amount))

            await expect(wrap_tx).to.emit(wrapper, 'Unwrapped').withArgs(
                depositor1.address,
                exptected_underlying_amount,
                unwrap_amount
            )

        });

        it(' should fail if given 0', async () => {

            await expect(
                wrapper.connect(depositor1).unwrap(0)
            ).to.be.revertedWith('NullAmount')

        });

    });

});