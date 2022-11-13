pragma solidity 0.8.16;
//SPDX-License-Identifier: MIT

import "./base/ScalingERC20.sol";
import "./interfaces/IERC4626.sol";
import "./oz/interfaces/IERC20.sol";
import "./oz/libraries/SafeERC20.sol";
import "./oz/utils/ReentrancyGuard.sol";
import "./oz/utils/Pausable.sol";
import "./interfaces/IStakedAave.sol";
import {Errors} from "./utils/Errors.sol";

/** @title DullahanVault contract
 *  @author Paladin
 *  @notice Main Dullahan Vault. IERC4626 compatible & ScalingERC20 token
 */
contract DullahanVault is IERC4626, ScalingERC20, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // Constants
    uint256 public constant MAX_BPS = 10000;

    address public constant STK_AAVE = 0x4da27a545c0c5B758a6BA100e3a049001de870f5;
    address public constant AAVE = 0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9;

    uint256 private constant SEED_DEPOSIT = 0.001 ether;

    uint256 private constant INITIAL_INDEX = 1e18;


    // Struct
    struct SubVaultsManager {
        bool rentingAllowed;
        uint128 totalRented; // Based on the AAVE max total supply, should be safe
    }

    // Storage
    bool public initialized;

    address public admin;
    address public pendingAdmin;

    uint256 public totalRentedAmount;

    mapping(address => SubVaultsManager) public subVaultManagers;

    uint256 public bufferRatio = 500; // We want a percentage of funds to stay in the contract for withdraws

    uint256 public reserveAmount;
    uint256 public reserveRatio;
    address public reserveManager;

    // Events

    event Initialized();

    event RentToSubVault(address indexed manager, address indexed subVault, uint256 amount);
    event PullFromSubVault(address indexed manager, address indexed subVault, uint256 amount);

    event ReserveManagerUpdated(
        address indexed oldManager,
        address indexed newManager
    );

    event AdminTransferred(
        address indexed previousAdmin,
        address indexed newAdmin
    );
    event NewPendingAdmin(
        address indexed previousPendingAdmin,
        address indexed newPendingAdmin
    );

    event NewSubVaultManager(address indexed newManager);
    event BlockedSubVaultManager(address indexed manager);

    event UpdatedBufferRatio(uint256 oldRatio, uint256 newRatio);

    // Modifers

    modifier onlyAdmin() {
        if (_msgSender() != admin) revert Errors.CallerNotAdmin();
        _;
    }

    modifier onlyAllowedManagers() {
        if (!subVaultManagers[_msgSender()].rentingAllowed) revert Errors.CallerNotAllowed();
        _;
    }

    modifier isInitialized() {
        if (!initialized) revert Errors.NotInitialized();
        _;
    }

    // Constructor

    constructor(
        address _admin,
        uint256 _reserveRatio,
        string memory _name,
        string memory _symbol
    ) ScalingERC20(_name, _symbol) {
        if(_admin == address(0)) revert Errors.AddressZero();
        if(_reserveRatio == 0) revert Errors.NullAmount();

        admin = _admin;

        reserveRatio = _reserveRatio;
    }

    function init() external onlyAdmin {
        if(initialized) revert Errors.AlreadyInitialized();

        // Seed deposit to prevent 1 wei LP token exploit
        _deposit(
            SEED_DEPOSIT,
            msg.sender,
            msg.sender
        );

        emit Initialized();
    }

    // View functions

    function asset() external pure returns (address) {
        return STK_AAVE;
    }

    function totalAssets() public view returns (uint256) {
        return
            IERC20(STK_AAVE).balanceOf(address(this)) +
            totalRentedAmount -
            reserveAmount;
    }

    function totalSupply()
        public
        view
        override(ScalingERC20, IERC20)
        returns (uint256)
    {
        return totalAssets();
    }

    function convertToShares(uint256 assets) public pure returns (uint256) {
        return assets;
    }

    function convertToAssets(uint256 shares) public pure returns (uint256) {
        return shares;
    }

    function previewDeposit(uint256 assets) public pure returns (uint256) {
        return assets;
    }

    function previewMint(uint256 shares) public pure returns (uint256) {
        return shares;
    }

    function previewWithdraw(uint256 assets) public pure returns (uint256) {
        return assets;
    }

    function previewRedeem(uint256 shares) public pure returns (uint256) {
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


    // State-changing functions

    function deposit(
        uint256 assets,
        address receiver
    ) public isInitialized nonReentrant whenNotPaused returns (uint256 shares) {
        (assets, shares) = _deposit(assets, receiver, msg.sender);

        emit Deposit(msg.sender, receiver, assets, shares);
    }

    function mint(
        uint256 shares,
        address receiver
        ) public isInitialized nonReentrant whenNotPaused returns (uint256 assets) {
        (assets, shares) = _deposit(assets, receiver, msg.sender);

        emit Deposit(msg.sender, receiver, assets, shares);
    }

    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) public isInitialized nonReentrant returns (uint256 shares) {
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
    ) public isInitialized nonReentrant returns (uint256 assets) {
        (uint256 _withdrawn, uint256 _burntShares) = _withdraw(
            shares,
            receiver,
            msg.sender
        );

        emit Withdraw(msg.sender, receiver, owner, _withdrawn, _burntShares);
        return _withdrawn;
    }

    function updateStkAaveRewards() external nonReentrant {
        _getStkAaveRewards();
    }


    // SubVaults Manager functions

    function rentToSubVault(address subVault, uint256 amount) external nonReentrant onlyAllowedManagers {
        address manager = msg.sender;
        if(subVault == address(0)) revert Errors.AddressZero();
        if(amount == 0) revert Errors.NullAmount();

        _getStkAaveRewards();

        IERC20 _stkAave = IERC20(STK_AAVE);

        uint256 availableBalance = _stkAave.balanceOf(address(this));
        availableBalance = reserveAmount >= availableBalance ? 0 : availableBalance - reserveAmount;
        uint256 bufferAmount = (totalAssets() * bufferRatio) / MAX_BPS;
        if(availableBalance < bufferAmount) revert Errors.WithdrawBuffer();
        if(amount > (availableBalance - bufferAmount)) revert Errors.NotEnoughAvailableFunds();

        subVaultManagers[manager].totalRented += safe128(amount);
        totalRentedAmount += amount;
        _stkAave.safeTransfer(subVault, amount);
    
        emit RentToSubVault(manager, subVault, amount);
    }

    function pullFromSubVault(address subVault, uint256 amount)external nonReentrant onlyAllowedManagers {
        address manager = msg.sender;
        if(subVault == address(0)) revert Errors.AddressZero();
        if(amount == 0) revert Errors.NullAmount();

        _getStkAaveRewards();

        // We consider that subVault give MAX_UNIT256 allowance to this contract when created
        IERC20(STK_AAVE).safeTransferFrom(subVault, address(this), amount);
        subVaultManagers[manager].totalRented -= safe128(amount);
        totalRentedAmount -= amount;

        emit PullFromSubVault(manager, subVault, amount);
    }


    // Internal functions

    function _getCurrentIndex() internal view override returns (uint256) {
        if(_totalSupply == 0) {
            return INITIAL_INDEX;
        } else {
            return (totalAssets() * UNIT) / _totalSupply;
        }
    }

    function _deposit(
        uint256 amount,
        address receiver,
        address depositor
    ) internal returns (uint256, uint256) {
        if (amount == 0) revert Errors.NullAmount();

        _getStkAaveRewards();

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

        _getStkAaveRewards();

        if (msg.sender != sender) {
            uint256 allowed = _allowances[sender][msg.sender];
            if (allowed < amount) revert Errors.ERC20_AmountOverAllowance();
            if (allowed != type(uint256).max)
                _allowances[sender][msg.sender] = allowed - amount;
        }

        IERC20 _stkAave = IERC20(STK_AAVE);

        uint256 availableBalance = _stkAave.balanceOf(address(this));
        availableBalance = reserveAmount >= availableBalance ? 0 : availableBalance - reserveAmount;
        if(amount > availableBalance) revert Errors.NotEnoughAvailableFunds();

        uint256 burned = _burn(sender, amount);

        beforeWithdraw(amount);

        _stkAave.safeTransfer(receiver, amount);

        return (amount, burned);
    }

    function beforeWithdraw(uint256 amount) internal {}

    function afterDeposit(uint256 amount) internal {}

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal isInitialized whenNotPaused override {
        from; to; amount;
        _getStkAaveRewards(); // keep that here ?
    }

    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override {}

    function _getStkAaveRewards() internal {
        IStakedAave _stkAave = IStakedAave(STK_AAVE);

        //Get pending rewards amount
        uint256 pendingRewards = _stkAave.getTotalRewardsBalance(address(this));

        if (pendingRewards > 0) {
            //claim the AAVE tokens
            _stkAave.claimRewards(address(this), pendingRewards);

            reserveAmount += (pendingRewards * reserveRatio) / MAX_BPS;

            IERC20 _aave = IERC20(AAVE);
            uint256 currentBalance = IERC20(_aave).balanceOf(address(this));
            IERC20(_aave).safeIncreaseAllowance(STK_AAVE, currentBalance);
            _stkAave.stake(address(this), currentBalance);
        }
    }


    // Admin functions

    function transferAdmin(address newAdmin) external onlyAdmin {
        if (newAdmin == address(0)) revert Errors.AddressZero();
        if (newAdmin == admin) revert Errors.CannotBeAdmin();
        address oldPendingAdmin = pendingAdmin;

        pendingAdmin = newAdmin;

        emit NewPendingAdmin(oldPendingAdmin, newAdmin);
    }

    function acceptAdmin() external {
        if (msg.sender != pendingAdmin) revert Errors.CallerNotPendingAdmin();
        address newAdmin = pendingAdmin;
        address oldAdmin = admin;
        admin = newAdmin;
        pendingAdmin = address(0);

        emit AdminTransferred(oldAdmin, newAdmin);
        emit NewPendingAdmin(newAdmin, address(0));
    }

    function addSubVaultManager(address newManager) external onlyAdmin {
        if(newManager == address(0)) revert Errors.AddressZero();
        if(subVaultManagers[newManager].rentingAllowed) revert Errors.ManagerAlreadyListed();

        subVaultManagers[newManager].rentingAllowed = true;

        emit NewSubVaultManager(newManager);
    }

    function blockSubVaultManager(address manager) external onlyAdmin {
        if(manager == address(0)) revert Errors.AddressZero();
        if(!subVaultManagers[manager].rentingAllowed) revert Errors.ManagerNotListed();

        subVaultManagers[manager].rentingAllowed = false;

        emit NewSubVaultManager(manager);
    }

    function updateBufferRatio(uint256 newRatio) external onlyAdmin {
        if(newRatio > 1500) revert Errors.InvalidParameter();

        uint256 oldRatio = bufferRatio;
        bufferRatio = newRatio;

        emit UpdatedBufferRatio(oldRatio, newRatio);
    }

    /**
     * @notice Deposit token in the reserve
     * @param from Address to pull the tokens from
     * @param amount Amount of token to deposit
     */
    function depositToReserve(address from, uint256 amount) external onlyAdmin returns(bool) {
        if(amount == 0) revert Errors.NullAmount();
        if(from == address(0)) revert Errors.AddressZero();

        _getStkAaveRewards();

        reserveAmount = reserveAmount + amount;
        IERC20(STK_AAVE).safeTransferFrom(from, address(this), amount);

        return true;
    }

    /**
     * @notice Withdraw tokens from the reserve to send to the Reserve Manager
     * @param amount Amount of token to withdraw
     */
    function withdrawFromReserve(uint256 amount) external onlyAdmin returns(bool) {
        if(amount == 0) revert Errors.NullAmount();
        if(amount > reserveAmount) revert Errors.ReserveTooLow();

        _getStkAaveRewards();

        reserveAmount = reserveAmount - amount;
        IERC20(STK_AAVE).safeTransfer(reserveManager, amount);

        return true;
    }

}