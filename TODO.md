first , what is volume via arr stream? a 24 hour snapshot... useless data
next
need real volume .. subscribe to the trades feed and update volume in db realtime (mt5 is gonna explode)

mt5 has 2 slots for volume within the candle data structure :

- real trades : realVolume : and the liq will be the tickvolume
- liquidation feed , key : `liq` :symbol , "symbol": btcusdt, amount, price time

market data fast : wss://data-stream.binance.vision , wss://data-fstream.binance.vision

Specific streams: wss://stream.binance.com:9443/ws/stream1/stream2/stream3

Raw streams are accessed at /ws/<streamName>
Combined streams are accessed at /stream?streams=<streamName1>/<streamName2>/<streamName3>

Stream Name: !miniTicker@arr
Update Speed: 1000ms
--
Stream Name: !ticker@arr
Update Speed: 1000ms
--

Stream Name: !ticker\_<window-size>@arr
Window Size: 1h,4h,1d
Update Speed:

--- https://developers.binance.com/docs/derivatives/usds-margined-futures/websocket-market-streams/Liquidation-Order-Streams

<symbol>@forceOrder

Update Speed
1000ms
