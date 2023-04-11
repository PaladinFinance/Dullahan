//██████╗  █████╗ ██╗      █████╗ ██████╗ ██╗███╗   ██╗
//██╔══██╗██╔══██╗██║     ██╔══██╗██╔══██╗██║████╗  ██║
//██████╔╝███████║██║     ███████║██║  ██║██║██╔██╗ ██║
//██╔═══╝ ██╔══██║██║     ██╔══██║██║  ██║██║██║╚██╗██║
//██║     ██║  ██║███████╗██║  ██║██████╔╝██║██║ ╚████║
//╚═╝     ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝ ╚═╝╚═╝  ╚═══╝
 

// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.16;

import "./oz/interfaces/IERC20.sol";
import "./oz/libraries/SafeERC20.sol";
import "./oz/utils/ReentrancyGuard.sol";
import "./utils/Owner.sol";
import "./utils/Errors.sol";

/** @title Paladin Treasure Chest  */
/// @author Paladin
/*
    Contract holding protocol fees from Dullahan contracts
*/

contract DullahanTreasureChest is Owner, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /** @notice Address approved to use methods to manage funds */
    mapping(address => bool) private approvedManagers;

    /** @notice Event emitted when a new manager is added */
    event AddedManager(address indexed manager);
    /** @notice Event emitted when a manager is removed */
    event RemovedManager(address indexed manager);

    /** @notice Check the caller is either the admin or an approved manager */
    modifier onlyAllowed(){
        if(!approvedManagers[msg.sender] && msg.sender != owner()) revert Errors.CallerNotAllowed();
        _;
    }

    /**
    * @notice Returns the balance of this contract for the given ERC20 token
    * @dev Returns the balance of this contract for the given ERC20 token
    * @param token Address of the ERC2O token
    * @return uint256 : current balance in the given ERC20 token
    */
    function currentBalance(address token) external view returns(uint256){
        return IERC20(token).balanceOf(address(this));
    }
   
    /**
    * @notice Increases the allowance of the spender of a given amount for the given ERC20 token
    * @dev Increases the allowance of the spender of a given amount for the given ERC20 token
    * @param token Address of the ERC2O token
    * @param spender Address to approve for spending
    * @param amount Amount to increase
    */
    function increaseAllowanceERC20(address token, address spender, uint256 amount) external onlyAllowed nonReentrant {
        if(amount == 0) revert Errors.NullAmount();
        IERC20(token).safeIncreaseAllowance(spender, amount);
    }

    /**
    * @notice Decreases the allowance of the spender of a given amount for the given ERC20 token
    * @dev Decreases the allowance of the spender of a given amount for the given ERC20 token
    * @param token Address of the ERC2O token
    * @param spender Address to approve for spending
    * @param amount Amount to decrease
    */
    function decreaseAllowanceERC20(address token, address spender, uint256 amount) external onlyAllowed nonReentrant {
        if(amount == 0) revert Errors.NullAmount();
        IERC20(token).safeDecreaseAllowance(spender, amount);
    }
   
    /**
    * @notice Transfers a given amount of ERC20 token to the given recipient
    * @dev Transfers a given amount of ERC20 token to the given recipient
    * @param token Address of the ERC2O token
    * @param recipient Address fo the recipient
    * @param amount Amount to transfer
    */
    function transferERC20(address token, address recipient, uint256 amount) external onlyAllowed nonReentrant {
        if(amount == 0) revert Errors.NullAmount();
        IERC20(token).safeTransfer(recipient, amount);
    }

    // Admin methods
   
    /**
    * @notice Approves a given address to be manager on this contract
    * @dev Approves a given address to be manager on this contract
    * @param newManager Address to approve as manager
    */
    function approveManager(address newManager) external onlyOwner {
        if(approvedManagers[newManager]) revert Errors.AlreadyListedManager();
        approvedManagers[newManager] = true;

        emit AddedManager(newManager);
    }
   
    /**
    * @notice Removes a given address from being manager on this contract
    * @dev Removes a given address from being manager on this contract
    * @param manager Address to remove
    */
    function removeManager(address manager) external onlyOwner {
        if(!approvedManagers[manager]) revert Errors.NotListedManager();
        approvedManagers[manager] = false;

        emit RemovedManager(manager);
    }

}