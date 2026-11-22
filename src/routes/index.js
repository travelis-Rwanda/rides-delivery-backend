import express from "express";
import authRoutes from "./authRoutes.js";
import deliveryRequestRoutes from "./deliveryRequestRoutes.js";
import bookingRoutes from "./bookingRoutes.js";

const router = express.Router();

// Authentication routes
router.use("/auth", authRoutes);

// Delivery routes
router.use("/delivery-requests", deliveryRequestRoutes);
router.use("/bookings", bookingRoutes);

export default router;
