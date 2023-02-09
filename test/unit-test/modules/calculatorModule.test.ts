const hre = require("hardhat");
import { ethers } from "hardhat";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { BigNumber } from "ethers";
import { DullahanDiscountCalculator } from "../../../typechain/modules/DullahanDiscountCalculator";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ContractFactory } from "@ethersproject/contracts";

import {
    resetFork
} from "../../utils/utils";

chai.use(solidity);
const { expect } = chai;
const { provider } = ethers;

let moduleFactory: ContractFactory

const UNIT = ethers.utils.parseEther('1')

describe('DullahanDiscountCalculator contract tests', () => {
    let admin: SignerWithAddress
    let otherUser: SignerWithAddress

    let module: DullahanDiscountCalculator

    before(async () => {
        await resetFork();

        [admin, otherUser] = await ethers.getSigners();

        moduleFactory = await ethers.getContractFactory("DullahanDiscountCalculator");

    })

    beforeEach(async () => {

        module = (await moduleFactory.connect(admin).deploy()) as DullahanDiscountCalculator;
        await module.deployed();

    });

    it(' should be deployed & have correct parameters', async () => {
        expect(module.address).to.properAddress

        expect(await module.GHO_DISCOUNTED_PER_DISCOUNT_TOKEN()).to.be.eq(ethers.utils.parseEther('100'))
        expect(await module.MIN_DISCOUNT_TOKEN_BALANCE()).to.be.eq(ethers.utils.parseEther('1'))
        expect(await module.MIN_DEBT_TOKEN_BALANCE()).to.be.eq(ethers.utils.parseEther('1'))

    });

    describe('calculateAmountForMaxDiscount', async () => {

        const steps = ethers.utils.parseEther('50')
        const loops = 200

        it(' should return the correct needed amount', async () => {

            const gho_per_stkAave = ethers.utils.parseEther('100')

            for(let i = 0; i < loops; i++) {

                let total_debt_amount = steps.mul(i)

                let expected_amount = total_debt_amount.mul(UNIT).add(gho_per_stkAave.div(2)).div(gho_per_stkAave)
                if(expected_amount.lt(ethers.utils.parseEther('1'))) expected_amount = BigNumber.from(0)

                expect(await module.calculateAmountForMaxDiscount(total_debt_amount)).to.be.eq(expected_amount)
            }
        });

        it(' should return 0 if under the minimum thresholds', async () => {

            // MIN_DEBT_TOKEN_BALANCE threshold
            expect(await module.calculateAmountForMaxDiscount(0)).to.be.eq(0)

            // MIN_DISCOUNT_TOKEN_BALANCE threshold
            expect(await module.calculateAmountForMaxDiscount(ethers.utils.parseEther('1.5'))).to.be.eq(0)
            expect(await module.calculateAmountForMaxDiscount(ethers.utils.parseEther('75'))).to.be.eq(0)

        });

    });

});