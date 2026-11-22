/**
 * Authentication Middleware
 * JWT-based authentication system
 */

import jwt from 'jsonwebtoken';
import { AppError } from '../errors.js';
import prisma from '../db/index.js';

/**
 * Authenticate user with JWT token
 */
export async function authenticate(req, res, next) {
  try {
    const header = req.header('authorization') || '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw new AppError('UNAUTHORIZED', 'Missing or malformed Authorization header', 401);
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new AppError('TOKEN_EXPIRED', 'Token has expired', 401);
      }
      throw new AppError('INVALID_TOKEN', 'Invalid token', 401);
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    if (!user) {
      throw new AppError('USER_NOT_FOUND', 'User not found', 401);
    }

    if (!user.isActive) {
      throw new AppError('ACCOUNT_INACTIVE', 'Account has been deactivated', 403);
    }

    // Set user on request object
    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Optional authentication - allows request to proceed with or without token
 */
export async function optionalAuth(req, res, next) {
  try {
    const header = req.header('authorization') || '';
    const [scheme, token] = header.split(' ');

    if (scheme === 'Bearer' && token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await prisma.user.findUnique({
          where: { id: decoded.id },
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
            isActive: true,
          },
        });

        if (user && user.isActive) {
          req.user = {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
          };
        }
      } catch (err) {
        // Token invalid or expired - just proceed without user
      }
    }
    next();
  } catch (err) {
    next();
  }
}

/**
 * Require specific role
 */
export function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('UNAUTHORIZED', 'Authentication required', 401));
    }

    // Handle array of roles
    if (Array.isArray(role)) {
      if (!role.includes(req.user.role)) {
        return next(
          new AppError('FORBIDDEN', `This action requires one of: ${role.join(', ')}`, 403)
        );
      }
    } else {
      // Single role
      if (req.user.role !== role) {
        return next(new AppError('FORBIDDEN', `This action requires the ${role} role`, 403));
      }
    }

    next();
  };
}

/**
 * Require any of the specified roles
 */
export function requireAnyRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('UNAUTHORIZED', 'Authentication required', 401));
    }

    const hasRole = roles.includes(req.user.role);
    if (!hasRole) {
      return next(
        new AppError('FORBIDDEN', `This action requires one of: ${roles.join(', ')}`, 403)
      );
    }
    next();
  };
}

export default { authenticate, optionalAuth, requireRole, requireAnyRole };
