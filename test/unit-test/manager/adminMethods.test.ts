const hre = require("hardhat");
import { ethers } from "hardhat";
import chai from "chai";
import { BigNumber } from "ethers";
import { solidity } from "ethereum-waffle";
import { DullahanPodManager } from "../../../typechain/DullahanPodManager";
import { MockERC20 } from "../../../typechain/test/MockERC20";
import { MockPod } from "../../../typechain/test/MockPod";
import { MockMarket } from "../../../typechain/test/MockMarket";
import { MockRewards } from "../../../typechain/test/MockRewards";
import { MockOracle } from "../../../typechain/test/MockOracle";
import { MockFeeModule } from "../../../typechain/test/MockFeeModule";
import { MockCalculator } from "../../../typechain/test/MockCalculator";
import { MockVault2 } from "../../../typechain/test/MockVault2";
import { MockStakingRewards } from "../../../typechain/test/MockStakingRewards";
import { DullahanRegistry } from "../../../typechain/modules/DullahanRegistry";
import { MockPod__factory } from "../../../typechain/factories/test/MockPod__factory";
import { IERC20 } from "../../../typechain/oz/interfaces/IERC20";
import { IERC20__factory } from "../../../typechain/factories/oz/interfaces/IERC20__factory";
import { IStakedAave } from "../../../typechain/interfaces/IStakedAave";
import { IStakedAave__factory } from "../../../typechain/factories/interfaces/IStakedAave__factory";
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
    REWARD_TOKEN_2,
} from "../../utils/constants"

chai.use(solidity);
const { expect } = chai;
const { provider } = ethers;

let managerFactory: ContractFactory
let podFactory: ContractFactory
let registryFactory: ContractFactory
let tokenFactory: ContractFactory
let rewardsFactory: ContractFactory
let marketFactory: ContractFactory
let vaultFactory: ContractFactory
let oracleFactory: ContractFactory
let calculatorModuleFactory: ContractFactory
let feeModuleFactory: ContractFactory
let stakingFactory: ContractFactory

const UNIT = ethers.utils.parseEther('1')
const MAX_BPS = BigNumber.from('10000')
const MAX_UINT256 = ethers.constants.MaxUint256
const WEEK = BigNumber.from(7 * 86400);

describe('DullahanPodManager contract tests - Admin functions', () => {
    let admin: SignerWithAddress

    let manager: DullahanPodManager

    let podImpl: MockPod
    let pod: MockPod

    let vault: MockVault2
    let staking: MockStakingRewards

    let collat: MockERC20
    let aCollat: MockERC20
    let collat2: MockERC20
    let aCollat2: MockERC20

    let gho: MockERC20
    let ghoDebt: MockERC20

    let oracle: MockOracle
    let feeModule: MockFeeModule
    let calculatorModule: MockCalculator

    let feeChest: SignerWithAddress

    let market: MockMarket
    let rewardsController: MockRewards

    let aave: IERC20
    let stkAave: IERC20
    let stkAave_staking: IStakedAave

    let registry: DullahanRegistry

    let delegate: SignerWithAddress
    let delegate2: SignerWithAddress
    let podOwner: SignerWithAddress
    let otherUser: SignerWithAddress

    let newRegistry: SignerWithAddress
    let newFeeModule: SignerWithAddress
    let newOracle: SignerWithAddress
    let newCalculator: SignerWithAddress

    before(async () => {
        await resetFork();

        [admin, feeChest, delegate, delegate2, podOwner, otherUser, newRegistry, newFeeModule, newOracle, newCalculator] = await ethers.getSigners();

        managerFactory = await ethers.getContractFactory("DullahanPodManager");
        podFactory = await ethers.getContractFactory("MockPod");
        tokenFactory = await ethers.getContractFactory("MockERC20");
        marketFactory = await ethers.getContractFactory("MockMarket");
        rewardsFactory = await ethers.getContractFactory("MockRewards");
        vaultFactory = await ethers.getContractFactory("MockVault2");
        registryFactory = await ethers.getContractFactory("DullahanRegistry");
        oracleFactory = await ethers.getContractFactory("MockOracle");
        feeModuleFactory = await ethers.getContractFactory("MockFeeModule");
        stakingFactory = await ethers.getContractFactory("MockStakingRewards");
        calculatorModuleFactory = await ethers.getContractFactory("MockCalculator");

        aave = IERC20__factory.connect(AAVE, provider);
        stkAave = IERC20__factory.connect(STK_AAVE, provider);
        stkAave_staking = IStakedAave__factory.connect(STK_AAVE, provider);

        await getERC20(admin, HOLDER_AAVE, aave, admin.address, AMOUNT_AAVE);

        await aave.connect(admin).approve(stkAave_staking.address, AMOUNT_AAVE);
        await stkAave_staking.connect(admin).stake(admin.address, AMOUNT_AAVE);

    });

    beforeEach(async () => {

        collat = (await tokenFactory.connect(admin).deploy("Collateral","COL")) as MockERC20;
        await collat.deployed();
        collat2 = (await tokenFactory.connect(admin).deploy("Collateral 2","COL2")) as MockERC20;
        await collat2.deployed();
        aCollat = (await tokenFactory.connect(admin).deploy("aToken Collateral","aCOL")) as MockERC20;
        await aCollat.deployed();
        aCollat2 = (await tokenFactory.connect(admin).deploy("aToken Collateral 2","aCOL2")) as MockERC20;
        await aCollat2.deployed();
        
        gho = (await tokenFactory.connect(admin).deploy("Mock GHO","GHO")) as MockERC20;
        await gho.deployed();
        ghoDebt = (await tokenFactory.connect(admin).deploy("Debt GHO","dGHO")) as MockERC20;
        await ghoDebt.deployed();

        oracle = (await oracleFactory.connect(admin).deploy()) as MockOracle;
        await oracle.deployed();
        feeModule = (await feeModuleFactory.connect(admin).deploy()) as MockFeeModule;
        await feeModule.deployed();
        calculatorModule = (await calculatorModuleFactory.connect(admin).deploy()) as MockCalculator;
        await calculatorModule.deployed();

        market = (await marketFactory.connect(admin).deploy(
            gho.address,
            ghoDebt.address
        )) as MockMarket;
        await market.deployed();

        rewardsController = (await rewardsFactory.connect(admin).deploy(
            REWARD_TOKEN_1,
            REWARD_TOKEN_2
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

        staking = (await stakingFactory.connect(admin).deploy()) as MockStakingRewards;
        await staking.deployed();

        podImpl = (await podFactory.connect(admin).deploy()) as MockPod;
        await podImpl.deployed();

        manager = (await managerFactory.connect(admin).deploy(
            vault.address,
            staking.address,
            feeChest.address,
            podImpl.address,
            registry.address,
            feeModule.address,
            oracle.address,
            calculatorModule.address
        )) as DullahanPodManager;
        await manager.deployed();

        await vault.connect(admin).setManager(manager.address)
        await vault.connect(admin).setDelegates(delegate.address, delegate2.address)


        await market.connect(admin).addToken(collat.address, aCollat.address)
        await market.connect(admin).addToken(collat2.address, aCollat2.address)

    });

    it(' should be deployed & have correct parameters', async () => {
        expect(manager.address).to.properAddress

        expect(await manager.owner()).to.be.eq(admin.address)

        expect(await manager.vault()).to.be.eq(vault.address)
        expect(await manager.rewardsStaking()).to.be.eq(staking.address)
        expect(await manager.protocolFeeChest()).to.be.eq(feeChest.address)
        expect(await manager.podImplementation()).to.be.eq(podImpl.address)
        expect(await manager.registry()).to.be.eq(registry.address)
        expect(await manager.feeModule()).to.be.eq(feeModule.address)
        expect(await manager.oracleModule()).to.be.eq(oracle.address)
        expect(await manager.discountCalculator()).to.be.eq(calculatorModule.address)

        expect(await manager.extraLiquidationRatio()).to.be.eq(500)
        expect(await manager.mintFeeRatio()).to.be.eq(25)
        expect(await manager.protocolFeeRatio()).to.be.eq(1000)

    });

    describe('addCollateral', async () => {
        
        it(' should add the collateral correctly (& emit Event)', async () => {

            expect(await manager.allowedCollaterals(collat.address)).to.be.false
            
            const add_tx = await manager.connect(admin).addCollateral(collat.address, aCollat.address)

            expect(await manager.allowedCollaterals(collat.address)).to.be.true
            expect(await manager.aTokenForCollateral(collat.address)).to.be.eq(aCollat.address)

            await expect(add_tx).to.emit(manager, "NewCollateral")
            .withArgs(collat.address, aCollat.address);
    
        });
        
        it(' should allow to add another collateral', async () => {
            
            await manager.connect(admin).addCollateral(collat.address, aCollat.address)

            expect(await manager.allowedCollaterals(collat.address)).to.be.true
            expect(await manager.allowedCollaterals(collat2.address)).to.be.false
            
            const add_tx = await manager.connect(admin).addCollateral(collat2.address, aCollat2.address)

            expect(await manager.allowedCollaterals(collat.address)).to.be.true
            expect(await manager.allowedCollaterals(collat2.address)).to.be.true
            expect(await manager.aTokenForCollateral(collat2.address)).to.be.eq(aCollat2.address)

            await expect(add_tx).to.emit(manager, "NewCollateral")
            .withArgs(collat2.address, aCollat2.address);
    
        });
        
        it(' should fail if already added', async () => {

            await manager.connect(admin).addCollateral(collat.address, aCollat.address)
            
            await expect(
                manager.connect(admin).addCollateral(collat.address, aCollat.address)
            ).to.be.revertedWith('CollateralAlreadyListed')
    
        });
        
        it(' should fail if given address 0x0', async () => {
            
            await expect(
                manager.connect(admin).addCollateral(ethers.constants.AddressZero, aCollat.address)
            ).to.be.revertedWith('AddressZero')

            await expect(
                manager.connect(admin).addCollateral(collat.address, ethers.constants.AddressZero)
            ).to.be.revertedWith('AddressZero')
    
        });
        
        it(' should only be callable by admin', async () => {
            
            await expect(
                manager.connect(otherUser).addCollateral(collat.address, aCollat.address)
            ).to.be.revertedWith('Ownable: caller is not the owner')

            await expect(
                manager.connect(podOwner).addCollateral(collat.address, aCollat.address)
            ).to.be.revertedWith('Ownable: caller is not the owner')
    
        });

    });

    describe('updateCollateral', async () => {

        beforeEach(async () => {
            
            await manager.connect(admin).addCollateral(collat.address, aCollat.address)
            await manager.connect(admin).addCollateral(collat2.address, aCollat2.address)
    
        });
        
        it(' should update the collateral correctly (& emit Event)', async () => {

            expect(await manager.allowedCollaterals(collat.address)).to.be.true
            
            const update_tx = await manager.connect(admin).updateCollateral(collat.address, false)

            expect(await manager.allowedCollaterals(collat.address)).to.be.false

            await expect(update_tx).to.emit(manager, "CollateralUpdated")
            .withArgs(collat.address, false);
    
        });
        
        it(' should allow to update a collateral after being blocked', async () => {
            
            await manager.connect(admin).updateCollateral(collat.address, false)

            expect(await manager.allowedCollaterals(collat.address)).to.be.false
            expect(await manager.allowedCollaterals(collat2.address)).to.be.true
            
            const update_tx = await manager.connect(admin).updateCollateral(collat.address, true)

            expect(await manager.allowedCollaterals(collat.address)).to.be.true
            expect(await manager.allowedCollaterals(collat2.address)).to.be.true
            expect(await manager.aTokenForCollateral(collat.address)).to.be.eq(aCollat.address)
            expect(await manager.aTokenForCollateral(collat2.address)).to.be.eq(aCollat2.address)

            await expect(update_tx).to.emit(manager, "CollateralUpdated")
            .withArgs(collat.address, true);
    
        });
        
        it(' should fail if not listed', async () => {
            
            await expect(
                manager.connect(admin).updateCollateral(aave.address, false)
            ).to.be.revertedWith('CollateralNotListed')
    
        });
        
        it(' should fail if given address 0x0', async () => {
            
            await expect(
                manager.connect(admin).updateCollateral(ethers.constants.AddressZero, false)
            ).to.be.revertedWith('AddressZero')
    
        });
        
        it(' should only be callable by admin', async () => {
            
            await expect(
                manager.connect(otherUser).updateCollateral(collat.address, false)
            ).to.be.revertedWith('Ownable: caller is not the owner')

            await expect(
                manager.connect(podOwner).updateCollateral(collat.address, false)
            ).to.be.revertedWith('Ownable: caller is not the owner')
    
        });

    });

    describe('updateRegistry', async () => {
        
        it(' should update the storage correctly (& emit Event)', async () => {

            expect(await manager.registry()).to.be.eq(registry.address)
            
            const update_tx = await manager.connect(admin).updateRegistry(newRegistry.address)

            expect(await manager.registry()).to.be.eq(newRegistry.address)

            await expect(update_tx).to.emit(manager, "RegistryUpdated")
            .withArgs(registry.address, newRegistry.address);
    
        });
        
        it(' should fail if given the same address', async () => {
            
            await expect(
                manager.connect(admin).updateRegistry(registry.address)
            ).to.be.revertedWith('SameAddress')
    
        });
        
        it(' should fail if given address 0x0', async () => {
            
            await expect(
                manager.connect(admin).updateRegistry(ethers.constants.AddressZero)
            ).to.be.revertedWith('AddressZero')
    
        });
        
        it(' should only be callable by admin', async () => {
            
            await expect(
                manager.connect(otherUser).updateRegistry(newRegistry.address)
            ).to.be.revertedWith('Ownable: caller is not the owner')

            await expect(
                manager.connect(podOwner).updateRegistry(newRegistry.address)
            ).to.be.revertedWith('Ownable: caller is not the owner')
    
        });

    });

    describe('updateFeeModule', async () => {
        
        it(' should update the storage correctly (& emit Event)', async () => {

            expect(await manager.feeModule()).to.be.eq(feeModule.address)
            
            const update_tx = await manager.connect(admin).updateFeeModule(newFeeModule.address)

            expect(await manager.feeModule()).to.be.eq(newFeeModule.address)

            await expect(update_tx).to.emit(manager, "FeeModuleUpdated")
            .withArgs(feeModule.address, newFeeModule.address);
    
        });
        
        it(' should fail if given the same address', async () => {
            
            await expect(
                manager.connect(admin).updateFeeModule(feeModule.address)
            ).to.be.revertedWith('SameAddress')
    
        });
        
        it(' should fail if given address 0x0', async () => {
            
            await expect(
                manager.connect(admin).updateFeeModule(ethers.constants.AddressZero)
            ).to.be.revertedWith('AddressZero')
    
        });
        
        it(' should only be callable by admin', async () => {
            
            await expect(
                manager.connect(otherUser).updateFeeModule(newFeeModule.address)
            ).to.be.revertedWith('Ownable: caller is not the owner')

            await expect(
                manager.connect(podOwner).updateFeeModule(newFeeModule.address)
            ).to.be.revertedWith('Ownable: caller is not the owner')
    
        });

    });

    describe('updateOracleModule', async () => {
        
        it(' should update the storage correctly (& emit Event)', async () => {

            expect(await manager.oracleModule()).to.be.eq(oracle.address)
            
            const update_tx = await manager.connect(admin).updateOracleModule(newOracle.address)

            expect(await manager.oracleModule()).to.be.eq(newOracle.address)

            await expect(update_tx).to.emit(manager, "OracleModuleUpdated")
            .withArgs(oracle.address, newOracle.address);
    
        });
        
        it(' should fail if given the same address', async () => {
            
            await expect(
                manager.connect(admin).updateOracleModule(oracle.address)
            ).to.be.revertedWith('SameAddress')
    
        });
        
        it(' should fail if given address 0x0', async () => {
            
            await expect(
                manager.connect(admin).updateOracleModule(ethers.constants.AddressZero)
            ).to.be.revertedWith('AddressZero')
    
        });
        
        it(' should only be callable by admin', async () => {
            
            await expect(
                manager.connect(otherUser).updateOracleModule(newOracle.address)
            ).to.be.revertedWith('Ownable: caller is not the owner')

            await expect(
                manager.connect(podOwner).updateOracleModule(newOracle.address)
            ).to.be.revertedWith('Ownable: caller is not the owner')
    
        });

    });

    describe('updateDiscountCalculator', async () => {
        
        it(' should update the storage correctly (& emit Event)', async () => {

            expect(await manager.discountCalculator()).to.be.eq(calculatorModule.address)
            
            const update_tx = await manager.connect(admin).updateDiscountCalculator(newCalculator.address)

            expect(await manager.discountCalculator()).to.be.eq(newCalculator.address)

            await expect(update_tx).to.emit(manager, "DiscountCalculatorUpdated")
            .withArgs(calculatorModule.address, newCalculator.address);
    
        });
        
        it(' should fail if given the same address', async () => {
            
            await expect(
                manager.connect(admin).updateDiscountCalculator(calculatorModule.address)
            ).to.be.revertedWith('SameAddress')
    
        });
        
        it(' should fail if given address 0x0', async () => {
            
            await expect(
                manager.connect(admin).updateDiscountCalculator(ethers.constants.AddressZero)
            ).to.be.revertedWith('AddressZero')
    
        });
        
        it(' should only be callable by admin', async () => {
            
            await expect(
                manager.connect(otherUser).updateDiscountCalculator(newCalculator.address)
            ).to.be.revertedWith('Ownable: caller is not the owner')

            await expect(
                manager.connect(podOwner).updateDiscountCalculator(newCalculator.address)
            ).to.be.revertedWith('Ownable: caller is not the owner')
    
        });

    });

    describe('updateMintFeeRatio', async () => {

        const new_ratio = BigNumber.from('50')
        
        it(' should update the storage correctly (& emit Event)', async () => {

            const old_ratio = await manager.mintFeeRatio()
            
            const update_tx = await manager.connect(admin).updateMintFeeRatio(new_ratio)

            expect(await manager.mintFeeRatio()).to.be.eq(new_ratio)

            await expect(update_tx).to.emit(manager, "MintFeeRatioUpdated")
            .withArgs(old_ratio, new_ratio);
    
        });
        
        it(' should fail if given an invalid parameter', async () => {
            
            await expect(
                manager.connect(admin).updateMintFeeRatio(5000)
            ).to.be.revertedWith('InvalidParameter')
    
        });
        
        it(' should only be callable by admin', async () => {
            
            await expect(
                manager.connect(otherUser).updateMintFeeRatio(new_ratio)
            ).to.be.revertedWith('Ownable: caller is not the owner')

            await expect(
                manager.connect(podOwner).updateMintFeeRatio(new_ratio)
            ).to.be.revertedWith('Ownable: caller is not the owner')
    
        });

    });

    describe('updateProtocolFeeRatio', async () => {

        const new_ratio = BigNumber.from('1500')
        
        it(' should update the storage correctly (& emit Event)', async () => {

            const old_ratio = await manager.protocolFeeRatio()
            
            const update_tx = await manager.connect(admin).updateProtocolFeeRatio(new_ratio)

            expect(await manager.protocolFeeRatio()).to.be.eq(new_ratio)

            await expect(update_tx).to.emit(manager, "ProtocolFeeRatioUpdated")
            .withArgs(old_ratio, new_ratio);
    
        });
        
        it(' should fail if given an invalid parameter', async () => {
            
            await expect(
                manager.connect(admin).updateProtocolFeeRatio(5000)
            ).to.be.revertedWith('InvalidParameter')
    
        });
        
        it(' should only be callable by admin', async () => {
            
            await expect(
                manager.connect(otherUser).updateProtocolFeeRatio(new_ratio)
            ).to.be.revertedWith('Ownable: caller is not the owner')

            await expect(
                manager.connect(podOwner).updateProtocolFeeRatio(new_ratio)
            ).to.be.revertedWith('Ownable: caller is not the owner')
    
        });

    });

    describe('updateExtraLiquidationRatio', async () => {

        const new_ratio = BigNumber.from('1500')
        
        it(' should update the storage correctly (& emit Event)', async () => {

            const old_ratio = await manager.extraLiquidationRatio()
            
            const update_tx = await manager.connect(admin).updateExtraLiquidationRatio(new_ratio)

            expect(await manager.extraLiquidationRatio()).to.be.eq(new_ratio)

            await expect(update_tx).to.emit(manager, "ExtraLiquidationRatioUpdated")
            .withArgs(old_ratio, new_ratio);
    
        });
        
        it(' should fail if given an invalid parameter', async () => {
            
            await expect(
                manager.connect(admin).updateExtraLiquidationRatio(5000)
            ).to.be.revertedWith('InvalidParameter')
    
        });
        
        it(' should only be callable by admin', async () => {
            
            await expect(
                manager.connect(otherUser).updateExtraLiquidationRatio(new_ratio)
            ).to.be.revertedWith('Ownable: caller is not the owner')

            await expect(
                manager.connect(podOwner).updateExtraLiquidationRatio(new_ratio)
            ).to.be.revertedWith('Ownable: caller is not the owner')
    
        });

    });

    describe('updateProcessThreshold', async () => {

        const new_threshold = ethers.utils.parseEther('550')
        
        it(' should update the storage correctly (& emit Event)', async () => {

            const old_threshold = await manager.processThreshold()
            
            const update_tx = await manager.connect(admin).updateProcessThreshold(new_threshold)

            expect(await manager.processThreshold()).to.be.eq(new_threshold)

            await expect(update_tx).to.emit(manager, "ProcessThresholdUpdated")
            .withArgs(old_threshold, new_threshold);
    
        });
        
        it(' should fail if given an invalid parameter', async () => {
            
            await expect(
                manager.connect(admin).updateProcessThreshold(ethers.utils.parseEther('1'))
            ).to.be.revertedWith('InvalidParameter')
    
        });
        
        it(' should only be callable by admin', async () => {
            
            await expect(
                manager.connect(otherUser).updateProcessThreshold(new_threshold)
            ).to.be.revertedWith('Ownable: caller is not the owner')

            await expect(
                manager.connect(podOwner).updateProcessThreshold(new_threshold)
            ).to.be.revertedWith('Ownable: caller is not the owner')
    
        });

    });

    describe('updatePodRegistry', async () => {

        let pod: MockPod

        beforeEach(async () => {

            await manager.connect(admin).addCollateral(collat.address, aCollat.address)
            
            await manager.connect(podOwner).createPod(collat.address, podOwner.address)
            const podList = await manager.getAllPods()
            pod = MockPod__factory.connect(podList[podList.length - 1], provider);

            await manager.connect(admin).updateRegistry(newRegistry.address)
    
        });
        
        it(' should update the Pod regisitry correctly', async () => {
            
            expect(await pod.registry()).to.be.eq(registry.address)

            await manager.connect(admin).updatePodRegistry(pod.address)
            
            expect(await pod.registry()).to.be.eq(newRegistry.address)
    
        });
        
        it(' should fail if the given Pod address is invalid', async () => {
            
            await expect(
                manager.connect(admin).updatePodRegistry(otherUser.address)
            ).to.be.revertedWith('PodInvalid')
    
        });
        
        it(' should only be callable by admin', async () => {
            
            await expect(
                manager.connect(otherUser).updatePodRegistry(pod.address)
            ).to.be.revertedWith('Ownable: caller is not the owner')

            await expect(
                manager.connect(podOwner).updatePodRegistry(pod.address)
            ).to.be.revertedWith('Ownable: caller is not the owner')
    
        });

    });

    describe('updateMultiplePodsRegistry', async () => {

        let pod: MockPod
        let pod2: MockPod
        let pod3: MockPod

        beforeEach(async () => {

            await manager.connect(admin).addCollateral(collat.address, aCollat.address)
            
            await manager.connect(podOwner).createPod(collat.address, podOwner.address)
            await manager.connect(podOwner).createPod(collat.address, podOwner.address)
            await manager.connect(podOwner).createPod(collat.address, podOwner.address)
            const podList = await manager.getAllPods()
            pod = MockPod__factory.connect(podList[podList.length - 3], provider);
            pod2 = MockPod__factory.connect(podList[podList.length - 2], provider);
            pod3 = MockPod__factory.connect(podList[podList.length - 1], provider);

            await manager.connect(admin).updateRegistry(newRegistry.address)
    
        });
        
        it(' should update the Pod regisitry correctly', async () => {
            
            expect(await pod.registry()).to.be.eq(registry.address)
            expect(await pod2.registry()).to.be.eq(registry.address)
            expect(await pod3.registry()).to.be.eq(registry.address)

            await manager.connect(admin).updateMultiplePodsRegistry([pod.address, pod2.address])
            
            expect(await pod.registry()).to.be.eq(newRegistry.address)
            expect(await pod2.registry()).to.be.eq(newRegistry.address)
            expect(await pod3.registry()).to.be.eq(registry.address)
    
        });
        
        it(' should fail if given an invalid Pod address', async () => {
            
            await expect(
                manager.connect(admin).updateMultiplePodsRegistry([pod.address, otherUser.address])
            ).to.be.revertedWith('PodInvalid')
    
        });
        
        it(' should only be callable by admin', async () => {
            
            await expect(
                manager.connect(otherUser).updateMultiplePodsRegistry([pod.address, pod2.address])
            ).to.be.revertedWith('Ownable: caller is not the owner')

            await expect(
                manager.connect(podOwner).updateMultiplePodsRegistry([pod.address, pod2.address])
            ).to.be.revertedWith('Ownable: caller is not the owner')
    
        });

    });

    describe('updateAllPodsRegistry', async () => {

        let pod: MockPod
        let pod2: MockPod
        let pod3: MockPod

        beforeEach(async () => {

            await manager.connect(admin).addCollateral(collat.address, aCollat.address)
            
            await manager.connect(podOwner).createPod(collat.address, podOwner.address)
            await manager.connect(podOwner).createPod(collat.address, podOwner.address)
            await manager.connect(podOwner).createPod(collat.address, podOwner.address)
            const podList = await manager.getAllPods()
            pod = MockPod__factory.connect(podList[podList.length - 3], provider);
            pod2 = MockPod__factory.connect(podList[podList.length - 2], provider);
            pod3 = MockPod__factory.connect(podList[podList.length - 1], provider);

            await manager.connect(admin).updateRegistry(newRegistry.address)
    
        });
        
        it(' should update the Pod regisitry correctly', async () => {
            
            expect(await pod.registry()).to.be.eq(registry.address)
            expect(await pod2.registry()).to.be.eq(registry.address)
            expect(await pod3.registry()).to.be.eq(registry.address)

            await manager.connect(admin).updateAllPodsRegistry()
            
            expect(await pod.registry()).to.be.eq(newRegistry.address)
            expect(await pod2.registry()).to.be.eq(newRegistry.address)
            expect(await pod3.registry()).to.be.eq(newRegistry.address)
    
        });
        
        it(' should only be callable by admin', async () => {
            
            await expect(
                manager.connect(otherUser).updateAllPodsRegistry()
            ).to.be.revertedWith('Ownable: caller is not the owner')

            await expect(
                manager.connect(podOwner).updateAllPodsRegistry()
            ).to.be.revertedWith('Ownable: caller is not the owner')
    
        });

    });

});