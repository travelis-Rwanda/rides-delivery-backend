/**
 * Delivery Routes
 * Order creation and management
 */

import express from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import {
  createDelivery,
  getDelivery,
  getAllDeliveries,
  cancelDelivery,
} from "../controllers/deliveryController.js";

const router = express.Router();

/**
 * @openapi
 * /api/deliveries:
 *   post:
 *     tags: [Orders]
 *     summary: Create a new delivery order
 *     description: |
 *       Create a new delivery request. Customers can create orders for:
 *       - Parcel delivery
 *       - Restaurant food delivery
 *       - Shop product delivery
 *       - Cargo delivery
 *       
 *       The order will be created with status "open" and drivers can start submitting offers.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - pickupLatitude
 *               - pickupLongitude
 *               - destinationLatitude
 *               - destinationLongitude
 *               - category
 *               - itemDescription
 *             properties:
 *               pickupLatitude:
 *                 type: number
 *                 example: -1.9441
 *                 description: Pickup location latitude
 *               pickupLongitude:
 *                 type: number
 *                 example: 30.0619
 *                 description: Pickup location longitude
 *               destinationLatitude:
 *                 type: number
 *                 example: -1.9506
 *                 description: Destination latitude
 *               destinationLongitude:
 *                 type: number
 *                 example: 30.0588
 *                 description: Destination longitude
 *               category:
 *                 type: string
 *                 enum: [Parcel, Restaurant, Shop, Cargo]
 *                 example: "Restaurant"
 *                 description: Type of delivery
 *               itemDescription:
 *                 type: string
 *                 example: "2 Burgers and Fries from KFC"
 *                 description: Detailed description of items
 *               recipientPhoneNumber:
 *                 type: string
 *                 pattern: '^\+250[0-9]{9}$'
 *                 example: "+250788123456"
 *                 description: Recipient phone number (optional)
 *               temperatureControl:
 *                 type: string
 *                 enum: [hot, cold, frozen, room_temperature]
 *                 description: For Restaurant deliveries
 *               preparationTimeMinutes:
 *                 type: integer
 *                 example: 20
 *                 description: Estimated preparation time for Restaurant
 *               requiredVehicleType:
 *                 type: string
 *                 enum: [van, small_truck, large_truck, flatbed]
 *                 description: Required for Cargo deliveries
 *               cargoWeightKg:
 *                 type: number
 *                 example: 50.5
 *                 description: Weight for Cargo deliveries
 *               cargoDimensionsCm:
 *                 type: string
 *                 example: "100x80x60"
 *                 description: Dimensions for Cargo
 *               fragilityLevel:
 *                 type: string
 *                 enum: [fragile, standard, durable]
 *                 description: For Shop deliveries
 *               packageSize:
 *                 type: string
 *                 enum: [small, medium, large, extra_large]
 *                 description: For Parcel deliveries
 *     responses:
 *       201:
 *         description: Order created successfully
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
 *                   example: "Delivery order created successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     status:
 *                       type: string
 *                       example: "open"
 *                     statusLabel:
 *                       type: string
 *                       example: "Order Placed"
 *                     statusDescription:
 *                       type: string
 *                     category:
 *                       type: string
 *                     itemDescription:
 *                       type: string
 *                     pickupLocation:
 *                       type: object
 *                       properties:
 *                         latitude:
 *                           type: number
 *                         longitude:
 *                           type: number
 *                     destinationLocation:
 *                       type: object
 *                       properties:
 *                         latitude:
 *                           type: number
 *                         longitude:
 *                           type: number
 *                     estimatedDistanceKm:
 *                       type: number
 *                     customer:
 *                       type: object
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post("/", authenticate, requireRole("customer"), createDelivery);

/**
 * @openapi
 * /api/deliveries:
 *   get:
 *     tags: [Orders]
 *     summary: Get all deliveries
 *     description: |
 *       Get list of deliveries based on user role:
 *       - Customers: See their own orders
 *       - Drivers: See available orders (open/negotiating) and their assigned orders
 *       - Admins: See all orders
 *       
 *       Supports filtering and pagination.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [open, negotiating, confirmed, preparing, ready_for_pickup, out_for_delivery, delivered, cancelled]
 *         description: Filter by status
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [Parcel, Restaurant, Shop, Cargo]
 *         description: Filter by category
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *           maximum: 100
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Deliveries retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                 pagination:
 *                   type: object
 *       401:
 *         description: Unauthorized
 */
router.get("/", authenticate, getAllDeliveries);

/**
 * @openapi
 * /api/deliveries/{id}:
 *   get:
 *     tags: [Orders]
 *     summary: Get delivery by ID
 *     description: Get detailed information about a specific delivery order including price offers
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Delivery retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Delivery not found
 */
router.get("/:id", authenticate, getDelivery);

/**
 * @openapi
 * /api/deliveries/{id}/cancel:
 *   delete:
 *     tags: [Orders]
 *     summary: Cancel a delivery order
 *     description: |
 *       Cancel a delivery order. Can only cancel orders in status:
 *       - open
 *       - negotiating
 *       - confirmed
 *       
 *       Only the customer who created the order or an admin can cancel it.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 example: "Changed my mind"
 *     responses:
 *       200:
 *         description: Order cancelled successfully
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
 *                   example: "Delivery cancelled successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     status:
 *                       type: string
 *                       example: "cancelled"
 *       400:
 *         description: Cannot cancel (invalid status)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Delivery not found
 */
router.delete("/:id/cancel", authenticate, cancelDelivery);

export default router;
