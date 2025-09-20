import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import sqlite3 from 'sqlite3';
import { WebSocket } from 'ws';
import axios from 'axios';
import cors from 'cors';

const app = express();
const HARD_CODED_MINT = '6PNDuznRwYkr7m5r8jBhJ9cf53EYu9nx8g7yhsv8vcuu';
const PUMP_API_KEY = process.env.PUMP_API_KEY;

// SQLite setup (in-memory, reset per invocation)
const db = new sqlite3.Database(':memory:');
db.serialize(() => {
  db.run('CREATE TABLE IF NOT EXISTS mcap (mint TEXT PRIMARY KEY, value REAL, solPrice REAL, timestamp INTEGER)');
  db.run('INSERT OR REPLACE INTO mcap (mint, value, solPrice, timestamp) VALUES (?, 0, 150, ?)', [HARD_CODED_MINT, Date.now()]);
});

// In-memory cache (reset per invocation)
let mcapCache = { mcap: 0, solPrice: 150, timestamp: Date.now(), error: 'No data yet' };

// Middleware
app.use(cors());
app.use(express.json());

// Fetch SOL price
let solPrice = 150;
const fetchSolPrice = async () => {
  try {
    const res = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
    solPrice = res.data.solana.usd;
    console.log('SOL price:', solPrice);
  } catch (err) {
    console.error('SOL price fetch error:', err);
  }
};

// Fallback to PumpPortal REST API
const fetchPumpPortalMcap = async () => {
  try {
    const res = await axios.get(`https://api-v2.pump.fun/tokens/${HARD_CODED_MINT}`, {
      headers: { 'Authorization': `Bearer ${PUMP_API_KEY}` }
    });
    console.log('PumpPortal REST response:', res.data);
    const data = res.data;
    let mcap = 0;
    if (data.marketCap) {
      mcap = parseFloat(data.marketCap);
      console.log('PumpPortal REST MCAP (direct):', mcap);
    } else if (data.price && data.supply) {
      mcap = parseFloat(data.price) * parseFloat(data.supply);
      console.log('PumpPortal REST MCAP (price * supply):', mcap);
    }
    return mcap;
  } catch (err) {
    console.error('PumpPortal REST fetch error:', err);
    return 0;
  }
};

// WebSocket for PumpPortal (runs per invocation, limited in serverless)
let lastValidMcap = 0;
let lastWsUpdate = Date.now();
const connectWebSocket = () => {
  if (!PUMP_API_KEY) {
    console.error('PUMP_API_KEY is not defined in .env');
    return;
  }
  const ws = new WebSocket(`wss://pumpportal.fun/api/data?api-key=${PUMP_API_KEY}`);
  ws.on('open', () => {
    ws.send(JSON.stringify({
      method: 'subscribeTokenTrade',
      keys: [HARD_CODED_MINT],
    }));
    console.log('WebSocket connected');
  });
  ws.on('message', (data) => {
    const trade = JSON.parse(data);
    console.log('WebSocket trade:', trade);
    let calculatedMcap = 0;
    let source = 'none';
    if (trade.marketCapSol) {
      calculatedMcap = parseFloat(trade.marketCapSol) * solPrice;
      source = 'WebSocket marketCapSol';
      console.log('Using WebSocket marketCapSol:', trade.marketCapSol, 'MCAP:', calculatedMcap);
    } else if (trade.vTokensInBondingCurve && trade.vSolInBondingCurve) {
      const tokensMinted = trade.vTokensInBondingCurve / 1e6;
      const solMinted = trade.vSolInBondingCurve / 1e9;
      console.log('Tokens minted:', tokensMinted, 'SOL minted:', solMinted);
      if (tokensMinted > 0) {
        const pricePerTokenSol = solMinted / tokensMinted;
        const pricePerTokenUsd = pricePerTokenSol * solPrice;
        const totalSupply = 1_000_000_000;
        calculatedMcap = pricePerTokenUsd * totalSupply;
        source = 'WebSocket bonding curve';
        console.log('Price per token (SOL):', pricePerTokenSol, 'Price per token (USD):', pricePerTokenUsd, 'MCAP:', calculatedMcap);
      }
    }
    if (calculatedMcap > 0) {
      lastValidMcap = calculatedMcap;
      lastWsUpdate = Date.now();
    }
    const valueToStore = calculatedMcap > 0 ? calculatedMcap : lastValidMcap;
    console.log('Storing MCAP:', valueToStore, 'Source:', source);
    db.run(
      'INSERT OR REPLACE INTO mcap (mint, value, solPrice, timestamp) VALUES (?, ?, ?, ?)',
      [HARD_CODED_MINT, valueToStore, solPrice, Date.now()],
      (err) => {
        if (!err) {
          mcapCache = {
            mcap: valueToStore,
            solPrice,
            timestamp: Date.now(),
            error: valueToStore === 0 ? 'No valid trades or token migrated. Using last valid MCAP.' : '',
          };
        }
      }
    );
  });
  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
    setTimeout(connectWebSocket, 5000);
  });
  ws.on('close', () => {
    console.log('WebSocket closed. Reconnecting...');
    setTimeout(connectWebSocket, 5000);
  });
};

// Fallback to REST if no WebSocket updates
setInterval(async () => {
  if (Date.now() - lastWsUpdate > 30000) {
    console.log('No WebSocket updates for 30s. Fetching from PumpPortal REST API.');
    const restMcap = await fetchPumpPortalMcap();
    if (restMcap > 0) {
      lastValidMcap = restMcap;
      db.run(
        'INSERT OR REPLACE INTO mcap (mint, value, solPrice, timestamp) VALUES (?, ?, ?, ?)',
        [HARD_CODED_MINT, restMcap, solPrice, Date.now()],
        (err) => {
          if (!err) {
            mcapCache = {
              mcap: restMcap,
              solPrice,
              timestamp: Date.now(),
              error: '',
            };
            console.log('Stored MCAP from REST:', restMcap);
          }
        }
      );
    }
  }
}, 10000);

// Start WebSocket and SOL price fetch
connectWebSocket();
fetchSolPrice();
setInterval(fetchSolPrice, 60000);

// API endpoint
app.get('/api/mcap', (req, res) => {
  if (Date.now() - mcapCache.timestamp < 5000) {
    console.log('Serving cached MCAP:', mcapCache);
    return res.json(mcapCache);
  }
  db.get('SELECT value, solPrice, timestamp FROM mcap WHERE mint = ?', [HARD_CODED_MINT], (err, row) => {
    if (err) {
      console.error('DB error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    if (!row) {
      mcapCache = { mcap: lastValidMcap, solPrice, timestamp: Date.now(), error: 'No data yet' };
      return res.json(mcapCache);
    }
    mcapCache = {
      mcap: row.value,
      solPrice: row.solPrice,
      timestamp: row.timestamp,
      error: row.value === 0 ? 'No valid trades or token migrated. Using last valid MCAP.' : '',
    };
    console.log('Serving DB MCAP:', mcapCache);
    res.json(mcapCache);
  });
});

// Export for Vercel serverless
export default app;