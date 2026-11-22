/**
 * Authentication Routes
 * User registration, login, and profile management
 */

import express from "express";
import { authenticate } from "../middleware/auth.js";
import {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  toggleAvailability,
} from "../controllers/authController.js";

const router = express.Router();

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     tags: [Authentication]
 *     summary: Register a new user
 *     description: Create a new user account with username, email, phone number, and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, email, phoneNumber, password]
 *             properties:
 *               username:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 50
 *                 example: "john_doe"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "john@example.com"
 *               phoneNumber:
 *                 type: string
 *                 pattern: '^\+250[0-9]{9}$'
 *                 example: "+250788123456"
 *                 description: Rwanda phone number format
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 example: "SecurePass123"
 *               address:
 *                 type: string
 *                 example: "KN 5 Ave, Kigali"
 *               role:
 *                 type: string
 *                 enum: [customer, driver, admin]
 *                 default: customer
 *                 example: "customer"
 *               gender:
 *                 type: string
 *                 enum: [male, female, other, prefer_not_to_say]
 *                 example: "male"
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "User registered successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     token:
 *                       type: string
 *                       example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: User already exists (email, username, or phone taken)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/register", register);

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [Authentication]
 *     summary: Login user
 *     description: Login with email/username/phone and password. Returns JWT token.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [login, password]
 *             properties:
 *               login:
 *                 type: string
 *                 example: "john@example.com"
 *                 description: Email, username, or phone number
 *               password:
 *                 type: string
 *                 example: "SecurePass123"
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Login successful"
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     token:
 *                       type: string
 *                       example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Account inactive
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/login", login);

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     tags: [Authentication]
 *     summary: Get current user profile
 *     description: Returns the authenticated user's profile information
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/me", authenticate, getProfile);

/**
 * @openapi
 * /api/auth/profile:
 *   patch:
 *     tags: [Authentication]
 *     summary: Update user profile
 *     description: Update user profile information (username, email, phone, address, gender, category preferences)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 example: "john_updated"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "john.updated@example.com"
 *               phoneNumber:
 *                 type: string
 *                 pattern: '^\+250[0-9]{9}$'
 *                 example: "+250788654321"
 *               address:
 *                 type: string
 *                 example: "KG 123 St, Kigali"
 *               gender:
 *                 type: string
 *                 enum: [male, female, other, prefer_not_to_say]
 *               categoryPreferences:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [Parcel, Restaurant, Shop, Cargo]
 *                 example: ["Parcel", "Restaurant"]
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Profile updated successfully"
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *       409:
 *         description: Username, email, or phone already taken
 */
router.patch("/profile", authenticate, updateProfile);

/**
 * @openapi
 * /api/auth/change-password:
 *   post:
 *     tags: [Authentication]
 *     summary: Change user password
 *     description: Change the authenticated user's password
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 example: "OldPass123"
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *                 example: "NewSecurePass456"
 *     responses:
 *       200:
 *         description: Password changed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Password changed successfully"
 *       401:
 *         description: Current password incorrect or unauthorized
 *       400:
 *         description: Validation error
 */
router.post("/change-password", authenticate, changePassword);

/**
 * @openapi
 * /api/auth/toggle-availability:
 *   post:
 *     tags: [Authentication]
 *     summary: Toggle driver availability
 *     description: Drivers can toggle their availability status (available/unavailable for deliveries)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Availability toggled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Driver is now available"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     username:
 *                       type: string
 *                     role:
 *                       type: string
 *                       example: "driver"
 *                     isAvailable:
 *                       type: boolean
 *                       example: true
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only drivers can toggle availability
 */
router.post("/toggle-availability", authenticate, toggleAvailability);

export default router;
