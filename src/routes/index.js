import express from "express";
import deliveryRequestRoutes from "./deliveryRequestRoutes.js";
import bookingRoutes from "./bookingRoutes.js";

const router = express.Router();

router.use("/delivery-requests", deliveryRequestRoutes);
router.use("/bookings", bookingRoutes);

export default router;
