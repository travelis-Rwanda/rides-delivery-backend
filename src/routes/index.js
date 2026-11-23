import express from "express";
import authRoutes from "./authRoutes.js";
import deliveryRoutes from "./deliveryRoutes.js";
import deliveryRequestRoutes from "./deliveryRequestRoutes.js";
import bookingRoutes from "./bookingRoutes.js";
import statusRoutes from "./statusRoutes.js";

const router = express.Router();

// Authentication routes
router.use("/auth", authRoutes);

// Delivery order routes (CRUD operations)
router.use("/deliveries", deliveryRoutes);

// Delivery request routes (offers and negotiations)
router.use("/delivery-requests", deliveryRequestRoutes);

// Booking routes (payments)
router.use("/bookings", bookingRoutes);

// Status tracking routes (merged into deliveries)
router.use("/deliveries", statusRoutes);

export default router;
