/**
 * Authentication Middleware
 * Integrates with Rides Platform authentication system
 */

import { AppError } from '../errors.js';
import defaultRidesClient from '../clients/ridesAuthClient.js';

/**
 * A factory, so tests can plug in a fake Rides client.
 */
function createAuth(ridesClient = defaultRidesClient) {
  /**
   * Reads "Authorization: Bearer <token>", asks Rides, then sets req.user.
   * Requirement 1: Integration with Rides Authentication System
   */
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

  /**
   * Optional authentication - allows request to proceed with or without token
   * If token is present and valid, sets req.user
   */
  async function optionalAuth(req, res, next) {
    try {
      const header = req.header('authorization') || '';
      const [scheme, token] = header.split(' ');
      
      if (scheme === 'Bearer' && token) {
        const user = await ridesClient.verifyToken(token);
        req.user = { id: user.id, roles: user.roles };
      }
      next();
    } catch (err) {
      // For optional auth, we don't fail - just proceed without user
      next();
    }
  }

  /**
   * Allows the request only if Rides says the user has this role (Req 1.5).
   * @param {string} role - Required role (e.g., 'driver', 'customer', 'admin')
   */
  function requireRole(role) {
    return (req, res, next) => {
      if (!req.user || !req.user.roles.includes(role)) {
        return next(new AppError('FORBIDDEN', `This action requires the ${role} role`, 403));
      }
      next();
    };
  }

  /**
   * Allows the request if user has ANY of the specified roles
   * @param {string[]} roles - Array of acceptable roles
   */
  function requireAnyRole(...roles) {
    return (req, res, next) => {
      if (!req.user) {
        return next(new AppError('FORBIDDEN', 'Authentication required', 403));
      }
      
      const hasRole = roles.some(role => req.user.roles.includes(role));
      if (!hasRole) {
        return next(new AppError('FORBIDDEN', `This action requires one of: ${roles.join(', ')}`, 403));
      }
      next();
    };
  }

  return { authenticate, optionalAuth, requireRole, requireAnyRole };
}

const { authenticate, optionalAuth, requireRole, requireAnyRole } = createAuth();

export { createAuth, authenticate, optionalAuth, requireRole, requireAnyRole };
export default { authenticate, optionalAuth, requireRole, requireAnyRole };
