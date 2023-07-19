pragma solidity 0.8.16;
//SPDX-License-Identifier: MIT

import "../oz/interfaces/IERC20.sol";
import "../oz/libraries/SafeERC20.sol";
import "../modules/DullahanRegistry.sol";
import "../interfaces/IStakedAave.sol";
import "../interfaces/IDullahanPodManager.sol";
import "../interfaces/IAavePool.sol";

contract MockPod {
    using SafeERC20 for IERC20;

    bool public initialized;

    address public manager;
    address public vault;
    address public registry;

    address public podOwner;

    address public votingPowerDelegate;
    address public proposalPowerDelegate;

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
        address _votingPowerDelegate,
        address _proposalPowerDelegate
    ) external {
        initialized = true;
        
        manager = _manager;
        vault = _vault;
        registry = _registry;
        podOwner = _podOwner;
        collateral = _collateral;
        votingPowerDelegate = _votingPowerDelegate;
        proposalPowerDelegate = _proposalPowerDelegate;

        aToken = _aToken;

        address _stkAave = DullahanRegistry(_registry).STK_AAVE();
        stkAave = _stkAave;
        aave = DullahanRegistry(registry).AAVE();

        IERC20(_stkAave).safeIncreaseAllowance(_vault, type(uint256).max);
    }

    function depositCollateral(uint256 amount) external {

        IERC20 _collateral = IERC20(collateral);
        // Pull the collateral from the Pod Owner
        _collateral.safeTransferFrom(msg.sender, address(this), amount);

        // And deposit it in the Aave Pool
        address _aavePool = DullahanRegistry(registry).AAVE_POOL_V3();
        _collateral.safeIncreaseAllowance(_aavePool, amount);
        IAavePool(_aavePool).supply(collateral, amount, address(this), 0);
    }

    function getStkAave(uint256 amountToMint) external {
        IDullahanPodManager(manager).getStkAave(amountToMint);

        address _ghoAddress = DullahanRegistry(registry).GHO();
        IAavePool(DullahanRegistry(registry).AAVE_POOL_V3()).borrow(_ghoAddress, amountToMint, 2, 0, address(this));
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

        IAavePool(DullahanRegistry(registry).AAVE_POOL_V3()).withdraw(collateral, amount, address(this));

        if(amount == type(uint256).max) {
            amount = IERC20(collateral).balanceOf(address(this));
        }

        IERC20(collateral).transfer(receiver, amount);
    }

    function updateDelegation(address newVotingDelegate, address newProposalDelegate) external {
        votingPowerDelegate = newVotingDelegate;
        proposalPowerDelegate = newProposalDelegate;
    }

    function updateRegistry(address newRegistry) external {
        registry = newRegistry;
    }

    function payFee(uint256 amount) external {
        IDullahanPodManager(manager).notifyPayFee(amount);
    }

    function payMintFee(uint256 amount) external {
        IDullahanPodManager(manager).notifyMintingFee(amount);
    }

    function pullCollateral(uint256 amount) external {
        IERC20(collateral).transfer(msg.sender, amount);
    }

}