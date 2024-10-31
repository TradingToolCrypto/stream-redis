import express from "express";

import fetchAllKeysAndValues from "./stream_futures";

const ENDPOINT_VERSION = "/v1";

const app = express();
/*
Metatrader only works with port 80 with http and 443 with https
*/
const port = process.env.PORT || 80;

// Middleware to parse JSON bodies
app.use(express.json());

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
    res.status(404).json({ error: "No trade data available" });
  }
});

// express ENDPOINT
// Start the express REST API server
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
