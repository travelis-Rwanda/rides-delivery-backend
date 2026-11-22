import "dotenv/config";

import app from "./app.js";
import config from "./config/index.js";
import testDatabaseConnection from "./db/testConnection.js  ";

const PORT = config.port;

async function startServer() {
  try {
    // Test database connection
    const isDatabaseConnected = await testDatabaseConnection();

    if (!isDatabaseConnected) {
      console.error(
        "Server startup aborted because the database is unavailable.",
      );
      process.exit(1);
    }

    // Start Express server
    app.listen(PORT, () => {
      console.log(`Rides Delivery Backend running on port ${PORT}`);
      console.log(`Environment: ${config.nodeEnv}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error);
    process.exit(1);
  }
}

startServer();
