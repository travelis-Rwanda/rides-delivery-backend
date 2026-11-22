import express from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import {
  getBookingPayment,
  setBookingPaymentMethod,
} from "../controllers/bookingPaymentController.js";

const router = express.Router();

/**
 * @openapi
 * /api/bookings/{bookingId}/payment-method:
 *   post:
 *     tags: [Payments]
 *     summary: Select payment method for a booking (Customer)
 *     description: Records or updates a pending PaymentTransaction for the booking using MTN Mobile Money or Airtel Money. No live provider API call is made.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [paymentMethod]
 *             properties:
 *               paymentMethod:
 *                 type: string
 *                 enum: [MTN_Mobile_Money, Airtel_Money]
 *     responses:
 *       200:
 *         description: Payment method recorded
 *       400:
 *         description: Invalid payment method
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Booking not found
 *       409:
 *         description: Payment already processed
 */
router.post(
  "/:bookingId/payment-method",
  authenticate,
  requireRole("customer"),
  setBookingPaymentMethod
);

/**
 * @openapi
 * /api/bookings/{bookingId}/payment:
 *   get:
 *     tags: [Payments]
 *     summary: Get booking payment transaction (Customer/Admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Payment transaction (or null)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Booking not found
 */
router.get(
  "/:bookingId/payment",
  authenticate,
  requireRole(["customer", "admin"]),
  getBookingPayment
);

export default router;
