// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// Game Token
contract GameToken is ERC20, Ownable {
    constructor() ERC20("DApps Game Token", "DGT") Ownable(msg.sender) {}
    
    // Mint tokens to an address (only owner can call)
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
}

// Main Game Contract
contract GameMachine is Ownable {
    GameToken public gameToken;
    
    struct Machine {
        uint256 currentTotal;
        uint256 aim;
        uint256 playerCount;
        bool active;
        mapping(address => bool) players;
        address[] playerAddresses; // Array to store player addresses
    }
    
    // Constants
    uint256 public constant MAX_PLAYERS = 10;
    uint256 public constant MIN_BET = 0;
    uint256 public constant MAX_BET = 10000;
    uint256 public constant ETH_TO_TOKEN_RATE = 1000; // 1 ETH = 1000 tokens
    
    // Three game machines
    Machine[3] public machines;
    
    // Add this mapping to track which machine a player is playing on
    mapping(address => uint256) public playerMachine; // 0 = not playing, 1-3 = machine number
    
    // Events
    event TokensPurchased(address indexed buyer, uint256 ethAmount, uint256 tokenAmount);
    event TokensSold(address indexed seller, uint256 tokenAmount, uint256 ethAmount);
    event BetPlaced(address indexed player, uint256 machineId, uint256 amount);
    event GameWon(address indexed winner, uint256 machineId, uint256 prize);
    event GameReset(uint256 machineId, uint256 newAim);
    
    constructor() Ownable(msg.sender) {
        gameToken = new GameToken();
        
        // Initialize game machines
        for(uint i = 0; i < 3; i++) {
            resetMachine(i);
        }
    }
    
    // Internal function to generate a random aim (normally distributed)
    // In a real-world scenario, you'd use an oracle for this
    function _generateAim() internal view returns (uint256) {
        uint256 randomValue = uint256(keccak256(abi.encodePacked(
            block.timestamp, 
            block.prevrandao, 
            msg.sender
        )));
        
        // Box-Muller approximation
        uint256 u1 = (randomValue % 1000) / 1000;
        uint256 u2 = ((randomValue / 1000) % 1000) / 1000;
        
        // Calculate z using Box-Muller (simplified)
        int256 z = int256(int256(u1) * 15000 / 500);
        
        // Apply mean and standard deviation
        uint256 aim = 100000 + uint256(z);
        
        return aim;
    }
    
    // Get player address by index for a specific machine
    function getPlayerAtIndex(uint256 machineId, uint256 index) internal view returns (address) {
        require(machineId < 3, "Invalid machine ID");
        require(index < machines[machineId].playerCount, "Index out of bounds");
        return machines[machineId].playerAddresses[index];
    }
    
    // Reset a game machine
    function resetMachine(uint256 machineId) internal {
        require(machineId < 3, "Invalid machine ID");
        
        uint256 newAim = _generateAim();
        
        // Reset machine state
        machines[machineId].currentTotal = 0;
        machines[machineId].aim = newAim;
        
        // Clear player assignments for this machine
        for (uint i = 0; i < machines[machineId].playerCount; i++) {
            address player = getPlayerAtIndex(machineId, i);
            if (playerMachine[player] == machineId + 1) {
                playerMachine[player] = 0;
            }
        }
        
        // Clear the player addresses array
        delete machines[machineId].playerAddresses;
        
        machines[machineId].playerCount = 0;
        machines[machineId].active = true;
        
        emit GameReset(machineId, newAim);
    }
    
    // Buy game tokens with ETH
    function buyTokens() external payable {
        require(msg.value > 0, "Must send ETH to buy tokens");
        
        uint256 tokenAmount = msg.value * ETH_TO_TOKEN_RATE;
        
        // Mint new tokens to the buyer
        gameToken.mint(msg.sender, tokenAmount);
        
        emit TokensPurchased(msg.sender, msg.value, tokenAmount);
    }
    
    // Sell tokens back for ETH
    function sellTokens(uint256 tokenAmount) external {
        require(tokenAmount > 0, "Must sell more than 0 tokens");
        require(gameToken.balanceOf(msg.sender) >= tokenAmount, "Insufficient token balance");
        
        uint256 ethAmount = tokenAmount / ETH_TO_TOKEN_RATE;
        require(address(this).balance >= ethAmount, "Contract has insufficient ETH");
        
        // First transfer tokens to the contract
        require(gameToken.transferFrom(msg.sender, address(this), tokenAmount), "Token transfer failed");
        
        // Then send ETH back to the user
        (bool sent, ) = msg.sender.call{value: ethAmount}("");
        require(sent, "Failed to send ETH");
        
        emit TokensSold(msg.sender, tokenAmount, ethAmount);
    }
    
    // Place a bet on a machine
    function placeBet(uint256 machineId, uint256 betAmount) external {
        require(machineId < 3, "Invalid machine ID");
        require(machines[machineId].active, "Machine is not active");
        
        // Check if player is playing on a different machine
        uint256 currentMachine = playerMachine[msg.sender];
        require(currentMachine == 0 || currentMachine == machineId + 1, "Already playing on another machine");
        
        require(machines[machineId].playerCount < MAX_PLAYERS, "Machine is full");
        require(betAmount >= MIN_BET && betAmount <= MAX_BET, "Bet amount out of range");
        require(gameToken.balanceOf(msg.sender) >= betAmount, "Insufficient token balance");
        
        // Transfer tokens to the contract
        require(gameToken.transferFrom(msg.sender, address(this), betAmount), "Token transfer failed");
        
        // Record that this player is playing on this machine
        if (currentMachine == 0) {
            // First time playing on this machine
            playerMachine[msg.sender] = machineId + 1; // Store 1-based index
            machines[machineId].players[msg.sender] = true;
            machines[machineId].playerAddresses.push(msg.sender);
            machines[machineId].playerCount++;
        }
        
        // Add the bet to the current total
        uint256 newTotal = machines[machineId].currentTotal + betAmount;
        machines[machineId].currentTotal = newTotal;
        
        emit BetPlaced(msg.sender, machineId, betAmount);
        
        // Check if this bet reached or exceeded the aim
        if (newTotal >= machines[machineId].aim) {
            // Player wins!
            uint256 prize = machines[machineId].aim;
            
            // Give prize tokens to the winner
            gameToken.mint(msg.sender, prize);
            
            emit GameWon(msg.sender, machineId, prize);
            
            // Reset the machine for a new game
            resetMachine(machineId);
        }
    }
    
    // Admin function to check the aim (for testing)
    function getAim(uint256 machineId) external view onlyOwner returns (uint256) {
        require(machineId < 3, "Invalid machine ID");
        return machines[machineId].aim;
    }
    
    // Check if a player has already participated in a specific machine
    function hasPlayed(uint256 machineId, address player) external view returns (bool) {
        require(machineId < 3, "Invalid machine ID");
        return machines[machineId].players[player];
    }
    
    // Get machine player count
    function getMachinePlayerCount(uint256 machineId) external view returns (uint256) {
        require(machineId < 3, "Invalid machine ID");
        return machines[machineId].playerCount;
    }
    
    // Owner can withdraw ETH from the contract
    function withdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No ETH to withdraw");
        
        (bool sent, ) = msg.sender.call{value: balance}("");
        require(sent, "Failed to withdraw ETH");
    }
    
    // Function to receive ETH
    receive() external payable {}
    
    function getCurrentMachine(address player) external view returns (uint256) {
        return playerMachine[player]; // 0 = not playing, 1-3 = machine number
    }
} 