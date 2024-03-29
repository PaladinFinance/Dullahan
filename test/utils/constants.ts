import { ethers } from "hardhat";
import { BigNumber } from "ethers";

export const AAVE = "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9";
export const STK_AAVE = "0x4da27a545c0c5B758a6BA100e3a049001de870f5";

export const HOLDER_AAVE = "0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8";
export const AMOUNT_AAVE = ethers.utils.parseEther('585000')

export const REWARD_TOKEN_1 = "0x6B175474E89094C44Da98b954EedeAC495271d0F"; //here : DAI
export const REWARD_TOKEN_2 = "0xAB846Fb6C81370327e784Ae7CbB6d6a6af6Ff4BF"; //here : PAL

export const HOLDER_REWARD_1 = "0x075e72a5eDf65F0A5f44699c7654C1a76941Ddc8";
export const AMOUNT_REWARD_1 = ethers.utils.parseEther('150000000')
export const HOLDER_REWARD_2 = "0x1Ae6DCBc88d6f81A7BCFcCC7198397D776F3592E";
export const AMOUNT_REWARD_2 = ethers.utils.parseEther('2500000')

export const GHO = "0x40D16FC0246aD3160Ccc09B8D0D3A2cD28aE6C2f"

//export const aGHO = ""
export const DEBT_GHO = "0x786dBff3f1292ae8F92ea68Cf93c30b34B1ed04B"

export const AAVE_POOL = "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2" // V3

export const AAVE_REWARD_CONTROLLER = "0x8164Cc65827dcFe994AB23944CBC90e0aa80bFcb"

export const ORACLE_ADDRESS = "0x54586bE62E3c3580375aE3723C145253060Ca0C2"

export const TEST_TOKEN_1 = "0x6B175474E89094C44Da98b954EedeAC495271d0F"; //here : DAI
export const TEST_TOKEN_2 = "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9"; //here : AAVE
export const TEST_TOKEN_3 = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"; //here : USDC

export const A_TOKEN_1 = "0x018008bfb33d285247A21d44E50697654f754e63"; //here : aDAI
export const A_TOKEN_2 = "0xA700b4eB416Be35b2911fd5Dee80678ff64fF6C9"; //here : aAAVE
export const A_TOKEN_3 = "0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c"; //here : aUSDC
