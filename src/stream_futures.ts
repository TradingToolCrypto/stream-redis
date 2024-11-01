import WebSocket from "ws";
import { createClient, RedisClientType } from "redis";

// Binance WebSocket URL for all ticker prices
const BINANCE_F_WS_URL = "wss://fstream.binance.com/ws/!ticker@arr";
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
  ws = new WebSocket(BINANCE_F_WS_URL);

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
  Q: string; // last quantity traded
}

// Sort websocket data and store to redis
function handleTickerData(data: WebSocket.Data) {
  try {
    const tickers: TickerData[] = JSON.parse(data.toString());
    tickers.forEach((ticker) => {
      const { s: symbol, c: price, Q: volume } = ticker;

      console.log("futures ticker", ticker);

      // futures data is different than spot

      const redisKey = `${ws?.url.includes("f") ? "futures:" : "spot:"}${symbol}`;
      const market = `${ws?.url.includes("f") ? "futures" : "spot"}`;

      if (Number(price) > 0 && price !== undefined) {
        let bid = price;
        let ask = price;
        let vol = Number(price) * Number(volume);

        const spr = Number(ask) - Number(bid);
        const sprPer = (Number(spr) / Number(ask)) * 100;
        const dataIn = {
          market: market,
          symbol: symbol,
          bid: bid,
          ask: ask,
          volume: vol.toString(),
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
