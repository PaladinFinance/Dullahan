const hre = require("hardhat");
import { ethers } from "hardhat";
import chai from "chai";
import { BigNumber } from "ethers";
import { solidity } from "ethereum-waffle";
import { DullahanPodManager } from "../../typechain/DullahanPodManager";
import { MockERC20 } from "../../typechain/test/MockERC20";
import { MockPod } from "../../typechain/test/MockPod";
import { MockMarket } from "../../typechain/test/MockMarket";
import { MockRewards } from "../../typechain/test/MockRewards";
import { MockOracle } from "../../typechain/test/MockOracle";
import { MockFeeModule } from "../../typechain/test/MockFeeModule";
import { MockVault2 } from "../../typechain/test/MockVault2";
import { DullahanRegistry } from "../../typechain/modules/DullahanRegistry";
import { MockPod__factory } from "../../typechain/factories/test/MockPod__factory";
import { IERC20 } from "../../typechain/oz/interfaces/IERC20";
import { IERC20__factory } from "../../typechain/factories/oz/interfaces/IERC20__factory";
import { IStakedAave } from "../../typechain/interfaces/IStakedAave";
import { IStakedAave__factory } from "../../typechain/factories/interfaces/IStakedAave__factory";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ContractFactory } from "@ethersproject/contracts";

import {
    getERC20,
    advanceTime,
    resetFork
} from "../utils/utils";

import {
    AAVE,
    STK_AAVE,
    HOLDER_AAVE,
    AMOUNT_AAVE,
    REWARD_TOKEN_1,
    REWARD_TOKEN_2,
} from "../utils/constants"

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
let feeModuleFactory: ContractFactory

const UNIT = ethers.utils.parseEther('1')
const MAX_BPS = BigNumber.from('10000')
const MAX_UINT256 = ethers.constants.MaxUint256
const WEEK = BigNumber.from(7 * 86400);

describe('DullahanPodManager contract tests - Admin functions', () => {
    let admin: SignerWithAddress

    let manager: DullahanPodManager

    let podImpl: MockPod
    let pod: MockPod
    let pod2: MockPod
    let pod3: MockPod

    let vault: MockVault2

    let collat: MockERC20
    let aCollat: MockERC20
    let collat2: MockERC20
    let aCollat2: MockERC20

    let gho: MockERC20
    let ghoDebt: MockERC20

    let oracle: MockOracle
    let feeModule: MockFeeModule

    let feeChest: SignerWithAddress

    let market: MockMarket
    let rewardsController: MockRewards

    let aave: IERC20
    let stkAave: IERC20
    let stkAave_staking: IStakedAave

    let registry: DullahanRegistry

    let delegate: SignerWithAddress
    let podOwner: SignerWithAddress
    let otherUser: SignerWithAddress

    before(async () => {
        await resetFork();

        [admin, feeChest, delegate, podOwner, otherUser] = await ethers.getSigners();

        managerFactory = await ethers.getContractFactory("DullahanPodManager");
        podFactory = await ethers.getContractFactory("MockPod");
        tokenFactory = await ethers.getContractFactory("MockERC20");
        marketFactory = await ethers.getContractFactory("MockMarket");
        rewardsFactory = await ethers.getContractFactory("MockRewards");
        vaultFactory = await ethers.getContractFactory("MockVault2");
        registryFactory = await ethers.getContractFactory("DullahanRegistry");
        oracleFactory = await ethers.getContractFactory("MockOracle");
        feeModuleFactory = await ethers.getContractFactory("MockFeeModule");

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

        podImpl = (await podFactory.connect(admin).deploy()) as MockPod;
        await podImpl.deployed();

        manager = (await managerFactory.connect(admin).deploy(
            vault.address,
            rewardsController.address,
            feeChest.address,
            podImpl.address,
            registry.address,
            feeModule.address,
            oracle.address
        )) as DullahanPodManager;
        await manager.deployed();

        await vault.connect(admin).setManager(manager.address)
        await vault.connect(admin).setDelegate(delegate.address)

        await market.connect(admin).addToken(collat.address, aCollat.address)
        await market.connect(admin).addToken(collat2.address, aCollat2.address)

        await manager.connect(admin).addCollateral(collat.address, aCollat.address)
        await manager.connect(admin).addCollateral(collat2.address, aCollat2.address)
            
        await manager.connect(podOwner).createPod(collat.address)
        await manager.connect(podOwner).createPod(collat.address)
        await manager.connect(podOwner).createPod(collat.address)
        const podList = await manager.getAllPods()
        pod = MockPod__factory.connect(podList[podList.length - 3], provider);
        pod2 = MockPod__factory.connect(podList[podList.length - 2], provider);
        pod3 = MockPod__factory.connect(podList[podList.length - 1], provider);

    });

    it(' should be deployed & have correct parameters', async () => {
        expect(manager.address).to.properAddress

        expect(await manager.owner()).to.be.eq(admin.address)

        expect(await manager.vault()).to.be.eq(vault.address)
        expect(await manager.rewardsStaking()).to.be.eq(rewardsController.address)
        expect(await manager.protocolFeeChest()).to.be.eq(feeChest.address)
        expect(await manager.podImplementation()).to.be.eq(podImpl.address)
        expect(await manager.registry()).to.be.eq(registry.address)
        expect(await manager.feeModule()).to.be.eq(feeModule.address)
        expect(await manager.oracleModule()).to.be.eq(oracle.address)

        expect(await manager.extraLiquidationRatio()).to.be.eq(500)
        expect(await manager.mintFeeRatio()).to.be.eq(50)
        expect(await manager.protocolFeeRatio()).to.be.eq(500)

    });

    describe('getStkAave', async () => {

        const previous_debt = ethers.utils.parseEther('1500')
        const added_debt = ethers.utils.parseEther('250')

        beforeEach(async () => {

            await ghoDebt.connect(admin).mint(pod.address, previous_debt)

        });
        
        it(' should xx', async () => {



        });
        
        it(' should xx', async () => {



        });
        
        it(' should xx', async () => {



        });
        
        it(' should xx', async () => {



        });
        
        it(' should xx', async () => {



        });

    });

    describe('xxx', async () => {

        beforeEach(async () => {


        });
        
        it(' should xx', async () => {



        });

    });

});