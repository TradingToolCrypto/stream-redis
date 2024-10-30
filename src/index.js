"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = __importDefault(require("ws"));
const redis_1 = __importDefault(require("redis"));
// Define Binance WebSocket URL for ticker prices
const BINANCE_WS_URL = 'wss://stream.binance.com:9443/ws/!ticker@arr';
// Initialize Redis client
const redisClient = redis_1.default.createClient();
// Handle Redis connection errors
redisClient.on('error', (err) => {
    console.error('Redis Error:', err);
});
// Connect to Binance WebSocket
const ws = new ws_1.default(BINANCE_WS_URL);
// When WebSocket connection opens
ws.on('open', () => {
    console.log('Connected to Binance WebSocket');
});
// Handle incoming messages from Binance
ws.on('message', (data) => {
    try {
        const tickers = JSON.parse(data.toString());
        tickers.forEach((ticker) => {
            const { s: symbol, c: price } = ticker;
            // Save trade data to Redis
            try {
                redisClient.set(symbol, JSON.stringify(price));
                console.log('Trade data saved to Redis');
            }
            catch (err) {
                console.error('Error saving trade to Redis:', err);
            }
        });
    }
    catch (error) {
        console.error('Error parsing message:', error);
    }
});
// Handle WebSocket errors
ws.on('error', (err) => {
    console.error('WebSocket Error:', err);
});
// Close Redis connection on exit
process.on('SIGINT', () => {
    console.log('Closing Redis connection...');
    redisClient.quit();
    process.exit();
});
// redis-server
