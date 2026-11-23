/**
 * Application Error Classes for Rides Delivery Backend
 * Supports both the Rides authentication pattern and existing error handling
 */

/**
 * Base AppError - supports both patterns:
 * 1. New pattern: AppError(code, message, status, details) - for Rides auth
 * 2. Old pattern: AppError(message, statusCode) - for existing code
 */
class AppError extends Error {
  constructor(codeOrMessage, messageOrStatus, statusOrDetails, detailsOrUndefined) {
    // Detect which pattern is being used
    if (typeof messageOrStatus === 'string') {
      // New pattern: AppError(code, message, status, details)
      super(messageOrStatus);
      this.code = codeOrMessage;
      this.status = statusOrDetails || 400;
      this.statusCode = this.status; // Alias for compatibility
      this.details = detailsOrUndefined;
    } else {
      // Old pattern: AppError(message, statusCode)
      super(codeOrMessage);
      this.statusCode = messageOrStatus || 500;
      this.status = this.statusCode; // Alias for compatibility
      this.code = this.name;
    }
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 400 Bad Request
 */
class BadRequestError extends AppError {
  constructor(message = 'Bad Request') {
    super(message, 400);
  }
}

/**
 * 401 Unauthorized
 */
class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
  }
}

/**
 * 403 Forbidden
 */
class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403);
  }
}

/**
 * 404 Not Found
 */
class NotFoundError extends AppError {
  constructor(message = 'Not Found') {
    super(message, 404);
  }
}

/**
 * 409 Conflict
 */
class ConflictError extends AppError {
  constructor(message = 'Conflict') {
    super(message, 409);
  }
}

/**
 * 422 Unprocessable Entity (Validation Error)
 */
class ValidationError extends AppError {
  constructor(message = 'Validation Error', details = null) {
    super(message, 422);
    this.details = details;
  }
}

/**
 * 429 Too Many Requests
 */
class TooManyRequestsError extends AppError {
  constructor(message = 'Too Many Requests') {
    super(message, 429);
  }
}

/**
 * 500 Internal Server Error
 */
class InternalServerError extends AppError {
  constructor(message = 'Internal Server Error') {
    super(message, 500);
  }
}

/**
 * Express error handler middleware
 * Builds the Req 18.1 envelope and handles both error patterns
 */
function errorHandler(err, req, res, next) {
  // Broken JSON sent by a client is a validation error, not a server error
  if (err.type === 'entity.parse.failed') {
    err = new AppError('VALIDATION_ERROR', 'Request body is not valid JSON', 400);
  }

  const status = err.status || err.statusCode || 500;
  if (status === 500) console.error(err); // log full details (Req 18.5)

  const error = {
    code: err.code || 'INTERNAL_ERROR',
    message: status === 500 ? 'Internal server error' : err.message,
    timestamp: new Date().toISOString(),
  };
  
  if (err.details) error.details = err.details; // carries the Rides error (Req 1.4)

  res.status(status).json({ error });
}

/**
 * 404 Not Found handler
 */
function notFoundHandler(req, res, next) {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
      timestamp: new Date().toISOString(),
    },
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
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  TooManyRequestsError,
  InternalServerError,
  errorHandler,
  notFoundHandler,
  asyncHandler,
};
