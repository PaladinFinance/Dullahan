//██████╗  █████╗ ██╗      █████╗ ██████╗ ██╗███╗   ██╗
//██╔══██╗██╔══██╗██║     ██╔══██╗██╔══██╗██║████╗  ██║
//██████╔╝███████║██║     ███████║██║  ██║██║██╔██╗ ██║
//██╔═══╝ ██╔══██║██║     ██╔══██║██║  ██║██║██║╚██╗██║
//██║     ██║  ██║███████╗██║  ██║██████╔╝██║██║ ╚████║
//╚═╝     ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝ ╚═╝╚═╝  ╚═══╝


pragma solidity 0.8.16;
//SPDX-License-Identifier: MIT

import "../DullahanVault.sol";
import "../DullahanRewardsStaking.sol";
import "../interfaces/IStakedAave.sol";
import "../utils/Owner.sol";
import "../oz/utils/ReentrancyGuard.sol";
import "../oz/utils/Pausable.sol";
import "../oz/interfaces/IERC20.sol";
import "../oz/libraries/SafeERC20.sol";
import {Errors} from "../utils/Errors.sol";

/** @title Dullahan Zap Deposit contract
 *  @author Paladin
 *  @notice Contract to zap deposit in the Vault & stake in the Staking module
 */
contract DullahanZapDeposit is Owner, Pausable {
    using SafeERC20 for IERC20;

    // Storage

    address public immutable aave;
    address public immutable stkAave;

    address public immutable vault;
    address public immutable staking;


    // Events

    event ZapDeposit(address indexed caller, address indexed receiver, address indexed sourceToken, uint256 amount, bool staked);

    event TokenRecovered(address indexed token, uint256 amount);


    // Constructor

    constructor(
        address _aave,
        address _stkAave,
        address _vault,
        address _staking
    ) {
        if(_aave == address(0) || _stkAave == address(0) || _vault == address(0) || _staking == address(0)) revert Errors.AddressZero();

        aave = _aave;
        stkAave = _stkAave;

        vault = _vault;
        staking = _staking;
    }


    // User functions

    function zapDeposit(address sourceToken, uint256 amount, address receiver, bool stake) external whenNotPaused {
        if(sourceToken == address(0) || receiver == address(0)) revert Errors.AddressZero();
        if(amount == 0) revert Errors.NullAmount();
        if(sourceToken != aave && sourceToken != stkAave) revert Errors.InvalidSourceToken();

        // Pull the tokens from the caller
        IERC20(sourceToken).safeTransferFrom(msg.sender, address(this), amount);

        // If the source tokens is AAVE, stake them into stkAAVE
        if(sourceToken == aave) {
            IERC20(aave).safeIncreaseAllowance(stkAave, amount);
            IStakedAave(stkAave).stake(address(this), amount);
        }

        IERC20(stkAave).safeIncreaseAllowance(vault, amount);

        if(stake) {
            // If the caller desires to stake their tokens, deposit the stkAAVE in the Vault
            // & stake them on behalf of the given receiver
            uint256 shares = DullahanVault(vault).deposit(amount, address(this));
            if(shares != amount) revert Errors.DepositFailed();

            IERC20(vault).safeIncreaseAllowance(staking, amount);
            DullahanRewardsStaking(staking).stake(amount, receiver);
        } else {
            // If the caller does not desire to stake their tokens, deposit
            // the stkAAVE in the Vault on behalf of the given receiver address directly
            uint256 shares = DullahanVault(vault).deposit(amount, receiver);
            if(shares != amount) revert Errors.DepositFailed();
        }

        emit ZapDeposit(msg.sender, receiver, sourceToken, amount, stake);
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