import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import detectEthereumProvider from '@metamask/detect-provider';
import 'bootstrap/dist/css/bootstrap.min.css';
import { Container, Row, Col, Card, Button, Form, Alert, Spinner } from 'react-bootstrap';
import GameMachineABI from './contracts/GameMachine.json';
import TokenABI from './contracts/GameToken.json';

function App() {
  // State variables
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [contract, setContract] = useState(null);
  const [tokenContract, setTokenContract] = useState(null);
  const [account, setAccount] = useState(null);
  const [networkName, setNetworkName] = useState('');
  const [tokenBalance, setTokenBalance] = useState('0');
  const [ethAmount, setEthAmount] = useState('');
  const [tokenAmount, setTokenAmount] = useState('');
  const [betAmount, setBetAmount] = useState('');
  const [selectedMachine, setSelectedMachine] = useState(0);
  const [machineStats, setMachineStats] = useState([
    { playerCount: 0, hasPlayed: false },
    { playerCount: 0, hasPlayed: false },
    { playerCount: 0, hasPlayed: false }
  ]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', content: '' });

  // Contract address - updated with the deployed contract address
  const contractAddress = '0x5acd86cdbf49cb5551a4790fdbce14d1ec78c16d';

  // Initialize the app
  useEffect(() => {
    const init = async () => {
      try {
        const provider = await detectEthereumProvider();
        
        if (provider) {
          const ethersProvider = new ethers.providers.Web3Provider(provider);
          setProvider(ethersProvider);
          
          // Set up event listener for account changes
          provider.on('accountsChanged', (accounts) => {
            if (accounts.length > 0) {
              setAccount(accounts[0]);
            } else {
              setAccount(null);
            }
            window.location.reload();
          });
          
          // Set up event listener for chain changes
          provider.on('chainChanged', () => {
            window.location.reload();
          });
          
          // Get network name
          const network = await ethersProvider.getNetwork();
          setNetworkName(network.name === 'unknown' ? 'Local Network' : network.name);
          
          // Try to get initial accounts
          const accounts = await provider.request({ method: 'eth_accounts' });
          if (accounts.length > 0) {
            setAccount(accounts[0]);
            const signer = ethersProvider.getSigner();
            setSigner(signer);
            
            // Initialize contracts
            if (contractAddress) {
              const gameContract = new ethers.Contract(contractAddress, GameMachineABI.abi, signer);
              setContract(gameContract);
              
              // Get token contract address
              const tokenAddress = await gameContract.gameToken();
              const tokenContract = new ethers.Contract(tokenAddress, TokenABI.abi, signer);
              setTokenContract(tokenContract);
              
              // Load user's token balance
              await updateTokenBalance(accounts[0], tokenContract);
              
              // Load machine stats
              await updateMachineStats(accounts[0], gameContract);
            }
          }
        } else {
          setMessage({
            type: 'warning',
            content: 'Please install MetaMask to use this dApp!'
          });
        }
      } catch (error) {
        console.error('Initialization error:', error);
        setMessage({
          type: 'danger',
          content: 'Error initializing app: ' + error.message
        });
      }
    };
    
    init();
  }, [contractAddress]);
  
  // Connect wallet function
  const connectWallet = async () => {
    try {
      setLoading(true);
      const accounts = await provider.request({ method: 'eth_requestAccounts' });
      
      if (accounts.length > 0) {
        setAccount(accounts[0]);
        const signer = provider.getSigner();
        setSigner(signer);
        
        // Initialize contracts
        if (contractAddress) {
          const gameContract = new ethers.Contract(contractAddress, GameMachineABI.abi, signer);
          setContract(gameContract);
          
          // Get token contract address
          const tokenAddress = await gameContract.gameToken();
          const tokenContract = new ethers.Contract(tokenAddress, TokenABI.abi, signer);
          setTokenContract(tokenContract);
          
          // Load user's token balance
          await updateTokenBalance(accounts[0], tokenContract);
          
          // Load machine stats
          await updateMachineStats(accounts[0], gameContract);
        }
      }
      setLoading(false);
    } catch (error) {
      console.error('Wallet connection error:', error);
      setMessage({
        type: 'danger',
        content: 'Error connecting wallet: ' + error.message
      });
      setLoading(false);
    }
  };
  
  // Update token balance
  const updateTokenBalance = async (address, tokenContract) => {
    if (tokenContract) {
      try {
        const balance = await tokenContract.balanceOf(address);
        setTokenBalance(ethers.utils.formatUnits(balance, 18));
      } catch (error) {
        console.error('Error fetching token balance:', error);
      }
    }
  };
  
  // Update machine stats
  const updateMachineStats = async (address, gameContract) => {
    if (gameContract) {
      try {
        const updatedStats = [...machineStats];
        
        const currentMachine = await gameContract.getCurrentMachine(address);
        const currentMachineIndex = currentMachine.toNumber() - 1; // Convert back to 0-based index
        
        for (let i = 0; i < 3; i++) {
          const playerCount = await gameContract.getMachinePlayerCount(i);
          
          updatedStats[i] = {
            playerCount: playerCount.toNumber(),
            hasPlayed: currentMachine.toNumber() > 0 && i !== currentMachineIndex // Player is playing on a different machine
          };
        }
        
        setMachineStats(updatedStats);
      } catch (error) {
        console.error('Error fetching machine stats:', error);
      }
    }
  };
  
  // Buy tokens
  const buyTokens = async () => {
    if (!contract || !ethAmount || parseFloat(ethAmount) <= 0) return;
    
    try {
      setLoading(true);
      setMessage({ type: '', content: '' });
      
      const tx = await contract.buyTokens({
        value: ethers.utils.parseEther(ethAmount)
      });
      
      setMessage({
        type: 'info',
        content: 'Transaction submitted. Waiting for confirmation...'
      });
      
      await tx.wait();
      
      setMessage({
        type: 'success',
        content: 'Tokens purchased successfully!'
      });
      
      // Update token balance
      await updateTokenBalance(account, tokenContract);
      
      // Clear input field
      setEthAmount('');
      setLoading(false);
    } catch (error) {
      console.error('Error buying tokens:', error);
      setMessage({
        type: 'danger',
        content: 'Error buying tokens: ' + error.message
      });
      setLoading(false);
    }
  };
  
  // Sell tokens
  const sellTokens = async () => {
    if (!contract || !tokenContract || !tokenAmount || parseFloat(tokenAmount) <= 0) return;
    
    try {
      setLoading(true);
      setMessage({ type: '', content: '' });
      
      console.log("--- SELL TOKENS TRACING ---");
      console.log("1. Original input tokenAmount:", tokenAmount);
      console.log("2. Parsed as float:", parseFloat(tokenAmount));
      console.log("3. ETH_TO_TOKEN_RATE:", 100000);
      console.log("4. Expected ETH to receive:", parseFloat(tokenAmount) / 100000);
      
      // Convert from human-readable format to a value with 18 decimals
      const formattedTokenAmount = ethers.utils.parseUnits(tokenAmount, 18);
      console.log("5. Formatted token amount with 18 decimals:", formattedTokenAmount.toString());
      
      // First approve the token transfer
      console.log("6. Approving token transfer...");
      const approvalAmount = ethers.utils.parseUnits('1000000', 18); // 1 million tokens
      const approveTx = await tokenContract.approve(contract.address, approvalAmount);
      
      setMessage({
        type: 'info',
        content: 'Approving token transfer. Please wait...'
      });
      
      await approveTx.wait();
      console.log("7. Token approval confirmed. Transaction hash:", approveTx.hash);
      
      // Then sell the tokens using the formatted amount with 18 decimals
      console.log("8. Selling tokens with formatted amount:", formattedTokenAmount.toString());
      const tx = await contract.sellTokens(formattedTokenAmount);
      
      setMessage({
        type: 'info',
        content: 'Transaction submitted. Waiting for confirmation...'
      });
      
      const receipt = await tx.wait();
      console.log("9. Sell transaction confirmed. Transaction hash:", tx.hash);
      
      // Check for any events
      if (receipt && receipt.events) {
        console.log("10. Transaction events found:", receipt.events.length);
        receipt.events.forEach((event, i) => {
          console.log(`Event ${i}:`, event);
          // If this is a TokensSold event, extract and display the data
          if (event && event.event === 'TokensSold') {
            console.log("TokensSold event found:");
            console.log("- Seller:", event.args.seller);
            console.log("- Token Amount:", event.args.tokenAmount.toString());
            console.log("- ETH Amount:", event.args.ethAmount.toString());
            console.log("- ETH Amount (readable):", ethers.utils.formatEther(event.args.ethAmount));
          }
        });
      }
      
      setMessage({
        type: 'success',
        content: 'Tokens sold successfully!'
      });
      
      // Update token balance
      await updateTokenBalance(account, tokenContract);
      
      // Clear input field
      setTokenAmount('');
      setLoading(false);
    } catch (error) {
      console.error('Error selling tokens:', error);
      setMessage({
        type: 'danger',
        content: 'Error selling tokens: ' + error.message
      });
      setLoading(false);
    }
  };
  
  // Place bet
  const placeBet = async () => {
    if (!contract || !tokenContract || !betAmount || parseFloat(betAmount) <= 0 || selectedMachine === null) return;
    
    try {
      setLoading(true);
      setMessage({ type: '', content: '' });
      
      // Check if player is already playing on a different machine
      const currentMachine = await contract.getCurrentMachine(account);
      if (currentMachine.toNumber() > 0 && currentMachine.toNumber() - 1 !== selectedMachine) {
        setMessage({
          type: 'warning',
          content: 'You are already playing on Machine ' + currentMachine.toNumber() + '!'
        });
        setLoading(false);
        return;
      }
      
      // Check if the player has enough tokens
      if (parseFloat(tokenBalance) < parseFloat(betAmount)) {
        setMessage({
          type: 'danger',
          content: `Insufficient token balance. You have ${parseFloat(tokenBalance).toFixed(2)} DGT but tried to bet ${parseFloat(betAmount)} DGT.`
        });
        setLoading(false);
        return;
      }
      
      // CRITICAL FIX: The contract is expecting raw integer values for bet amount check (0-10000)
      // but then uses that same value for token transfers where 18 decimals are expected
      // THIS IS A MISTAKE IN THE CONTRACT DESIGN
      
      // Convert amount to a value with 18 decimals
      const formattedBetAmount = ethers.utils.parseUnits(betAmount, 18);
      
      console.log("Placing bet of", betAmount, "tokens on machine", selectedMachine + 1);
      console.log("Formatted bet amount with 18 decimals:", formattedBetAmount.toString());
      
      // First approve a large amount to cover the transfer - with 18 decimals
      // This is a workaround for the contract's inconsistent handling of token values
      const largeApprovalAmount = ethers.utils.parseUnits('1000000', 18); // 1 million tokens
      const approveTx = await tokenContract.approve(contract.address, largeApprovalAmount);
      
      setMessage({
        type: 'info',
        content: 'Approving token transfer. Please wait...'
      });
      
      await approveTx.wait();
      
      console.log("Token approval confirmed. Transaction hash:", approveTx.hash);
      
      // Place the bet with the formatted amount (with 18 decimals)
      const tx = await contract.placeBet(selectedMachine, formattedBetAmount);
      
      setMessage({
        type: 'info',
        content: 'Transaction submitted. Waiting for confirmation...'
      });
      
      const receipt = await tx.wait();
      console.log("Bet transaction confirmed. Transaction hash:", tx.hash);
      console.log("Transaction receipt:", receipt);
      
      // Check for any events
      if (receipt && receipt.events) {
        console.log("Transaction events:", receipt.events);
        receipt.events.forEach((event, i) => {
          console.log(`Event ${i}:`, event);
        });
      }
      
      setMessage({
        type: 'success',
        content: 'Bet placed successfully! Check if you won!'
      });
      
      console.log("Transaction confirmed. Starting balance update...");
      
      // Force a delay before updating the token balance to ensure blockchain state is updated
      setTimeout(async () => {
        try {
          // Update token balance - get the latest balance from the blockchain
          if (tokenContract && account) {
            console.log("Fetching latest balance for account:", account);
            const oldBalance = tokenBalance;
            const latestBalance = await tokenContract.balanceOf(account);
            const formattedBalance = ethers.utils.formatUnits(latestBalance, 18);
            console.log("Old balance:", oldBalance);
            console.log("New token balance (raw):", latestBalance.toString());
            console.log("New token balance (formatted):", formattedBalance);
            setTokenBalance(formattedBalance);
            
            // If the balance hasn't changed, force a page refresh
            if (parseFloat(oldBalance) === parseFloat(formattedBalance)) {
              console.log("Balance didn't update, forcing page reload");
              setTimeout(() => window.location.reload(), 1000);
            }
          }
          
          // Update machine stats
          await updateMachineStats(account, contract);
          
          // Clear input field
          setBetAmount('');
          setLoading(false);
        } catch (error) {
          console.error("Error updating balance:", error);
          setLoading(false);
        }
      }, 3000); // Increased delay to ensure blockchain state is updated
    } catch (error) {
      console.error('Error placing bet:', error);
      setMessage({
        type: 'danger',
        content: 'Error placing bet: ' + error.message
      });
      setLoading(false);
    }
  };
  
  return (
    <Container className="py-5">
      <Row className="mb-4">
        <Col>
          <h1 className="text-center">DApps Game</h1>
          <p className="text-center">Try your luck on one of our three game machines!</p>
        </Col>
      </Row>
      
      {message.content && (
        <Row className="mb-4">
          <Col>
            <Alert variant={message.type} dismissible onClose={() => setMessage({ type: '', content: '' })}>
              {message.content}
            </Alert>
          </Col>
        </Row>
      )}
      
      <Row className="mb-4">
        <Col>
          <Card>
            <Card.Body>
              <Card.Title>Wallet Connection</Card.Title>
              <Card.Text>
                {account ? (
                  <>
                    <p>Connected Account: {account.substring(0, 6)}...{account.substring(account.length - 4)}</p>
                    <p>Network: {networkName}</p>
                    <p>Token Balance: {parseFloat(tokenBalance).toFixed(2)} DGT 
                      <Button 
                        variant="link" 
                        size="sm" 
                        onClick={async () => {
                          if (tokenContract && account) {
                            const balance = await tokenContract.balanceOf(account);
                            setTokenBalance(ethers.utils.formatUnits(balance, 18));
                            console.log("Manually refreshed balance:", ethers.utils.formatUnits(balance, 18));
                          }
                        }}
                      >
                        ↻
                      </Button>
                    </p>
                  </>
                ) : (
                  <p>Not connected to wallet</p>
                )}
              </Card.Text>
              {!account && (
                <Button variant="primary" onClick={connectWallet} disabled={loading}>
                  {loading ? <Spinner animation="border" size="sm" /> : 'Connect Wallet'}
                </Button>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
      
      {account && (
        <>
          <Row className="mb-4">
            <Col md={6}>
              <Card>
                <Card.Body>
                  <Card.Title>Buy Tokens</Card.Title>
                  <Form>
                    <Form.Group className="mb-3">
                      <Form.Label>ETH Amount</Form.Label>
                      <Form.Control 
                        type="number" 
                        placeholder="Amount of ETH to spend" 
                        value={ethAmount} 
                        onChange={(e) => setEthAmount(e.target.value)}
                      />
                      <Form.Text className="text-muted">
                        You'll receive {ethAmount ? (parseFloat(ethAmount) * 100000).toFixed(2) : '0'} DGT
                      </Form.Text>
                    </Form.Group>
                    <Button variant="success" onClick={buyTokens} disabled={loading || !ethAmount}>
                      {loading ? <Spinner animation="border" size="sm" /> : 'Buy Tokens'}
                    </Button>
                  </Form>
                </Card.Body>
              </Card>
            </Col>
            
            <Col md={6}>
              <Card>
                <Card.Body>
                  <Card.Title>Sell Tokens</Card.Title>
                  <Form>
                    <Form.Group className="mb-3">
                      <Form.Label>Token Amount</Form.Label>
                      <Form.Control 
                        type="number" 
                        placeholder="Amount of DGT to sell" 
                        value={tokenAmount} 
                        onChange={(e) => setTokenAmount(e.target.value)}
                      />
                      <Form.Text className="text-muted">
                        You'll receive {tokenAmount ? ethers.utils.formatEther(ethers.utils.parseUnits(tokenAmount, 18).div(ethers.BigNumber.from(100000))) : '0'} ETH
                      </Form.Text>
                    </Form.Group>
                    <Button variant="warning" onClick={sellTokens} disabled={loading || !tokenAmount}>
                      {loading ? <Spinner animation="border" size="sm" /> : 'Sell Tokens'}
                    </Button>
                  </Form>
                </Card.Body>
              </Card>
            </Col>
          </Row>
          
          <Row className="mb-4">
            <Col>
              <Card>
                <Card.Body>
                  <Card.Title>Game Machines</Card.Title>
                  <Card.Text>
                    Select a machine and place your bet!
                  </Card.Text>
                  
                  <Form>
                    <Form.Group className="mb-3">
                      <Form.Label>Select Machine</Form.Label>
                      <div className="d-flex justify-content-between mb-3">
                        {[0, 1, 2].map((machine) => (
                          <Card 
                            key={machine} 
                            className={`flex-fill mx-2 ${selectedMachine === machine ? 'border-primary' : ''}`}
                            onClick={() => setSelectedMachine(machine)}
                            style={{ cursor: 'pointer' }}
                          >
                            <Card.Body>
                              <Card.Title>Machine {machine + 1}</Card.Title>
                              <Card.Text>
                                Players: {machineStats[machine].playerCount}/10
                                <br/>
                                {machineStats[machine].hasPlayed ? 
                                  <span className="text-danger">Not available - playing on another machine</span> : 
                                  <span className="text-success">Available to play</span>
                                }
                              </Card.Text>
                            </Card.Body>
                          </Card>
                        ))}
                      </div>
                    </Form.Group>
                    
                    <Form.Group className="mb-3">
                      <Form.Label>Bet Amount (DGT)</Form.Label>
                      <Form.Control 
                        type="number" 
                        placeholder="Amount to bet (0-10000)" 
                        value={betAmount} 
                        onChange={(e) => setBetAmount(e.target.value)}
                        min="0"
                        max={Math.min(10000, parseFloat(tokenBalance))}
                      />
                      <Form.Text className="text-muted">
                        The bet must be between 0 and {Math.min(10000, parseFloat(tokenBalance)).toFixed(2)} DGT.
                      </Form.Text>
                    </Form.Group>
                    
                    <Button 
                      variant="primary" 
                      onClick={placeBet} 
                      disabled={
                        loading || 
                        !betAmount || 
                        parseFloat(betAmount) < 0 || 
                        parseFloat(betAmount) > 10000 ||
                        parseFloat(betAmount) > parseFloat(tokenBalance) ||
                        selectedMachine === null ||
                        machineStats[selectedMachine]?.hasPlayed
                      }
                    >
                      {loading ? <Spinner animation="border" size="sm" /> : 'Place Bet'}
                    </Button>
                  </Form>
                </Card.Body>
              </Card>
            </Col>
          </Row>
          
          <Row>
            <Col>
              <Card>
                <Card.Body>
                  <Card.Title>Game Rules</Card.Title>
                  <Card.Text>
                    <ol>
                      <li>Each game machine has a hidden target amount.</li>
                      <li>Players place bets (0-10,000 DGT) on a machine.</li>
                      <li>The player whose bet makes the machine reach or exceed the target wins the prize.</li>
                      <li>The prize equals the target amount.</li>
                      <li>Players can play multiple times on the same machine but cannot play on multiple machines simultaneously.</li>
                      <li>Each machine can have a maximum of 10 players.</li>
                      <li>Machines reset once a winner is determined.</li>
                    </ol>
                  </Card.Text>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </>
      )}
    </Container>
  );
}

export default App; 