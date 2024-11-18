# test-bybit-futures

## Project setup

### Install dependences

```bash
$ npm install
```

### Update .env with .env.example

### Run server

```bash
$ npm run start
```

### Use route /createLongLimitOrder

```bash
$ curl -X POST http://localhost:3000/createLongLimitOrder \
  -H "Content-Type: application/json" \
  -d '{
    "price": "85000",
    "qty": "0.01",
    "symbol": "BTCUSDT",
    "leverage": "10",
    "takeProfit": "100000",
    "stopLoss": "80000",
  }'
```