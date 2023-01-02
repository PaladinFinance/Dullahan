pragma solidity 0.8.16;
//SPDX-License-Identifier: MIT

import "../oz/interfaces/IERC20.sol";
import "../oz/utils/Context.sol";
import {Errors} from  "../utils/Errors.sol";
import {WadRayMath} from  "../utils/WadRayMath.sol";

/** @title ScalingERC20 contract
 *  @author Paladin, inspired by Aave & OpenZeppelin implementations
 *  @notice ERC20 implementation of scaled balance token
*/
abstract contract ScalingERC20 is Context, IERC20 {
    using WadRayMath for uint256;

    // Constants

    /** @notice 1e18 scale */
    uint256 public constant UNIT = 1e18;

    /** @notice 1e18 Initial Index for balance to scaled balance */
    uint256 internal constant INITIAL_INDEX = 1e27;

    // Structs

    struct UserState {
        uint128 scaledBalance;
        uint128 index;
    }

    // Storage

    uint256 internal _totalSupply;

    mapping(address => mapping(address => uint256)) internal _allowances;

    string private _name;
    string private _symbol;
    uint8 private _decimals;

    mapping(address => UserState) internal _userStates;


    // Events

    event Mint(address indexed user, uint256 scaledAmount, uint256 index);
    event Burn(address indexed user, uint256 scaledAmount, uint256 index);


    // Constructor

    constructor(
        string memory __name,
        string memory __symbol
    ) {
        _name = __name;
        _symbol = __symbol;
        _decimals = 18;
    }


    // View methods

    function name() public view returns (string memory) {
        return _name;
    }

    function symbol() external view returns (string memory) {
        return _symbol;
    }

    function decimals() external view returns (uint8) {
        return _decimals;
    }

    function totalSupply() public view override virtual returns (uint256) {
        uint256 _scaledSupply = _totalSupply;
        if(_scaledSupply == 0) return 0;
        return _scaledSupply.rayMul(_getCurrentIndex());
    }

    function balanceOf(address account) public view override virtual returns (uint256) {
        return uint256(_userStates[account].scaledBalance).rayMul(_getCurrentIndex());
    }

    function totalScaledSupply() public view virtual returns (uint256) {
        return _totalSupply;
    }

    function scaledBalanceOf(address account) public view virtual returns (uint256) {
        return _userStates[account].scaledBalance;
    }

    function allowance(address owner, address spender) public view virtual override returns (uint256) {
        return _allowances[owner][spender];
    }




    // Write methods

    function approve(address spender, uint256 amount) public virtual override returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function increaseAllowance(address spender, uint256 addedValue) public virtual returns (bool) {
        address owner = msg.sender;
        _approve(owner, spender, allowance(owner, spender) + addedValue);
        return true;
    }

    function decreaseAllowance(address spender, uint256 subtractedValue) public virtual returns (bool) {
        address owner = msg.sender;
        uint256 currentAllowance = allowance(owner, spender);
        if(currentAllowance < subtractedValue) revert Errors.ERC20_AllowanceUnderflow();
        unchecked {
            _approve(owner, spender, currentAllowance - subtractedValue);
        }

        return true;
    }

    function transfer(address recipient, uint256 amount) public virtual override returns (bool) {
        _transfer(msg.sender, recipient, amount);
        emit Transfer(msg.sender, recipient, amount);
        return true;
    }

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) public virtual override returns (bool) {
        uint256 _allowance = _allowances[sender][msg.sender];
        if(_allowance < amount) revert Errors.ERC20_AmountOverAllowance();
        if(_allowance != type(uint256).max) {
            _approve(
                sender,
                msg.sender,
                _allowances[sender][msg.sender] - amount
            );
        }
        _transfer(sender, recipient, amount);
        emit Transfer(sender, recipient, amount);
        return true;
    }


    // Internal methods

    // To implement in inheriting contract
    function _getCurrentIndex() internal virtual view returns(uint256) {}

    function _approve(
        address owner,
        address spender,
        uint256 amount
    ) internal virtual {
        if(owner == address(0) || spender == address(0)) revert Errors.ERC20_ApproveAddressZero();

        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    function _transfer(
        address sender,
        address recipient,
        uint256 amount
    ) internal virtual {
        if(sender == address(0) || recipient == address(0)) revert Errors.ERC20_AddressZero();
        if(sender == recipient) revert Errors.ERC20_SelfTransfer();
        if(amount == 0) revert Errors.ERC20_NullAmount();

        // Get the scaled amount to transfer for the given amount
        uint128 _scaledAmount = safe128(amount.rayDiv(_getCurrentIndex()));
        _transferScaled(sender, recipient, _scaledAmount);
    }

    function _transferScaled(
        address sender,
        address recipient,
        uint128 scaledAmount
    ) internal virtual {
        if(scaledAmount > _userStates[sender].scaledBalance) revert Errors.ERC20_AmountExceedBalance();

        _beforeTokenTransfer(sender, recipient, scaledAmount);

        unchecked {
            // Should never fail because of previous check
            // & because the scaledBalance of an user should never exceed the _totalSupply
            _userStates[sender].scaledBalance -= scaledAmount;
            _userStates[recipient].scaledBalance += scaledAmount;
        }

        _afterTokenTransfer(sender, recipient, scaledAmount);
    }

    function _mint(address account, uint256 amount, uint256 _currentIndex) internal virtual returns(uint256) {
        uint256 _scaledAmount = amount.rayDiv(_currentIndex);
        if(_scaledAmount == 0) revert Errors.ERC20_NullAmount();

        _beforeTokenTransfer(address(0), account, _scaledAmount);

        _userStates[account].index = safe128(_currentIndex);

        _totalSupply += _scaledAmount;
        _userStates[account].scaledBalance += safe128(_scaledAmount);

        _afterTokenTransfer(address(0), account, _scaledAmount);

        emit Mint(account, _scaledAmount, _currentIndex);
        emit Transfer(address(0), account, amount);

        return amount;
    }

    function _burn(address account, uint256 amount, bool maxWithdraw) internal virtual returns(uint256) {
        uint256 _currentIndex = _getCurrentIndex();
        uint256 _scaledBalance = _userStates[account].scaledBalance;

        // if given maxWithdraw as true, we want to burn the whole balance for the user
        uint256 _scaledAmount = maxWithdraw ?  _scaledBalance: amount.rayDiv(_currentIndex);
        if(_scaledAmount == 0) revert Errors.ERC20_NullAmount();
        if(_scaledAmount > _scaledBalance) revert Errors.ERC20_AmountExceedBalance();

        _beforeTokenTransfer(account, address(0), _scaledAmount);
        
        _userStates[account].index = safe128(_currentIndex);

        _totalSupply -= _scaledAmount;
        _userStates[account].scaledBalance -= safe128(_scaledAmount);

        _afterTokenTransfer(account, address(0), _scaledAmount);
        
        emit Burn(account, _scaledAmount, _currentIndex);
        emit Transfer(account, address(0), amount);

        return amount;
    }


    // Virtual hooks

    // To implement in inheriting contract
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual {}

    // To implement in inheriting contract
    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual {}


    // Maths

    function safe128(uint256 n) internal pure returns (uint128) {
        if(n > type(uint128).max) revert Errors.NumberExceed128Bits();
        return uint128(n);
    }


}