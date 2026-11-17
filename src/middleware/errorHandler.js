
import config from '../config/index.js';
import { AppError } from '../utils/errors.js';

/**
 * Global error handling middleware
 * Catches and formats all errors in a consistent way
 */
function errorHandler(err, req, res, next) {
  // Log error details
  console.error('Error occurred:', {
    name: err.name,
    message: err.message,
    statusCode: err.statusCode,
    stack: err.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString(),
  });

  // Determine status code
  const statusCode = err.statusCode || 500;

  // Prepare error response
  const errorResponse = {
    error: err.name || 'Error',
    message: err.message || 'Internal Server Error',
    timestamp: new Date().toISOString(),
  };

  // Add validation details if present
  if (err.details) {
    errorResponse.details = err.details;
  }

  // Add request info in development
  if (config.nodeEnv === 'development') {
    errorResponse.path = req.path;
    errorResponse.method = req.method;
    errorResponse.stack = err.stack;
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
}

/**
 * 404 Not Found handler
 */
function notFoundHandler(req, res, next) {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Async error wrapper
 * Wraps async route handlers to catch errors
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export {
  errorHandler,
  notFoundHandler,
  asyncHandler,
};
