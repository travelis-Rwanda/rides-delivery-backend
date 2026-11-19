import prisma from "../db/prisma.js";
import { getDriverInfo } from "../services/ridesPlatformService.js";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../utils/errors.js";

async function getDbUserByRidesUserId(ridesUserId) {
  if (ridesUserId == null) return null;
  return prisma.user.findUnique({
    where: { ridesUserId: String(ridesUserId) },
  });
}

function getDriverVehicleType(driverInfo) {
  if (!driverInfo) return null;
  return (
    driverInfo.vehicleType ||
    driverInfo.vehicle?.type ||
    driverInfo.vehicle?.vehicleType ||
    driverInfo.activeVehicle?.type ||
    driverInfo.activeVehicle?.vehicleType ||
    null
  );
}

function isDriverActive(driverInfo) {
  if (!driverInfo) return false;
  if (driverInfo.active === true || driverInfo.isActive === true) return true;
  const status = driverInfo.status || driverInfo.driverStatus;
  if (status === "active" || status === "approved") return true;
  return false;
}

async function notifyUser(userId, event, payload) {
  try {
    console.log("[notify]", { userId, event, payload });
  } catch (_e) {
    // ignore
  }
}

/**
 * POST /api/delivery-requests/:requestId/offers
 * Driver submits a price offer (Requirement 3)
 */
export async function submitPriceOffer(req, res, next) {
  try {
    const { requestId } = req.params;
    const { offeredPriceRWF } = req.body || {};

    const driver = await getDbUserByRidesUserId(req.user?.id);
    if (!driver) {
      throw new ForbiddenError("Driver profile not found");
    }
    if (driver.role !== "driver") {
      throw new ForbiddenError("Only drivers can submit offers");
    }
    if (!driver.isAvailable) {
      throw new ForbiddenError("Driver is not available");
    }

    // Ensure driver has no active delivery
    const activeBooking = await prisma.booking.findFirst({
      where: {
        driverId: driver.id,
        deliveryRequest: {
          status: { in: ["confirmed", "in_progress", "returning"] },
        },
      },
      select: { id: true },
    });
    if (activeBooking) {
      throw new ConflictError("Driver already has an active delivery");
    }

    const deliveryRequest = await prisma.deliveryRequest.findUnique({
      where: { id: requestId },
    });
    if (!deliveryRequest) {
      throw new NotFoundError("Delivery request not found");
    }
    if (!["open", "negotiating"].includes(deliveryRequest.status)) {
      throw new ConflictError(
        "Offers can only be submitted for open or negotiating requests"
      );
    }

    const price = Number(offeredPriceRWF);
    if (!Number.isFinite(price) || price <= 0) {
      throw new BadRequestError("offeredPriceRWF must be a positive number");
    }

    // Rides platform verification using ridesUserId
    const ridesDriverInfo = await getDriverInfo(driver.ridesUserId);
    if (!isDriverActive(ridesDriverInfo)) {
      throw new ForbiddenError("Driver is not active on Rides platform");
    }
    if (
      deliveryRequest.category === "Cargo" &&
      deliveryRequest.requiredVehicleType
    ) {
      const vehicleType = getDriverVehicleType(ridesDriverInfo);
      if (!vehicleType || vehicleType !== deliveryRequest.requiredVehicleType) {
        throw new BadRequestError(
          "Driver vehicle does not match required vehicle type for this cargo delivery"
        );
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const reqRow = await tx.deliveryRequest.findUnique({
        where: { id: requestId },
      });
      if (!reqRow) throw new NotFoundError("Delivery request not found");
      if (!["open", "negotiating"].includes(reqRow.status)) {
        throw new ConflictError(
          "Offers can only be submitted for open or negotiating requests"
        );
      }

      // Reject duplicate pending offer
      const existingPending = await tx.priceOffer.findFirst({
        where: {
          deliveryRequestId: requestId,
          driverId: driver.id,
          isAccepted: false,
          isRejected: false,
        },
      });
      if (existingPending) {
        throw new ConflictError(
          "Driver already has a pending offer for this delivery request"
        );
      }

      const offer = await tx.priceOffer.create({
        data: {
          deliveryRequestId: requestId,
          driverId: driver.id,
          offeredPriceRWF: price,
          isAccepted: false,
          isRejected: false,
        },
      });

      if (reqRow.status === "open") {
        await tx.deliveryRequest.update({
          where: { id: requestId },
          data: { status: "negotiating" },
        });
        await tx.statusHistory.create({
          data: {
            deliveryRequestId: requestId,
            previousStatus: "open",
            newStatus: "negotiating",
            changedBy: driver.id,
            changeReason: "Driver submitted price offer",
          },
        });
      }

      return { offer, becameNegotiating: reqRow.status === "open" };
    });

    setImmediate(() => {
      notifyUser(deliveryRequest.customerId, "offer_submitted", {
        deliveryRequestId: requestId,
        offerId: result.offer.id,
        offeredPriceRWF: result.offer.offeredPriceRWF,
        driverId: driver.id,
      });
    });

    return res.status(201).json({
      success: true,
      data: {
        id: result.offer.id,
        deliveryRequestId: result.offer.deliveryRequestId,
        driverId: result.offer.driverId,
        offeredPriceRWF: result.offer.offeredPriceRWF,
        isAccepted: result.offer.isAccepted,
        isRejected: result.offer.isRejected,
        createdAt: result.offer.createdAt,
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/delivery-requests/:requestId/offers
 * Customer views offers (Requirement 4)
 */
export async function getPriceOffers(req, res, next) {
  try {
    const { requestId } = req.params;
    const dbUser = await getDbUserByRidesUserId(req.user?.id);
    if (!dbUser) {
      throw new ForbiddenError("User profile not found");
    }

    const deliveryRequest = await prisma.deliveryRequest.findUnique({
      where: { id: requestId },
      select: { id: true, customerId: true },
    });
    if (!deliveryRequest) {
      throw new NotFoundError("Delivery request not found");
    }

    if (dbUser.role !== "admin" && deliveryRequest.customerId !== dbUser.id) {
      throw new ForbiddenError("Not authorized to view offers for this request");
    }

    const offers = await prisma.priceOffer.findMany({
      where: {
        deliveryRequestId: requestId,
        isRejected: false,
      },
      orderBy: {
        offeredPriceRWF: "asc",
      },
      include: {
        driver: {
          select: { id: true, ridesUserId: true, phoneNumber: true },
        },
      },
    });

    return res.status(200).json({ success: true, data: offers });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/delivery-requests/:requestId/offers/:offerId/accept
 * Customer accepts offer with concurrency control (Requirement 4)
 */
export async function acceptPriceOffer(req, res, next) {
  try {
    const { requestId, offerId } = req.params;
    const customer = await getDbUserByRidesUserId(req.user?.id);
    if (!customer) {
      throw new ForbiddenError("Customer profile not found");
    }
    if (customer.role !== "customer") {
      throw new ForbiddenError("Only customers can accept offers");
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1) Lock delivery request row
      const reqRows = await tx.$queryRaw`
        SELECT id, customer_id as "customerId", status
        FROM delivery_requests
        WHERE id = ${requestId}::uuid
        FOR UPDATE
      `;
      const dr = Array.isArray(reqRows) ? reqRows[0] : reqRows;
      if (!dr) throw new NotFoundError("Delivery request not found");
      if (dr.customerId !== customer.id) {
        throw new ForbiddenError(
          "Not authorized to accept offers for this request"
        );
      }
      if (!["open", "negotiating"].includes(dr.status)) {
        throw new ConflictError(
          "Offers can only be accepted while request is open or negotiating"
        );
      }

      // 2) Lock selected offer row
      const offerRows = await tx.$queryRaw`
        SELECT id,
               delivery_request_id as "deliveryRequestId",
               driver_id as "driverId",
               offered_price_rwf as "offeredPriceRWF",
               is_accepted as "isAccepted",
               is_rejected as "isRejected"
        FROM price_offers
        WHERE id = ${offerId}::uuid
        FOR UPDATE
      `;
      const offer = Array.isArray(offerRows) ? offerRows[0] : offerRows;
      if (!offer || offer.deliveryRequestId !== requestId) {
        throw new NotFoundError("Offer not found for this delivery request");
      }
      if (offer.isAccepted || offer.isRejected) {
        throw new ConflictError("Offer is no longer available");
      }

      // 3) Lock driver user row to serialize competing bookings for same driver
      const driverRows = await tx.$queryRaw`
        SELECT id, is_available as "isAvailable", role
        FROM users
        WHERE id = ${offer.driverId}::uuid
        FOR UPDATE
      `;
      const driver = Array.isArray(driverRows) ? driverRows[0] : driverRows;
      if (!driver || driver.role !== "driver") {
        throw new ConflictError("Driver not found");
      }
      if (!driver.isAvailable) {
        throw new ConflictError("Driver is no longer available");
      }

      // 4) Ensure driver has no active delivery
      const activeRows = await tx.$queryRaw`
        SELECT b.id
        FROM bookings b
        JOIN delivery_requests dr2 ON dr2.id = b.delivery_request_id
        WHERE b.driver_id = ${offer.driverId}::uuid
          AND dr2.status IN ('confirmed', 'in_progress', 'returning')
        LIMIT 1
      `;
      const hasActive = Array.isArray(activeRows)
        ? activeRows.length > 0
        : !!activeRows;
      if (hasActive) {
        throw new ConflictError("Driver already has an active delivery");
      }

      // 5) Accept selected offer, reject others
      await tx.priceOffer.update({
        where: { id: offerId },
        data: { isAccepted: true, isRejected: false },
      });
      await tx.priceOffer.updateMany({
        where: {
          deliveryRequestId: requestId,
          id: { not: offerId },
          isRejected: false,
        },
        data: { isRejected: true, isAccepted: false },
      });

      // 6) Mark driver unavailable and create booking
      await tx.user.update({
        where: { id: offer.driverId },
        data: { isAvailable: false },
      });

      const booking = await tx.booking.create({
        data: {
          deliveryRequestId: requestId,
          driverId: offer.driverId,
          agreedPriceRWF: Number(offer.offeredPriceRWF),
          confirmedAt: new Date(),
        },
      });

      // 7) Transition delivery request to confirmed + audit history
      await tx.deliveryRequest.update({
        where: { id: requestId },
        data: { status: "confirmed" },
      });
      await tx.statusHistory.create({
        data: {
          deliveryRequestId: requestId,
          previousStatus: dr.status,
          newStatus: "confirmed",
          changedBy: customer.id,
          changeReason: "Customer accepted price offer",
          metadata: JSON.stringify({ offerId, bookingId: booking.id }),
        },
      });

      return {
        booking,
        offer,
        driverId: offer.driverId,
        previousStatus: dr.status,
      };
    });

    setImmediate(() => {
      notifyUser(result.driverId, "offer_accepted", {
        deliveryRequestId: requestId,
        offerId,
        bookingId: result.booking.id,
      });
    });

    return res.status(200).json({
      success: true,
      data: {
        bookingId: result.booking.id,
        deliveryRequestId: requestId,
        offerId,
        driverId: result.driverId,
        agreedPriceRWF: result.booking.agreedPriceRWF,
        status: "confirmed",
      },
    });
  } catch (err) {
    return next(err);
  }
}
