pragma solidity 0.8.16;
//SPDX-License-Identifier: MIT

import "./ScalingERC20.sol";
import "../interfaces/IERC4626.sol";
import "../oz/interfaces/IERC20.sol";
import "../oz/libraries/SafeERC20.sol";
import "../oz/utils/ReentrancyGuard.sol";
import "../interfaces/IStakedAave.sol";
import {Errors} from "../utils/Errors.sol";

/** @title DullahanVault contract
 *  @author Paladin
 *  @notice Main Dullahan Vault. IERC4626 compatible & ScalingERC20 token
 */
contract DullahanVault is IERC4626, ScalingERC20, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // Constants
    uint256 public constant MAX_BPS = 10000;

    address public constant STK_AAVE = 0x4da27a545c0c5B758a6BA100e3a049001de870f5;
    address public constant AAVE = address(0);
    // Aave V3 Pool ?
    // GHO token ??


    // Storage

    address public admin;
    address public pendingAdmin;

    uint256 public totalRentedAmount;
    
    // reward indexes for incoming tokens (Gov module)
    // + 1 just for stkAAVE renting for GHO index ?

    uint256 public reserveAmount;
    uint256 public reserveRatio;
    address public reserveManager;
    


    // Events



    event ReserveManagerUpdated(address indexed oldManager, address indexed newManager);

    event AdminTransferred(
        address indexed previousAdmin,
        address indexed newAdmin
    );
    event NewPendingAdmin(
        address indexed previousPendingAdmin,
        address indexed newPendingAdmin
    );


    // Modifers

    modifier onlyAdmin() {
        if (_msgSender() != admin) revert Errors.CallerNotAdmin();
        _;
    }

    modifier onlyReserveController() {
        if (_msgSender() != reserveManager && _msgSender() != admin) revert Errors.CallerNotAllowed();
        _;
    }


    // Constructor

    constructor(
        address _admin,
        uint256 _reserveRatio,
        string memory name,
        string memory symbol
    ) ScalingERC20(name, symbol) {
        admin = _admin;

        reserveRatio = _reserveRatio;
    }



    // View functions

    function asset() external view returns (address) {
        return STK_AAVE;
    }

    function totalAssets() public view returns (uint256){
        return IERC20(STK_AAVE).balanceOf(address(this)) + totalRentedAmount - reserveAmount;
    }

    function totalSupply() public view override(ScalingERC20, IERC20) returns (uint256) {
        return totalAssets();
    }

    function convertToShares(uint256 assets) public view returns (uint256) {
        return assets;
    }

    function convertToAssets(uint256 shares) public view returns (uint256) {
        return shares;
    }

    function previewDeposit(uint256 assets) public view returns (uint256) {
        return assets;
    }

    function previewMint(uint256 shares) public view returns (uint256) {
        return shares;
    }

    function previewWithdraw(uint256 assets) public view returns (uint256) {
        return assets;
    }

    function previewRedeem(uint256 shares) public view returns (uint256) {
        return shares;
    }

    function maxDeposit(address user) public view returns (uint256) {
        return IERC20(STK_AAVE).balanceOf(user);
    }

    function maxMint(address user) public view returns (uint256) {
        return IERC20(STK_AAVE).balanceOf(user);
    }

    function maxWithdraw(address owner) public view returns (uint256) {
        return balanceOf(owner);
    }

    function maxRedeem(address owner) public view returns (uint256) {
        return balanceOf(owner);
    }

    // methods for rewards 



    // State-changing functions

    function deposit(uint256 assets, address receiver)
        public
        virtual
        nonReentrant
        returns (uint256 shares)
    {
        (assets, shares) = _deposit(assets, receiver, msg.sender);

        emit Deposit(msg.sender, receiver, assets, shares);
    }

    function mint(uint256 shares, address receiver)
        public
        virtual
        nonReentrant
        returns (uint256 assets)
    {
        (assets, shares) = _deposit(assets, receiver, msg.sender);

        emit Deposit(msg.sender, receiver, assets, shares);
    }

    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) public virtual nonReentrant returns (uint256 shares) {
        (uint256 _withdrawn, uint256 _burntShares) = _withdraw(
            assets,
            receiver,
            msg.sender
        );

        emit Withdraw(msg.sender, receiver, owner, _withdrawn, _burntShares);
        return _burntShares;
    }

    function redeem(
        uint256 shares,
        address receiver,
        address owner
    ) public virtual nonReentrant returns (uint256 assets) {
        (uint256 _withdrawn, uint256 _burntShares) = _withdraw(
            shares,
            receiver,
            msg.sender
        );

        emit Withdraw(msg.sender, receiver, owner, _withdrawn, _burntShares);
        return _withdrawn;
    }

    function _deposit(
        uint256 amount,
        address receiver,
        address depositor
    ) internal returns (uint256, uint256) {
        if (amount == 0) revert Errors.NullAmount();

        IERC20(STK_AAVE).safeTransferFrom(depositor, address(this), amount);

        uint256 minted = _mint(receiver, amount);

        afterDeposit(amount);

        return (amount, minted);
    }

    function _withdraw(
        uint256 amount, // if `MAX_UINT256`, just withdraw everything
        address receiver,
        address sender
    ) internal returns (uint256, uint256) {
        if (amount == 0) revert Errors.NullAmount();

        if (msg.sender != sender) {
            uint256 allowed = _allowances[sender][msg.sender];
            if (allowed < amount) revert Errors.ERC20_AmountOverAllowance();
            if (allowed != type(uint256).max)
                _allowances[sender][msg.sender] = allowed - amount;
        }

        // add check available balance in Vault

        uint256 burned = _burn(sender, amount);

        beforeWithdraw(amount);

        IERC20(STK_AAVE).safeTransfer(receiver, amount);

        return(amount, burned);
    }

    // method claim et stake AAVE

    // methods for rewards

    // methods for subVault



    // Internal functions

    function _getCurrentIndex() internal view override returns (uint256) {
        return (totalAssets() * UNIT) / _totalSupply;
    }

    function beforeWithdraw(uint256 amount) internal {
        
    }

    function afterDeposit(uint256 amount) internal {
        
    }

    function _beforeTokenTransfer(address from, address to, uint256 amount) internal override {
        
    }

    function _afterTokenTransfer(address from, address to, uint256 amount) internal override {

    }

    function _getStkAaveRewards() internal {
        IStakedAave _stkAave = IStakedAave(STK_AAVE);

        //Get pending rewards amount
        uint256 pendingRewards = _stkAave.getTotalRewardsBalance(address(this));

        if(pendingRewards > 0){
            //claim the AAVE tokens
            _stkAave.claimRewards(address(this), pendingRewards);

            reserveAmount += (pendingRewards * reserveRatio) / MAX_BPS;

            IERC20 _aave = IERC20(AAVE);
            uint256 currentBalance = IERC20(_aave).balanceOf(address(this));
            IERC20(_aave).safeIncreaseAllowance(STK_AAVE, currentBalance);
            _stkAave.stake(address(this), currentBalance);
        }
    }

    // methods for sub-vaults ??


    // Admin functions

    function transferAdmin(address newAdmin) public virtual onlyAdmin {
        if (newAdmin == address(0)) revert Errors.ZeroAddress();
        if (newAdmin == admin) revert Errors.CannotBeAdmin();
        address oldPendingAdmin = pendingAdmin;

        pendingAdmin = newAdmin;

        emit NewPendingAdmin(oldPendingAdmin, newAdmin);
    }

    function acceptAdmin() public virtual {
        if (msg.sender != pendingAdmin) revert Errors.CallerNotPendingAdmin();
        address newAdmin = pendingAdmin;
        address oldAdmin = admin;
        admin = newAdmin;
        pendingAdmin = address(0);

        emit AdminTransferred(oldAdmin, newAdmin);
        emit NewPendingAdmin(newAdmin, address(0));
    }

}