export { };
const hre = require("hardhat");
import { BigNumber } from "ethers";
import { IERC20__factory } from "../../typechain/factories/oz/interfaces/IERC20__factory";

const ethers = hre.ethers;

const network = hre.network.name;

let constant_path = '../utils/constants';
if(network == 'goerli') constant_path = '../utils/goerli-constants'

const { 
    AAVE,
    STK_AAVE,
    GHO,
    DEBT_GHO,
    AAVE_POOL,
    AAVE_REWARD_CONTROLLER,
    ORACLE_ADDRESS,
    TEST_TOKEN_1,
    TEST_TOKEN_2,
    TEST_TOKEN_3,
    A_TOKEN_1,
    A_TOKEN_2,
    A_TOKEN_3
} = require(constant_path);

async function main() {

    const stkAAVE = IERC20__factory.connect(STK_AAVE, hre.ethers.provider);

    const seed_deposit = ethers.utils.parseEther('0.001')
    const reserve_ratio = BigNumber.from(100)
    const start_fee = BigNumber.from('270000000')

    const deployer = (await hre.ethers.getSigners())[0];

    const DullahanVault = await ethers.getContractFactory("DullahanVault");
    const DullahanRewardsStaking = await ethers.getContractFactory("DullahanRewardsStaking");
    const DullahanPodManager = await ethers.getContractFactory("DullahanPodManager");
    const DullahanPod = await ethers.getContractFactory("DullahanPod");
    const OracleModule = await ethers.getContractFactory("OracleModule");
    const DullahanRegistry = await ethers.getContractFactory("DullahanRegistry");
    const DullahanDiscountCalculator = await ethers.getContractFactory("DullahanDiscountCalculator");
    const DullahanFeeModule = await ethers.getContractFactory("DullahanFeeModule");

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
        deployer.address,
        podImplementation.address,
        registry.address,
        feeModule.address,
        oracleModule.address,
        calculator.address
    )
    await podManager.deployed()
    console.log('DullahanPodManager : ', podManager.address)
    console.log()


    console.log()
    console.log()
    console.log('Initiate Vault  ...')

    const approve_tx_1 = await stkAAVE.connect(deployer).approve(vault.address, seed_deposit)
    await approve_tx_1.wait(10)

    const init_tx_1 = await vault.connect(deployer).init(deployer.address, { gasLimit: 1_000_000 })
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
    console.log('Adding Collaterals  ...')
    console.log('Adding DAI  ...')
    await podManager.connect(deployer).addCollateral(TEST_TOKEN_1, A_TOKEN_1)
    console.log('Adding WETH  ...')
    await podManager.connect(deployer).addCollateral(TEST_TOKEN_2, A_TOKEN_2)
    console.log('Adding USDC  ...')
    await podManager.connect(deployer).addCollateral(TEST_TOKEN_3, A_TOKEN_3)


}

main()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });