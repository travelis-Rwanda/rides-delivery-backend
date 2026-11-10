const config = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT, 10) || 3000,

  database: {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    database: process.env.DB_NAME || "rides_delivery",
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "",
  },

  ridesPlatform: {
    apiUrl: process.env.RIDES_PLATFORM_API_URL || "http://localhost:4000",
    jwtSecret: process.env.RIDES_PLATFORM_JWT_SECRET || "",
  },

  jwt: {
    secret: process.env.JWT_SECRET || "your-secret-key",
    expiresIn: process.env.JWT_EXPIRES_IN || "24h",
  },

  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || "",
  },

  mobileMoney: {
    mtn: {
      apiUrl: process.env.MTN_MOMO_API_URL || "",
      apiKey: process.env.MTN_MOMO_API_KEY || "",
      apiSecret: process.env.MTN_MOMO_API_SECRET || "",
    },
    airtel: {
      apiUrl: process.env.AIRTEL_MONEY_API_URL || "",
      apiKey: process.env.AIRTEL_MONEY_API_KEY || "",
      apiSecret: process.env.AIRTEL_MONEY_API_SECRET || "",
    },
  },

  rateLimit: {
    authenticated: parseInt(process.env.RATE_LIMIT_AUTHENTICATED, 10) || 100,
    unauthenticated: parseInt(process.env.RATE_LIMIT_UNAUTHENTICATED, 10) || 20,
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000,
  },

  logging: {
    level: process.env.LOG_LEVEL || "info",
  },
};

export default config;
