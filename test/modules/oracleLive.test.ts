const hre = require("hardhat");
import { ethers } from "hardhat";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { BigNumber } from "ethers";
import { OracleModule } from "../../typechain/modules/OracleModule";
import { IAaveOracle } from "../../typechain/interfaces/IAaveOracle";
import { IAaveOracle__factory } from "../../typechain/factories/interfaces/IAaveOracle__factory";
import { IERC20 } from "../../typechain/oz/interfaces/IERC20";
import { IERC20__factory } from "../../typechain/factories/oz/interfaces/IERC20__factory";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ContractFactory } from "@ethersproject/contracts";

import {
    resetFork
} from "../utils/utils";

const TOKEN_1 = "0x6B175474E89094C44Da98b954EedeAC495271d0F"; //here : DAI
const TOKEN_2 = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"; //here : WETH
const TOKEN_3 = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"; //here : USDC

chai.use(solidity);
const { expect } = chai;
const { provider } = ethers;

let moduleFactory: ContractFactory

const UNIT = ethers.utils.parseEther('1')
const MAX_BPS = BigNumber.from('10000')

const BLOCK_NUMBER_OVERRIDE = 16537150

const ORACLE_ADDRESS = "0x54586bE62E3c3580375aE3723C145253060Ca0C2"

describe('OracleModule contract tests - Live Oracle', () => {
    let user: SignerWithAddress

    let gho: SignerWithAddress

    let module: OracleModule

    let oracle: IAaveOracle

    let token1: IERC20
    let token2: IERC20
    let token3: IERC20

    before(async () => {
        await resetFork(BLOCK_NUMBER_OVERRIDE);

        [user, gho] = await ethers.getSigners();

        moduleFactory = await ethers.getContractFactory("OracleModule");

        oracle = IAaveOracle__factory.connect(ORACLE_ADDRESS, provider);

        token1 = IERC20__factory.connect(TOKEN_1, provider);
        token2 = IERC20__factory.connect(TOKEN_2, provider);
        token3 = IERC20__factory.connect(TOKEN_3, provider);

    })

    beforeEach(async () => {

        module = (await moduleFactory.connect(user).deploy(
            ORACLE_ADDRESS,
            gho.address
        )) as OracleModule;
        await module.deployed();

    });

    it(' should be deployed & have correct parameters', async () => {
        expect(module.address).to.properAddress

        expect(await module.AAVE_ORACLE()).to.be.eq(ORACLE_ADDRESS)
        expect(await module.GHO()).to.be.eq(gho.address)

    });

    describe('getCollateralAmount', async () => {

        it(' should return the correct amount - 1', async () => {

            const feeAmount = ethers.utils.parseEther('1500')
            const collateral = token1

            const feePrice = await oracle.getAssetPrice(gho.address)
            const collateralPrice = await oracle.getAssetPrice(collateral.address)

            const expected_amount = feeAmount.mul(feePrice).div(collateralPrice)

            expect(await module.getCollateralAmount(collateral.address, feeAmount)).to.be.eq(expected_amount)

        });

        it(' should return the correct amount - 2', async () => {

            const feeAmount = ethers.utils.parseEther('1275')
            const collateral = token2

            const feePrice = await oracle.getAssetPrice(gho.address)
            const collateralPrice = await oracle.getAssetPrice(collateral.address)

            const expected_amount = feeAmount.mul(feePrice).div(collateralPrice)

            expect(await module.getCollateralAmount(collateral.address, feeAmount)).to.be.eq(expected_amount)

        });

        it(' should return the correct amount - 3', async () => {

            const feeAmount = ethers.utils.parseEther('0.00455')
            const collateral = token2

            const feePrice = await oracle.getAssetPrice(gho.address)
            const collateralPrice = await oracle.getAssetPrice(collateral.address)

            const expected_amount = feeAmount.mul(feePrice).div(collateralPrice)

            expect(await module.getCollateralAmount(collateral.address, feeAmount)).to.be.eq(expected_amount)

        });

        it(' should return the correct amount - 4 - decimals difference', async () => {

            const feeAmount = ethers.utils.parseEther('250')
            const collateral = token3

            const feePrice = await oracle.getAssetPrice(gho.address)
            const collateralPrice = await oracle.getAssetPrice(collateral.address)

            const expected_amount = feeAmount.mul(feePrice).div(10**12).div(collateralPrice)

            expect(await module.getCollateralAmount(collateral.address, feeAmount)).to.be.eq(expected_amount)

        });

    });

    describe('getFeeAmount', async () => {

        it(' should return the correct amount - 1', async () => {

            const collateralAmount = ethers.utils.parseEther('25000')
            const collateral = token1

            const feePrice = await oracle.getAssetPrice(gho.address)
            const collateralPrice = await oracle.getAssetPrice(collateral.address)

            const expected_amount = collateralAmount.mul(collateralPrice).div(feePrice)

            expect(await module.getFeeAmount(collateral.address, collateralAmount)).to.be.eq(expected_amount)

        });

        it(' should return the correct amount - 2', async () => {

            const collateralAmount = ethers.utils.parseEther('85')
            const collateral = token2

            const feePrice = await oracle.getAssetPrice(gho.address)
            const collateralPrice = await oracle.getAssetPrice(collateral.address)

            const expected_amount = collateralAmount.mul(collateralPrice).div(feePrice)

            expect(await module.getFeeAmount(collateral.address, collateralAmount)).to.be.eq(expected_amount)

        });

        it(' should return the correct amount - 3', async () => {

            const collateralAmount = ethers.utils.parseEther('0.001275')
            const collateral = token2

            const feePrice = await oracle.getAssetPrice(gho.address)
            const collateralPrice = await oracle.getAssetPrice(collateral.address)

            const expected_amount = collateralAmount.mul(collateralPrice).div(feePrice)

            expect(await module.getFeeAmount(collateral.address, collateralAmount)).to.be.eq(expected_amount)

        });

        it(' should return the correct amount - 4 - decimals difference', async () => {

            const collateralAmount = BigNumber.from('1500000000')
            const collateral = token3

            const feePrice = await oracle.getAssetPrice(gho.address)
            const collateralPrice = await oracle.getAssetPrice(collateral.address)

            const expected_amount = collateralAmount.mul(collateralPrice).mul(10**12).div(feePrice)

            expect(await module.getFeeAmount(collateral.address, collateralAmount)).to.be.eq(expected_amount)

        });

    });

});