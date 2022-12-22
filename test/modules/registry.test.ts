const hre = require("hardhat");
import { ethers } from "hardhat";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { DullahanRegistry } from "../../typechain/modules/DullahanRegistry";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ContractFactory } from "@ethersproject/contracts";

import {
    resetFork
} from "../utils/utils";

chai.use(solidity);
const { expect } = chai;
const { provider } = ethers;

let registryFactory: ContractFactory

describe('DullahanRegistry contract tests', () => {
    let admin: SignerWithAddress

    let aave: SignerWithAddress
    let stkAave: SignerWithAddress
    let gho: SignerWithAddress
    let ghoDebt: SignerWithAddress
    let aavePool: SignerWithAddress
    let aaveRewardController: SignerWithAddress

    let podManager1: SignerWithAddress
    let podManager2: SignerWithAddress

    let vault: SignerWithAddress

    let registry: DullahanRegistry

    before(async () => {
        await resetFork();

        [admin, aave, stkAave, gho, ghoDebt, aavePool, aaveRewardController, podManager1, podManager2, vault] = await ethers.getSigners();

        registryFactory = await ethers.getContractFactory("DullahanRegistry");

    })

    beforeEach(async () => {

        registry = (await registryFactory.connect(admin).deploy(
            aave.address,
            stkAave.address,
            gho.address,
            ghoDebt.address,
            aavePool.address,
            aaveRewardController.address
        )) as DullahanRegistry;
        await registry.deployed();

    });

    it(' should be deployed & have correct parameters', async () => {
        expect(registry.address).to.properAddress

        expect(await registry.owner()).to.be.eq(admin.address)

        expect(await registry.AAVE()).to.be.eq(aave.address)
        expect(await registry.STK_AAVE()).to.be.eq(stkAave.address)
        expect(await registry.GHO()).to.be.eq(gho.address)
        expect(await registry.DEBT_GHO()).to.be.eq(ghoDebt.address)
        expect(await registry.AAVE_POOL_V3()).to.be.eq(aavePool.address)
        expect(await registry.AAVE_REWARD_COONTROLLER()).to.be.eq(aaveRewardController.address)

        expect(await registry.dullahanVault()).to.be.eq(ethers.constants.AddressZero)

        expect(await registry.getPodManagers()).to.be.empty

    });

    it(' should fail to deploy if given address 0x0', async () => {
        
        await expect(
            registryFactory.connect(admin).deploy(
                ethers.constants.AddressZero,
                stkAave.address,
                gho.address,
                ghoDebt.address,
                aavePool.address,
                aaveRewardController.address
            )
        ).to.be.reverted
        
        await expect(
            registryFactory.connect(admin).deploy(
                aave.address,
                ethers.constants.AddressZero,
                gho.address,
                ghoDebt.address,
                aavePool.address,
                aaveRewardController.address
            )
        ).to.be.reverted
        
        await expect(
            registryFactory.connect(admin).deploy(
                aave.address,
                stkAave.address,
                ethers.constants.AddressZero,
                ghoDebt.address,
                aavePool.address,
                aaveRewardController.address
            )
        ).to.be.reverted
        
        await expect(
            registryFactory.connect(admin).deploy(
                aave.address,
                stkAave.address,
                gho.address,
                ethers.constants.AddressZero,
                aavePool.address,
                aaveRewardController.address
            )
        ).to.be.reverted
        
        await expect(
            registryFactory.connect(admin).deploy(
                aave.address,
                stkAave.address,
                gho.address,
                ghoDebt.address,
                ethers.constants.AddressZero,
                aaveRewardController.address
            )
        ).to.be.reverted
        
        await expect(
            registryFactory.connect(admin).deploy(
                aave.address,
                stkAave.address,
                gho.address,
                ghoDebt.address,
                aavePool.address,
                ethers.constants.AddressZero
            )
        ).to.be.reverted

    });

    describe('setVault', async () => {

        it(' should set the correct vault (& emit correct Event)', async () => {

            expect(await registry.dullahanVault()).to.be.eq(ethers.constants.AddressZero)

            const set_tx = await registry.connect(admin).setVault(vault.address)

            expect(await registry.dullahanVault()).to.be.eq(vault.address)

            await expect(set_tx).to.emit(registry, "SetVault")
                .withArgs(vault.address);

        });

        it(' should fail if already listed', async () => {

            await registry.connect(admin).setVault(vault.address)

            await expect(
                registry.connect(admin).setVault(vault.address)
            ).to.be.revertedWith('VaultAlreadySet')

        });

        it(' should fail if given address 0x0', async () => {

            await expect(
                registry.connect(admin).setVault(ethers.constants.AddressZero)
            ).to.be.revertedWith('AddressZero')

        });

        it(' should only be callable by admin', async () => {

            await expect(
                registry.connect(podManager1).setVault(vault.address)
            ).to.be.revertedWith('Ownable: caller is not the owner')

        });

    });

    describe('addPodManager', async () => {

        it(' should add the pod manager to the list (& emit correct Event)', async () => {

            expect(await registry.getPodManagers()).not.to.be.contain(podManager1.address)

            const add_tx = await registry.connect(admin).addPodManager(podManager1.address)

            const new_list = await registry.getPodManagers()

            expect(new_list).to.be.contain(podManager1.address)
            expect(new_list[new_list.length - 1]).to.be.eq(podManager1.address)

            await expect(add_tx).to.emit(registry, "AddPodManager")
                .withArgs(podManager1.address);

        });

        it(' should allow to list multiple maangers', async () => {

            expect(await registry.getPodManagers()).not.to.be.contain(podManager1.address)
            expect(await registry.getPodManagers()).not.to.be.contain(podManager2.address)

            await registry.connect(admin).addPodManager(podManager1.address)

            expect(await registry.getPodManagers()).to.be.contain(podManager1.address)
            expect(await registry.getPodManagers()).not.to.be.contain(podManager2.address)

            const add_tx = await registry.connect(admin).addPodManager(podManager2.address)

            const new_list = await registry.getPodManagers()

            expect(new_list).to.be.contain(podManager1.address)
            expect(new_list).to.be.contain(podManager2.address)
            expect(new_list[new_list.length - 1]).to.be.eq(podManager2.address)
            expect(new_list[new_list.length - 2]).to.be.eq(podManager1.address)

            await expect(add_tx).to.emit(registry, "AddPodManager")
                .withArgs(podManager2.address);

        });

        it(' should fail if already listed', async () => {

            await registry.connect(admin).addPodManager(podManager1.address)
            await registry.connect(admin).addPodManager(podManager2.address)

            await expect(
                registry.connect(admin).addPodManager(podManager1.address)
            ).to.be.revertedWith('AlreadyListedManager')

            await expect(
                registry.connect(admin).addPodManager(podManager2.address)
            ).to.be.revertedWith('AlreadyListedManager')

        });

        it(' should fail if given address 0x0', async () => {

            await expect(
                registry.connect(admin).addPodManager(ethers.constants.AddressZero)
            ).to.be.revertedWith('AddressZero')

        });

        it(' should only be callable by admin', async () => {

            await expect(
                registry.connect(podManager1).addPodManager(podManager1.address)
            ).to.be.revertedWith('Ownable: caller is not the owner')

        });

    });

});