pragma solidity 0.8.16;
//SPDX-License-Identifier: MIT

import "../oz/ERC20.sol";

contract MockERC20 is ERC20 {

    constructor(
        string memory _name,
        string memory _symbol
    ) ERC20(_name, _symbol) {}

    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }

    function burn(address account, uint256 amount) external {
        _burn(account, amount);
    }

}