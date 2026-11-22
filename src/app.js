import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";

import config from "./config/index.js";
import { errorHandler, notFoundHandler } from "./errors.js";
import { optionalAuth } from "./middleware/auth.js";
import { rateLimiter } from "./middleware/rateLimiter.js";
import routes from "./routes/index.js";
import swaggerSpec from "./config/swagger.js";

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

// Swagger API docs (keep updated with every new endpoint)
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get("/api-docs.json", (req, res) => res.json(swaggerSpec));

/**
 * @openapi
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: Health check
 *     responses:
 *       200:
 *         description: Service is healthy
 */
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "rides-delivery-backend",
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
  });
});

// API routes
app.use("/api", routes);

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

export default app;
