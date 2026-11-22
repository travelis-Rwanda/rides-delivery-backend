/**
 * Rides Platform Authentication Client
 * Verifies tokens with the Rides platform and retrieves user information
 */

import { AppError } from '../errors.js';

// Fake users for development only (RIDES_AUTH_MODE=mock).
const MOCK_USERS = {
  'driver-token': { id: 'driver-1', roles: ['driver'] },
  'customer-token': { id: 'customer-1', roles: ['customer'] },
  'admin-token': { id: 'admin-1', roles: ['admin'] },
};

function mockVerify(token) {
  const user = MOCK_USERS[token];
  if (!user) {
    throw new AppError('UNAUTHORIZED', 'Invalid or expired Rides token', 401, {
      ridesError: { code: 'INVALID_TOKEN', message: 'Token not recognised (mock)' },
    });
  }
  return user;
}

/**
 * Asks Rides who owns this token. Returns { id, roles }.
 * @param {string} token - The authentication token
 * @returns {Promise<{id: string, roles: string[]}>}
 */
async function verifyToken(token) {
  if (process.env.RIDES_AUTH_MODE === 'mock') {
    if (process.env.NODE_ENV === 'production') {
      throw new AppError('CONFIG_ERROR', 'Mock auth is not allowed in production', 500);
    }
    return mockVerify(token);
  }

  const baseUrl = process.env.RIDES_API_URL;
  if (!baseUrl) {
    throw new AppError('CONFIG_ERROR', 'RIDES_API_URL is not set', 500);
  }

  let response;
  try {
    // ASSUMPTION: Rides exposes GET {RIDES_API_URL}/auth/me. Confirm with Pacific.
    response = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000), // never wait forever on Rides
    });
  } catch {
    throw new AppError('RIDES_UNAVAILABLE', 'Rides authentication service is unreachable', 503);
  }

  if (response.status === 401 || response.status === 403) {
    const ridesError = await response.json().catch(() => null);
    throw new AppError('UNAUTHORIZED', 'Invalid or expired Rides token', 401, { ridesError });
  }

  if (!response.ok) {
    throw new AppError('RIDES_UNAVAILABLE', 'Rides authentication service failed', 503);
  }

  const data = await response.json();
  // ASSUMPTION: the response has `id` and `role` or `roles`. Adjust to the real shape.
  return { id: String(data.id), roles: data.roles || (data.role ? [data.role] : []) };
}

export default { verifyToken };
export { verifyToken };
