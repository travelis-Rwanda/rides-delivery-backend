/**
 * Status Tracking Routes
 * Order status tracking and management
 */

import express from "express";
import { authenticate } from "../middleware/auth.js";
import {
  updateDeliveryStatus,
  getDeliveryStatus,
  getMyOrders,
  getStatusStatistics,
} from "../controllers/statusController.js";

const router = express.Router();

/**
 * @openapi
 * /api/deliveries/{id}/status:
 *   get:
 *     tags: [Order Tracking]
 *     summary: Get delivery status and history
 *     description: |
 *       Get current status and complete timeline of status changes for a delivery.
 *       Shows all status transitions with timestamps and who made the change.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Delivery request ID
 *     responses:
 *       200:
 *         description: Delivery status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     currentStatus:
 *                       type: string
 *                       example: "out_for_delivery"
 *                     currentStatusLabel:
 *                       type: string
 *                       example: "Out for Delivery"
 *                     currentStatusDescription:
 *                       type: string
 *                       example: "Your order is on the way to you."
 *                     validNextStatuses:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           status:
 *                             type: string
 *                           label:
 *                             type: string
 *                           description:
 *                             type: string
 *                     timeline:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           status:
 *                             type: string
 *                           statusLabel:
 *                             type: string
 *                           statusDescription:
 *                             type: string
 *                           changedBy:
 *                             type: string
 *                           changedByRole:
 *                             type: string
 *                           reason:
 *                             type: string
 *                             nullable: true
 *                           timestamp:
 *                             type: string
 *                             format: date-time
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Not authorized to view this delivery
 *       404:
 *         description: Delivery not found
 */
router.get("/:id/status", authenticate, getDeliveryStatus);

/**
 * @openapi
 * /api/deliveries/{id}/status:
 *   post:
 *     tags: [Order Tracking]
 *     summary: Update delivery status
 *     description: |
 *       Update the status of a delivery. Role-based permissions apply:
 *       - Customers: Can cancel orders
 *       - Drivers: Can update to ready_for_pickup, out_for_delivery, delivered, failed
 *       - Sellers: Can update to preparing, ready_for_pickup
 *       - Admins: Can update to any status
 *       
 *       Status flow:
 *       1. Order Placed (open)
 *       2. Order Confirmed (confirmed)
 *       3. Preparing Order (preparing)
 *       4. Ready for Pickup (ready_for_pickup)
 *       5. Out for Delivery (out_for_delivery)
 *       6. Delivered (delivered)
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
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum:
 *                   - open
 *                   - negotiating
 *                   - confirmed
 *                   - preparing
 *                   - ready_for_pickup
 *                   - out_for_delivery
 *                   - delivered
 *                   - rejected
 *                   - failed
 *                   - returning
 *                   - returned
 *                   - cancelled
 *                   - refund_requested
 *                   - refund_processed
 *                   - disputed
 *                 example: "out_for_delivery"
 *               reason:
 *                 type: string
 *                 example: "Driver picked up the order"
 *     responses:
 *       200:
 *         description: Status updated successfully
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
 *                   example: "Status updated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     previousStatus:
 *                       type: string
 *                     newStatus:
 *                       type: string
 *                     statusLabel:
 *                       type: string
 *                     statusDescription:
 *                       type: string
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Invalid status transition
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Not authorized to update this status
 *       404:
 *         description: Delivery not found
 */
router.post("/:id/status", authenticate, updateDeliveryStatus);

/**
 * @openapi
 * /api/deliveries/my-orders:
 *   get:
 *     tags: [Order Tracking]
 *     summary: Get my orders
 *     description: |
 *       Get all orders for the authenticated user.
 *       - Customers see their created orders
 *       - Drivers see their assigned deliveries
 *       - Admins see all orders
 *       
 *       Supports filtering by status and pagination.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum:
 *             - open
 *             - negotiating
 *             - confirmed
 *             - preparing
 *             - ready_for_pickup
 *             - out_for_delivery
 *             - delivered
 *             - cancelled
 *         description: Filter by status
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *           maximum: 100
 *         description: Number of results per page
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of results to skip
 *     responses:
 *       200:
 *         description: Orders retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       status:
 *                         type: string
 *                       statusLabel:
 *                         type: string
 *                       statusDescription:
 *                         type: string
 *                       category:
 *                         type: string
 *                       itemDescription:
 *                         type: string
 *                       pickupLocation:
 *                         type: object
 *                       destinationLocation:
 *                         type: object
 *                       customer:
 *                         type: object
 *                       driver:
 *                         type: object
 *                         nullable: true
 *                       agreedPrice:
 *                         type: number
 *                         nullable: true
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     offset:
 *                       type: integer
 *                     hasMore:
 *                       type: boolean
 *       401:
 *         description: Unauthorized
 */
router.get("/my-orders", authenticate, getMyOrders);

/**
 * @openapi
 * /api/deliveries/statistics:
 *   get:
 *     tags: [Order Tracking]
 *     summary: Get order statistics
 *     description: Get statistics of orders by status for the authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       example: 45
 *                     byStatus:
 *                       type: object
 *                       additionalProperties:
 *                         type: object
 *                         properties:
 *                           count:
 *                             type: integer
 *                           label:
 *                             type: string
 *       401:
 *         description: Unauthorized
 */
router.get("/statistics", authenticate, getStatusStatistics);

export default router;
