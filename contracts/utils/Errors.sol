pragma solidity 0.8.16;
//SPDX-License-Identifier: MIT

library Errors {

    // Common Errors
    error AddressZero();
    error NullAmount();
    error IncorrectRewardToken();
    error SameAddress();
    error InequalArraySizes();
    error EmptyArray();
    error EmptyParameters();
    error NotInitialized();
    error AlreadyInitialized();
    error InvalidParameter();
    error CannotRecoverToken();
    error NullWithdraw();

    // Access Control Erros
    error CallerNotAdmin();
    error CannotBeAdmin();
    error CallerNotPendingAdmin();
    error CallerNotAllowed();

    // ERC20 Errors
    error ERC20_ApproveAddressZero();
    error ERC20_AllowanceUnderflow();
    error ERC20_AmountOverAllowance();
    error ERC20_AddressZero();
    error ERC20_SelfTransfer();
    error ERC20_NullAmount();
    error ERC20_AmountExceedBalance();

    // Maths Errors
    error NumberExceed128Bits();

    // Vault Errors
    error ManagerAlreadyListed();
    error ManagerNotListed();
    error NotEnoughAvailableFunds();
    error WithdrawBuffer();
    error ReserveTooLow();

    // Vaults Rewards Errors
    error NullScaledAmount();
    error AlreadyListedDepositor();
    error NotListedDepositor();
    error ClaimNotAllowed();
    
}