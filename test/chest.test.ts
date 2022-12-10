const hre = require("hardhat");
import { ethers } from "hardhat";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { DullahanTreasureChest } from "../typechain/DullahanTreasureChest";
import { IERC20 } from "../typechain/oz/interfaces/IERC20";
import { IERC20__factory } from "../typechain/factories/oz/interfaces/IERC20__factory";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ContractFactory } from "@ethersproject/contracts";

import {
    getERC20,
    resetFork
} from "./utils/utils";

import { 
    REWARD_TOKEN_1,
    HOLDER_REWARD_1,
    AMOUNT_REWARD_1,
    REWARD_TOKEN_2,
    HOLDER_REWARD_2,
    AMOUNT_REWARD_2
} from "./utils/constants"


chai.use(solidity);
const { expect } = chai;
const { provider } = ethers;

let chestFactory: ContractFactory

describe('DullahanTreasureChest contract tests', () => {
    let admin: SignerWithAddress
    let manager1: SignerWithAddress
    let manager2: SignerWithAddress

    let chest: DullahanTreasureChest

    let token1: IERC20
    let token2: IERC20

    before(async () => {
        await resetFork();

        [admin, manager1, manager2] = await ethers.getSigners();

        chestFactory = await ethers.getContractFactory("DullahanTreasureChest");

        token1 = IERC20__factory.connect(REWARD_TOKEN_1, provider);
        token2 = IERC20__factory.connect(REWARD_TOKEN_2, provider);

        await getERC20(admin, HOLDER_REWARD_1, token1, admin.address, AMOUNT_REWARD_1);

        await getERC20(admin, HOLDER_REWARD_2, token2, admin.address, AMOUNT_REWARD_2);

    })

    beforeEach(async () => {

        chest = (await chestFactory.connect(admin).deploy()) as DullahanTreasureChest;
        await chest.deployed();

    });


    it(' should be deployed & have correct parameters', async () => {
        expect(chest.address).to.properAddress

        expect(await chest.owner()).to.be.eq(admin.address)

    });


    describe('currentBalance', async () => {

        const token2_transfer1 = ethers.utils.parseEther("2500")
        const token2_transfer2 = ethers.utils.parseEther("1700")

        const token1_transfer = ethers.utils.parseEther("550")

        it(' should return the correct balances', async () => {

            expect(await token1.balanceOf(chest.address)).to.be.eq(0)
            expect(await token2.balanceOf(chest.address)).to.be.eq(0)

            expect(await chest.currentBalance(token1.address)).to.be.eq(0)
            expect(await chest.currentBalance(token2.address)).to.be.eq(0)

            await token2.connect(admin).transfer(chest.address, token2_transfer1)

            expect(await chest.currentBalance(token1.address)).to.be.eq(0)
            expect(await chest.currentBalance(token2.address)).to.be.eq(token2_transfer1)

            await token1.connect(admin).transfer(chest.address, token1_transfer)

            expect(await chest.currentBalance(token1.address)).to.be.eq(token1_transfer)
            expect(await chest.currentBalance(token2.address)).to.be.eq(token2_transfer1)

            await token2.connect(admin).transfer(chest.address, token2_transfer2)

            expect(await chest.currentBalance(token1.address)).to.be.eq(token1_transfer)
            expect(await chest.currentBalance(token2.address)).to.be.eq(token2_transfer1.add(token2_transfer2))

        });

    });


    describe('increaseAllowanceERC20', async () => {

        const approve_amount = ethers.utils.parseEther("5000")
        const other_increase_amount = ethers.utils.parseEther("2500")

        beforeEach(async () => {

            await chest.connect(admin).approveManager(manager1.address)

        });

        it(' should increase the allowance correctly', async () => {

            expect(await token1.allowance(chest.address, manager1.address)).to.be.eq(0)

            await chest.connect(manager1).increaseAllowanceERC20(token1.address, manager1.address, approve_amount)

            expect(await token1.allowance(chest.address, manager1.address)).to.be.eq(approve_amount)

        });

        it(' should increase the allowance again correctly', async () => {

            await chest.connect(manager1).increaseAllowanceERC20(token1.address, manager1.address, approve_amount)

            expect(await token1.allowance(chest.address, manager1.address)).to.be.eq(approve_amount)

            await chest.connect(manager1).increaseAllowanceERC20(token1.address, manager1.address, other_increase_amount)

            expect(await token1.allowance(chest.address, manager1.address)).to.be.eq(approve_amount.add(other_increase_amount))

        });

        it(' should fail if given a null amount', async () => {

            await expect(
                chest.connect(admin).increaseAllowanceERC20(token1.address, admin.address, 0)
            ).to.be.revertedWith('NullAmount')

        });

        it(' should fail if token address is address Zero', async () => {

            await expect(
                chest.connect(admin).increaseAllowanceERC20(ethers.constants.AddressZero, admin.address, approve_amount)
            ).to.be.reverted

        });

        it(' should only be allowed for admin & managers', async () => {

            await expect(
                chest.connect(manager2).increaseAllowanceERC20(token2.address, manager2.address, approve_amount)
            ).to.be.revertedWith('CallerNotAllowed')

        });

    });


    describe('decreaseAllowanceERC20', async () => {

        const approve_amount = ethers.utils.parseEther("5000")
        const decrease_amount = ethers.utils.parseEther("1000")

        beforeEach(async () => {

            await chest.connect(admin).approveManager(manager1.address)

            await chest.connect(manager1).increaseAllowanceERC20(token1.address, manager1.address, approve_amount)

        });

        it(' should decrease the allowance correctly', async () => {

            expect(await token1.allowance(chest.address, manager1.address)).to.be.eq(approve_amount)

            await chest.connect(manager1).decreaseAllowanceERC20(token1.address, manager1.address, decrease_amount)

            expect(await token1.allowance(chest.address, manager1.address)).to.be.eq(approve_amount.sub(decrease_amount))

        });

        it(' should approve back to 0', async () => {

            expect(await token1.allowance(chest.address, manager1.address)).to.be.eq(approve_amount)

            await chest.connect(manager1).decreaseAllowanceERC20(token1.address, manager1.address, approve_amount)

            expect(await token1.allowance(chest.address, manager1.address)).to.be.eq(0)

        });

        it(' should fail if given a null amount', async () => {

            await expect(
                chest.connect(admin).decreaseAllowanceERC20(token1.address, admin.address, 0)
            ).to.be.revertedWith('NullAmount')

        });

        it(' should fail if token address is address Zero', async () => {

            await expect(
                chest.connect(admin).decreaseAllowanceERC20(ethers.constants.AddressZero, admin.address, approve_amount)
            ).to.be.reverted

        });

        it(' should only be allowed for admin & managers', async () => {

            await expect(
                chest.connect(manager2).decreaseAllowanceERC20(token2.address, manager2.address, approve_amount)
            ).to.be.revertedWith('CallerNotAllowed')

        });

    });


    describe('transferERC20', async () => {

        const token2_transfer = ethers.utils.parseEther("2500")

        const token1_transfer = ethers.utils.parseEther("550")

        const withdraw_amount1 = ethers.utils.parseEther("300")
        const withdraw_amount2 = ethers.utils.parseEther("750")

        const withdraw_bigger_amount = ethers.utils.parseEther("1000")

        beforeEach(async () => {

            await chest.connect(admin).approveManager(manager1.address)

            await token2.connect(admin).transfer(chest.address, token2_transfer)

            await token1.connect(admin).transfer(chest.address, token1_transfer)

        });

        it(' should transfer the tokens', async () => {

            const manager_old_balance = await token1.balanceOf(manager1.address)
            const admin_old_balance = await token2.balanceOf(admin.address)

            const chest_old_balance1 = await chest.currentBalance(token1.address)
            const chest_old_balance2 = await chest.currentBalance(token2.address)

            await chest.connect(manager1).transferERC20(token1.address, manager1.address, withdraw_amount1)

            const manager_new_balance = await token1.balanceOf(manager1.address)
            const chest_new_balance1 = await chest.currentBalance(token1.address)

            expect(manager_new_balance).to.be.eq(manager_old_balance.add(withdraw_amount1))
            expect(chest_new_balance1).to.be.eq(chest_old_balance1.sub(withdraw_amount1))
            expect(await token2.balanceOf(admin.address)).to.be.eq(admin_old_balance)
            expect(await chest.currentBalance(token2.address)).to.be.eq(chest_old_balance2)

            await chest.connect(admin).transferERC20(token2.address, admin.address, withdraw_amount2)

            const admin_new_balance = await token2.balanceOf(admin.address)
            const chest_new_balance2 = await chest.currentBalance(token2.address)

            expect(admin_new_balance).to.be.eq(admin_old_balance.add(withdraw_amount2))
            expect(chest_new_balance2).to.be.eq(chest_old_balance2.sub(withdraw_amount2))
            expect(await token1.balanceOf(manager1.address)).to.be.eq(manager_new_balance)
            expect(await chest.currentBalance(token1.address)).to.be.eq(chest_new_balance1)

        });

        it(' should not allow to transfer more than available balance', async () => {

            await expect(
                chest.connect(manager1).transferERC20(token1.address, manager1.address, withdraw_bigger_amount)
            ).to.be.reverted

        });

        it(' should fail if token address is address Zero', async () => {

            await expect(
                chest.connect(admin).transferERC20(ethers.constants.AddressZero, admin.address, token2_transfer)
            ).to.be.reverted

        });

        it(' should only be allowed for admin & managers', async () => {

            await expect(
                chest.connect(manager2).transferERC20(token2.address, manager2.address, token2_transfer)
            ).to.be.revertedWith('CallerNotAllowed')

        });

    });


    describe('approveManager', async () => {

        const token2_transfer = ethers.utils.parseEther("2500")

        const withdraw_amount = ethers.utils.parseEther("500")

        beforeEach(async () => {

            await token2.connect(admin).transfer(chest.address, token2_transfer)

        });

        it(' should allow the added address as manager', async () => {

            await expect(
                chest.connect(manager1).transferERC20(token2.address, manager1.address, withdraw_amount)
            ).to.be.revertedWith('CallerNotAllowed')

            await chest.connect(admin).approveManager(manager1.address)

            await expect(
                chest.connect(manager1).transferERC20(token2.address, manager1.address, withdraw_amount)
            ).to.not.be.reverted

        });

        it(' should only be allowed for admin', async () => {

            await expect(
                chest.connect(manager1).approveManager(manager1.address)
            ).to.be.revertedWith('Ownable: caller is not the owner')

            await expect(
                chest.connect(manager2).approveManager(manager2.address)
            ).to.be.revertedWith('Ownable: caller is not the owner')

        });

    });


    describe('removeManager', async () => {

        const token2_transfer = ethers.utils.parseEther("2500")

        const withdraw_amount = ethers.utils.parseEther("500")

        beforeEach(async () => {

            await chest.connect(admin).approveManager(manager1.address)
            await chest.connect(admin).approveManager(manager2.address)

            await token2.connect(admin).transfer(chest.address, token2_transfer)

        });

        it(' should remove the address as manager', async () => {

            await expect(
                chest.connect(manager1).transferERC20(token2.address, manager1.address, withdraw_amount)
            ).to.not.be.reverted

            await chest.connect(admin).removeManager(manager1.address)

            await expect(
                chest.connect(manager1).transferERC20(token2.address, manager1.address, withdraw_amount)
            ).to.be.revertedWith('CallerNotAllowed')

        });

        it(' should not remove other managers', async () => {

            await chest.connect(admin).removeManager(manager1.address)

            await expect(
                chest.connect(manager2).transferERC20(token2.address, manager2.address, withdraw_amount)
            ).to.not.be.reverted

        });

        it(' should only be allowed for admin', async () => {

            await expect(
                chest.connect(manager1).removeManager(manager1.address)
            ).to.be.revertedWith('Ownable: caller is not the owner')

            await expect(
                chest.connect(manager2).removeManager(manager1.address)
            ).to.be.revertedWith('Ownable: caller is not the owner')

        });

    });

});