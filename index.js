const express = require('express');
const TronWeb = require('tronweb');

const app = express();
const PORT = 3000;


app.use(express.json());


const USDT_CONTRACT = 'TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj';


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
      privateKey
    });
    
    const amountInSun = tronWeb.toBigNumber(amount).times(1e6);

    const contract = await tronWeb.contract().at(USDT_CONTRACT);

    const transaction = await contract.transfer(address, amountInSun).send();

    res.json({ success: true, transactionId: transaction });
    
  } catch (error) {
    
    console.error('Error during USDT transfer:', error);
    
    res.status(500).json({ success: false, error: error.message });
  }
});




app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});