// SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.16;

import "ds-test/test.sol";
import "forge-std/Vm.sol";
import "forge-std/console.sol";
import {Utils} from "./utils/Utils.sol";

import {DullahanVault} from "../../contracts/DullahanVault.sol";
import {IERC20} from "../../contracts/oz/interfaces/IERC20.sol";
import {IStakedAave} from "../../contracts/interfaces/IStakedAave.sol";

contract DullahanVaultTest is DSTest {
    Vm internal immutable vm = Vm(HEVM_ADDRESS);

    Utils internal utils;

    address payable[] internal users;

    DullahanVault internal vault;

    uint256 internal maxAmount = 500 ether;

    address internal AAVE = 0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9;
    address internal STK_AAVE = 0x4da27a545c0c5B758a6BA100e3a049001de870f5;

    function setUp() public {
        utils = new Utils();
        users = utils.createUsers(2);

        // Vault constructor parameters
        uint256 reserveRatio = 100;
        uint256 seedDeposit = 0.001 ether;

        // Tokens stealing setup
        address holder = 0xF977814e90dA44bFA03b6295A0616a897441aceC;
        uint256 stealAmount = 500_000 ether;
        utils.stealTokens(AAVE, holder, address(this), stealAmount);
        IERC20(AAVE).approve(STK_AAVE, stealAmount);
        IStakedAave(STK_AAVE).stake(address(this), stealAmount);

        // deploy instance & init
        vault = new DullahanVault(
            address(this),
            reserveRatio,
            address(this),
            AAVE,
            STK_AAVE,
            "Dullahan stkAave",
            "dstkAAVE"
        );
        IERC20(STK_AAVE).approve(address(vault), seedDeposit);
        vault.init(address(this));
    }

    function testDeposit(uint72 amount) public {
        vm.assume(amount <= maxAmount);

        address payable depositor = users[0];

        IERC20(STK_AAVE).transfer(depositor, maxAmount);

        uint256 previousDepositorBalance = vault.balanceOf(depositor);
        uint256 previousDepositorScaledBalance = vault.scaledBalanceOf(depositor);
        uint256 previousTotalSupply = vault.totalSupply();

        vm.prank(depositor);
        IERC20(STK_AAVE).approve(address(vault), amount);

        if(amount == 0){
            vm.expectRevert(
                bytes4(keccak256(bytes("NullAmount()")))
            );
            vm.prank(depositor);
            vault.deposit(amount, depositor);

            uint256 newDepositorBalance = vault.balanceOf(depositor);
            uint256 newDepositorScaledBalance = vault.scaledBalanceOf(depositor);
            uint256 newTotalSupply = vault.totalSupply();

            assertEq(newDepositorBalance, previousDepositorBalance);
            assertEq(newDepositorScaledBalance, previousDepositorScaledBalance);
            assertEq(newTotalSupply, previousTotalSupply);
        }
        else{
            vm.prank(depositor);
            uint256 sharesAmount = vault.deposit(amount, depositor);

            assertEq(sharesAmount, amount);

            uint256 newDepositorBalance = vault.balanceOf(depositor);
            uint256 newTotalSupply = vault.totalSupply();

            assertEq(newDepositorBalance, previousDepositorBalance + amount);
            assertEq(newTotalSupply, previousTotalSupply + amount);

        }
    }

    function testWithdraw(uint72 amount) public {
        vm.assume(amount <= maxAmount);

        address payable depositor = users[0];

        IERC20(STK_AAVE).transfer(depositor, maxAmount);

        vm.prank(depositor);
        IERC20(STK_AAVE).approve(address(vault), maxAmount);

        vm.prank(depositor);
        vault.deposit(maxAmount, depositor);

        uint256 previousDepositorBalance = vault.balanceOf(depositor);
        uint256 previousDepositorScaledBalance = vault.scaledBalanceOf(depositor);
        uint256 previousTotalSupply = vault.totalSupply();

        if(amount == 0){
            vm.expectRevert(
                bytes4(keccak256(bytes("NullAmount()")))
            );
            vm.prank(depositor);
            vault.withdraw(amount, depositor, depositor);

            uint256 newDepositorBalance = vault.balanceOf(depositor);
            uint256 newDepositorScaledBalance = vault.scaledBalanceOf(depositor);
            uint256 newTotalSupply = vault.totalSupply();

            assertEq(newDepositorBalance, previousDepositorBalance);
            assertEq(newDepositorScaledBalance, previousDepositorScaledBalance);
            assertEq(newTotalSupply, previousTotalSupply);
        }
        else{
            vm.prank(depositor);
            uint256 sharesAmount = vault.withdraw(amount, depositor, depositor);

            assertEq(sharesAmount, amount);

            uint256 newDepositorBalance = vault.balanceOf(depositor);
            uint256 newTotalSupply = vault.totalSupply();

            assertEq(newDepositorBalance, previousDepositorBalance - amount);
            assertEq(newTotalSupply, previousTotalSupply - amount);

        }
    }

    function testTransfer(uint72 amount) public {
        address payable depositor = users[0];
        address payable receiver = users[1];

        IERC20(STK_AAVE).transfer(depositor, maxAmount);

        vm.prank(depositor);
        IERC20(STK_AAVE).approve(address(vault), maxAmount);

        vm.prank(depositor);
        vault.deposit(maxAmount, depositor);

        uint256 previousDepositorBalance = vault.balanceOf(depositor);
        uint256 previousReceiverBalance = vault.balanceOf(receiver);
        uint256 previousDepositorScaledBalance = vault.scaledBalanceOf(depositor);
        uint256 previousReceiverScaledBalance = vault.scaledBalanceOf(receiver);
        uint256 previousTotalSupply = vault.totalSupply();

        if(amount == 0){
            vm.expectRevert(
                bytes4(keccak256(bytes("ERC20_NullAmount()")))
            );
            vm.prank(depositor);
            vault.transfer(receiver, amount);

            uint256 newDepositorBalance = vault.balanceOf(depositor);
            uint256 newReceiverBalance = vault.balanceOf(receiver);
            uint256 newDepositorScaledBalance = vault.scaledBalanceOf(depositor);
            uint256 newReceiverScaledBalance = vault.scaledBalanceOf(receiver);
            uint256 newTotalSupply = vault.totalSupply();

            assertEq(newDepositorBalance, previousDepositorBalance);
            assertEq(newDepositorScaledBalance, previousDepositorScaledBalance);
            assertEq(newReceiverBalance, previousReceiverBalance);
            assertEq(newReceiverScaledBalance, previousReceiverScaledBalance);
            assertEq(newTotalSupply, previousTotalSupply);
        }
        else if(amount > maxAmount){
            vm.expectRevert(
                bytes4(keccak256(bytes("ERC20_AmountExceedBalance()")))
            );
            vm.prank(depositor);
            vault.transfer(receiver, amount);

            uint256 newDepositorBalance = vault.balanceOf(depositor);
            uint256 newReceiverBalance = vault.balanceOf(receiver);
            uint256 newDepositorScaledBalance = vault.scaledBalanceOf(depositor);
            uint256 newReceiverScaledBalance = vault.scaledBalanceOf(receiver);
            uint256 newTotalSupply = vault.totalSupply();

            assertEq(newDepositorBalance, previousDepositorBalance);
            assertEq(newDepositorScaledBalance, previousDepositorScaledBalance);
            assertEq(newReceiverBalance, previousReceiverBalance);
            assertEq(newReceiverScaledBalance, previousReceiverScaledBalance);
            assertEq(newTotalSupply, previousTotalSupply);
        }
        else{
            vm.prank(depositor);
            vault.transfer(receiver, amount);

            uint256 newDepositorBalance = vault.balanceOf(depositor);
            uint256 newReceiverBalance = vault.balanceOf(receiver);
            uint256 newTotalSupply = vault.totalSupply();

            assertEq(newDepositorBalance, previousDepositorBalance - amount);
            assertEq(newReceiverBalance, previousReceiverBalance + amount);
            assertEq(newTotalSupply, previousTotalSupply);

        }
    }

}