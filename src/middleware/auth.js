const { AppError } = require('../errors');
const defaultRidesClient = require('../clients/ridesAuthClient');

// A factory, so tests can plug in a fake Rides client.
function createAuth(ridesClient = defaultRidesClient) {
  // Reads "Authorization: Bearer <token>", asks Rides, then sets req.user.
  async function authenticate(req, res, next) {
    try {
      const header = req.header('authorization') || '';
      const [scheme, token] = header.split(' ');

      if (scheme !== 'Bearer' || !token) {
        throw new AppError('UNAUTHORIZED', 'Missing or malformed Authorization header', 401);
      }

      const user = await ridesClient.verifyToken(token);
      req.user = { id: user.id, roles: user.roles }; // the Rides user ID (Req 1.3)
      next();
    } catch (err) {
      next(err); // the errorHandler builds the JSON response
    }
  }

  // Allows the request only if Rides says the user has this role (Req 1.5).
  function requireRole(role) {
    return (req, res, next) => {
      if (!req.user || !req.user.roles.includes(role)) {
        return next(new AppError('FORBIDDEN', `This action requires the ${role} role`, 403));
      }
      next();
    };
  }

  return { authenticate, requireRole };
}

const { authenticate, requireRole } = createAuth();

module.exports = { createAuth, authenticate, requireRole };