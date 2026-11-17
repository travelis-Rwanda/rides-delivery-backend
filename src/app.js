import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";

import config from "./config/index.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { optionalAuth } from "./middleware/auth.js";
import { rateLimiter } from "./middleware/rateLimiter.js";

const app = express();

// Security middleware
app.use(helmet());
app.use(cors());

// Logging middleware
app.use(morgan(config.nodeEnv === "production" ? "combined" : "dev"));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Optional authentication (adds user context if token is present)
app.use(optionalAuth);

// Rate limiting (applies different limits based on authentication status)
app.use(rateLimiter);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "rides-delivery-backend",
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
  });
});

// API routes will be added here
// app.use('/api/v1', routes);

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

export default app;
