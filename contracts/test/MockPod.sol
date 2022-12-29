pragma solidity 0.8.16;
//SPDX-License-Identifier: MIT

import "../oz/interfaces/IERC20.sol";
import "../oz/libraries/SafeERC20.sol";
import "../modules/DullahanRegistry.sol";
import "../interfaces/IStakedAave.sol";
import "../interfaces/IDullahanPodManager.sol";

contract MockPod {
    using SafeERC20 for IERC20;

    bool public initialized;

    address public manager;
    address public vault;
    address public registry;

    address public podOwner;

    address public delegate;

    address public collateral;
    address public aToken;

    address public aave;
    address public stkAave;

    function init(
        address _manager,
        address _vault,
        address _registry,
        address _podOwner,
        address _collateral,
        address _aToken,
        address _delegate
    ) external {
        initialized = true;
        
        manager = _manager;
        vault = _vault;
        registry = _registry;
        podOwner = _podOwner;
        collateral = _collateral;
        delegate = _delegate;

        aToken = _aToken;

        address _stkAave = DullahanRegistry(_registry).STK_AAVE();
        stkAave = _stkAave;
        aave = DullahanRegistry(registry).AAVE();
    }

    function compoundStkAave() external {
        IStakedAave _stkAave = IStakedAave(stkAave);

        //Get pending rewards amount
        uint256 pendingRewards = _stkAave.getTotalRewardsBalance(address(this));

        if (pendingRewards > 0) {
            //claim the AAVE tokens
            _stkAave.claimRewards(address(this), pendingRewards);
        }

        IERC20 _aave = IERC20(aave);
        uint256 currentBalance = _aave.balanceOf(address(this));
        
        if(currentBalance > 0) {
            _aave.safeIncreaseAllowance(address(_stkAave), currentBalance);
            _stkAave.stake(address(this), currentBalance);

            IDullahanPodManager(manager).notifyStkAaveClaim(currentBalance);
        }
    }

    function liquidateCollateral(uint256 amount, address receiver) external {
        if(amount == 0) return;

        if(amount == type(uint256).max) {
            amount = IERC20(collateral).balanceOf(address(this));
        }

        IERC20(collateral).transfer(receiver, amount);
    }

    function updateDelegation(address newDelegate) external {
        delegate = newDelegate;
    }

    function updateRegistry(address newRegistry) external {
        registry = newRegistry;
    }

}