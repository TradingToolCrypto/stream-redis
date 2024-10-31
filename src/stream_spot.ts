import WebSocket from "ws";
import { createClient, RedisClientType } from "redis";

// Binance WebSocket URL for all ticker prices
const BINANCE_WS_URL = "wss://stream.binance.com:9443/ws/!ticker@arr";
const REDIS__OVERRIDE = true; // Override redis db with current streams

// Initialize Redis Client
const redisClient: RedisClientType = createClient({
  url: process.env.REDIS_URL,
});

redisClient.on("error", (err) => {
  console.error("Redis Client Error:", err);
});

// Connect to Redis
const connectRedis = async () => {
  try {
    await redisClient.connect();
    console.log("Connected to Redis");
  } catch (error) {
    console.error("Failed to connect to Redis:", error);
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

  ws.on("open", () => {
    console.log("Connected to Binance WebSocket");
    reconnectInterval = 1000; // Reset reconnect interval on success
    startPing();
  });

  ws.on("message", (data: WebSocket.Data) => {
    handleTickerData(data);
  });

  ws.on("close", (code, reason) => {
    console.warn(`WebSocket closed: ${code} - ${reason}`);
    reconnect();
  });

  ws.on("error", (err) => {
    console.error("WebSocket Error:", err.message);
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
      const redisKey = `${ws?.url.includes("f") ? "futures:" : "spot:"}${symbol}`;
      const market = `${ws?.url.includes("f") ? "futures" : "spot"}`;

      if (Number(price) > 0 && price !== undefined) {
        const spr = Number(ask) - Number(bid);
        const sprPer = (Number(spr) / Number(ask)) * 100;
        const dataIn = {
          market: market,
          symbol: symbol,
          bid: bid,
          ask: ask,
          spread: spr.toString(),
          spread_percent: sprPer.toString(),
        };

        // Save trade data to Redis
        if (REDIS__OVERRIDE) {
          try {
            redisClient.set(redisKey, JSON.stringify(dataIn));
          } catch (err) {
            console.error("Error saving trade to Redis:", err);
          }
        }
      }
    });
  } catch (error) {
    console.error("Error parsing message:", error);
  }
}

// redis get key values and build an object
async function fetchAllKeysAndValues() {
  try {
    // get all the keys in an array
    const keys: string[] = await redisClient.keys("*");

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
    console.error("Error fetching keys and values:", error);
  }
}

// Helper: Ping Binance to check connection health
let pingInterval: NodeJS.Timeout;
function startPing() {
  clearInterval(pingInterval);
  pingInterval = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      console.log("Sending ping...");
      ws.ping();
    } else {
      console.warn("WebSocket not open, reconnecting...");
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
process.on("SIGINT", () => {
  console.log("Shutting down...");
  if (ws) ws.terminate();
  redisClient.quit();
  process.exit();
});

// Start the WebSocket connection
connectWebSocket();
