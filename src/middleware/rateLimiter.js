import rateLimit from "express-rate-limit";
import config from "../config/index.js";

/**
 * Rate limiter for authenticated users
 * 100 requests per minute
 */
const authenticatedLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.authenticated,
  message: {
    error: "Too Many Requests",
    message: "Too many requests from this account, please try again later",
    timestamp: new Date().toISOString(),
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => !req.user,
  keyGenerator: (req) => req.user?.id || req.ip,
});

/**
 * Rate limiter for unauthenticated users
 * 20 requests per minute per IP
 */
const unauthenticatedLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.unauthenticated,
  message: {
    error: "Too Many Requests",
    message: "Too many requests from this IP, please try again later",
    timestamp: new Date().toISOString(),
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => !!req.user,
  keyGenerator: (req) => req.ip,
});

/**
 * Combined rate limiter middleware
 * Applies different limits based on authentication status
 */
function rateLimiter(req, res, next) {
  if (req.user) {
    return authenticatedLimiter(req, res, next);
  }

  return unauthenticatedLimiter(req, res, next);
}

/**
 * Strict rate limiter for sensitive operations
 * 10 requests per minute
 */
const strictLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: 10,
  message: {
    error: "Too Many Requests",
    message: "Too many attempts, please try again later",
    timestamp: new Date().toISOString(),
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
});

export {
  rateLimiter,
  authenticatedLimiter,
  unauthenticatedLimiter,
  strictLimiter,
};
