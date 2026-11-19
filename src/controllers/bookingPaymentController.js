import prisma from "../db/prisma.js";
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

const ALLOWED_PAYMENT_METHODS = new Set(["MTN_Mobile_Money", "Airtel_Money"]);

/**
 * POST /api/bookings/:bookingId/payment-method
 * Customer selects payment method (MTN/Airtel) and records PaymentTransaction (no live provider call).
 */
export async function setBookingPaymentMethod(req, res, next) {
  try {
    const { bookingId } = req.params;
    const { paymentMethod } = req.body || {};

    if (!ALLOWED_PAYMENT_METHODS.has(paymentMethod)) {
      throw new BadRequestError(
        "paymentMethod must be one of: MTN_Mobile_Money, Airtel_Money"
      );
    }

    const customer = await getDbUserByRidesUserId(req.user?.id);
    if (!customer) {
      throw new ForbiddenError("Customer profile not found");
    }
    if (customer.role !== "customer") {
      throw new ForbiddenError("Only customers can set booking payment method");
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        deliveryRequest: { select: { id: true, customerId: true } },
        paymentTransaction: true,
      },
    });
    if (!booking) {
      throw new NotFoundError("Booking not found");
    }
    if (booking.deliveryRequest.customerId !== customer.id) {
      throw new ForbiddenError("Not authorized to manage payment for this booking");
    }

    // Record transaction (pending). If one exists and still pending, allow updating method.
    let txRecord;
    if (booking.paymentTransaction) {
      if (booking.paymentTransaction.status !== "pending") {
        throw new ConflictError(
          "Payment transaction already processed; method cannot be changed"
        );
      }
      txRecord = await prisma.paymentTransaction.update({
        where: { id: booking.paymentTransaction.id },
        data: {
          paymentMethod,
          amountRWF: booking.agreedPriceRWF,
        },
      });
    } else {
      txRecord = await prisma.paymentTransaction.create({
        data: {
          bookingId: booking.id,
          amountRWF: booking.agreedPriceRWF,
          paymentMethod,
          status: "pending",
          initiatedAt: new Date(),
        },
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: txRecord.id,
        bookingId: txRecord.bookingId,
        amountRWF: txRecord.amountRWF,
        paymentMethod: txRecord.paymentMethod,
        status: txRecord.status,
        initiatedAt: txRecord.initiatedAt,
        transactionReference: txRecord.transactionReference,
      },
    });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/bookings/:bookingId/payment
 * Get payment transaction for a booking (customer owner or admin).
 */
export async function getBookingPayment(req, res, next) {
  try {
    const { bookingId } = req.params;
    const user = await getDbUserByRidesUserId(req.user?.id);
    if (!user) {
      throw new ForbiddenError("User profile not found");
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        deliveryRequest: { select: { customerId: true } },
        paymentTransaction: true,
      },
    });
    if (!booking) {
      throw new NotFoundError("Booking not found");
    }
    if (user.role !== "admin" && booking.deliveryRequest.customerId !== user.id) {
      throw new ForbiddenError("Not authorized to view payment for this booking");
    }

    return res.status(200).json({
      success: true,
      data: booking.paymentTransaction,
    });
  } catch (err) {
    return next(err);
  }
}
