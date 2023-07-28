//██████╗  █████╗ ██╗      █████╗ ██████╗ ██╗███╗   ██╗
//██╔══██╗██╔══██╗██║     ██╔══██╗██╔══██╗██║████╗  ██║
//██████╔╝███████║██║     ███████║██║  ██║██║██╔██╗ ██║
//██╔═══╝ ██╔══██║██║     ██╔══██║██║  ██║██║██║╚██╗██║
//██║     ██║  ██║███████╗██║  ██║██████╔╝██║██║ ╚████║
//╚═╝     ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝ ╚═╝╚═╝  ╚═══╝


pragma solidity 0.8.16;
//SPDX-License-Identifier: BUSL-1.1

import "./interfaces/IScalingERC20.sol";
import "./oz/interfaces/IERC20.sol";
import "./oz/ERC20.sol";
import "./oz/libraries/SafeERC20.sol";
import "./oz/utils/ReentrancyGuard.sol";
import {Errors} from "./utils/Errors.sol";
import {WadRayMath} from  "./utils/WadRayMath.sol";

/** @title WrappedVaultToken contract
 *  @author Paladin
 *  @notice Wrapped versino fo the ScalingeRC20 from the Dullahan Vault,
 *          to be used for AMM & cie
 */
contract WrappedVaultToken is ERC20, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using WadRayMath for uint256;


    // Constants

    /** @notice 1e27 - RAY - Initial Index for balance to scaled balance */
    uint256 private constant INITIAL_INDEX = 1e27;


    // Storage

    /** @notice Address of the Dullahan Vault */
    address public immutable vault;


    // Events

    event Wrapped(address indexed user, uint256 dstkAaveAmount, uint256 wdstkAaveAmount);
    event Unwrapped(address indexed user, uint256 dstkAaveAmount, uint256 wdstkAaveAmount);


    // Constructor

    constructor(
        address _vault,
        string memory _name,
        string memory _symbol
    ) ERC20(_name, _symbol) {
        if(_vault == address(0)) revert Errors.AddressZero();

        vault = _vault;
    }


    // View functions

    /**
    * @notice Get the current index to convert between dstkAave & wdstkAave
    * @return uint256 : Current index
    */
    function getCurrentIndex() external view returns(uint256) {
        return _getCurrentIndex();
    }

    /**
    * @notice Convert a dstkAave amount into wdstkAave
    * @param dstkAaveAmount : Amount of dstkAave to convert
    * @return wdstkAaveAmount : Converted amount
    */
    function convertToWdstkAave(uint256 dstkAaveAmount) public view returns(uint256 wdstkAaveAmount) {
        wdstkAaveAmount = dstkAaveAmount.rayDiv(_getCurrentIndex());
    }

    /**
    * @notice Convert a wdstkAave amount into dstkAave
    * @param wdstkAaveAmount : Amount of wdstkAave to convert
    * @return dstkAaveAmount : Converted amount
    */
    function convertToDstkAave(uint256 wdstkAaveAmount) public view returns(uint256 dstkAaveAmount) {
        dstkAaveAmount = wdstkAaveAmount.rayMul(_getCurrentIndex());
    }


    // State-changing functions

    /**
    * @notice Wrap dstkAave into wdstkAave
    * @param dstkAaveAmount : Amount of dstkAave to wrap
    * @return wdstkAaveAmount : Wrapped amount
    */
    function wrap(uint256 dstkAaveAmount) external nonReentrant returns(uint256 wdstkAaveAmount) {
        if(dstkAaveAmount == 0) revert Errors.NullAmount();
        wdstkAaveAmount = convertToWdstkAave(dstkAaveAmount);
        if(wdstkAaveAmount == 0) revert Errors.NullConvertedAmount();

        IERC20(vault).safeTransferFrom(msg.sender, address(this), dstkAaveAmount);

        _mint(msg.sender, wdstkAaveAmount);

        emit Wrapped(msg.sender, dstkAaveAmount, wdstkAaveAmount);
    }

    /**
    * @notice Unwrap wdstkAave into dstkAave
    * @param wdstkAaveAmount : Amount of wdstkAave to unwrap
    * @return dstkAaveAmount : Unwrapped amount
    */
    function unwrap(uint256 wdstkAaveAmount) external nonReentrant returns(uint256 dstkAaveAmount) {
        if(wdstkAaveAmount == 0) revert Errors.NullAmount();
        dstkAaveAmount = convertToDstkAave(wdstkAaveAmount);
        if(dstkAaveAmount == 0) revert Errors.NullConvertedAmount();

        _burn(msg.sender, wdstkAaveAmount);

        IERC20(vault).safeTransfer(msg.sender, dstkAaveAmount);

        emit Unwrapped(msg.sender, dstkAaveAmount, wdstkAaveAmount);
    }


    // Internal functions

    /**
    * @dev Get the current index to convert between dstkAave & wdstkAave
    * @return uint256 : Current index
    */
    function _getCurrentIndex() internal view returns(uint256) {
        uint256 _totalSupply = totalSupply();
        if(_totalSupply == 0) return INITIAL_INDEX;
        return IScalingERC20(vault).balanceOf(address(this)).rayDiv(_totalSupply);
    }

}