import express from "express";
import { authenticate, requireRole } from "../middleware/auth.js";
import {
  submitPriceOffer,
  getPriceOffers,
  acceptPriceOffer,
} from "../controllers/offerController.js";
import { requestLowerPrice } from "../controllers/negotiationController.js";

const router = express.Router();

/**
 * @openapi
 * /api/delivery-requests/{requestId}/price-requests:
 *   post:
 *     tags: [Negotiation]
 *     summary: Request a lower price (Customer)
 *     description: Customer signals a desired lower price/target to drivers while negotiating. Drivers submit actual typed offers via POST /offers. Records a negotiation event in status history and notifies drivers who have offered.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               targetPriceRWF:
 *                 type: number
 *                 nullable: true
 *                 exclusiveMinimum: 0
 *                 example: 2000
 *               message:
 *                 type: string
 *                 nullable: true
 *                 example: "Can you do 2000 RWF?"
 *     responses:
 *       201:
 *         description: Price request recorded
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Delivery request not found
 *       409:
 *         description: Request not open/negotiating
 */
router.post(
  "/:requestId/price-requests",
  authenticate,
  requireRole("customer"),
  requestLowerPrice
);

/**
 * @openapi
 * /api/delivery-requests/{requestId}/offers:
 *   post:
 *     tags: [Offers]
 *     summary: Submit a price offer (Driver)
 *     description: Driver submits an offer for an open/negotiating delivery request. Verifies driver availability, active delivery, and Rides platform/vehicle eligibility. Transitions request from open to negotiating on first offer.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SubmitOfferRequest'
 *     responses:
 *       201:
 *         description: Offer submitted
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SubmitOfferResponse'
 *       400:
 *         description: Invalid input or vehicle mismatch
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not a driver / not available / not active on Rides)
 *       404:
 *         description: Delivery request or driver profile not found
 *       409:
 *         description: Conflict (not open/negotiating, active delivery, or duplicate pending offer)
 */
router.post(
  "/:requestId/offers",
  authenticate,
  requireRole("driver"),
  submitPriceOffer
);

/**
 * @openapi
 * /api/delivery-requests/{requestId}/offers:
 *   get:
 *     tags: [Offers]
 *     summary: View offers for a delivery request (Customer/Admin)
 *     description: Returns non-rejected offers for the request, sorted by offered price ascending.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: List of offers
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/GetOffersResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not owner or admin)
 *       404:
 *         description: Delivery request or user profile not found
 */
router.get(
  "/:requestId/offers",
  authenticate,
  requireRole(["customer", "admin"]),
  getPriceOffers
);

/**
 * @openapi
 * /api/delivery-requests/{requestId}/offers/{offerId}/accept:
 *   post:
 *     tags: [Offers]
 *     summary: Accept an offer (Customer)
 *     description: Atomically accepts an offer with row-level locking to prevent concurrent booking conflicts. Creates booking, rejects other offers, marks driver unavailable, and confirms the delivery request.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: requestId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: offerId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Offer accepted and booking confirmed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AcceptOfferResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not owner customer)
 *       404:
 *         description: Request/offer/customer profile not found
 *       409:
 *         description: Conflict (offer/request state changed, driver unavailable or has active delivery)
 */
router.post(
  "/:requestId/offers/:offerId/accept",
  authenticate,
  requireRole("customer"),
  acceptPriceOffer
);

export default router;
