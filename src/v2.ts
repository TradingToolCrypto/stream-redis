/*
This implementation:

- Handles multiple WebSocket streams from both spot and futures markets.
- Stores ticker data in Redis with clear prefixes (spot: and futures:).
- Includes ping monitoring and reconnect logic for both connections.
- Ensures a graceful shutdown with Redis properly closed on exit.

*/

import WebSocket from 'ws';
import Redis from 'redis';

// Binance WebSocket URLs
const BINANCE_WS_URL = 'wss://stream.binance.com:9443/ws/!ticker@arr';
const BINANCE_F_WS_URL = 'wss://fstream.binance.com/ws/!ticker@arr'; // Futures market

// Redis client initialization
const redisClient = Redis.createClient();
let redisReady = false;

redisClient.on('connect', () => {
  console.log('Connected to Redis');
  redisReady = true;
});

redisClient.on('end', () => {
  console.log('Redis connection closed');
  redisReady = false;
});

redisClient.on('error', (err) => console.error('Redis Error:', err));

// WebSocket management
interface TickerData {
  s: string; // Symbol
  c: string; // Last price
}

// WebSocket state and logic encapsulated in an object
class BinanceWebSocket {
  private url: string;
  private ws: WebSocket | null = null;
  private reconnectInterval = 1000; // Start with 1 second
  private pingInterval!: NodeJS.Timeout;
  private readonly MAX_RECONNECT_INTERVAL = 30000; // Max 30 seconds

  constructor(url: string) {
    this.url = url;
    this.connect();
  }

  // Connect to the WebSocket
  private connect() {
    console.log(`Connecting to WebSocket: ${this.url}`);
    this.ws = new WebSocket(this.url);

    this.ws.on('open', () => this.onOpen());
    this.ws.on('message', (data) => this.onMessage(data));
    this.ws.on('close', (code, reason) => this.onClose(code, reason));
    this.ws.on('error', (err) => this.onError(err));
  }

  // On successful connection
  private onOpen() {
    console.log(`Connected to WebSocket: ${this.url}`);
    this.reconnectInterval = 1000; // Reset reconnect interval
    this.startPing();
  }

  // Handle incoming messages
  private onMessage(data: WebSocket.Data) {
    try {
      const tickers: TickerData[] = JSON.parse(data.toString());
      tickers.forEach((ticker) => {
        const { s: symbol, c: price } = ticker;
        const redisKey = `${this.url.includes('futures') ? 'futures:' : 'spot:'}${symbol}`;

        if (redisReady) {
          redisClient.set(redisKey, price, (err) => {
            if (err) {
              console.error(`Failed to save ${redisKey}: ${err.message}`);
            } else {
              console.log(`Saved ${redisKey}: ${price}`);
            }
          });
        } else {
          console.warn(`Redis not ready, could not save ${redisKey}`);
        }
      });
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  }

  // Handle WebSocket close event
  private onClose(code: number, reason: string) {
    console.warn(`WebSocket closed: ${code} - ${reason}`);
    this.reconnect();
  }

  // Handle WebSocket errors
  private onError(err: Error) {
    console.error('WebSocket Error:', err.message);
    this.reconnect();
  }

  // Start a ping interval to monitor connection health
  private startPing() {
    clearInterval(this.pingInterval);
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        console.log(`Sending ping to ${this.url}`);
        this.ws.ping();
      } else {
        console.warn(`WebSocket not open, reconnecting: ${this.url}`);
        this.reconnect();
      }
    }, 30000); // Every 30 seconds
  }

  // Reconnect with exponential backoff
  private reconnect() {
    if (this.ws) {
      this.ws.terminate();
      this.ws = null;
    }

    setTimeout(() => {
      console.log(`Reconnecting to ${this.url} in ${this.reconnectInterval / 1000} seconds...`);
      this.connect();
      this.reconnectInterval = Math.min(this.reconnectInterval * 2, this.MAX_RECONNECT_INTERVAL);
    }, this.reconnectInterval);
  }
}

// Start both WebSocket connections
const spotSocket = new BinanceWebSocket(BINANCE_WS_URL);
const futuresSocket = new BinanceWebSocket(BINANCE_F_WS_URL);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down...');
  redisClient.quit(() => console.log('Redis connection closed.'));
  process.exit();
});
