import { ethers } from "hardhat";
import { BigNumber } from "ethers";

export const AAVE = "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9";
export const STK_AAVE = "0x4da27a545c0c5B758a6BA100e3a049001de870f5";

export const HOLDER_AAVE = "0xF977814e90dA44bFA03b6295A0616a897441aceC";
export const AMOUNT_AAVE = ethers.utils.parseEther('650000')

export const REWARD_TOKEN_1 = "0x6B175474E89094C44Da98b954EedeAC495271d0F"; //here : DAI
export const REWARD_TOKEN_2 = "0xAB846Fb6C81370327e784Ae7CbB6d6a6af6Ff4BF"; //here : PAL

export const HOLDER_REWARD_1 = "0x075e72a5eDf65F0A5f44699c7654C1a76941Ddc8";
export const AMOUNT_REWARD_1 = ethers.utils.parseEther('250000000')
export const HOLDER_REWARD_2 = "0x1Ae6DCBc88d6f81A7BCFcCC7198397D776F3592E";
export const AMOUNT_REWARD_2 = ethers.utils.parseEther('2500000')
