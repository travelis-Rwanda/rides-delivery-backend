// An error we throw on purpose: HTTP status + code + optional details.
class AppError extends Error {
  constructor(code, message, status = 400, details = undefined) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

// Express calls this when anything throws. It builds the Req 18.1 envelope.
function errorHandler(err, req, res, next) {
  // Broken JSON sent by a client is a validation error, not a server error
  if (err.type === 'entity.parse.failed') {
    err = new AppError('VALIDATION_ERROR', 'Request body is not valid JSON', 400);
  }

  const status = err.status || 500;
  if (status === 500) console.error(err); // log full details (Req 18.5)

  const error = {
    code: err.code || 'INTERNAL_ERROR',
    message: status === 500 ? 'Internal server error' : err.message,
    timestamp: new Date().toISOString(),
  };
  if (err.details) error.details = err.details; // carries the Rides error (Req 1.4)

  res.status(status).json({ error });
}

module.exports = { AppError, errorHandler };