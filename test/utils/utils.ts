const hre = require("hardhat");
import { ethers } from "hardhat";
import { BigNumber, Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { IERC20__factory } from "../../typechain/factories/oz/interfaces/IERC20__factory";
import { IStakedAave__factory } from "../../typechain/factories/interfaces/IStakedAave__factory";

const { provider } = ethers;

import { 
    AAVE,
    STK_AAVE,
    HOLDER_AAVE,
    AMOUNT_AAVE
} from "./constants"


require("dotenv").config();

export async function resetFork() {
    await hre.network.provider.request({
        method: "hardhat_reset",
        params: [
          {
            forking: {
                jsonRpcUrl: "https://eth-mainnet.alchemyapi.io/v2/" + (process.env.ALCHEMY_API_KEY || ''),
                blockNumber: 16076533
            },
          },
        ],
    });

}

export async function resetForkGoerli() {
    await hre.network.provider.request({
        method: "hardhat_reset",
        params: [
          {
            forking: {
                jsonRpcUrl: "https://eth-goerli.g.alchemy.com/v2/" + (process.env.ALCHEMY_GOERLI_API_KEY || ''),
                blockNumber: 8463485
            },
          },
        ],
    });

}

export async function getStkAave(
    admin: SignerWithAddress,
    recipient: SignerWithAddress
) {
    const aave = IERC20__factory.connect(AAVE, provider)
    const stkAave = IStakedAave__factory.connect(STK_AAVE, provider)

    await getERC20(
        admin,
        HOLDER_AAVE,
        aave,
        recipient.address,
        AMOUNT_AAVE
    )

    await aave.connect(recipient).approve(STK_AAVE, AMOUNT_AAVE)

    await stkAave.connect(recipient).stake(recipient.address, AMOUNT_AAVE)

}

export async function getTimestamp(
    day: number,
    month: number,
    year: number,
    hours: number = 0,
    minutes: number = 0
) {
    let date = new Date(year, month, day, hours, minutes, 0)
    return Math.floor(date.getTime() / 1000)
}

export async function setBlockTimestamp(
    timestamp: string,
) {
    await hre.network.provider.send("evm_setNextBlockTimestamp", [timestamp])
    await hre.network.provider.send("evm_mine")
}


export async function advanceTime(
    seconds: number
) {
    await hre.network.provider.send("evm_mine")
    await hre.network.provider.send("evm_increaseTime", [seconds])
    await hre.network.provider.send("evm_mine")
}

export async function getERC20(
    admin: SignerWithAddress,
    holder: string,
    erc20_contract: Contract,
    recipient: string,
    amount: BigNumber
) {

    await hre.network.provider.request({
        method: "hardhat_impersonateAccount",
        params: [holder],
    });

    await admin.sendTransaction({
        to: holder,
        value: ethers.utils.parseEther("10"),
    });

    const signer = await ethers.getSigner(holder)

    await erc20_contract.connect(signer).transfer(recipient, amount);

    await hre.network.provider.request({
        method: "hardhat_stopImpersonatingAccount",
        params: [holder],
    });
}

export async function stopAutoMine() {
    await hre.network.provider.send("evm_setAutomine", [false]);
    await hre.network.provider.send("evm_setIntervalMining", [0]);
}

export async function startAutoMine() {
    await hre.network.provider.send("evm_setAutomine", [true]);
}

export async function mineNextBlock() {
    await hre.network.provider.send("evm_mine")
}