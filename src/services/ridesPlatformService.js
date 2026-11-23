
import axios from 'axios';
import config from '../config/index.js';

/**
 * HTTP client for Rides Platform API
 */
const ridesApiClient = axios.create({
  baseURL: config.ridesPlatform.apiUrl,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Validate JWT token with Rides Platform
 * @param {string} token - JWT token to validate
 * @returns {Promise<Object|null>} User context or null if invalid
 */
async function validateToken(token) {
  try {
    const response = await ridesApiClient.post('/api/auth/validate', {
      token,
    });

    if (response.data && response.data.valid) {
      return {
        userId: response.data.userId,
        role: response.data.role,
        email: response.data.email,
        phone: response.data.phone,
      };
    }

    return null;
  } catch (error) {
    console.error('Token validation error:', error.message);
    return null;
  }
}

/**
 * Get user profile from Rides Platform
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} User profile or null
 */
async function getUserProfile(userId) {
  try {
    const response = await ridesApiClient.get(`/api/users/${userId}`);
    return response.data;
  } catch (error) {
    console.error('Get user profile error:', error.message);
    return null;
  }
}

/**
 * Get driver information from Rides Platform
 * @param {string} driverId - Driver ID
 * @returns {Promise<Object|null>} Driver info or null
 */
async function getDriverInfo(driverId) {
  try {
    const response = await ridesApiClient.get(`/api/drivers/${driverId}`);
    return response.data;
  } catch (error) {
    console.error('Get driver info error:', error.message);
    return null;
  }
}

/**
 * Get vehicle information from Rides Platform
 * @param {string} vehicleId - Vehicle ID
 * @returns {Promise<Object|null>} Vehicle info or null
 */
async function getVehicleInfo(vehicleId) {
  try {
    const response = await ridesApiClient.get(`/api/vehicles/${vehicleId}`);
    return response.data;
  } catch (error) {
    console.error('Get vehicle info error:', error.message);
    return null;
  }
}

/**
 * Get driver availability status from Rides Platform
 * @param {string} driverId - Driver ID
 * @returns {Promise<Object|null>} Availability status or null
 */
async function getDriverAvailability(driverId) {
  try {
    const response = await ridesApiClient.get(
      `/api/drivers/${driverId}/availability`
    );

    return {
      available: response.data.available,
      status: response.data.status,
      lastUpdated: response.data.lastUpdated,
    };
  } catch (error) {
    console.error('Get driver availability error:', error.message);
    return null;
  }
}

/**
 * Update driver status in Rides Platform
 * @param {string} driverId - Driver ID
 * @param {string} status - New status
 * @returns {Promise<boolean>} Success status
 */
async function updateDriverStatus(driverId, status) {
  try {
    await ridesApiClient.patch(`/api/drivers/${driverId}/status`, {
      status,
    });

    return true;
  } catch (error) {
    console.error('Update driver status error:', error.message);
    return false;
  }
}

/**
 * Get driver current location from Rides Platform
 * @param {string} driverId - Driver ID
 * @returns {Promise<Object|null>} Location or null
 */
async function getDriverLocation(driverId) {
  try {
    const response = await ridesApiClient.get(
      `/api/drivers/${driverId}/location`
    );

    return {
      latitude: response.data.latitude,
      longitude: response.data.longitude,
      timestamp: response.data.timestamp,
    };
  } catch (error) {
    console.error('Get driver location error:', error.message);
    return null;
  }
}

export {
  validateToken,
  getUserProfile,
  getDriverInfo,
  getVehicleInfo,
  getDriverAvailability,
  updateDriverStatus,
  getDriverLocation,
};
