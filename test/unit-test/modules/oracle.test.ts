const hre = require("hardhat");
import { ethers } from "hardhat";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { BigNumber } from "ethers";
import { OracleModule } from "../../../typechain/modules/OracleModule";
import { MockOracle } from "../../../typechain/test/MockOracle";
import { IERC20 } from "../../../typechain/oz/interfaces/IERC20";
import { IERC20__factory } from "../../../typechain/factories/oz/interfaces/IERC20__factory";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ContractFactory } from "@ethersproject/contracts";

import {
    resetFork
} from "../../utils/utils";

const TOKEN_1 = "0x6B175474E89094C44Da98b954EedeAC495271d0F"; //here : DAI
const TOKEN_2 = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"; //here : WETH
const TOKEN_3 = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"; //here : USDC

chai.use(solidity);
const { expect } = chai;
const { provider } = ethers;

let moduleFactory: ContractFactory
let oraclefactory: ContractFactory

const UNIT = ethers.utils.parseEther('1')
const MAX_BPS = BigNumber.from('10000')

describe('OracleModule contract tests - Mock oracle', () => {
    let user: SignerWithAddress

    let gho: SignerWithAddress

    let module: OracleModule

    let token1: IERC20
    let token2: IERC20
    let token3: IERC20

    let oracle: MockOracle

    before(async () => {
        await resetFork();

        [user, gho] = await ethers.getSigners();

        moduleFactory = await ethers.getContractFactory("OracleModule");
        oraclefactory = await ethers.getContractFactory("MockOracle");

        token1 = IERC20__factory.connect(TOKEN_1, provider);
        token2 = IERC20__factory.connect(TOKEN_2, provider);
        token3 = IERC20__factory.connect(TOKEN_3, provider);

    })

    beforeEach(async () => {

        oracle = (await oraclefactory.connect(user).deploy()) as MockOracle;
        await oracle.deployed();

        module = (await moduleFactory.connect(user).deploy(
            oracle.address,
            gho.address
        )) as OracleModule;
        await module.deployed();

    });

    it(' should be deployed & have correct parameters', async () => {
        expect(module.address).to.properAddress

        expect(await module.AAVE_ORACLE()).to.be.eq(oracle.address)
        expect(await module.GHO()).to.be.eq(gho.address)

    });

    describe('getCollateralAmount', async () => {

        // Prices taken at arbitrary block, with block's ETH price :
        const token1_price = ethers.utils.parseEther('0.00085') // consider 1 DAI == 1 $USD
        const token2_price = ethers.utils.parseEther('1') // because Oracle base currency is in ETH
        const token3_price = ethers.utils.parseEther('0.00085') // consider 1 USDC == 1 $USD
        const gho_price = ethers.utils.parseEther('0.00085') // because (in docs) hardcoded 1 GHO == 1 $USD

        beforeEach(async () => {

            await oracle.connect(user).setAssetPrice(token1.address, token1_price)
            await oracle.connect(user).setAssetPrice(token2.address, token2_price)
            await oracle.connect(user).setAssetPrice(token3.address, token3_price)
            await oracle.connect(user).setAssetPrice(gho.address, gho_price)

        });

        it(' should return the correct amount - 1', async () => {

            const feeAmount = ethers.utils.parseEther('1500')
            const collateral = token1

            const expected_amount = ethers.utils.parseEther('1500')

            expect(await module.getCollateralAmount(collateral.address, feeAmount)).to.be.eq(expected_amount)

        });

        it(' should return the correct amount - 2', async () => {

            const feeAmount = ethers.utils.parseEther('1275')
            const collateral = token2

            const expected_amount = ethers.utils.parseEther('1.08375')

            expect(await module.getCollateralAmount(collateral.address, feeAmount)).to.be.eq(expected_amount)

        });

        it(' should return the correct amount - 3', async () => {

            const feeAmount = ethers.utils.parseEther('0.00455')
            const collateral = token2

            const expected_amount = ethers.utils.parseEther('0.0000038675')

            expect(await module.getCollateralAmount(collateral.address, feeAmount)).to.be.eq(expected_amount)

        });

        it(' should return the correct amount - 4 - decimals difference', async () => {

            const feeAmount = ethers.utils.parseEther('250')
            const collateral = token3

            const expected_amount = BigNumber.from('250000000')

            expect(await module.getCollateralAmount(collateral.address, feeAmount)).to.be.eq(expected_amount)

        });

    });

    describe('getFeeAmount', async () => {

        // Prices taken at arbitrary block, with block's ETH price :
        const token1_price = ethers.utils.parseEther('0.00085') // consider 1 DAI == 1 $USD
        const token2_price = ethers.utils.parseEther('1') // because Oracle base currency is in ETH
        const token3_price = ethers.utils.parseEther('0.00085') // consider 1 USDC == 1 $USD
        const gho_price = ethers.utils.parseEther('0.00085') // because (in docs) hardcoded 1 GHO == 1 $USD

        beforeEach(async () => {

            await oracle.connect(user).setAssetPrice(token1.address, token1_price)
            await oracle.connect(user).setAssetPrice(token2.address, token2_price)
            await oracle.connect(user).setAssetPrice(token3.address, token3_price)
            await oracle.connect(user).setAssetPrice(gho.address, gho_price)

        });

        it(' should return the correct amount - 1', async () => {

            const collateralAmount = ethers.utils.parseEther('25000')
            const collateral = token1

            const expected_amount = ethers.utils.parseEther('25000')

            expect(await module.getFeeAmount(collateral.address, collateralAmount)).to.be.eq(expected_amount)

        });

        it(' should return the correct amount - 2', async () => {

            const collateralAmount = ethers.utils.parseEther('85')
            const collateral = token2

            const expected_amount = ethers.utils.parseEther('100000')

            expect(await module.getFeeAmount(collateral.address, collateralAmount)).to.be.eq(expected_amount)

        });

        it(' should return the correct amount - 3', async () => {

            const collateralAmount = ethers.utils.parseEther('0.001275')
            const collateral = token2

            const expected_amount = ethers.utils.parseEther('1.5')

            expect(await module.getFeeAmount(collateral.address, collateralAmount)).to.be.eq(expected_amount)

        });

        it(' should return the correct amount - 4 - decimals difference', async () => {

            const collateralAmount = BigNumber.from('1500000000')
            const collateral = token3

            const expected_amount = ethers.utils.parseEther('1500')

            expect(await module.getFeeAmount(collateral.address, collateralAmount)).to.be.eq(expected_amount)

        });

    });

});