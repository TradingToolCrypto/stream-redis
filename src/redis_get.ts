import { createClient, RedisClientType } from "redis";

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

// redis get key values and build an object
export default async function fetchAllKeysAndValues() {
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
