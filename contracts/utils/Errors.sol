pragma solidity 0.8.16;
//SPDX-License-Identifier: MIT

library Errors {

    // Common Errors
    error ZeroAddress();
    error NullAmount();
    error IncorrectRewardToken();
    error SameAddress();
    error InequalArraySizes();
    error EmptyArray();
    error EmptyParameters();
    error AlreadyInitialized();
    error InvalidParameter();
    error CannotRecoverToken();
    error NullWithdraw();

    // Access Control Erros
    error CallerNotAdmin();
    error CannotBeAdmin();
    error CallerNotPendingAdmin();
    error CallerNotAllowed();

    // ERC20
    error ERC20_ApproveZeroAddress();
    error ERC20_AllowanceUnderflow();
    error ERC20_AmountOverAllowance();
    error ERC20_AddressZero();
    error ERC20_SelfTransfer();
    error ERC20_NullAmount();
    error ERC20_AmountExceedBalance();

    // Maths
    error NumberExceed128Bits();
    
}