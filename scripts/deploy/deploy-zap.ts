export { };
const hre = require("hardhat");
import { BigNumber } from "ethers";
import { IERC20__factory } from "../../typechain/factories/oz/interfaces/IERC20__factory";

const ethers = hre.ethers;

const network = hre.network.name;

let constant_path = '../utils/constants';
if(network == 'goerli') constant_path = '../utils/goerli-constants'

let deploy_path = '../utils/deploys';
if(network == 'goerli') deploy_path = '../utils/goerli-deploy'

const { 
    AAVE,
    STK_AAVE,
} = require(constant_path);

const { 
    VAULT,
    STAKING,
} = require(deploy_path);

async function main() {

    const deployer = (await hre.ethers.getSigners())[0];

    const DullahanZapDeposit = await ethers.getContractFactory("DullahanZapDeposit");

    console.log('Deploying DullahanZapDeposit  ...')
    const zap = await DullahanZapDeposit.deploy(
        AAVE,
        STK_AAVE,
        VAULT,
        STAKING
    )
    await zap.deployed()
    console.log('DullahanZapDeposit : ', zap.address)
    console.log()

}

main()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error);
      process.exit(1);
    });