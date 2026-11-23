/**
 * Authentication Controller
 * Handles user registration, login, and profile management
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../db/index.js';
import { AppError, ValidationError } from '../errors.js';

/**
 * Generate JWT token
 */
function generateToken(user) {
  const payload = {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  });
}

/**
 * Register a new user
 */
export async function register(req, res, next) {
  try {
    const {
      username,
      email,
      phoneNumber,
      password,
      address,
      role,
      gender,
    } = req.body;

    // Validation
    if (!username || !email || !phoneNumber || !password) {
      throw new ValidationError('Username, email, phone number, and password are required', {
        fields: ['username', 'email', 'phoneNumber', 'password'],
      });
    }

    // Validate Rwanda phone number format
    const phoneRegex = /^\+250[0-9]{9}$/;
    if (!phoneRegex.test(phoneNumber)) {
      throw new ValidationError('Phone number must be in Rwanda format: +250XXXXXXXXX', {
        field: 'phoneNumber',
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new ValidationError('Invalid email format', {
        field: 'email',
      });
    }

    // Validate password strength (minimum 8 characters)
    if (password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters long', {
        field: 'password',
      });
    }

    // Validate role
    const validRoles = ['customer', 'driver', 'admin'];
    const userRole = role || 'customer';
    if (!validRoles.includes(userRole)) {
      throw new ValidationError('Role must be one of: customer, driver, admin', {
        field: 'role',
      });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          { username },
          { phoneNumber },
        ],
      },
    });

    if (existingUser) {
      if (existingUser.email === email) {
        throw new AppError('EMAIL_EXISTS', 'Email already registered', 409);
      }
      if (existingUser.username === username) {
        throw new AppError('USERNAME_EXISTS', 'Username already taken', 409);
      }
      if (existingUser.phoneNumber === phoneNumber) {
        throw new AppError('PHONE_EXISTS', 'Phone number already registered', 409);
      }
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = await prisma.user.create({
      data: {
        username,
        email,
        phoneNumber,
        password: hashedPassword,
        address: address || null,
        role: userRole,
        gender: gender || null,
        isActive: true,
        isAvailable: userRole === 'driver' ? false : false,
      },
      select: {
        id: true,
        username: true,
        email: true,
        phoneNumber: true,
        address: true,
        role: true,
        gender: true,
        isAvailable: true,
        createdAt: true,
      },
    });

    // Generate token
    const token = generateToken(user);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user,
        token,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Login user
 */
export async function login(req, res, next) {
  try {
    const { login, password } = req.body;

    // Validation
    if (!login || !password) {
      throw new ValidationError('Login (email/username/phone) and password are required', {
        fields: ['login', 'password'],
      });
    }

    // Find user by email, username, or phone
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: login },
          { username: login },
          { phoneNumber: login },
        ],
      },
    });

    if (!user) {
      throw new AppError('INVALID_CREDENTIALS', 'Invalid credentials', 401);
    }

    // Check if user is active
    if (!user.isActive) {
      throw new AppError('ACCOUNT_INACTIVE', 'Your account has been deactivated', 403);
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      throw new AppError('INVALID_CREDENTIALS', 'Invalid credentials', 401);
    }

    // Generate token
    const token = generateToken(user);

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: userWithoutPassword,
        token,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get current user profile
 */
export async function getProfile(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        username: true,
        email: true,
        phoneNumber: true,
        address: true,
        role: true,
        gender: true,
        categoryPreferences: true,
        isAvailable: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new AppError('USER_NOT_FOUND', 'User not found', 404);
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update user profile
 */
export async function updateProfile(req, res, next) {
  try {
    const { username, email, phoneNumber, address, gender, categoryPreferences } = req.body;

    const updateData = {};

    if (username) {
      // Check if username is taken
      const existing = await prisma.user.findFirst({
        where: {
          username,
          NOT: { id: req.user.id },
        },
      });
      if (existing) {
        throw new AppError('USERNAME_EXISTS', 'Username already taken', 409);
      }
      updateData.username = username;
    }

    if (email) {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new ValidationError('Invalid email format', { field: 'email' });
      }
      // Check if email is taken
      const existing = await prisma.user.findFirst({
        where: {
          email,
          NOT: { id: req.user.id },
        },
      });
      if (existing) {
        throw new AppError('EMAIL_EXISTS', 'Email already registered', 409);
      }
      updateData.email = email;
    }

    if (phoneNumber) {
      // Validate Rwanda phone number format
      const phoneRegex = /^\+250[0-9]{9}$/;
      if (!phoneRegex.test(phoneNumber)) {
        throw new ValidationError('Phone number must be in Rwanda format: +250XXXXXXXXX', {
          field: 'phoneNumber',
        });
      }
      // Check if phone is taken
      const existing = await prisma.user.findFirst({
        where: {
          phoneNumber,
          NOT: { id: req.user.id },
        },
      });
      if (existing) {
        throw new AppError('PHONE_EXISTS', 'Phone number already registered', 409);
      }
      updateData.phoneNumber = phoneNumber;
    }

    if (address !== undefined) updateData.address = address;
    if (gender) updateData.gender = gender;
    if (categoryPreferences && Array.isArray(categoryPreferences)) {
      updateData.categoryPreferences = categoryPreferences;
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        phoneNumber: true,
        address: true,
        role: true,
        gender: true,
        categoryPreferences: true,
        isAvailable: true,
        updatedAt: true,
      },
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Change password
 */
export async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      throw new ValidationError('Current password and new password are required', {
        fields: ['currentPassword', 'newPassword'],
      });
    }

    if (newPassword.length < 8) {
      throw new ValidationError('New password must be at least 8 characters long', {
        field: 'newPassword',
      });
    }

    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!user) {
      throw new AppError('USER_NOT_FOUND', 'User not found', 404);
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      throw new AppError('INVALID_PASSWORD', 'Current password is incorrect', 401);
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashedPassword },
    });

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Toggle driver availability
 */
export async function toggleAvailability(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { role: true, isAvailable: true },
    });

    if (!user) {
      throw new AppError('USER_NOT_FOUND', 'User not found', 404);
    }

    if (user.role !== 'driver') {
      throw new AppError('FORBIDDEN', 'Only drivers can toggle availability', 403);
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: { isAvailable: !user.isAvailable },
      select: {
        id: true,
        username: true,
        role: true,
        isAvailable: true,
      },
    });

    res.json({
      success: true,
      message: `Driver is now ${updatedUser.isAvailable ? 'available' : 'unavailable'}`,
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
}
