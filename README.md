# TTC-Stream-Redis

1. **What is TTC?** 

A Unified API that acts as a CryptoBridge to MetaTrader5 platform for charting, trading and backtesting algorithms.  

2. **What is ttc-stream-redis?** 

Websocket connection for near instant price feeds within Metatrader5 aka MT5.  

3. **What is Redis?** 

Local in memory cache for storage of ticker data.  


# Installation 

```redis-server``` 

1. ```cp env.example .env```
2. ```yarn install```
3. ```yarn dev```

## Metatrader prereq
1. Tools -> Options -> Add webRequest : ```http://127.0.01:80``` 

# Dependencies 

REDIS 

[windows install](https://redis.io/docs/latest/operate/oss_and_stack/install/install-redis/install-redis-on-windows/)
