const express = require('express');
const TronWeb = require('tronweb');

const app = express();
const PORT = 3000;


app.use(express.json());


const USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';



async function estimateTransactionCost(address, amount) {
  try {

    const amountInSun = amount * 1000000; //tronWeb.toBigNumber(amount).times(1e6);

    
    const contract = await tronWeb.contract().at(USDT_CONTRACT);

    
    const energyEstimate = await contract.transfer(address, amountInSun).estimateEnergy();

    console.log('Estimated Energy Required: ', energyEstimate);
    console.log('Estimated Fee in TRX: ', energyEstimate.fee);


    const accountInfo = await tronWeb.trx.getAccount('<YOUR_TRON_ADDRESS>');
    const energyAvailable = accountInfo.energy;

    console.log('Energy Available: ', energyAvailable);

    if (energyAvailable >= energyEstimate.energy) {
  
      console.log('You have enough energy to proceed!');
      return true;
      
    } else {
      console.log('Insufficient energy! You need more TRX to freeze for energy.');
      return false;
    }

  } catch (error) {
    console.error('Error estimating transaction cost:', error);
    return false;
  }
}




app.get('/', (req, res) => {
  res.send('Api developed by t.me/stark_nilxxx');
});


app.post('/send/usdt', async (req, res) => {
  const { address, privateKey, amount } = req.body;

  if (!address || !privateKey || !amount) {
    return res.status(400).json({ error: 'Missing required fields: address, privateKey, or amount' });
  }


  try {
    
    
    const enoughFees = await estimateTransactionCost(address, amount);

    if (enoughFees !== true){
      return res.status(500).json({ success: false, error: "Not enough fee or Energy" });
    }
    const tronWeb = new TronWeb({
      fullHost: 'https://api.trongrid.io',
      privateKey
    });
    
    const amountInSun = amount * 1000000; //tronWeb.toBigNumber(amount).times(1e6);


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