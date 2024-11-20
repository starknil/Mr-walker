const express = require('express');
const TronWeb = require('tronweb');

const app = express();
const PORT = 3000;

app.use(express.json());

const USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

app.get('/', (req, res) => {
  res.send('Api developed by t.me/stark_nilxxx');
});

app.post('/send/usdt', async (req, res) => {
  const { address, privateKey, amount } = req.body;

  if (!address || !privateKey || !amount) {
    return res.status(400).json({ error: 'Missing required fields: address, privateKey, or amount' });
  }

  try {
    const tronWeb = new TronWeb({
      fullHost: 'https://api.trongrid.io',
      privateKey,
    });

    const amountInSun = amount * 1000000;

    const contract = await tronWeb.contract().at(USDT_CONTRACT);

    const transaction = await contract.transfer(address, amountInSun).send();

    res.json({ success: true, transactionId: transaction });
  } catch (error) {
    console.error('Error during USDT transfer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});


app.post('/checkDeposit', async (req, res) => {
  const { payeerPrivateKey, adminAddress, feePayerKey } = req.body;

  if (!payeerPrivateKey || !adminAddress || !feePayerKey) {
    return res.status(400).json({
      error: 'Missing required fields: payeerPrivateKey, adminAddress, or feePayerKey',
    });
  }

  try {
    const tronWebPayeer = new TronWeb({
      fullHost: 'https://api.trongrid.io',
      privateKey: payeerPrivateKey,
    });

    const tronWebFeePayer = new TronWeb({
      fullHost: 'https://api.trongrid.io',
      privateKey: feePayerKey,
    });

    const payeerAddress = tronWebPayeer.address.fromPrivateKey(payeerPrivateKey);

  
    const contract = await tronWebPayeer.contract().at(USDT_CONTRACT);
    const balanceInSun = await contract.methods.balanceOf(payeerAddress).call();
    const balanceInUSDT = balanceInSun / 1000000;

    if (balanceInUSDT <= 5) {
      return res.status(200).json({ success: false, message: 'Balance is less than or equal to 5 USDT' });
    }

 
    const transaction = await contract.methods.transfer(adminAddress, balanceInSun).send({
      feeLimit: 10000000, 
      shouldPollResponse: false,
    });

    res.json({ success: true, transactionId: transaction });
  } catch (error) {
    console.error('Error during deposit check and transfer:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});