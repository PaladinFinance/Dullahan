export { };
const hre = require("hardhat");
import { BigNumber } from "ethers";
import { IERC20__factory } from "../../typechain/factories/oz/interfaces/IERC20__factory";

const ethers = hre.ethers;

const network = hre.network.name;

let constant_path = '../utils/constants';
if(network == 'goerli') constant_path = '../utils/goerli-constants'

let deploy_path = '../utils/deploy';
if(network == 'goerli') deploy_path = '../utils/goerli-deploy'

const {
    TEST_TOKEN_1,
    TEST_TOKEN_2,
    TEST_TOKEN_3,
    A_TOKEN_1,
    A_TOKEN_2,
    A_TOKEN_3
} = require(constant_path);

const { 
    VAULT,
    STAKING,
    REGISTRY,
    FEE_MODULE,
    ORACLE_MODULE,
    DISCOUNT_CALCULATOR_MODULE
} = require(deploy_path);

async function main() {

    const deployer = (await hre.ethers.getSigners())[0];

    const DullahanPodManager = await ethers.getContractFactory("DullahanPodManager");
    const DullahanPod = await ethers.getContractFactory("DullahanPod");
    const DullahanVault = await ethers.getContractFactory("DullahanVault");
    const DullahanRewardsStaking = await ethers.getContractFactory("DullahanRewardsStaking");

    const vault = DullahanVault.attach(VAULT)
    const staking = DullahanRewardsStaking.attach(STAKING)


    console.log('Deploying DullahanPod Implementation ...')
    const podImplementation = await DullahanPod.deploy()
    await podImplementation.deployed()
    console.log('DullahanPod : ', podImplementation.address)
    console.log()

    console.log('Deploying DullahanPodManager  ...')
    const podManager = await DullahanPodManager.deploy(
        VAULT,
        STAKING,
        deployer.address,
        podImplementation.address,
        REGISTRY,
        FEE_MODULE,
        ORACLE_MODULE,
        DISCOUNT_CALCULATOR_MODULE
    )
    await podManager.deployed()
    console.log('DullahanPodManager : ', podManager.address)
    console.log()

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