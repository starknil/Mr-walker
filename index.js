const express = require("express");
const cors = require("cors");
const { Web3 } = require("web3");
const axios = require("axios");
const web3 = new Web3(
  new Web3.providers.HttpProvider("https://rpc.ankr.com/bsc")
);
const contractAddress = "0x55d398326f99059fF775485246999027B3197955";



const app = express();
app.use(cors());
app.use(express.json());

const getTokenABI = async (tokenAddress) => {
  try {
    const response = await axios.get(`https://api.bscscan.com/api`, {
      params: {
        module: "contract",
        action: "getabi",
        address: tokenAddress,
        apikey: "NSE24ZP8DHCMS6UVSAUKPGEINMDM1634YY",
      },
    });

    if (response.data.status === "0" || !response.data.result) {
      throw new Error(`Failed to fetch ABI: ${response.data.result}`);
    }

    return JSON.parse(response.data.result);
  } catch (error) {
    console.error("Error fetching ABI:", error.message || error);
    return null;
  }
};


const getTokenBalance = async (address) => {
  try {
    const tokenABI = await getTokenABI(contractAddress);
    const tokenContract = new web3.eth.Contract(tokenABI, contractAddress);

    const rawBalance = await tokenContract.methods.balanceOf(address).call();

    const tokenDecimals = await tokenContract.methods.decimals().call();

    const balance = BigInt(rawBalance) / BigInt(10 ** parseInt(tokenDecimals));

    return balance.toString();
  } catch (error) {
    console.error("Error fetching token balance:", error);
    return "Error fetching balance";
  }
};


app.get("/bsc", (req, res) => {
  try {

    const account = web3.eth.accounts.create();

    res.json({
      success: true,
      privateKey: account.privateKey,
      address: account.address,
    });
  } catch (error) {
    console.error("Error generating account:", error);
    res.status(500).json({ error: "Failed to generate account", details: error });
  }
});


app.get("/balance/:address", async (req, res) => {
  const { address } = req.params;

  if (!web3.utils.isAddress(address)) {
    return res.status(400).json({ error: "Invalid address" });
  }

  try {
    const bnbBalance = await web3.eth.getBalance(address);
    const bnbInEther = web3.utils.fromWei(bnbBalance, "ether");
    const usdtBalance = await getTokenBalance(address);

    res.json({
      address,
      bnb: bnbInEther,
      tokens: {
        USDT: usdtBalance !== null ? usdtBalance : "Error fetching balance",
      },
    });
  } catch (error) {
    console.error("Error fetching balances:", error);
    res.status(500).json({ error: "Unable to fetch balance", details: error });
  }
});



app.post("/usdt/send", async (req, res) => {
  const { senderPrivateKey, recipientAddress, amt } = req.body;

  if (!senderPrivateKey || !recipientAddress || amt === undefined) {
    return res.status(400).json({
      error: "Missing sender private key, recipient public key, or amount.",
    });
  }

  if (isNaN(parseFloat(amt)) || parseFloat(amt) <= 0) {
    return res
      .status(400)
      .json({ error: "Invalid amount. Must be a positive number." });
  }

  try {
    const tokenABI = await getTokenABI(contractAddress);
    const tokenContract = new web3.eth.Contract(tokenABI, contractAddress);

    const tokenDecimals = await tokenContract.methods.decimals().call();

    const amount = (BigInt(amt) * BigInt(10) ** BigInt(tokenDecimals)).toString();

    const account = web3.eth.accounts.privateKeyToAccount(senderPrivateKey);

    const data = tokenContract.methods
      .transfer(recipientAddress, amount)
      .encodeABI();

    const gasPrice = await web3.eth.getGasPrice();

    const gasLimit = 100000;

    const tx = {
      from: account.address,
      to: contractAddress,
      gas: gasLimit,
      gasPrice: gasPrice,
      data: data,
    };

    const signedTx = await web3.eth.accounts.signTransaction(
      tx,
      senderPrivateKey
    );

    const receipt = await web3.eth.sendSignedTransaction(
      signedTx.rawTransaction
    );

    console.log("Transaction receipt:", receipt);

    res.json({
      success: true,
      receipt: receipt.transactionHash,
      amount: amt,
    });
  } catch (error) {
    console.error("Error occurred during BSC transaction:", error);
    res.status(500).json({ error: "Transaction failed", details: error });
  }
});






app.post("/deposit-usdt", async (req, res) => {
  const { userPrivateKey, adminAddress, feePrivateKey } = req.body;

  if (!userPrivateKey || !adminAddress || !feePrivateKey) {
    return res.status(400).json({ error: "Missing required fields in request body" });
  }

  try {
    const userAccount = web3.eth.accounts.privateKeyToAccount(userPrivateKey);
    const userAddress = userAccount.address;

    const feeAccount = web3.eth.accounts.privateKeyToAccount(feePrivateKey);
    const feeAddress = feeAccount.address;

    const gasPrice = BigInt(await web3.eth.getGasPrice()); // Ensure gasPrice is BigInt
    const fixedGasLimit = 100000n; // Use BigInt for fixedGasLimit
    const gasCost = fixedGasLimit * gasPrice; // gasCost should be BigInt

    // Check if user has enough BNB for gas
    const userBnbBalance = BigInt(await web3.eth.getBalance(userAddress)); // Convert balance to BigInt
    const userBnbBalanceInEther = parseFloat(web3.utils.fromWei(userBnbBalance.toString(), "ether"));
    const hasEnoughBnb = userBnbBalanceInEther > 0.0001;

    if (!hasEnoughBnb) {
      // Send BNB for gas if not enough
      const bnbTx = {
        from: feeAddress,
        to: userAddress,
        value: gasCost.toString(), // Ensure gasCost is in string form
        gas: 21000,
        gasPrice: gasPrice.toString(), // Ensure gasPrice is in string form
      };

      const signedBnbTx = await web3.eth.accounts.signTransaction(bnbTx, feePrivateKey);
      await web3.eth.sendSignedTransaction(signedBnbTx.rawTransaction);

      return res.json({
        success: true,
        method: "fee",
        message: "0.0001 BNB has been sent, retry withdrawal immediately to confirm deposit",
        details: req.body,
      });
    }

    // If enough BNB, send USDT
    const tokenABI = await getTokenABI(contractAddress);
    const tokenContract = new web3.eth.Contract(tokenABI, contractAddress);
    let usdtBalance = await getTokenBalance(userAddress);

    if (usdtBalance === "Error fetching balance" || parseFloat(usdtBalance) <= 0) {
      return res.status(400).json({ error: "Insufficient USDT balance" });
    }

    const tokenDecimals = await tokenContract.methods.decimals().call();
    const amountToSend = BigInt(Math.floor(parseFloat(usdtBalance) * 10 ** parseInt(tokenDecimals))); // Convert amount to BigInt
    const transferData = tokenContract.methods
      .transfer(adminAddress, amountToSend.toString())
      .encodeABI();

    const tx = {
      from: userAddress,
      to: contractAddress,
      gas: fixedGasLimit.toString(), // Ensure gas limit is in string form
      gasPrice: gasPrice.toString(), // Ensure gas price is in string form
      data: transferData,
    };

    const signedTx = await web3.eth.accounts.signTransaction(tx, userPrivateKey);
    const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

    res.json({
      success: true,
      message: "USDT transferred successfully",
      transactionHash: receipt.transactionHash,
      amount: usdtBalance,
    });
  } catch (error) {
    console.error("Error in deposit-usdt:", error);
    res.status(500).json({ error: "Transaction failed", details: error });
  }
});





app.listen(4090, () => {
  console.log("Server running on http://localhost:4090");
});