const hre = require("hardhat");
import { ethers } from "hardhat";
import chai from "chai";
import { BigNumber } from "ethers";
import { solidity } from "ethereum-waffle";
import { Tester } from "../../typechain/test/Tester";
import { IERC20 } from "../../typechain/oz/interfaces/IERC20";
import { IERC20__factory } from "../../typechain/factories/oz/interfaces/IERC20__factory";
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
    GHO,
    DEBT_GHO,
    AAVE_POOL,
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

let testerFactory: ContractFactory

const MAX_BPS = BigNumber.from('10000')
const MAX_UINT256 = ethers.constants.MaxUint256
const WEEK = BigNumber.from(7 * 86400);
const RAY = ethers.utils.parseEther('1000000000')
const UNIT = ethers.utils.parseEther('1')

const random_amount = ethers.utils.parseEther('15000000')

describe('Test interaction w/ Aave Pool - Goerli', () => {
    let admin: SignerWithAddress

    let tester: Tester
    let tester2: Tester
    let tester3: Tester

    let depositor: SignerWithAddress

    let gho: IERC20
    let debtGho: IERC20

    let token1: IERC20
    let token2: IERC20
    let token3: IERC20

    let aToken1: IERC20
    let aToken2: IERC20
    let aToken3: IERC20

    let aavePool: IAavePool

    before(async () => {
        await resetForkGoerli();

        [admin, depositor] = await ethers.getSigners();

        testerFactory = await ethers.getContractFactory("Tester");

        gho = IERC20__factory.connect(GHO, provider);
        debtGho = IERC20__factory.connect(DEBT_GHO, provider);

        token1 = IERC20__factory.connect(TEST_TOKEN_1, provider);
        token2 = IERC20__factory.connect(TEST_TOKEN_2, provider);
        token3 = IERC20__factory.connect(TEST_TOKEN_3, provider);

        aToken1 = IERC20__factory.connect(A_TOKEN_1, provider);
        aToken2 = IERC20__factory.connect(A_TOKEN_2, provider);
        aToken3 = IERC20__factory.connect(A_TOKEN_3, provider);

        aavePool = IAavePool__factory.connect(AAVE_POOL, provider);

        await mintTokenStorage(TEST_TOKEN_1, depositor, random_amount, 0);
        await mintTokenStorage(TEST_TOKEN_3, depositor, random_amount, 0);
        await mintTokenStorage(TEST_TOKEN_2, depositor, random_amount, 0);
        /*const token2_holder = "0x518B13838F5810979C173d79699F2ADB92E4956f"
        await getERC20(admin, token2_holder, token2, depositor.address, ethers.utils.parseEther('1000'));*/

        const holder = "0x85c792d6E608D90b7513F01AefA6c8260D3a7aF5"
        await getERC20(admin, holder, gho, depositor.address, ethers.utils.parseEther('50000'));

    });

    beforeEach(async () => {

        tester = (await testerFactory.connect(admin).deploy(
            AAVE_POOL,
            GHO,
            DEBT_GHO,
            TEST_TOKEN_1,
            A_TOKEN_1
        )) as Tester;
        await tester.deployed();

        tester2 = (await testerFactory.connect(admin).deploy(
            AAVE_POOL,
            GHO,
            DEBT_GHO,
            TEST_TOKEN_2,
            A_TOKEN_2
        )) as Tester;
        await tester2.deployed();

        tester3 = (await testerFactory.connect(admin).deploy(
            AAVE_POOL,
            GHO,
            DEBT_GHO,
            TEST_TOKEN_3,
            A_TOKEN_3
        )) as Tester;
        await tester3.deployed();

    });

    describe('depositCollateral', async () => {

        const deposit_amount = ethers.utils.parseEther('1500')
        const deposit_amount2 = ethers.utils.parseEther('50')
        const deposit_amount3 = BigNumber.from('75000000000')

        beforeEach(async () => {

            await token1.connect(depositor).approve(tester.address, ethers.constants.MaxUint256)
            await token2.connect(depositor).approve(tester2.address, ethers.constants.MaxUint256)
            await token3.connect(depositor).approve(tester3.address, ethers.constants.MaxUint256)

        });

        it(' test simple deposit - tester 1', async () => {

            const previous_pod_balance = await token1.balanceOf(tester.address)
            const previous_user_balance = await token1.balanceOf(depositor.address)

            const previous_pod_aToken_balance = await aToken1.balanceOf(tester.address)

            const deposit_tx = await tester.connect(depositor).depositCollateral(deposit_amount)

            const tx_block = (await deposit_tx).blockNumber

            const new_pod_balance = await token1.balanceOf(tester.address)
            const new_user_balance = await token1.balanceOf(depositor.address)

            const new_pod_aToken_balance = await aToken1.balanceOf(tester.address, { blockTag: tx_block })

            expect(new_pod_balance).to.be.eq(previous_pod_balance)
            expect(new_user_balance).to.be.eq(previous_user_balance.sub(deposit_amount))

            expect(new_pod_aToken_balance).to.be.eq(previous_pod_aToken_balance.add(deposit_amount))

            const aave_pool_pod_status = await aavePool.getUserAccountData(tester.address)

            expect(aave_pool_pod_status.totalCollateralBase).to.be.eq(150000000000) // because 1500 DAI & Base is 8 decimals in Aave Oracle
            expect(aave_pool_pod_status.totalDebtBase).to.be.eq(0)
            
            await expect(deposit_tx).to.emit(token1, "Transfer")
            .withArgs(depositor.address, tester.address, deposit_amount);

            await expect(deposit_tx).to.emit(token1, "Approval")
            .withArgs(tester.address, AAVE_POOL, deposit_amount);

            await expect(deposit_tx).to.emit(token1, "Transfer")
            .withArgs(tester.address, aToken1.address, deposit_amount);

            await expect(deposit_tx).to.emit(tester, "CollateralDeposited")
            .withArgs(token1.address, deposit_amount);

        });

        it(' test simple deposit - tester 2', async () => {

            const previous_pod_balance = await token2.balanceOf(tester2.address)
            const previous_user_balance = await token2.balanceOf(depositor.address)

            const previous_pod_aToken_balance = await aToken2.balanceOf(tester2.address)

            const deposit_tx = await tester2.connect(depositor).depositCollateral(deposit_amount2)

            const tx_block = (await deposit_tx).blockNumber

            const new_pod_balance = await token2.balanceOf(tester2.address)
            const new_user_balance = await token2.balanceOf(depositor.address)

            const new_pod_aToken_balance = await aToken2.balanceOf(tester2.address, { blockTag: tx_block })

            expect(new_pod_balance).to.be.eq(previous_pod_balance)
            expect(new_user_balance).to.be.eq(previous_user_balance.sub(deposit_amount2))

            expect(new_pod_aToken_balance).to.be.eq(previous_pod_aToken_balance.add(deposit_amount2))
            
            await expect(deposit_tx).to.emit(token2, "Transfer")
            .withArgs(depositor.address, tester2.address, deposit_amount2);

            await expect(deposit_tx).to.emit(token2, "Approval")
            .withArgs(tester2.address, AAVE_POOL, deposit_amount2);

            await expect(deposit_tx).to.emit(token2, "Transfer")
            .withArgs(tester2.address, aToken2.address, deposit_amount2);

            await expect(deposit_tx).to.emit(tester2, "CollateralDeposited")
            .withArgs(token2.address, deposit_amount2);

        });

        it(' test simple deposit - tester 3', async () => {

            const previous_pod_balance = await token3.balanceOf(tester3.address)
            const previous_user_balance = await token3.balanceOf(depositor.address)

            const previous_pod_aToken_balance = await aToken3.balanceOf(tester3.address)

            const deposit_tx = await tester3.connect(depositor).depositCollateral(deposit_amount3)

            const tx_block = (await deposit_tx).blockNumber

            const new_pod_balance = await token3.balanceOf(tester3.address)
            const new_user_balance = await token3.balanceOf(depositor.address)

            const new_pod_aToken_balance = await aToken3.balanceOf(tester3.address, { blockTag: tx_block })

            expect(new_pod_balance).to.be.eq(previous_pod_balance)
            expect(new_user_balance).to.be.eq(previous_user_balance.sub(deposit_amount3))

            expect(new_pod_aToken_balance).to.be.eq(previous_pod_aToken_balance.add(deposit_amount3))
            
            await expect(deposit_tx).to.emit(token3, "Transfer")
            .withArgs(depositor.address, tester3.address, deposit_amount3);

            await expect(deposit_tx).to.emit(token3, "Approval")
            .withArgs(tester3.address, AAVE_POOL, deposit_amount3);

            await expect(deposit_tx).to.emit(token3, "Transfer")
            .withArgs(tester3.address, aToken3.address, deposit_amount3);

            await expect(deposit_tx).to.emit(tester3, "CollateralDeposited")
            .withArgs(token3.address, deposit_amount3);

        });

    });

    describe('withdrawCollateral', async () => {

        const deposit_amount = ethers.utils.parseEther('1500')
        const deposit_amount2 = ethers.utils.parseEther('50')
        const deposit_amount3 = BigNumber.from('75000000000')

        const withdraw_amount = ethers.utils.parseEther('800')
        const withdraw_amount2 = ethers.utils.parseEther('15')
        const withdraw_amount3 = BigNumber.from('30000000000')

        beforeEach(async () => {

            await token1.connect(depositor).approve(tester.address, ethers.constants.MaxUint256)
            await token2.connect(depositor).approve(tester2.address, ethers.constants.MaxUint256)
            await token3.connect(depositor).approve(tester3.address, ethers.constants.MaxUint256)

            await tester.connect(depositor).depositCollateral(deposit_amount)
            await tester2.connect(depositor).depositCollateral(deposit_amount2)
            await tester3.connect(depositor).depositCollateral(deposit_amount3)

            await advanceTime(WEEK.mul(4).toNumber())

        });

        it(' withdraw collateral - Tester 1', async () => {

            const previous_pod_balance = await token1.balanceOf(tester.address)
            const previous_user_balance = await token1.balanceOf(depositor.address)

            const previous_pod_aToken_balance = await aToken1.balanceOf(tester.address)

            const withdraw_tx = await tester.connect(depositor).withdrawCollateral(withdraw_amount, depositor.address)

            const tx_block = (await withdraw_tx).blockNumber

            const new_pod_balance = await token1.balanceOf(tester.address)
            const new_user_balance = await token1.balanceOf(depositor.address)

            const new_pod_aToken_balance = await aToken1.balanceOf(tester.address, { blockTag: tx_block })

            expect(new_pod_balance).to.be.eq(previous_pod_balance)
            expect(new_user_balance).to.be.eq(previous_user_balance.add(withdraw_amount))

            //expect(new_pod_aToken_balance).to.be.eq(previous_pod_aToken_balance.sub(withdraw_amount))

            await expect(withdraw_tx).to.emit(token1, "Transfer")
            .withArgs(aToken1.address, depositor.address, withdraw_amount);

            await expect(withdraw_tx).to.emit(tester, "CollateralWithdrawn")
            .withArgs(token1.address, withdraw_amount);

        });

        it(' withdraw collateral - Tester 2', async () => {

            const previous_pod_balance = await token2.balanceOf(tester2.address)
            const previous_user_balance = await token2.balanceOf(depositor.address)

            const previous_pod_aToken_balance = await aToken2.balanceOf(tester2.address)

            const withdraw_tx = await tester2.connect(depositor).withdrawCollateral(withdraw_amount2, depositor.address)

            const tx_block = (await withdraw_tx).blockNumber

            const new_pod_balance = await token2.balanceOf(tester2.address)
            const new_user_balance = await token2.balanceOf(depositor.address)

            const new_pod_aToken_balance = await aToken2.balanceOf(tester2.address, { blockTag: tx_block })

            expect(new_pod_balance).to.be.eq(previous_pod_balance)
            expect(new_user_balance).to.be.eq(previous_user_balance.add(withdraw_amount2))

            //expect(new_pod_aToken_balance).to.be.eq(previous_pod_aToken_balance.sub(withdraw_amount))

            await expect(withdraw_tx).to.emit(token2, "Transfer")
            .withArgs(aToken2.address, depositor.address, withdraw_amount2);

            await expect(withdraw_tx).to.emit(tester2, "CollateralWithdrawn")
            .withArgs(token2.address, withdraw_amount2);

        });

        it(' withdraw collateral - Tester 3', async () => {

            const previous_pod_balance = await token3.balanceOf(tester3.address)
            const previous_user_balance = await token3.balanceOf(depositor.address)

            const previous_pod_aToken_balance = await aToken3.balanceOf(tester3.address)

            const withdraw_tx = await tester3.connect(depositor).withdrawCollateral(withdraw_amount3, depositor.address)

            const tx_block = (await withdraw_tx).blockNumber

            const new_pod_balance = await token3.balanceOf(tester3.address)
            const new_user_balance = await token3.balanceOf(depositor.address)

            const new_pod_aToken_balance = await aToken3.balanceOf(tester3.address, { blockTag: tx_block })

            expect(new_pod_balance).to.be.eq(previous_pod_balance)
            expect(new_user_balance).to.be.eq(previous_user_balance.add(withdraw_amount3))

            //expect(new_pod_aToken_balance).to.be.eq(previous_pod_aToken_balance.sub(withdraw_amount))

            await expect(withdraw_tx).to.emit(token3, "Transfer")
            .withArgs(aToken3.address, depositor.address, withdraw_amount3);

            await expect(withdraw_tx).to.emit(tester3, "CollateralWithdrawn")
            .withArgs(token3.address, withdraw_amount3);

        
        });

        it(' withdraw all collateral - Tester 1', async () => {

            await tester.connect(depositor).withdrawCollateral(ethers.constants.MaxUint256, depositor.address)
            
            expect(await aToken1.balanceOf(tester.address)).to.be.eq(0)
            expect(await token1.balanceOf(tester.address)).to.be.eq(0)
        
        });

        it(' withdraw all collateral - Tester 2', async () => {

            await tester2.connect(depositor).withdrawCollateral(ethers.constants.MaxUint256, depositor.address)
            
            expect(await aToken2.balanceOf(tester2.address)).to.be.eq(0)
            expect(await token2.balanceOf(tester2.address)).to.be.eq(0)
        
        });

        it(' withdraw all collateral - Tester 3', async () => {

            await tester3.connect(depositor).withdrawCollateral(ethers.constants.MaxUint256, depositor.address)
            
            expect(await aToken3.balanceOf(tester3.address)).to.be.eq(0)
            expect(await token3.balanceOf(tester3.address)).to.be.eq(0)
        
        });

        it(' withdraw collateral using aToken balance - Tester 1', async () => {

            await tester.connect(depositor).withdrawCollateral(0, depositor.address)
            
            expect(await aToken1.balanceOf(tester.address)).to.be.eq(0)
            expect(await token1.balanceOf(tester.address)).to.be.eq(0)
        
        });

        it(' withdraw collateral using aToken balance - Tester 2', async () => {

            await tester2.connect(depositor).withdrawCollateral(0, depositor.address)
            
            expect(await aToken2.balanceOf(tester2.address)).to.be.eq(0)
            expect(await token2.balanceOf(tester2.address)).to.be.eq(0)
        
        });

        it(' withdraw collateral using aToken balance - Tester 3', async () => {

            await tester3.connect(depositor).withdrawCollateral(0, depositor.address)
            
            expect(await aToken3.balanceOf(tester3.address)).to.be.eq(0)
            expect(await token3.balanceOf(tester3.address)).to.be.eq(0)
        
        });

    });

    describe('mintGho', async () => {

        const deposit_amount = ethers.utils.parseEther('1500')
        const deposit_amount2 = ethers.utils.parseEther('50')
        const deposit_amount3 = BigNumber.from('75000000000')

        const mint_amount = ethers.utils.parseEther('400')
        const mint_amount2 = ethers.utils.parseEther('120')
        const mint_amount3 = ethers.utils.parseEther('300')

        beforeEach(async () => {

            await token1.connect(depositor).approve(tester.address, ethers.constants.MaxUint256)
            await token2.connect(depositor).approve(tester2.address, ethers.constants.MaxUint256)
            await token3.connect(depositor).approve(tester3.address, ethers.constants.MaxUint256)

            await tester.connect(depositor).depositCollateral(deposit_amount)
            await tester2.connect(depositor).depositCollateral(deposit_amount2)
            await tester3.connect(depositor).depositCollateral(deposit_amount3)

        });

        it(' borrow GHO - Tester 1', async () => {

            const previous_pod_balance = await gho.balanceOf(tester.address)
            const previous_user_balance = await gho.balanceOf(depositor.address)

            const previous_pod_debt = await debtGho.balanceOf(tester.address)

            const mint_tx = await tester.connect(depositor).mintGho(mint_amount, depositor.address)

            const tx_block = (await mint_tx).blockNumber

            const new_pod_balance = await gho.balanceOf(tester.address)
            const new_user_balance = await gho.balanceOf(depositor.address)

            const new_pod_debt = await debtGho.balanceOf(tester.address, { blockTag: tx_block })

            expect(new_pod_balance).to.be.eq(previous_pod_balance)
            expect(new_user_balance).to.be.eq(previous_user_balance.add(mint_amount))

            expect(new_pod_debt).to.be.eq(previous_pod_debt.add(mint_amount))

            await expect(mint_tx).to.emit(gho, "Transfer")
            .withArgs(ethers.constants.AddressZero, tester.address, mint_amount);

            await expect(mint_tx).to.emit(tester, "GhoMinted")
            .withArgs(mint_amount);

            await expect(mint_tx).to.emit(gho, "Transfer")
            .withArgs(tester.address, depositor.address, mint_amount);

        });

        it(' borrow GHO - Tester 2', async () => {

            const previous_pod_balance = await gho.balanceOf(tester2.address)
            const previous_user_balance = await gho.balanceOf(depositor.address)

            const previous_pod_debt = await debtGho.balanceOf(tester2.address)

            const mint_tx = await tester2.connect(depositor).mintGho(mint_amount2, depositor.address)

            const tx_block = (await mint_tx).blockNumber

            const new_pod_balance = await gho.balanceOf(tester2.address)
            const new_user_balance = await gho.balanceOf(depositor.address)

            const new_pod_debt = await debtGho.balanceOf(tester2.address, { blockTag: tx_block })

            expect(new_pod_balance).to.be.eq(previous_pod_balance)
            expect(new_user_balance).to.be.eq(previous_user_balance.add(mint_amount2))

            expect(new_pod_debt).to.be.eq(previous_pod_debt.add(mint_amount2))

            await expect(mint_tx).to.emit(gho, "Transfer")
            .withArgs(ethers.constants.AddressZero, tester2.address, mint_amount2);

            await expect(mint_tx).to.emit(tester2, "GhoMinted")
            .withArgs(mint_amount2);

            await expect(mint_tx).to.emit(gho, "Transfer")
            .withArgs(tester2.address, depositor.address, mint_amount2);

        });

        it(' borrow GHO - Tester 3', async () => {

            const previous_pod_balance = await gho.balanceOf(tester3.address)
            const previous_user_balance = await gho.balanceOf(depositor.address)

            const previous_pod_debt = await debtGho.balanceOf(tester3.address)

            const mint_tx = await tester3.connect(depositor).mintGho(mint_amount3, depositor.address)

            const tx_block = (await mint_tx).blockNumber

            const new_pod_balance = await gho.balanceOf(tester3.address)
            const new_user_balance = await gho.balanceOf(depositor.address)

            const new_pod_debt = await debtGho.balanceOf(tester3.address, { blockTag: tx_block })

            expect(new_pod_balance).to.be.eq(previous_pod_balance)
            expect(new_user_balance).to.be.eq(previous_user_balance.add(mint_amount3))

            expect(new_pod_debt).to.be.eq(previous_pod_debt.add(mint_amount3))

            await expect(mint_tx).to.emit(gho, "Transfer")
            .withArgs(ethers.constants.AddressZero, tester3.address, mint_amount3);

            await expect(mint_tx).to.emit(tester3, "GhoMinted")
            .withArgs(mint_amount3);

            await expect(mint_tx).to.emit(gho, "Transfer")
            .withArgs(tester3.address, depositor.address, mint_amount3);

        });

    });

    describe('repayGho', async () => {

        const deposit_amount = ethers.utils.parseEther('1500')
        const deposit_amount2 = ethers.utils.parseEther('50')
        const deposit_amount3 = BigNumber.from('75000000000')

        const mint_amount = ethers.utils.parseEther('400')
        const mint_amount2 = ethers.utils.parseEther('120')
        const mint_amount3 = ethers.utils.parseEther('300')

        const repay_amount = ethers.utils.parseEther('250')
        const repay_amount2 = ethers.utils.parseEther('50')
        const repay_amount3 = ethers.utils.parseEther('35')

        beforeEach(async () => {

            await token1.connect(depositor).approve(tester.address, ethers.constants.MaxUint256)
            await token2.connect(depositor).approve(tester2.address, ethers.constants.MaxUint256)
            await token3.connect(depositor).approve(tester3.address, ethers.constants.MaxUint256)

            await tester.connect(depositor).depositCollateral(deposit_amount)
            await tester2.connect(depositor).depositCollateral(deposit_amount2)
            await tester3.connect(depositor).depositCollateral(deposit_amount3)

            await tester.connect(depositor).mintGho(mint_amount, depositor.address)
            await tester2.connect(depositor).mintGho(mint_amount2, depositor.address)
            await tester3.connect(depositor).mintGho(mint_amount3, depositor.address)

            await advanceTime(WEEK.mul(4).toNumber())

            await gho.connect(depositor).approve(tester.address, ethers.constants.MaxUint256)
            await gho.connect(depositor).approve(tester2.address, ethers.constants.MaxUint256)
            await gho.connect(depositor).approve(tester3.address, ethers.constants.MaxUint256)

        });

        it(' repay GHO - Tester 1', async () => {

            await gho.connect(depositor).transfer(tester.address, ethers.utils.parseEther('1000'))

            const previous_pod_debt = await debtGho.balanceOf(tester.address)

            const repay_tx = await tester.connect(depositor).repayGho(repay_amount)

            const tx_block = (await repay_tx).blockNumber

            const new_pod_debt = await debtGho.balanceOf(tester.address, { blockTag: tx_block })

            //expect(new_pod_debt).to.be.eq(previous_pod_debt.sub(repay_amount))

            /*await expect(repay_tx).to.emit(gho, "Transfer")
            .withArgs(tester.address, aavePool.address, repay_amount);*/

            /*await expect(repay_tx).to.emit(debtGho, "Transfer")
            .withArgs(tester.address, ethers.constants.AddressZero, repay_amount);*/

            await expect(repay_tx).to.emit(tester, "GhoRepayed")
            .withArgs(repay_amount);

        });

        it(' repay GHO - Tester 2', async () => {

            await gho.connect(depositor).transfer(tester.address, ethers.utils.parseEther('1000'))

            const previous_pod_debt = await debtGho.balanceOf(tester2.address)

            const repay_tx = await tester2.connect(depositor).repayGho(ethers.utils.parseEther('1'))

            const tx_block = (await repay_tx).blockNumber

            const new_pod_debt = await debtGho.balanceOf(tester2.address, { blockTag: tx_block })

            //expect(new_pod_debt).to.be.eq(previous_pod_debt.sub(repay_amount2))

            /*await expect(repay_tx).to.emit(gho, "Transfer")
            .withArgs(tester2.address, aavePool.address, repay_amount2);*/

            /*await expect(repay_tx).to.emit(debtGho, "Transfer")
            .withArgs(tester2.address, ethers.constants.AddressZero, repay_amount2);*/

            await expect(repay_tx).to.emit(tester2, "GhoRepayed")
            .withArgs(repay_amount2);

        });

        it(' repay GHO - Tester 3', async () => {

            await gho.connect(depositor).transfer(tester.address, ethers.utils.parseEther('1000'))

            const previous_pod_debt = await debtGho.balanceOf(tester3.address)

            const repay_tx = await tester3.connect(depositor).repayGho(repay_amount3)

            const tx_block = (await repay_tx).blockNumber

            const new_pod_debt = await debtGho.balanceOf(tester3.address, { blockTag: tx_block })

            //expect(new_pod_debt).to.be.eq(previous_pod_debt.sub(repay_amount3))

            /*await expect(repay_tx).to.emit(gho, "Transfer")
            .withArgs(tester3.address, aavePool.address, repay_amount3);*/

            /*await expect(repay_tx).to.emit(debtGho, "Transfer")
            .withArgs(tester3.address, ethers.constants.AddressZero, repay_amount3);*/

            await expect(repay_tx).to.emit(tester3, "GhoRepayed")
            .withArgs(repay_amount3);

        });

        it(' repay all GHO debt - Tester 1', async () => {

            await gho.connect(depositor).transfer(tester.address, ethers.utils.parseEther('1000'))

            await tester.connect(depositor).repayGho(ethers.constants.MaxUint256)

            expect(await debtGho.balanceOf(tester.address)).to.be.eq(0)
        });

        it(' repay all GHO debt - Tester 2', async () => {

            await gho.connect(depositor).transfer(tester.address, ethers.utils.parseEther('1000'))

            await tester2.connect(depositor).repayGho(ethers.constants.MaxUint256)

            expect(await debtGho.balanceOf(tester2.address)).to.be.eq(0)
        });

        it(' repay all GHO debt - Tester 3', async () => {

            await gho.connect(depositor).transfer(tester.address, ethers.utils.parseEther('1000'))

            await tester3.connect(depositor).repayGho(ethers.constants.MaxUint256)

            expect(await debtGho.balanceOf(tester3.address)).to.be.eq(0)
        });

        it(' repay all GHO debt using balance - Tester 1', async () => {

            await gho.connect(depositor).transfer(tester.address, ethers.utils.parseEther('1000'))

            await tester.connect(depositor).repayGho(0)

            expect(await debtGho.balanceOf(tester.address)).to.be.eq(0)
        });

        it(' repay all GHO debt using balance - Tester 2', async () => {

            await gho.connect(depositor).transfer(tester.address, ethers.utils.parseEther('1000'))

            await tester2.connect(depositor).repayGho(0)

            expect(await debtGho.balanceOf(tester2.address)).to.be.eq(0)
        });

        it(' repay all GHO debt using balance - Tester 3', async () => {

            await gho.connect(depositor).transfer(tester.address, ethers.utils.parseEther('1000'))

            await tester3.connect(depositor).repayGho(0)

            expect(await debtGho.balanceOf(tester3.address)).to.be.eq(0)
        });

    });

    describe('diff time', async () => {

        const deposit_amount = ethers.utils.parseEther('1500')

        const mint_amount = ethers.utils.parseEther('400')

        const repay_amount = ethers.utils.parseEther('250')

        beforeEach(async () => {

            await token1.connect(depositor).approve(tester.address, ethers.constants.MaxUint256)

            await tester.connect(depositor).depositCollateral(deposit_amount)

            await gho.connect(depositor).approve(tester.address, ethers.constants.MaxUint256)

            await gho.connect(depositor).transfer(tester.address, ethers.utils.parseEther('5000'))

        });

        it(' 1 week', async () => {

            await tester.connect(depositor).mintGho(mint_amount, depositor.address)

            await advanceTime(WEEK.mul(1).toNumber())

            await tester.connect(depositor).repayGho(ethers.constants.MaxUint256)

        });

        it(' 2 week', async () => {

            await tester.connect(depositor).mintGho(mint_amount, depositor.address)

            await advanceTime(WEEK.mul(2).toNumber())

            await tester.connect(depositor).repayGho(ethers.constants.MaxUint256)

        });

        it(' 3 week', async () => {

            await tester.connect(depositor).mintGho(mint_amount, depositor.address)

            await advanceTime(WEEK.mul(3).toNumber())

            await tester.connect(depositor).repayGho(ethers.constants.MaxUint256)

        });

        it(' 4 week', async () => {

            await tester.connect(depositor).mintGho(mint_amount, depositor.address)

            await advanceTime(WEEK.mul(4).toNumber())

            await tester.connect(depositor).repayGho(ethers.constants.MaxUint256)

        });

        it(' 5 week', async () => {

            await tester.connect(depositor).mintGho(mint_amount, depositor.address)

            await advanceTime(WEEK.mul(5).toNumber())

            await tester.connect(depositor).repayGho(ethers.constants.MaxUint256)

        });

        it(' 6 week', async () => {

            await tester.connect(depositor).mintGho(mint_amount, depositor.address)

            await advanceTime(WEEK.mul(6).toNumber())

            await tester.connect(depositor).repayGho(ethers.constants.MaxUint256)

        });

        it(' 7 week', async () => {

            await tester.connect(depositor).mintGho(mint_amount, depositor.address)

            await advanceTime(WEEK.mul(7).toNumber())

            await tester.connect(depositor).repayGho(ethers.constants.MaxUint256)

        });

    });

});