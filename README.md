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

- GameMachine Contract: `0xd7ac7ef3273a99d2e1fb7a5c4fe0ce25f54d675b`
- Network: Sepolia Testnet

## Deployment Steps

1. Create a GitHub repository named "dapps-game"

2. Initialize and push the code:
   ```
   cd dapps-game-github-deploy
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/nhatminh37/dapps-game.git
   git push -u origin main
   ```

3. Install dependencies and deploy:
   ```
   npm install
   npm run deploy
   ```

4. Go to your GitHub repository settings:
   - Find the "Pages" section
   - Ensure source is set to "gh-pages" branch
   - Your app will be available at https://nhatminh37.github.io/dapps-game

## Technology Used

- Solidity (Smart Contracts)
- React.js (Frontend)
- Web3.js (Blockchain Integration)
- Bootstrap (UI)
- GitHub Pages (Hosting) 