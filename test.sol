

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

// Import the Foundry testing library and console
import {Test, console} from "forge-std/Test.sol";

// Import the tested contract from the specified path
import {GameMachine, GameToken} from "../contracts/GameMachine.sol";

contract GameMachineTest is Test {
    GameMachine public gameMachine;
    GameToken public gameToken;
    
    // Some constants from the contract for ease of use
    uint256 constant ETH_TO_TOKEN_RATE = 100000; // as defined in the tested contract
    uint256 constant MAX_BET = 10000 * 10**18;
    uint256 constant MIN_BET = 0 * 10**18; // as defined in the tested contract
    uint256 constant MAX_PLAYERS = 10;
    
    // Set up before each test
    function setUp() public {
        // Deploy GameMachine; the deployer (this contract) becomes the owner.
        gameMachine = new GameMachine();
        // Retrieve the associated GameToken contract.
        gameToken = gameMachine.gameToken();
        
        // Fund the GameMachine contract with ETH so it can pay out in sellTokens and withdraw.
        vm.deal(address(gameMachine), 10 ether);
        
        console.log("GameMachine deployed and funded with %s ETH", address(gameMachine).balance);
    }
    
    // Test case: Buying tokens with ETH results in correct token minting.
    function test_buyTokens() public {
        console.log("Running test_buyTokens");
        
        // Set amount to buy tokens with. 1 ether.
        uint256 ethAmount = 1 ether;
        // Call buyTokens sending 1 ether.
        gameMachine.buyTokens{value: ethAmount}();
        
        // Calculate expected token amount: ethAmount * ETH_TO_TOKEN_RATE.
        uint256 expectedTokenAmount = ethAmount * ETH_TO_TOKEN_RATE;
        // Note: Tokens have 18 decimals like ETH.
        uint256 balance = gameToken.balanceOf(address(this));
        console.log("Token balance of buyer: %s", balance);
        assertEq(balance, expectedTokenAmount, "Token balance does not match expected mint amount");
    }
    
    // Test case: Selling tokens awards ETH back to the seller.
    function test_sellTokens() public {
        console.log("Running test_sellTokens");
        
        // First: Buy tokens to have a balance.
        uint256 ethAmount = 1 ether;
        gameMachine.buyTokens{value: ethAmount}();
        uint256 tokenAmount = ethAmount * ETH_TO_TOKEN_RATE;
        
        // Approve GameMachine contract to spend tokens on behalf of seller.
        gameToken.approve(address(gameMachine), tokenAmount);
        
        // Expected ETH amount to receive when selling all tokens.
        uint256 expectedEth = tokenAmount / ETH_TO_TOKEN_RATE;
        uint256 sellerEthBefore = address(this).balance;
        
        // Call sellTokens.
        gameMachine.sellTokens(tokenAmount);
        uint256 sellerEthAfter = address(this).balance;
        
        console.log("Seller ETH before: %s, after sellTokens: %s", sellerEthBefore, sellerEthAfter);
        // Check that seller receives the expected ETH. Allowing some margin for gas.
        assertEq(sellerEthAfter, sellerEthBefore + expectedEth, "Seller did not receive correct ETH amount for tokens sold");
    }
    
    // Test case: Placing bets correctly updates machine state and triggers win when aim is reached.
    function test_placeBet_winCondition() public {
        console.log("Running test_placeBet_winCondition");
        
        // Buy tokens with sufficient amount.
        uint256 ethAmount = 10 ether;
        gameMachine.buyTokens{value: ethAmount}();
        uint256 buyerTokenBalance = gameToken.balanceOf(address(this));
        console.log("Buyer token balance: %s", buyerTokenBalance);
        
        // Approve GameMachine to spend tokens.
        uint256 approvalAmount = buyerTokenBalance;
        gameToken.approve(address(gameMachine), approvalAmount);
        
        // We are playing on machine 0 (machineId = 0)
        uint256 machineId = 0;
        
        // Retrieve the current aim of machine 0 (only available for owner, and this contract is the owner).
        uint256 aim = gameMachine.getAim(machineId);
        console.log("Machine %s aim: %s", machineId, aim);
        
        // Bet in multiple rounds. Here we bet MAX_BET repeatedly.
        // To win, cumulative bets >= aim. Use 10 bets of MAX_BET if needed.
        uint256 cumulativeBet = 0;
        uint256 rounds = 0;
        while(cumulativeBet < aim) {
            // Use the maximum allowed bet but ensure we don’t exceed the aim.
            uint256 betAmount = MAX_BET;
            if(cumulativeBet + betAmount > aim) {
                betAmount = aim - cumulativeBet;
            }
            // Place the bet.
            gameMachine.placeBet(machineId, betAmount);
            cumulativeBet += betAmount;
            rounds++;
        }
        console.log("Placed %s bets totaling: %s", rounds, cumulativeBet);
        
        // At this point, winning should have been triggered and the machine should have reset.
        // Check: currentTotal should be 0 and the player's current machine assignment should be reset.
        uint256 machinePlayerCount = gameMachine.getMachinePlayerCount(machineId);
        uint256 currentMachine = gameMachine.getCurrentMachine(address(this));
        assertEq(machinePlayerCount, 0, "Machine player count should be reset to 0 after win");
        assertEq(currentMachine, 0, "Player's machine assignment should be reset to 0 after winning");
        
        // Also, the winner should have received prize tokens equal to the machine aim.
        uint256 postWinBalance = gameToken.balanceOf(address(this));
        // Note: The player spent tokens equal to cumulative bets, but then got prize tokens minted.
        // Therefore, postWinBalance should be (initial tokens - cumulativeBet + prize) where prize = aim.
        uint256 expectedBalance = buyerTokenBalance - cumulativeBet + aim;
        assertEq(postWinBalance, expectedBalance, "Player token balance incorrect after win");
    }
    
    // Test case: Reverting when trying to place a bet on an invalid machine id.
    function test_placeBet_invalidMachine() public {
        console.log("Running test_placeBet_invalidMachine");
        
        // Buy tokens beforehand.
        uint256 ethAmount = 1 ether;
        gameMachine.buyTokens{value: ethAmount}();
        gameToken.approve(address(gameMachine), type(uint256).max);
        
        // Attempt to place bet on an invalid machine id (>=3)
        uint256 invalidMachineId = 3;
        vm.expectRevert("Invalid machine ID");
        gameMachine.placeBet(invalidMachineId, MIN_BET);
    }
    
    // Test case: A player already playing on one machine cannot play on another.
    function test_placeBet_onDifferentMachine() public {
        console.log("Running test_placeBet_onDifferentMachine");
        
        // Buy tokens and approve spending.
        uint256 ethAmount = 1 ether;
        gameMachine.buyTokens{value: ethAmount}();
        gameToken.approve(address(gameMachine), type(uint256).max);
        
        // First, place a bet on machine 0.
        gameMachine.placeBet(0, MIN_BET + 1); // bet a minimal non-zero bet
        
        // Now, attempt to place a bet on machine 1 and expect revert.
        vm.expectRevert("Already playing on another machine");
        gameMachine.placeBet(1, MIN_BET + 1);
    }
    
    // Test case: Selling tokens when the seller has insufficient token balance should revert.
    function test_sellTokens_insufficientBalance() public {
        console.log("Running test_sellTokens_insufficientBalance");
        
        // Ensure the caller has 0 tokens.
        uint256 tokenBalance = gameToken.balanceOf(address(this));
        assertEq(tokenBalance, 0, "Caller should start with zero token balance");
        
        // Approve some arbitrary amount.
        gameToken.approve(address(gameMachine), 1e18);
        
        vm.expectRevert("Insufficient token balance");
        gameMachine.sellTokens(1e18);
    }
    
    // Test case: Non-owner calling getAim should revert because of onlyOwner modifier.
    function test_getAim_nonOwner() public {
        console.log("Running test_getAim_nonOwner");
        
        // Create a new address to simulate a non-owner caller.
        address nonOwner = address(0xBEEF);
        // Use vm.prank to simulate call from nonOwner.
        vm.prank(nonOwner);
        vm.expectRevert(); // We expect a revert because onlyOwner should block nonOwner
        gameMachine.getAim(0);
    }
    
    // Test case: Non-owner cannot withdraw the contract's ETH balance.
    function test_withdraw_nonOwner() public {
        console.log("Running test_withdraw_nonOwner");
        
        // Create a non-owner address.
        address nonOwner = address(0xABCD);
        vm.prank(nonOwner);
        vm.expectRevert(); // onlyOwner should prevent the withdrawal.
        gameMachine.withdraw();
    }
    
    // Test case: Only owner can mint tokens in GameToken contract.
    function test_GameToken_mint_accessControl() public {
        console.log("Running test_GameToken_mint_accessControl");
        
        // Simulate a non-owner trying to mint tokens directly on the GameToken contract.
        address nonOwner = address(0xDEAD);
        vm.prank(nonOwner);
        // Expect revert due to onlyOwner modifier in GameToken.mint.
        vm.expectRevert();
        gameToken.mint(nonOwner, 1000 * 10**18);
    }
    
    // Test case: Machine cannot accept more than MAX_PLAYERS players.
    function test_machineFull() public {
        console.log("Running test_machineFull");
        
        uint256 machineId = 0;
        uint256 betAmount = 1 ether; // Using 1 ether worth of tokens as bet; note that 1 ether * ETH_TO_TOKEN_RATE gives sufficient tokens relative to MIN_BET.
        
        // To simulate different players, we run a loop and use vm.prank with different addresses.
        for (uint256 i = 0; i < MAX_PLAYERS; i++) {
            // Derive a pseudo user address.
            address player = address(uint160(uint256(keccak256(abi.encodePacked(i)))));
            
            // Give the player some ETH so they can buy tokens.
            vm.deal(player, 1 ether);
            vm.prank(player);
            gameMachine.buyTokens{value: 1 ether}();
            
            // Approve GameMachine to spend tokens.
            vm.prank(player);
            gameToken.approve(address(gameMachine), type(uint256).max);
            
            // Place a bet on machine 0.
            vm.prank(player);
            gameMachine.placeBet(machineId, betAmount);
        }
        
        // Now, try with a new player (the 11th) and expect revert with "Machine is full".
        address extraPlayer = address(uint160(uint256(keccak256(abi.encodePacked("extraPlayer")))));
        vm.deal(extraPlayer, 1 ether);
        vm.prank(extraPlayer);
        gameMachine.buyTokens{value: 1 ether}();
        vm.prank(extraPlayer);
        gameToken.approve(address(gameMachine), type(uint256).max);
        vm.prank(extraPlayer);
        vm.expectRevert("Machine is full");
        gameMachine.placeBet(machineId, betAmount);
    }
    
    // Fallback and receive functions so the test contract can get ETH transfers if necessary
    receive() external payable {}
    fallback() external payable {}
}
