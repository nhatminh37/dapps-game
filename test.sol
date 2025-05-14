Generated Test Cases:


// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

// Dummy library to satisfy missing deliveryTime member in DeFiPaymentGateway.Order struct
library DeFiPaymentGateway {
    struct Order {
        uint256 deliveryTime;
    }
}

// Import Foundry's testing utilities and console for logging
import {Test, console} from "forge-std/Test.sol";

// Import the tested contract. 
import {GameMachine, GameToken} from "../src/GameMachine_21007491_1747217530.sol";

contract ContractTest is Test {
    GameMachine public gameMachine;
    GameToken public gameToken;

    // Define two user addresses for testing various scenarios
    address public user = address(0xBEEF);
    address public user2 = address(0xABCD);

    // setUp is called before each test case.
    function setUp() public {
        // Deploy the main game contract. Since the deployer becomes owner,
        // this contract (i.e. msg.sender in setUp) is the owner.
        gameMachine = new GameMachine();
        // Retrieve the GameToken instance created in the GameMachine constructor.
        gameToken = gameMachine.gameToken();

        // Fund test user accounts with ETH to simulate real users
        vm.deal(user, 10 ether);
        vm.deal(user2, 10 ether);

        // Fund the GameMachine contract with ETH so it can pay out token sales.
        vm.deal(address(gameMachine), 10 ether);
        console.log("GameMachine initial ETH balance: %d ether", address(gameMachine).balance / 1 ether);
    }

    // Test Case 1: Buying tokens with ETH should mint tokens accordingly.
    function test_buyTokens() public {
        console.log("Running test_buyTokens");
        // Have 'user' buy tokens by sending 1 ETH.
        vm.prank(user);
        uint256 ethVal = 1 ether;
        gameMachine.buyTokens{value: ethVal}();

        // Expected token amount = sent ETH * ETH_TO_TOKEN_RATE.
        uint256 expectedTokens = ethVal * gameMachine.ETH_TO_TOKEN_RATE();
        uint256 userTokenBalance = gameToken.balanceOf(user);
        console.log("User token balance: %s", vm.toString(userTokenBalance));
        assertEq(userTokenBalance, expectedTokens, "User token balance should match the token purchase amount");
    }

    // Test Case 2: Selling tokens back for ETH.
    function test_sellTokens() public {
        console.log("Running test_sellTokens");
        // Step 1: 'user' buys tokens.
        vm.prank(user);
        uint256 ethVal = 2 ether;
        gameMachine.buyTokens{value: ethVal}();
        uint256 tokenAmount = ethVal * gameMachine.ETH_TO_TOKEN_RATE();

        // Step 2: 'user' approves the GameMachine contract to spend their tokens.
        vm.prank(user);
        gameToken.approve(address(gameMachine), tokenAmount);

        // Step 3: 'user' sells half of their tokens.
        uint256 sellAmount = tokenAmount / 2;
        vm.prank(user);
        gameMachine.sellTokens(sellAmount);

        // Expected ETH return equals sellAmount divided by ETH_TO_TOKEN_RATE.
        uint256 expectedEth = sellAmount / gameMachine.ETH_TO_TOKEN_RATE();
        // Check that the GameMachine ETH balance has decreased by expectedEth.
        uint256 machineEthAfter = address(gameMachine).balance;
        assertEq(machineEthAfter, 10 ether - expectedEth, "GameMachine ETH balance should reduce by the sold ETH amount");
    }

    // Test Case 3: Normal bet placement (without triggering a win).
    function test_placeBet_normal() public {
        console.log("Running test_placeBet_normal");
        // Setup: 'user' buys tokens.
        vm.prank(user);
        gameMachine.buyTokens{value: 1 ether}();

        // Choose a bet amount within range (MIN_BET=0, MAX_BET=10000).
        uint256 betAmount = 500;
        // Approve the GameMachine contract to transfer tokens on behalf of 'user'.
        vm.prank(user);
        gameToken.approve(address(gameMachine), type(uint256).max);

        // Record initial token balance.
        uint256 initialTokenBalance = gameToken.balanceOf(user);

        // User places a bet on machine with ID 0.
        uint256 machineId = 0;
        vm.prank(user);
        gameMachine.placeBet(machineId, betAmount);

        // Verify the user's token balance decreased by betAmount.
        uint256 finalTokenBalance = gameToken.balanceOf(user);
        assertEq(finalTokenBalance, initialTokenBalance - betAmount, "User token balance should decrease by the bet amount");

        // Verify that the user is assigned to machineId+1 (playerMachine mapping uses 1-indexing for assigned machines).
        uint256 userMachine = gameMachine.getCurrentMachine(user);
        assertEq(userMachine, machineId + 1, "User should be assigned to the correct machine");

        // Verify the machine's player count has increased.
        uint256 playerCount = gameMachine.getMachinePlayerCount(machineId);
        assertEq(playerCount, 1, "Machine player count should be updated after placing a bet");

        // Verify via hasPlayed function.
        bool hasPlayed = gameMachine.hasPlayed(machineId, user);
        assertTrue(hasPlayed, "User should be recorded as having played on the machine");
    }

    // Test Case 4: Placing bets that trigger a win.
    // When the cumulative bets meet or exceed the machine's aim, the player wins.
    function test_placeBet_win() public {
        console.log("Running test_placeBet_win");
        // 'user' buys enough tokens for multiple bets.
        vm.prank(user);
        gameMachine.buyTokens{value: 5 ether}();
        uint256 machineId = 0;
        // Obtain the current aim for machine 0 (only owner can do this; this contract is the owner).
        uint256 aim = gameMachine.getAim(machineId);
        console.log("Machine aim: %s", vm.toString(aim));

        // Approve a huge allowance for repeated bets.
        vm.prank(user);
        gameToken.approve(address(gameMachine), type(uint256).max);

        uint256 cumulativeBet = 0;
        uint256 betAmount = gameMachine.MAX_BET(); // Each bet must not exceed MAX_BET.
        // Loop: Place bets until adding one more bet meets or exceeds the aim.
        while (cumulativeBet + betAmount < aim) {
            vm.prank(user);
            gameMachine.placeBet(machineId, betAmount);
            cumulativeBet += betAmount;
        }

        uint256 finalBet = aim - cumulativeBet;
        // In the rare event that finalBet is 0, we add one more bet to trigger the win.
        if (finalBet == 0) {
            finalBet = betAmount;
        }
        // Record token balance before the winning bet.
        uint256 balanceBefore = gameToken.balanceOf(user);
        vm.prank(user);
        gameMachine.placeBet(machineId, finalBet);
        // After win, prize tokens (equal to the aim) are minted.
        uint256 balanceAfter = gameToken.balanceOf(user);
        // Expected: balanceAfter = balanceBefore - finalBet (bet spent) + aim (prize)
        assertEq(balanceAfter, balanceBefore - finalBet + aim, "User token balance should reflect the win prize");

        // After a win, the machine is reset. Check that the machine's player count is 0.
        uint256 playerCountAfter = gameMachine.getMachinePlayerCount(machineId);
        assertEq(playerCountAfter, 0, "Machine player count should reset to 0 after a win");

        // Also, the user's current machine assignment should be reset to 0.
        uint256 userMachine = gameMachine.getCurrentMachine(user);
        assertEq(userMachine, 0, "User machine assignment should reset after winning");
    }

    // Test Case 5: Placing a bet with an amount exceeding MAX_BET should revert.
    function test_placeBet_revert_betTooHigh() public {
        console.log("Running test_placeBet_revert_betTooHigh");
        vm.prank(user);
        gameMachine.buyTokens{value: 1 ether}();

        uint256 excessiveBet = gameMachine.MAX_BET() + 1;
        vm.prank(user);
        gameToken.approve(address(gameMachine), excessiveBet);

        vm.prank(user);
        vm.expectRevert("Bet amount out of range");
        gameMachine.placeBet(0, excessiveBet);
    }

    // Test Case 6: Placing a bet with insufficient token balance should revert.
    function test_placeBet_revert_insufficientToken() public {
        console.log("Running test_placeBet_revert_insufficientToken");
        // 'user' does not buy any tokens here.
        vm.prank(user);
        gameToken.approve(address(gameMachine), 1000);

        vm.prank(user);
        vm.expectRevert("Insufficient token balance");
        gameMachine.placeBet(0, 1000);
    }

    // Test Case 7: A user already playing on one machine cannot bet on another.
    function test_placeBet_revert_alreadyPlayingOnAnotherMachine() public {
        console.log("Running test_placeBet_revert_alreadyPlayingOnAnotherMachine");
        vm.prank(user);
        gameMachine.buyTokens{value: 1 ether}();

        uint256 betAmount = 500;
        vm.prank(user);
        gameToken.approve(address(gameMachine), type(uint256).max);

        // Place a bet on machine 0.
        vm.prank(user);
        gameMachine.placeBet(0, betAmount);

        // Attempt to place a bet on machine 1 (different machine).
        vm.prank(user);
        vm.expectRevert("Already playing on another machine");
        gameMachine.placeBet(1, betAmount);
    }

    // Test Case 8: Owner withdrawal of ETH.
    function test_withdraw_owner() public {
        console.log("Running test_withdraw_owner");
        // Deposit extra ETH into GameMachine by sending via the fallback function.
        uint256 depositEth = 1 ether;
        (bool sent, ) = address(gameMachine).call{value: depositEth}("");
        require(sent, "Failed to deposit ETH");

        uint256 ownerEthBefore = address(this).balance;
        // Owner (this contract) withdraws the ETH.
        gameMachine.withdraw();
        uint256 ownerEthAfter = address(this).balance;
        assertGt(ownerEthAfter, ownerEthBefore, "Owner should receive the withdrawn ETH");
    }

    // Test Case 9: Non-owner calling withdraw() should revert due to access control.
    function test_withdraw_revert_nonOwner() public {
        console.log("Running test_withdraw_revert_nonOwner");
        vm.prank(user);
        vm.expectRevert("Ownable: caller is not the owner");
        gameMachine.withdraw();
    }
    
    // Test Case 10: Selling tokens should revert when the GameMachine has insufficient ETH.
    function test_sellTokens_revert_insufficientContractETH() public {
        console.log("Running test_sellTokens_revert_insufficientContractETH");
        // Deploy a fresh GameMachine which we can drain of ETH.
        GameMachine freshGameMachine = new GameMachine();
        GameToken freshGameToken = freshGameMachine.gameToken();
        
        // Have 'user' buy tokens from the fresh contract.
        vm.prank(user);
        freshGameMachine.buyTokens{value: 1 ether}();
        uint256 tokenAmount = 1 ether * freshGameMachine.ETH_TO_TOKEN_RATE();
        
        // Withdraw the ETH from freshGameMachine to ensure its balance is zero.
        freshGameMachine.withdraw();
        uint256 contractEthAfter = address(freshGameMachine).balance;
        assertEq(contractEthAfter, 0, "Fresh GameMachine should have 0 ETH after withdrawal");
        
        // 'user' approves the freshGameMachine to transfer their tokens.
        vm.prank(user);
        freshGameToken.approve(address(freshGameMachine), tokenAmount);
        
        vm.prank(user);
        vm.expectRevert("Contract has insufficient ETH");
        freshGameMachine.sellTokens(tokenAmount);
    }

    // Fallback and receive functions so the test contract can receive ETH if needed.
    receive() external payable {}
    fallback() external payable {}
}
