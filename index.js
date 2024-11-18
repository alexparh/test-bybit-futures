const express = require('express');
const WebSocket = require('ws');
const crypto = require('crypto');
require('dotenv').config()

const app = express();
app.use(express.json());

const { API_KEY, API_SECRET, RECV_WINDOW: RECV_WINDOW = '5000', BYBIT_API_URL, BYBIT_WS_URL, PORT: PORT = 3000 } = process.env;

function getSignature(data, timestamp) {
    return crypto.createHmac('sha256', API_SECRET).update(timestamp + API_KEY + RECV_WINDOW + data).digest('hex');
}

function getHeaders(body){
    const timestamp = Date.now().toString();
    const signature = getSignature(body, timestamp);
  
    return {
      'Content-Type': 'application/json',
      'X-BAPI-SIGN-TYPE': '2',
      'X-BAPI-API-KEY': API_KEY, 
      'X-BAPI-TIMESTAMP': timestamp, 
      'X-BAPI-RECV-WINDOW': RECV_WINDOW, 
      'X-BAPI-SIGN': signature
    }
}

async function setLeverage({ leverage, symbol }) {
  const body = JSON.stringify({
    category: 'linear',
    symbol,
    buyLeverage: leverage,
    sellLeverage: leverage,
  });

  try {
    const res = await fetch(`${BYBIT_API_URL}/position/set-leverage`, {
        method: 'POST',
        headers: getHeaders(body),
        body,
    });

    const data = await res.json();
    if (data && data.retCode === 0) {
      console.log(`Leverage ${leverage} for ${symbol} set successfully`);
      return true;
    } else {
      console.error('Error while setting leverage', data.retMsg);
      return false;
    }
  } catch (error) {
    console.error('Error in setLeverage', error);
    return null;
  }   
}

async function createLongLimitOrder({ price, qty, symbol, takeProfit, stopLoss }) {
  const body = JSON.stringify({
    category: 'linear',
    symbol,
    side: 'Buy',
    orderType: 'Limit',
    qty,
    price,
    isLeverage: 1,
    takeProfit: takeProfit,
    stopLoss: stopLoss,
  });

  try {
    const res = await fetch(`${BYBIT_API_URL}/order/create`, {
        method: 'POST',
        headers: getHeaders(body),
        body,
    });

    const data = await res.json();

    if (data && data.retCode === 0) {
      console.log('Order created successfully:', data.result.orderId);
      return data.result.orderId;
    } else {
      console.error('Error creating order:', data.retMsg);
      return null;
    }
  } catch (error) {
    console.error('Error in createLongLimitOrder:', error);
    return null;
  }
}

function listenForOrderCompletion() {
  const ws = new WebSocket(BYBIT_WS_URL, {
    headers: {
      'X-BYBIT-APIKEY': API_KEY,
    },
  });

  ws.on('open', () => {
    console.log('WebSocket connected');
    const expires = new Date().getTime() + 10000;
	const signature = crypto.createHmac("sha256", API_SECRET).update("GET/realtime" + expires).digest("hex");
    ws.send(JSON.stringify({
      op: 'auth',
      args: [API_KEY, expires.toFixed(0), signature],
    }));
    ws.ping();
    ws.send(JSON.stringify({"op": "subscribe", "args": ['order']}));
  });

  ws.on('message', (data) => {
    const parsedData = JSON.parse(Buffer.from(data).toString());
    if (parsedData.data && parsedData.data[0].orderStatus == 'Filled') {
      console.log(`Order completed - id: ${parsedData.data[0].orderId}`);
      ws.close();
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
}

app.post('/createLongLimitOrder', async (req, res) => {
  const { price, qty, symbol, leverage, takeProfit, stopLoss } = req.body;

  const isLeverageSet = await setLeverage({ leverage, symbol });
  if (!isLeverageSet){
    res.status(500).json({ error: 'Failed to set leverage' });
  }

  const orderId = await createLongLimitOrder({ price, qty, symbol, takeProfit, stopLoss });
  if (orderId) {
    res.status(200).json({ message: 'Order created', orderId });
  } else {
    res.status(500).json({ error: 'Failed to create order' });
  }
});

app.listen(PORT, () => {
  listenForOrderCompletion();
  console.log(`Server running on http://localhost:${PORT}`);
});
