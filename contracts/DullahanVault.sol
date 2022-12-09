//██████╗  █████╗ ██╗      █████╗ ██████╗ ██╗███╗   ██╗
//██╔══██╗██╔══██╗██║     ██╔══██╗██╔══██╗██║████╗  ██║
//██████╔╝███████║██║     ███████║██║  ██║██║██╔██╗ ██║
//██╔═══╝ ██╔══██║██║     ██╔══██║██║  ██║██║██║╚██╗██║
//██║     ██║  ██║███████╗██║  ██║██████╔╝██║██║ ╚████║
//╚═╝     ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═════╝ ╚═╝╚═╝  ╚═══╝


pragma solidity 0.8.16;
//SPDX-License-Identifier: MIT

import "./base/ScalingERC20.sol";
import "./interfaces/IERC4626.sol";
import "./oz/interfaces/IERC20.sol";
import "./oz/libraries/SafeERC20.sol";
import "./oz/utils/ReentrancyGuard.sol";
import "./oz/utils/Pausable.sol";
import "./interfaces/IStakedAave.sol";
import "./interfaces/IGovernancePowerDelegationToken.sol";
import {Errors} from "./utils/Errors.sol";
import {WadRayMath} from  "./utils/WadRayMath.sol";

/** @title DullahanVault contract
 *  @author Paladin
 *  @notice Main Dullahan Vault. IERC4626 compatible & ScalingERC20 token
 */
contract DullahanVault is IERC4626, ScalingERC20, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    using WadRayMath for uint256;

    // Constants
    uint256 public constant MAX_BPS = 10000;
    uint256 public constant MAX_UINT256 = 2**256 - 1;

    uint256 private constant SEED_DEPOSIT = 0.001 ether;

    address public immutable STK_AAVE;
    address public immutable AAVE;


    // Struct
    struct PodsManager { // To pack better - gas opti
        bool rentingAllowed;
        uint128 totalRented; // Based on the AAVE max total supply, should be safe
    }


    // Storage
    bool public initialized;

    address public admin;
    address public pendingAdmin;

    uint256 public totalRentedAmount;

    mapping(address => PodsManager) public podManagers;

    address public votingPowerManager;

    uint256 public bufferRatio = 500; // We want a percentage of funds to stay in the contract for withdraws

    uint256 public reserveAmount;
    uint256 public reserveRatio;
    address public reserveManager;


    // Events

    event Initialized();

    event RentToPod(address indexed manager, address indexed pod, uint256 amount);
    event NotifyRentedAmount(address indexed manager, address indexed pod, uint256 addedAmount);
    event PullFromPod(address indexed manager, address indexed pod, uint256 amount);


    event AdminTransferred(
        address indexed previousAdmin,
        address indexed newAdmin
    );
    event NewPendingAdmin(
        address indexed previousPendingAdmin,
        address indexed newPendingAdmin
    );

    event NewPodManager(address indexed newManager);
    event BlockedPodManager(address indexed manager);
    event UpdatedVotingPowerManager(address indexed oldManager, address indexed newManager);
    event UpdatedReserveManager(address indexed oldManager, address indexed newManager);
    event UpdatedBufferRatio(uint256 oldRatio, uint256 newRatio);


    // Modifers

    modifier onlyAdmin() {
        if (msg.sender != admin) revert Errors.CallerNotAdmin();
        _;
    }

    modifier onlyAllowed() {
        // Only admin & reserveManager
        if (msg.sender != admin && msg.sender != reserveManager) revert Errors.CallerNotAdmin();
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
        address _reserveManager,
        address _aave,
        address _stkAave,
        string memory _name,
        string memory _symbol
    ) ScalingERC20(_name, _symbol) {
        if(_admin == address(0) || _reserveManager == address(0) || _aave == address(0) || _stkAave == address(0)) revert Errors.AddressZero();
        if(_reserveRatio == 0) revert Errors.NullAmount();

        admin = _admin;

        reserveRatio = _reserveRatio;
        reserveManager = _reserveManager;

        AAVE = _aave;
        STK_AAVE = _stkAave;
    }

    function init(address _votingPowerManager) external onlyAdmin {
        if(initialized) revert Errors.AlreadyInitialized();

        initialized = true;

        votingPowerManager = _votingPowerManager;

        // Seed deposit to prevent 1 wei LP token exploit
        _deposit(
            SEED_DEPOSIT,
            msg.sender,
            msg.sender
        );

        IGovernancePowerDelegationToken(STK_AAVE).delegate(_votingPowerManager);

        emit Initialized();
    }


    // View functions

    function asset() external view returns (address) {
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
        return type(uint256).max;
    }

    function maxMint(address user) public view returns (uint256) {
        return type(uint256).max;
    }

    function maxWithdraw(address owner) public view returns (uint256) {
        return balanceOf(owner);
    }

    function maxRedeem(address owner) public view returns (uint256) {
        return balanceOf(owner);
    }

    function getCurrentIndex() public view returns(uint256) {
        return _getCurrentIndex();
    }

    function getDelegate() external view returns(address) {
        return votingPowerManager;
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
        (assets, shares) = _deposit(shares, receiver, msg.sender);

        emit Deposit(msg.sender, receiver, assets, shares);
    }

    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) public isInitialized nonReentrant returns (uint256 shares) {
        (uint256 _withdrawn, uint256 _burntShares) = _withdraw(
            assets,
            owner,
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
            owner,
            receiver,
            msg.sender
        );

        emit Withdraw(msg.sender, receiver, owner, _withdrawn, _burntShares);
        return _withdrawn;
    }

    function updateStkAaveRewards() external nonReentrant {
        _getStkAaveRewards();
    }


    // Pods Manager functions

    function rentStkAave(address pod, uint256 amount) external nonReentrant {
        address manager = msg.sender;
        if (!podManagers[manager].rentingAllowed) revert Errors.CallerNotAllowedManager();
        if(pod == address(0)) revert Errors.AddressZero();
        if(amount == 0) revert Errors.NullAmount();

        _getStkAaveRewards();

        IERC20 _stkAave = IERC20(STK_AAVE);

        uint256 availableBalance = _stkAave.balanceOf(address(this));
        availableBalance = reserveAmount >= availableBalance ? 0 : availableBalance - reserveAmount;
        uint256 bufferAmount = (totalAssets() * bufferRatio) / MAX_BPS;
        if(availableBalance < bufferAmount) revert Errors.WithdrawBuffer();
        if(amount > (availableBalance - bufferAmount)) revert Errors.NotEnoughAvailableFunds();

        podManagers[manager].totalRented += safe128(amount);
        totalRentedAmount += amount;
        _stkAave.safeTransfer(pod, amount);
    
        emit RentToPod(manager, pod, amount);
    }

    // To track pods stkAave claims & re-stake into the main balance for ScalingeRC20 logic
    function notifyRentedAmount(address pod, uint256 addedAmount) external nonReentrant {
        address manager = msg.sender;
        if (!podManagers[manager].rentingAllowed) revert Errors.CallerNotAllowedManager();
        if(pod == address(0)) revert Errors.AddressZero();
        if(addedAmount == 0) revert Errors.NullAmount();

        podManagers[manager].totalRented += safe128(addedAmount);
        totalRentedAmount += addedAmount;

        reserveAmount += (addedAmount * reserveRatio) / MAX_BPS;

        emit NotifyRentedAmount(manager, pod, addedAmount);
    }

    function pullRentedStkAave(address pod, uint256 amount)external nonReentrant {
        address manager = msg.sender;
        if (podManagers[manager].totalRented == 0) revert Errors.NotUndebtedManager();
        if(pod == address(0)) revert Errors.AddressZero();
        if(amount == 0) revert Errors.NullAmount();

        _getStkAaveRewards();

        // We consider that pod give MAX_UINT256 allowance to this contract when created
        IERC20(STK_AAVE).safeTransferFrom(pod, address(this), amount);
        podManagers[manager].totalRented -= safe128(amount);
        totalRentedAmount -= amount;

        emit PullFromPod(manager, pod, amount);
    }


    // Internal functions

    function _getCurrentIndex() internal view override returns (uint256) {
        if(_totalSupply == 0) return INITIAL_INDEX;
        return totalAssets().rayDiv(_totalSupply);
    }

    function _deposit(
        uint256 amount,
        address receiver,
        address depositor
    ) internal returns (uint256, uint256) {
        if (receiver == address(0)) revert Errors.AddressZero();
        if (amount == 0) revert Errors.NullAmount();

        _getStkAaveRewards();

        // We need to get the index before pulling the assets
        // so we can have the correct one based on previous stkAave claim
        uint256 _currentIndex = _getCurrentIndex();

        IERC20(STK_AAVE).safeTransferFrom(depositor, address(this), amount);

        uint256 minted = _mint(receiver, amount, _currentIndex);

        afterDeposit(amount);

        return (amount, minted);
    }

    function _withdraw(
        uint256 amount, // if `MAX_UINT256`, just withdraw everything
        address owner,
        address receiver,
        address sender
    ) internal returns (uint256, uint256) {
        if (receiver == address(0) || owner == address(0)) revert Errors.AddressZero();
        if (amount == 0) revert Errors.NullAmount();

        _getStkAaveRewards();

        bool _maxWithdraw;
        if(amount == MAX_UINT256) {
            amount = balanceOf(owner);
            _maxWithdraw = true;
        }

        if (owner != sender) {
            uint256 allowed = _allowances[owner][sender];
            if (allowed < amount) revert Errors.ERC20_AmountOverAllowance();
            if (allowed != type(uint256).max)
                _allowances[owner][sender] = allowed - amount;
        }

        IERC20 _stkAave = IERC20(STK_AAVE);

        uint256 availableBalance = _stkAave.balanceOf(address(this));
        availableBalance = reserveAmount >= availableBalance ? 0 : availableBalance - reserveAmount;
        if(amount > availableBalance) revert Errors.NotEnoughAvailableFunds();

        uint256 burned = _burn(owner, amount, _maxWithdraw);

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
    ) internal isInitialized whenNotPaused override {}

    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override {}

    function _getStkAaveRewards() internal {
        IStakedAave _stkAave = IStakedAave(STK_AAVE);

        // Get pending rewards amount
        uint256 pendingRewards = _stkAave.getTotalRewardsBalance(address(this));

        if (pendingRewards > 0) {
            // Claim the AAVE tokens
            _stkAave.claimRewards(address(this), pendingRewards);

            reserveAmount += (pendingRewards * reserveRatio) / MAX_BPS;
        }

        IERC20 _aave = IERC20(AAVE);
        uint256 currentBalance = _aave.balanceOf(address(this));
        
        if(currentBalance > 0) {
            _aave.safeIncreaseAllowance(STK_AAVE, currentBalance);
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

    function addPodManager(address newManager) external onlyAdmin {
        if(newManager == address(0)) revert Errors.AddressZero();
        if(podManagers[newManager].rentingAllowed) revert Errors.ManagerAlreadyListed();

        podManagers[newManager].rentingAllowed = true;

        emit NewPodManager(newManager);
    }

    function blockPodManager(address manager) external onlyAdmin {
        if(manager == address(0)) revert Errors.AddressZero();
        if(!podManagers[manager].rentingAllowed) revert Errors.ManagerNotListed();

        podManagers[manager].rentingAllowed = false;

        emit NewPodManager(manager);
    }

    function updateVotingPowerManager(address newManager) external onlyAdmin {
        if(newManager == address(0)) revert Errors.AddressZero();
        if(newManager == votingPowerManager) revert Errors.SameAddress();

        address oldManager = votingPowerManager;
        votingPowerManager = newManager;

        IGovernancePowerDelegationToken(STK_AAVE).delegate(newManager);

        emit UpdatedVotingPowerManager(oldManager, newManager);
    }

    function updateReserveManager(address newManager) external onlyAdmin {
        if(newManager == address(0)) revert Errors.AddressZero();
        if(newManager == reserveManager) revert Errors.SameAddress();

        address oldManager = reserveManager;
        reserveManager = newManager;

        emit UpdatedReserveManager(oldManager, newManager);
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
    function depositToReserve(address from, uint256 amount) external onlyAllowed returns(bool) {
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
    function withdrawFromReserve(uint256 amount, address receiver) external onlyAllowed returns(bool) {
        if(amount == 0) revert Errors.NullAmount();
        if(receiver == address(0)) revert Errors.AddressZero();
        if(amount > reserveAmount) revert Errors.ReserveTooLow();

        _getStkAaveRewards();

        reserveAmount = reserveAmount - amount;
        IERC20(STK_AAVE).safeTransfer(receiver, amount);

        return true;
    }

}