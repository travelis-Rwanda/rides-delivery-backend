import { validateToken } from "../services/ridesPlatformService.js";

/**
 * Middleware to authenticate requests using JWT token from Rides Platform
 */
async function authenticate(req, res, next) {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "No token provided",
        timestamp: new Date().toISOString(),
      });
    }

    const token = authHeader.substring(7);

    // Validate token with Rides Platform
    const userContext = await validateToken(token);

    if (!userContext) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Invalid or expired token",
        timestamp: new Date().toISOString(),
      });
    }

    // Attach user context to request
    req.user = {
      id: userContext.userId,
      role: userContext.role,
      email: userContext.email,
      phone: userContext.phone,
    };

    next();
  } catch (error) {
    console.error("Authentication error:", error);

    return res.status(401).json({
      error: "Unauthorized",
      message: "Authentication failed",
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Middleware to require specific role(s)
 * @param {string|string[]} allowedRoles - Role or array of roles allowed
 */
function requireRole(allowedRoles) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: "Unauthorized",
        message: "Authentication required",
        timestamp: new Date().toISOString(),
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: "Forbidden",
        message: `Access denied. Required role: ${roles.join(" or ")}`,
        timestamp: new Date().toISOString(),
      });
    }

    next();
  };
}

/**
 * Middleware to require customer role
 */
const requireCustomer = requireRole("customer");

/**
 * Middleware to require driver role
 */
const requireDriver = requireRole("driver");

/**
 * Optional authentication - adds user context if token is provided
 */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next();
    }

    const token = authHeader.substring(7);

    const userContext = await validateToken(token);

    if (userContext) {
      req.user = {
        id: userContext.userId,
        role: userContext.role,
        email: userContext.email,
        phone: userContext.phone,
      };
    }

    next();
  } catch (error) {
    // Silent fail for optional authentication
    next();
  }
}

export {
  authenticate,
  requireRole,
  requireCustomer,
  requireDriver,
  optionalAuth,
};
