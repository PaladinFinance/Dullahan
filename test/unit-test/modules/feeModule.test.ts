const hre = require("hardhat");
import { ethers } from "hardhat";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { BigNumber } from "ethers";
import { DullahanFeeModule } from "../../../typechain/modules/DullahanFeeModule";
import { MockVault } from "../../../typechain/test/MockVault";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ContractFactory } from "@ethersproject/contracts";

import {
    resetFork
} from "../../utils/utils";

chai.use(solidity);
const { expect } = chai;
const { provider } = ethers;

let moduleFactory: ContractFactory
let vaultfactory: ContractFactory

const UNIT = ethers.utils.parseEther('1')
const MAX_BPS = BigNumber.from('10000')

const start_fee = BigNumber.from('270000000')

describe('DullahanFeeModule contract tests', () => {
    let admin: SignerWithAddress
    let otherUser: SignerWithAddress

    let module: DullahanFeeModule

    let vault: MockVault

    before(async () => {
        await resetFork();

        [admin, otherUser] = await ethers.getSigners();

        moduleFactory = await ethers.getContractFactory("DullahanFeeModule");
        vaultfactory = await ethers.getContractFactory("MockVault");

    })

    beforeEach(async () => {

        vault = (await vaultfactory.connect(admin).deploy()) as MockVault;
        await vault.deployed();

        module = (await moduleFactory.connect(admin).deploy(
            vault.address,
            start_fee
        )) as DullahanFeeModule;
        await module.deployed();

    });

    it(' should be deployed & have correct parameters', async () => {
        expect(module.address).to.properAddress

        expect(await module.owner()).to.be.eq(admin.address)

        expect(await module.vault()).to.be.eq(vault.address)
        expect(await module.feePerStkAavePerSecond()).to.be.eq(start_fee)

    });

    describe('utilizationRate', async () => {

        let total_assets = BigNumber.from('0')

        const steps = ethers.utils.parseEther('1000')

        const loops = 100

        it(' should return the correct utiliation rate', async () => {

            for(let i = 0; i < loops; i++) {

                let total_rented = BigNumber.from('0')

                while(total_rented.lte(total_assets)) {

                    await vault.connect(admin).setTotalAssets(total_assets);
                    await vault.connect(admin).setTotalRentedAmount(total_rented);

                    let expeted_util_rate = BigNumber.from(0)
                    if(total_assets.gt(0)) expeted_util_rate = total_rented.mul(UNIT).div(total_assets);

                    expect(
                        await module.utilizationRate()
                    ).to.be.eq(expeted_util_rate)

                    total_rented = total_rented.add(steps);
                }
                total_assets = total_assets.add(steps);
            }
        });

    });

    describe('getCurrentFeePerSecond', async () => {

        let total_assets = BigNumber.from('0')

        const steps = ethers.utils.parseEther('1000')

        const loops = 100

        it(' should return the correct fee per second', async () => {

            const threshold = ethers.utils.parseEther('0.75')
            const base_mult = ethers.utils.parseEther('1')
            const extra_mult_step = ethers.utils.parseEther('4')

            const base_fee = start_fee

            for(let i = 0; i < loops; i++) {

                let total_rented = BigNumber.from('0')

                while(total_rented.lte(total_assets)) {

                    await vault.connect(admin).setTotalAssets(total_assets);
                    await vault.connect(admin).setTotalRentedAmount(total_rented);

                    const util_rate = await module.utilizationRate()

                    let expected_fee_per_sec = base_fee
                    if(util_rate.gte(threshold)) {
                        expected_fee_per_sec = expected_fee_per_sec.mul(
                            base_mult.add(extra_mult_step.mul(util_rate.sub(threshold)).div(UNIT))
                        ).div(UNIT)
                    }

                    expect(
                        await module.getCurrentFeePerSecond()
                    ).to.be.eq(expected_fee_per_sec)

                    total_rented = total_rented.add(steps);
                }
                total_assets = total_assets.add(steps);
            }
        });

    });

    describe('updateFeePerStkAavePerSecond', async () => {

        const new_fee = ethers.utils.parseEther('0.0000000875')

        it(' should update the parameter correctly (& emit correct Event)', async () => {

            expect(await module.feePerStkAavePerSecond()).to.be.eq(start_fee)

            const update_tx = await module.connect(admin).updateFeePerStkAavePerSecond(new_fee)

            expect(await module.feePerStkAavePerSecond()).to.be.eq(new_fee)

            await expect(update_tx).to.emit(module, "UpdatedFeePerStkAavePerSecond")
                .withArgs(start_fee, new_fee);

        });

        it(' should fail if given a null amount', async () => {

            await expect(
                module.connect(admin).updateFeePerStkAavePerSecond(0)
            ).to.be.revertedWith('NullAmount')

        });

        it(' should only be callable by admin', async () => {

            await expect(
                module.connect(otherUser).updateFeePerStkAavePerSecond(new_fee)
            ).to.be.revertedWith('Ownable: caller is not the owner')

        });

    });

});