import jwt from 'jsonwebtoken';
import { AppError } from '../errors.js';

// Checks the JWT sent as "Authorization: Bearer <token>"
export function authenticate(req, res, next) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return next(new AppError('CONFIG_ERROR', 'JWT_SECRET is not set', 500));
  }

  const [scheme, token] = (req.header('authorization') || '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(new AppError('UNAUTHORIZED', 'Missing or malformed Authorization header', 401));
  }

  try {
    const payload = jwt.verify(token, secret);

    // The token may name the user "id", "userId" or "sub", and the role "role" or "roles".
    const id = payload.id ?? payload.userId ?? payload.sub;
    const roles = [].concat(payload.roles ?? payload.role ?? []).map((r) => String(r).toLowerCase());

    if (!id) {
      return next(new AppError('UNAUTHORIZED', 'Token does not contain a user identifier', 401));
    }

    req.user = { id: String(id), roles }; // the Rides user ID (Req 1.3)
    next();
  } catch (err) {
    next(
      new AppError('UNAUTHORIZED', 'Invalid or expired token', 401, {
        reason: err.name, // for example TokenExpiredError or JsonWebTokenError
        message: err.message,
      })
    );
  }
}

// Allows the request only if the token's roles include this role (Req 1.5).
export function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || !req.user.roles.includes(role)) {
      return next(new AppError('FORBIDDEN', `This action requires the ${role} role`, 403));
    }
    next();
  };
}