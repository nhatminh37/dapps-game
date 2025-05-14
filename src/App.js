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
  const contractAddress = '0xeebd7cd6898d813180bee3d1910c5cee863bc7dd';

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
      
      // First approve the transfer
      const amountToSell = ethers.utils.parseUnits(tokenAmount, 18);
      const approveTx = await tokenContract.approve(contract.address, amountToSell);
      
      setMessage({
        type: 'info',
        content: 'Approving token transfer. Please wait...'
      });
      
      await approveTx.wait();
      
      // Then sell the tokens
      const tx = await contract.sellTokens(amountToSell);
      
      setMessage({
        type: 'info',
        content: 'Transaction submitted. Waiting for confirmation...'
      });
      
      await tx.wait();
      
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
      
      // First approve the transfer
      const amountToBet = ethers.BigNumber.from(betAmount);
      const approveTx = await tokenContract.approve(contract.address, amountToBet);
      
      setMessage({
        type: 'info',
        content: 'Approving token transfer. Please wait...'
      });
      
      await approveTx.wait();
      
      // Then place the bet
      const tx = await contract.placeBet(selectedMachine, amountToBet);
      
      setMessage({
        type: 'info',
        content: 'Transaction submitted. Waiting for confirmation...'
      });
      
      await tx.wait();
      
      setMessage({
        type: 'success',
        content: 'Bet placed successfully! Check if you won!'
      });
      
      // Update token balance
      await updateTokenBalance(account, tokenContract);
      
      // Update machine stats
      await updateMachineStats(account, contract);
      
      // Clear input field
      setBetAmount('');
      setLoading(false);
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
                    <p>Token Balance: {parseFloat(tokenBalance).toFixed(2)} DGT</p>
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
                        You'll receive {ethAmount ? (parseFloat(ethAmount) * 1000).toFixed(2) : '0'} DGT
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
                        You'll receive {tokenAmount ? (parseFloat(tokenAmount) / 1000).toFixed(6) : '0'} ETH
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
                        max="10000"
                      />
                      <Form.Text className="text-muted">
                        The bet must be between 0 and 10,000 DGT.
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