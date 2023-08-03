export { };
const hre = require("hardhat");
import { BigNumber } from "ethers";
import { IERC20__factory } from "../../typechain/factories/oz/interfaces/IERC20__factory";

const ethers = hre.ethers;

const network = hre.network.name;

let constant_path = '../utils/constants';

const {
    AAVE,
    STK_AAVE,
    GHO,
    DEBT_GHO,
    AAVE_POOL,
    AAVE_REWARD_CONTROLLER,
    ORACLE_ADDRESS
} = require(constant_path);

async function main() {

    const PALADIN_COMMU_MSIG = "0x1Ae6DCBc88d6f81A7BCFcCC7198397D776F3592E"

    const stkAAVE = IERC20__factory.connect(STK_AAVE, hre.ethers.provider);

    const seed_deposit = ethers.utils.parseEther('0.001')
    const reserve_ratio = BigNumber.from(500)
    const start_fee = BigNumber.from('1590000000')

    const deployer = (await hre.ethers.getSigners())[0];

    const DullahanVault = await ethers.getContractFactory("DullahanVault");
    const DullahanRewardsStaking = await ethers.getContractFactory("DullahanRewardsStaking");
    const DullahanPodManager = await ethers.getContractFactory("DullahanPodManager");
    const DullahanPod = await ethers.getContractFactory("DullahanPod");
    const OracleModule = await ethers.getContractFactory("OracleModule");
    const DullahanRegistry = await ethers.getContractFactory("DullahanRegistry");
    const DullahanDiscountCalculator = await ethers.getContractFactory("DullahanDiscountCalculator");
    const DullahanFeeModule = await ethers.getContractFactory("DullahanFeeModule");
    const DullahanZapDeposit = await ethers.getContractFactory("DullahanZapDeposit");

    console.log('Deploying OracleModule  ...')
    const oracleModule = await OracleModule.deploy(
        ORACLE_ADDRESS,
        GHO
    )
    await oracleModule.deployed()
    console.log('OracleModule : ', oracleModule.address)
    console.log()

    console.log('Deploying DullahanDiscountCalculator  ...')
    const calculator = await DullahanDiscountCalculator.deploy()
    await calculator.deployed()
    console.log('DullahanDiscountCalculator : ', calculator.address)
    console.log()

    console.log('Deploying DullahanRegistry  ...')
    const registry = await DullahanRegistry.deploy(
        AAVE,
        STK_AAVE,
        GHO,
        DEBT_GHO,
        AAVE_POOL,
        AAVE_REWARD_CONTROLLER
    )
    await registry.deployed()
    console.log('DullahanRegistry : ', registry.address)
    console.log()

    console.log('Deploying DullahanVault  ...')
    const vault = await DullahanVault.deploy(
        deployer.address,
        reserve_ratio,
        deployer.address,
        AAVE,
        STK_AAVE,
        "Dullahan stkAave",
        "dstkAAVE"
    )
    await vault.deployed()
    console.log('DullahanVault : ', vault.address)
    console.log()

    console.log('Deploying DullahanFeeModule  ...')
    const feeModule = await DullahanFeeModule.deploy(
        vault.address,
        start_fee
    )
    await feeModule.deployed()
    console.log('DullahanFeeModule : ', feeModule.address)
    console.log()

    console.log('Deploying DullahanRewardsStaking  ...')
    const staking = await DullahanRewardsStaking.deploy(
        vault.address
    )
    await staking.deployed()
    console.log('DullahanRewardsStaking : ', staking.address)
    console.log()

    console.log('Deploying DullahanPod Implementation ...')
    const podImplementation = await DullahanPod.deploy()
    await podImplementation.deployed()
    console.log('DullahanPod : ', podImplementation.address)
    console.log()

    console.log('Deploying DullahanPodManager  ...')
    const podManager = await DullahanPodManager.deploy(
        vault.address,
        staking.address,
        PALADIN_COMMU_MSIG,
        podImplementation.address,
        registry.address,
        feeModule.address,
        oracleModule.address,
        calculator.address
    )
    await podManager.deployed()
    console.log('DullahanPodManager : ', podManager.address)
    console.log()

    console.log('Deploying DullahanZapDeposit  ...')
    const zap = await DullahanZapDeposit.deploy(
        AAVE,
        STK_AAVE,
        vault.address,
        staking.address
    )
    await zap.deployed()
    console.log('DullahanZapDeposit : ', zap.address)
    console.log()


    console.log()
    console.log()
    console.log('Initiate Vault  ...')

    const approve_tx_1 = await stkAAVE.connect(deployer).approve(vault.address, seed_deposit)
    await approve_tx_1.wait(10)

    const init_tx_1 = await vault.connect(deployer).init(PALADIN_COMMU_MSIG, PALADIN_COMMU_MSIG, { gasLimit: 1_000_000 })
    await init_tx_1.wait(10)

    console.log()
    console.log('Initiate Staking  ...')

    const approve_tx_2 = await vault.connect(deployer).approve(staking.address, seed_deposit)
    await approve_tx_2.wait(10)

    const init_tx_2 = await staking.connect(deployer).init()
    await init_tx_2.wait(10)

    console.log()
    console.log('Add Pod Manager for Vault ...')
    const add_tx_1 = await vault.connect(deployer).addPodManager(podManager.address)
    await add_tx_1.wait(10)

    console.log()
    console.log('Add Pod Manager as Reward Depositor  ...')
    const add_tx_2 = await staking.connect(deployer).addRewardDepositor(podManager.address)
    await add_tx_2.wait(10)

    console.log()
    console.log('Update Vault Reserve Manager ...')
    const update_tx = await vault.connect(deployer).updateReserveManager(PALADIN_COMMU_MSIG)
    await update_tx.wait(10)

    // Verification of contracts

    await hre.run("verify:verify", {
        address: oracleModule.address,
        constructorArguments: [
            ORACLE_ADDRESS,
            GHO
        ],
    });

    await hre.run("verify:verify", {
        address: calculator.address,
        constructorArguments: [],
    });

    await hre.run("verify:verify", {
        address: registry.address,
        constructorArguments: [
            AAVE,
            STK_AAVE,
            GHO,
            DEBT_GHO,
            AAVE_POOL,
            AAVE_REWARD_CONTROLLER
        ],
    });

    await hre.run("verify:verify", {
        address: vault.address,
        constructorArguments: [
            deployer.address,
            reserve_ratio,
            deployer.address,
            AAVE,
            STK_AAVE,
            "Dullahan stkAave",
            "dstkAAVE"
        ],
    });

    await hre.run("verify:verify", {
        address: feeModule.address,
        constructorArguments: [
            vault.address,
            start_fee
        ],
    });

    await hre.run("verify:verify", {
        address: staking.address,
        constructorArguments: [
            vault.address
        ],
    });

    await hre.run("verify:verify", {
        address: podImplementation.address,
        constructorArguments: [],
    });

    await hre.run("verify:verify", {
        address: podManager.address,
        constructorArguments: [
            vault.address,
            staking.address,
            PALADIN_COMMU_MSIG,
            podImplementation.address,
            registry.address,
            feeModule.address,
            oracleModule.address,
            calculator.address
        ],
    });

    await hre.run("verify:verify", {
        address: zap.address,
        constructorArguments: [
            AAVE,
            STK_AAVE,
            vault.address,
            staking.address
        ],
    });

}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });