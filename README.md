# DApps Game

A decentralized application game built on Ethereum where players can try their luck on three different game machines with hidden targets.

## Game Rules

1. Each game machine has a hidden target amount (normally distributed with mean 100,000 and standard deviation 10,000).
2. Each machine can have up to 10 players.
3. Players buy DApps Tokens (DGT) with ETH and place bets (0-10,000 DGT) on a machine.
4. A player can only play once on each machine before it resets.
5. When a player's bet causes the machine's total to reach or exceed the hidden target, that player wins!
6. The winner receives the target amount of DGT tokens as a prize.
7. After a win, the machine resets with a new hidden target.
8. The current total on each machine is hidden, adding an element of mystery and strategy.

## Contract Details

- GameMachine Contract: `0x5acd86cdbf49cb5551a4790fdbce14d1ec78c16d`
- Network: Sepolia Testnet
- App will be available at https://nhatminh37.github.io/dapps-game/

## Technology Used

- Solidity (Smart Contracts)
- React.js (Frontend)
- Web3.js (Blockchain Integration)
- Bootstrap (UI)
- GitHub Pages (Hosting) 