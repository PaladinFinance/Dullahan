//██████╗  █████╗ ██╗      █████╗ ██████╗ ██╗███╗   ██╗
//██╔══██╗██╔══██╗██║     ██╔══██╗██╔══██╗██║████╗  ██║
//██████╔╝███████║██║     ███████║██║  ██║██║██╔██╗ ██║
//██╔═══╝ ██╔══██║██║     ██╔══██║██║  ██║██║██║╚██╗██║
//██║     ██║  ██║███████╗██║  ██║██████╔╝██║██║ ╚████║
//╚═╝     ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝ ╚═╝╚═╝  ╚═══╝


pragma solidity 0.8.16;
//SPDX-License-Identifier: BUSL-1.1

import "../DullahanVault.sol";
import "../DullahanRewardsStaking.sol";
import "../interfaces/IStakedAave.sol";
import "../interfaces/IPalPool.sol";
import "../utils/Owner.sol";
import "../oz/utils/ReentrancyGuard.sol";
import "../oz/utils/Pausable.sol";
import "../oz/interfaces/IERC20.sol";
import "../oz/libraries/SafeERC20.sol";
import {Errors} from "../utils/Errors.sol";

/** @title Dullahan Migrator contract
 *  @author Paladin
 *  @notice Contract to withdraw from palStkAAVE Pool into Dullahan
 */
contract DullahanMigrator is Owner, Pausable {
    using SafeERC20 for IERC20;

    // Storage

    /** @notice Address of the stkAAVE token */
    address public immutable stkAave;
    /** @notice Address of the palStkAave token */
    address public immutable palStkAave;
    /** @notice Address of the palStkAave PalPool */
    address public immutable palPool;

    /** @notice Address of the Dullahan Vault */
    address public immutable vault;
    /** @notice Address of the Dullahan Staking */
    address public immutable staking;


    // Events

    /** @notice Event emitted when a Migration id performed */
    event Migrate(address indexed caller, address indexed receiver, uint256 amount, uint256 stkAave, bool staked);

    /** @notice Event emitted when an ERC20 token is recovered from this contract */
    event TokenRecovered(address indexed token, uint256 amount);


    // Constructor

    constructor(
        address _stkAave,
        address _palStkAave,
        address _palPool,
        address _vault,
        address _staking
    ) {
        if(_palStkAave == address(0) || _palPool == address(0) || _stkAave == address(0) || _vault == address(0) || _staking == address(0)) revert Errors.AddressZero();

        stkAave = _stkAave;
        palStkAave = _palStkAave;
        palPool = _palPool;

        vault = _vault;
        staking = _staking;
    }


    // User functions

    /**
    * @notice Withdraw palStkAAVE & deposit into the Vault & stake them
    * @dev Withdraw palStkAAVE, deposit in the Vault, and stake if flag was given
    * @param amount Amount of palStkAave
    * @param receiver Address to receive the share token / to be staked on behalf of
    * @param stake Flag to stake the received shares
    */
    function migrate(uint256 amount, address receiver, bool stake) external whenNotPaused {
        if(receiver == address(0)) revert Errors.AddressZero();
        if(amount == 0) revert Errors.NullAmount();

        // Pull the tokens from the caller
        IERC20(palStkAave).safeTransferFrom(msg.sender, address(this), amount);

        // Withdraw stkAave from the PalPool
        uint256 stkAaveAmount = IPalPool(palPool).withdraw(amount);


        IERC20(stkAave).safeIncreaseAllowance(vault, stkAaveAmount);

        if(stake) {
            // If the caller desires to stake their tokens, deposit the stkAAVE in the Vault
            // & stake them on behalf of the given receiver
            uint256 shares = DullahanVault(vault).deposit(stkAaveAmount, address(this));
            if(shares != stkAaveAmount) revert Errors.DepositFailed();

            IERC20(vault).safeIncreaseAllowance(staking, stkAaveAmount);
            DullahanRewardsStaking(staking).stake(stkAaveAmount, receiver);
        } else {
            // If the caller does not desire to stake their tokens, deposit
            // the stkAAVE in the Vault on behalf of the given receiver address directly
            uint256 shares = DullahanVault(vault).deposit(stkAaveAmount, receiver);
            if(shares != stkAaveAmount) revert Errors.DepositFailed();
        }

        emit Migrate(msg.sender, receiver, amount, stkAaveAmount, stake);
    }


    // Admin functions
    
    /**
     * @notice Pause the contract
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause the contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
    * @notice Recover ERC2O tokens in the contract
    * @dev Recover ERC2O tokens in the contract
    * @param token Address of the ERC2O token
    * @return bool: success
    */
    function recoverERC20(address token) external onlyOwner returns(bool) {
        uint256 amount = IERC20(token).balanceOf(address(this));
        if(amount == 0) revert Errors.NullAmount();
        IERC20(token).safeTransfer(msg.sender, amount);

        emit TokenRecovered(token, amount);

        return true;
    }

}