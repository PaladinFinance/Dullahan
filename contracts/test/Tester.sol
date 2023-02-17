pragma solidity 0.8.16;
//SPDX-License-Identifier: MIT

import "../oz/interfaces/IERC20.sol";
import "../oz/libraries/SafeERC20.sol";
import "../modules/DullahanRegistry.sol";
import "../interfaces/IAavePool.sol";

//import "hardhat/console.sol";

contract Tester {
    using SafeERC20 for IERC20;


    /** @notice 1e18 scale */
    uint256 public constant UNIT = 1e18;
    /** @notice Max value for BPS - 100% */
    uint256 public constant MAX_BPS = 10000;
    /** @notice Max value possible for an uint256 */
    uint256 private constant MAX_UINT256 = 2**256 - 1;

    address public immutable AAVE_POOL;
    address public immutable GHO;
    address public immutable DEBT_GHO;

    address public immutable collateral;
    address public immutable aToken;

    /** @notice Event emitted when collateral is deposited */
    event CollateralDeposited(address indexed collateral, uint256 amount);
    /** @notice Event emitted when collateral is withdrawn */
    event CollateralWithdrawn(address indexed collateral, uint256 amount);

    /** @notice Event emitted when GHO is minted */
    event GhoMinted(uint256 mintedAmount);
    /** @notice Event emitted when GHO is repayed */
    event GhoRepayed(uint256 amountToRepay);

    constructor(
        address _pool,
        address _gho,
        address _debtGho,
        address _collateral,
        address _aToken
    ) {
        AAVE_POOL = _pool;
        GHO = _gho;
        DEBT_GHO = _debtGho;
        collateral = _collateral;
        aToken = _aToken;
    }

    function depositCollateral(uint256 amount) external {

        IERC20 _collateral = IERC20(collateral);
        _collateral.safeTransferFrom(msg.sender, address(this), amount);

        _collateral.safeIncreaseAllowance(AAVE_POOL, amount);
        IAavePool(AAVE_POOL).supply(collateral, amount, address(this), 0);

        emit CollateralDeposited(collateral, amount);
    }

    // Can give MAX_UINT256 to withdraw all
    function withdrawCollateral(uint256 amount, address receiver) external {

        // We use the null amount to mock amount set from the contract aToken balance during actual function execution
        if(amount == 0) {
            amount = IERC20(aToken).balanceOf(address(this));
        }

        uint256 withdrawnAmount = IAavePool(AAVE_POOL).withdraw(collateral, amount, receiver);

        emit CollateralWithdrawn(collateral, withdrawnAmount);
    }

    function mintGho(uint256 amountToMint, address receiver) external {
        IAavePool(AAVE_POOL).borrow(GHO, amountToMint, 2, 0, address(this)); // 2 => variable mode (might need to change that)

        IERC20 _gho = IERC20(GHO);
        _gho.safeTransfer(receiver, amountToMint);

        emit GhoMinted(amountToMint);
    }

    // Can give MAX_UINT256 to repay all
    function repayGho(uint256 amountToRepay) external {
        // Pull the GHO from the Pod Owner
        IERC20 _gho = IERC20(GHO);
        //_gho.safeTransferFrom(msg.sender, address(this), amountToRepay);

        // We use the null amount to mock amount set from the contract debt during actual function execution
        if(amountToRepay == 0) {
            amountToRepay = IERC20(DEBT_GHO).balanceOf(address(this));
        }

        _gho.safeIncreaseAllowance(AAVE_POOL, amountToRepay);
        IAavePool(AAVE_POOL).repay(GHO, amountToRepay, 2, address(this)); // 2 => variable mode (might need to change that)

        emit GhoRepayed(amountToRepay);
    }

}