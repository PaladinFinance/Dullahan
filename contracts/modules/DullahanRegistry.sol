//██████╗  █████╗ ██╗      █████╗ ██████╗ ██╗███╗   ██╗
//██╔══██╗██╔══██╗██║     ██╔══██╗██╔══██╗██║████╗  ██║
//██████╔╝███████║██║     ███████║██║  ██║██║██╔██╗ ██║
//██╔═══╝ ██╔══██║██║     ██╔══██║██║  ██║██║██║╚██╗██║
//██║     ██║  ██║███████╗██║  ██║██████╔╝██║██║ ╚████║
//╚═╝     ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝ ╚═╝╚═╝  ╚═══╝


pragma solidity 0.8.16;
//SPDX-License-Identifier: MIT

import "../utils/Owner.sol";
import {Errors} from "../utils/Errors.sol";

/** @title Dullahan Registry contract
 *  @author Paladin
 *  @notice Registry, for all Aave related addresses & some Dullahan addresses
 */
contract DullahanRegistry is Owner {

    // Storage

    address public immutable STK_AAVE;
    address public immutable AAVE;

    address public immutable GHO;
    address public immutable DEBT_GHO;

    address public immutable AAVE_POOL_V3;

    address public immutable AAVE_REWARD_COONTROLLER;

    address public dullahanVault;

    address[] public dullahanPodManagers;

    // Events

    event SetVault(address indexed vault);
    event AddPodManager(address indexed newManager);


    // Constructor
    constructor(
        address _aave,
        address _stkAave,
        address _gho,
        address _ghoDebt,
        address _aavePool,
        address _aaveRewardController
    ) {
        if(
            _aave == address(0)
            || _stkAave == address(0)
            || _gho == address(0)
            || _ghoDebt == address(0)
            || _aavePool == address(0)
            || _aaveRewardController == address(0)
        ) revert Errors.AddressZero();

        STK_AAVE = _stkAave;
        AAVE = _aave;

        GHO = _gho;
        DEBT_GHO = _ghoDebt;

        AAVE_POOL_V3 = _aavePool;

        AAVE_REWARD_COONTROLLER = _aaveRewardController;
    }

    function setVault(address vault) external onlyOwner {
        if(vault == address(0)) revert Errors.AddressZero();
        if(dullahanVault != address(0)) revert Errors.VaultAlreadySet();

        dullahanVault = vault;

        emit SetVault(vault);
    }

    function addPodManager(address manager) external onlyOwner {
        if(manager == address(0)) revert Errors.AddressZero();

        address[] memory _managers = dullahanPodManagers;
        uint256 length = _managers.length;
        for(uint256 i; i < length;){
            if(_managers[i] == manager) revert Errors.AlreadyListedManager();
            unchecked { ++i; }
        }

        dullahanPodManagers.push(manager);

        emit AddPodManager(manager);
    }

    function getPodManagers() external view returns(address[] memory) {
        return dullahanPodManagers;
    }

}