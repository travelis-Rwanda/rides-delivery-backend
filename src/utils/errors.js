/**
 * Base application error class
 */
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 400 Bad Request
 */
class BadRequestError extends AppError {
  constructor(message = "Bad Request") {
    super(message, 400);
  }
}

/**
 * 401 Unauthorized
 */
class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, 401);
  }
}

/**
 * 403 Forbidden
 */
class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(message, 403);
  }
}

/**
 * 404 Not Found
 */
class NotFoundError extends AppError {
  constructor(message = "Not Found") {
    super(message, 404);
  }
}

/**
 * 409 Conflict
 */
class ConflictError extends AppError {
  constructor(message = "Conflict") {
    super(message, 409);
  }
}

/**
 * 422 Unprocessable Entity (Validation Error)
 */
class ValidationError extends AppError {
  constructor(message = "Validation Error", details = null) {
    super(message, 422);
    this.details = details;
  }
}

/**
 * 429 Too Many Requests
 */
class TooManyRequestsError extends AppError {
  constructor(message = "Too Many Requests") {
    super(message, 429);
  }
}

/**
 * 500 Internal Server Error
 */
class InternalServerError extends AppError {
  constructor(message = "Internal Server Error") {
    super(message, 500);
  }
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
};
