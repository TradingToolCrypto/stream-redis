# TTC-Stream-Redis

1. **What is TTC?**

A Unified API that acts as a CryptoBridge to MetaTrader5 platform for charting, trading and backtesting algorithms.

2. **What is ttc-stream-redis?**

Websocket connection for near instant price feeds within Metatrader5 aka MT5.

3. **What is Redis?**

Local in memory cache for storage of ticker data.

# Installation

`npm` or `yarn` package management.

- Follow these instructions to run a realtime binance `spot` datafeed

1. `cp env.example .env`
2. `yarn install`
3. `redis-server`
4. `redis-cli FLUSHDB`
5. `yarn dev`

For futures and spot data feeds follow these instructions

1. `yarn express`
2. `yarn spot`
3. `yarn futures`

## Metatrader prereq

1. Tools -> Options -> Add webRequest : `http://127.0.01:80`

# Dependencies

REDIS

[windows install](https://redis.io/docs/latest/operate/oss_and_stack/install/install-redis/install-redis-on-windows/)
