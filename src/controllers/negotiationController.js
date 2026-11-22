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

async function notifyUser(userId, event, payload) {
  try {
    console.log("[notify]", { userId, event, payload });
  } catch (_e) {
    // ignore
  }
}

/**
 * POST /api/delivery-requests/:requestId/price-requests
 * Customer requests a lower price (negotiation). Drivers type/submit actual offers.
 */
export async function requestLowerPrice(req, res, next) {
  try {
    const { requestId } = req.params;
    const { targetPriceRWF, message } = req.body || {};

    const customer = await getDbUserByRidesUserId(req.user?.id);
    if (!customer) {
      throw new ForbiddenError("Customer profile not found");
    }
    if (customer.role !== "customer") {
      throw new ForbiddenError("Only customers can request a lower price");
    }

    let target = null;
    if (targetPriceRWF !== undefined && targetPriceRWF !== null && targetPriceRWF !== "") {
      target = Number(targetPriceRWF);
      if (!Number.isFinite(target) || target <= 0) {
        throw new BadRequestError("targetPriceRWF must be a positive number when provided");
      }
    }

    const note = typeof message === "string" ? message.trim() : "";
    if (target == null && !note) {
      throw new BadRequestError("Provide targetPriceRWF and/or message");
    }

    const deliveryRequest = await prisma.deliveryRequest.findUnique({
      where: { id: requestId },
      select: { id: true, customerId: true, status: true },
    });
    if (!deliveryRequest) {
      throw new NotFoundError("Delivery request not found");
    }
    if (deliveryRequest.customerId !== customer.id) {
      throw new ForbiddenError("Not authorized to negotiate on this request");
    }
    if (!["open", "negotiating"].includes(deliveryRequest.status)) {
      throw new ConflictError(
        "Price requests are only allowed while request is open or negotiating"
      );
    }

    const history = await prisma.statusHistory.create({
      data: {
        deliveryRequestId: requestId,
        previousStatus: deliveryRequest.status,
        newStatus: deliveryRequest.status,
        changedBy: customer.id,
        changeReason: "Customer requested lower price",
        metadata: JSON.stringify({
          type: "price_request",
          targetPriceRWF: target,
          message: note || null,
        }),
      },
    });

    // Notify drivers who have submitted (pending or past) offers on this request
    const offers = await prisma.priceOffer.findMany({
      where: { deliveryRequestId: requestId },
      select: { driverId: true },
      distinct: ["driverId"],
    });

    setImmediate(() => {
      for (const o of offers) {
        notifyUser(o.driverId, "price_request", {
          deliveryRequestId: requestId,
          targetPriceRWF: target,
          message: note || null,
          statusHistoryId: history.id,
        });
      }
    });

    return res.status(201).json({
      success: true,
      data: {
        id: history.id,
        deliveryRequestId: requestId,
        status: deliveryRequest.status,
        targetPriceRWF: target,
        message: note || null,
        createdAt: history.createdAt,
      },
    });
  } catch (err) {
    return next(err);
  }
}
