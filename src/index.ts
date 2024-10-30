import WebSocket from 'ws';
import express from 'express';
import { createClient, RedisClientType } from 'redis';
/*
v1 : binance 
*/
const ENDPOINT_VERSION = '/v1';
// Binance WebSocket URL for all ticker prices
const BINANCE_WS_URL = 'wss://stream.binance.com:9443/ws/!ticker@arr';
const BINANCE_F_WS_URL = 'wss://stream.binancefuture.com:9443/ws/!ticker@price';
/*
REST API ONLY
The following base endpoints are available. 
Please use whichever works best for your setup:
https://api.binance.com
https://api-gcp.binance.com
https://api1.binance.com
https://api2.binance.com
https://api3.binance.com
https://api4.binance.com

https://fapi.binance.com

WEBSOCKETS
wss://stream.binancefuture.com
The base endpoint is: wss://ws-fapi.binance.com/ws-fapi/v1
A single connection can listen to a maximum of 1024 streams.
There is a limit of 300 connections per attempt every 5 minutes per IP.
*/



/*
import { AevoClient, AevoChainType } from "aevo-js-sdk";

const aevoClient = new AevoClient({
  signingKey: process.env.PRIVATE_KEY,
  walletAddress: process.env.PUBLUC_ADDRESS,
  apiKey: process.env.AEVO_API_KEY,
  apiSecret: process.env.AEVO_API_SECRET,
  chain: "mainnet" as AevoChainType ,
  silent: false
});


// AEVO : create rest client
const restClient = new AevoClient().getRestApiClient();

const testAevo = async () => {

    const data = await restClient.getMarkets({
        asset: "ETH",
        instrument_type: "OPTION",
      });

      console.log("AEVO REST API ", data);


}

testAevo();

*/


const app = express();
/*
Metatrader only works with port 80 with http and 443 with https
*/
const port = process.env.PORT || 80;

// Middleware to parse JSON bodies
app.use(express.json());


// Initialize Redis Client
const redisClient: RedisClientType = createClient({
    url: process.env.REDIS_URL,
});

redisClient.on('error', (err) => {
    console.error('Redis Client Error:', err);
});

// Connect to Redis
const connectRedis = async () => {
    try {
        await redisClient.connect();
        console.log('Connected to Redis');
    } catch (error) {
        console.error('Failed to connect to Redis:', error);
    }
};

connectRedis();



// WebSocket connection variables
let ws: WebSocket | null = null;
let reconnectInterval = 1000; // Start with 3 second
const MAX_RECONNECT_INTERVAL = 30000; // Max 30 seconds

// Helper: Connect to WebSocket with error handling
function connectWebSocket() {

    ws = new WebSocket(BINANCE_WS_URL);

    ws.on('open', () => {
        console.log('Connected to Binance WebSocket');
        reconnectInterval = 1000; // Reset reconnect interval on success
        startPing();
    });

    ws.on('message', (data: WebSocket.Data) => {
        handleTickerData(data);
    });

    ws.on('close', (code, reason) => {
        console.warn(`WebSocket closed: ${code} - ${reason}`);
        reconnect();
    });

    ws.on('error', (err) => {
        console.error('WebSocket Error:', err.message);
        reconnect();
    });
}

// Helper: Handle ticker data from Binance
interface TickerData {
    s: string; // Symbol
    c: string; // Last price
    a: string;
    b: string;
    v: string;
}

// Sort websocket data and store to redis
function handleTickerData(data: WebSocket.Data) {
    try {
        const tickers: TickerData[] = JSON.parse(data.toString());
        tickers.forEach((ticker) => {
            const { s: symbol, c: price, b: bid, a: ask, v: volume } = ticker;
            //  console.log('Trade data saved to Redis symbol', symbol , price  );

            const spr = Number(ask) - Number(bid);
            const sprPer = (Number(spr) / Number(ask)) * 100;
            const dataIn = {
                "symbol": symbol,
                "bid": bid,
                "ask": ask,
                "spread": spr.toString(),
                "spread_percent": sprPer.toString()
            }
            // Save trade data to Redis
            try {
                redisClient.set(symbol, JSON.stringify(dataIn));
                //  console.log(`Trade data saved to Redis`, symbol, ticker);
            } catch (err) {
                console.error('Error saving trade to Redis:', err);
            }
        });
    } catch (error) {
        console.error('Error parsing message:', error);

    }
}

// redis get key values and build an object
async function fetchAllKeysAndValues() {

    try {
        // get all the keys in an array
        const keys: string[] = await redisClient.keys('*');

      //  console.log(`Total number of keys: ${keys.length}`);

        // Array to store parsed key-value data
        const parsedData: Array<Record<string, any>> = [];

        // Fetch and parse each key's value
        for (const key of keys) {
            const value = await redisClient.get(key);

            if (value) {
                try {
                    // Parse the JSON string and add the object to the array
                    const jsonData = JSON.parse(value);
                    parsedData.push(jsonData);
                } catch (error) {
                    console.error(`Error parsing value for key "${key}":`, error);
                }
            }
        }

        return parsedData;

    } catch (error) {
        console.error('Error fetching keys and values:', error);
    }
}



// express ENDPOINT
// Endpoint to get all the ticker data
app.get(`${ENDPOINT_VERSION}/tickers`, async (req, res) => {

    try {
        // Run the function
        const allKeys = await fetchAllKeysAndValues();

        if (allKeys) {
            // Convert the array to JSON
            res.status(200).json(allKeys);
        }
    } catch (error) {
        res.status(404).json({ error: 'No trade data available' });
    }
});



// express ENDPOINT
// Endpoint to get the latest trade data from Redis
app.get(`${ENDPOINT_VERSION}/ticker`, async (req, res) => {

    console.log("INCOMING ", req);

    // default if the user doesn't have a query 
    // if (req?.query?.symbol as string === null) {

    //     try {
    //         const tradeData = await redisClient.hGetAll("ticker");
    //         if (tradeData) {
    //             res.json(tradeData);
    //             //  res.json(tradeData);
    //         } else {
    //             res.status(404).json({ error: 'No trade data available' });
    //         }
    //     } catch (error) {
    //         console.error('Error fetching trade data:', error);
    //         res.status(500).json({ error: 'Failed to fetch trade data' });
    //     }


    // }



    try {
        const tradeData = await redisClient.get(req?.query?.symbol as string);
        if (tradeData) {
            res.json(JSON.parse(tradeData));
            //  res.json(tradeData);
        } else {
            res.status(404).json({ error: 'No trade data available' });
        }
    } catch (error) {
        console.error('Error fetching trade data:', error);
        res.status(500).json({ error: 'Failed to fetch trade data' });
    }
});




// Helper: Ping Binance to check connection health
let pingInterval: NodeJS.Timeout;
function startPing() {
    clearInterval(pingInterval);
    pingInterval = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            console.log('Sending ping...');
            ws.ping();
        } else {
            console.warn('WebSocket not open, reconnecting...');
            reconnect();
        }
    }, 30000); // Send a ping every 30 seconds
}

// Helper: Reconnect with exponential backoff
function reconnect() {
    if (ws) {
        ws.terminate();
        ws = null;
    }

    setTimeout(() => {
        console.log(`Reconnecting in ${reconnectInterval / 1000} seconds...`);
        connectWebSocket();
        reconnectInterval = Math.min(reconnectInterval * 2, MAX_RECONNECT_INTERVAL); // Exponential backoff
    }, reconnectInterval);
}

// Graceful shutdown: Close Redis and WebSocket on exit
process.on('SIGINT', () => {
    console.log('Shutting down...');
    if (ws) ws.terminate();
    redisClient.quit();
    process.exit();
});

// Start the WebSocket connection
connectWebSocket();

// Start the express REST API server
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});

