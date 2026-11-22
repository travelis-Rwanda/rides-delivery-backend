/**
 * Status Tracking Controller
 * Handles order status updates and tracking
 */

import prisma from '../db/index.js';
import { AppError, ValidationError, ForbiddenError, NotFoundError } from '../errors.js';

/**
 * Valid status transitions map
 */
const VALID_TRANSITIONS = {
  open: ['negotiating', 'cancelled'],
  negotiating: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'rejected', 'cancelled'],
  preparing: ['ready_for_pickup', 'cancelled'],
  ready_for_pickup: ['out_for_delivery', 'cancelled'],
  out_for_delivery: ['delivered', 'failed'],
  delivered: ['refund_requested', 'disputed'],
  rejected: ['open'],
  failed: ['returning'],
  returning: ['returned'],
  returned: ['refund_requested', 'disputed'],
  cancelled: [], // Terminal
  refund_requested: ['refund_processed'],
  refund_processed: [], // Terminal
  disputed: ['delivered', 'refund_processed', 'returned'],
  // Legacy statuses
  in_progress: ['delivered', 'failed'],
  completed: ['refund_requested', 'disputed'],
};

/**
 * Status labels for customer notifications
 */
const STATUS_LABELS = {
  open: 'Order Placed',
  negotiating: 'Finding Driver',
  confirmed: 'Order Confirmed',
  preparing: 'Preparing Order',
  ready_for_pickup: 'Ready for Pickup',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  rejected: 'Driver Rejected',
  failed: 'Delivery Failed',
  returning: 'Returning',
  returned: 'Returned',
  cancelled: 'Cancelled',
  refund_requested: 'Refund Requested',
  refund_processed: 'Refund Processed',
  disputed: 'Under Dispute',
  in_progress: 'Out for Delivery',
  completed: 'Delivered',
};

/**
 * Status descriptions for customers
 */
const STATUS_DESCRIPTIONS = {
  open: 'Your order has been successfully placed and is waiting for driver offers.',
  negotiating: 'Drivers are submitting price offers for your delivery.',
  confirmed: 'A driver has been assigned to your order.',
  preparing: 'The seller is preparing your items for pickup.',
  ready_for_pickup: 'Your order is ready and waiting for driver pickup.',
  out_for_delivery: 'Your order is on the way to you.',
  delivered: 'Your order has been successfully delivered.',
  rejected: 'The driver rejected this delivery. Finding another driver...',
  failed: 'Delivery attempt failed. Processing return.',
  returning: 'Your order is being returned to the seller.',
  returned: 'Your order has been returned to the seller.',
  cancelled: 'This order has been cancelled.',
  refund_requested: 'A refund has been requested for this order.',
  refund_processed: 'Your refund has been processed.',
  disputed: 'This order is under dispute and being reviewed.',
  in_progress: 'Your order is on the way to you.',
  completed: 'Your order has been successfully delivered.',
};

/**
 * Validate status transition
 */
function validateTransition(currentStatus, newStatus) {
  const validNextStatuses = VALID_TRANSITIONS[currentStatus] || [];
  
  if (!validNextStatuses.includes(newStatus)) {
    return {
      isValid: false,
      error: `Cannot transition from '${currentStatus}' to '${newStatus}'. Valid transitions: ${validNextStatuses.join(', ') || 'none'}`,
    };
  }
  
  return { isValid: true };
}

/**
 * Update delivery status
 * POST /api/deliveries/:id/status
 */
export async function updateDeliveryStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Validation
    if (!status) {
      throw new ValidationError('Status is required', { field: 'status' });
    }

    // Get delivery request with transaction
    const delivery = await prisma.$transaction(async (tx) => {
      const existingDelivery = await tx.deliveryRequest.findUnique({
        where: { id },
        include: {
          customer: { select: { id: true, username: true, email: true } },
          booking: {
            include: {
              driver: { select: { id: true, username: true, email: true } },
            },
          },
        },
      });

      if (!existingDelivery) {
        throw new NotFoundError('Delivery request not found');
      }

      // Authorization check
      const isCustomer = existingDelivery.customerId === userId;
      const isDriver = existingDelivery.booking?.driverId === userId;
      const isAdmin = userRole === 'admin';

      if (!isCustomer && !isDriver && !isAdmin) {
        throw new ForbiddenError('You do not have permission to update this delivery status');
      }

      // Role-based status restrictions
      const driverStatuses = ['ready_for_pickup', 'out_for_delivery', 'delivered', 'failed'];
      const customerStatuses = ['cancelled'];
      const sellerStatuses = ['preparing', 'ready_for_pickup'];

      if (userRole === 'driver' && !driverStatuses.includes(status) && !isAdmin) {
        throw new ForbiddenError(`Drivers can only set status to: ${driverStatuses.join(', ')}`);
      }

      if (userRole === 'customer' && !customerStatuses.includes(status) && !isAdmin) {
        throw new ForbiddenError(`Customers can only cancel orders`);
      }

      // Validate transition
      const validation = validateTransition(existingDelivery.status, status);
      if (!validation.isValid) {
        throw new ValidationError(validation.error);
      }

      // Update status
      const updatedDelivery = await tx.deliveryRequest.update({
        where: { id },
        data: { status },
        include: {
          customer: { select: { id: true, username: true, email: true, phoneNumber: true } },
          booking: {
            include: {
              driver: { select: { id: true, username: true, email: true, phoneNumber: true } },
            },
          },
        },
      });

      // Create status history
      await tx.statusHistory.create({
        data: {
          deliveryRequestId: id,
          previousStatus: existingDelivery.status,
          newStatus: status,
          changedBy: userId,
          changeReason: reason || null,
          metadata: JSON.stringify({
            changedByRole: userRole,
            timestamp: new Date().toISOString(),
          }),
        },
      });

      // Update booking status if needed
      if (updatedDelivery.booking) {
        if (status === 'delivered') {
          await tx.booking.update({
            where: { id: updatedDelivery.booking.id },
            data: { completedAt: new Date() },
          });
        }
      }

      return updatedDelivery;
    });

    // TODO: Send notification to customer (implement notification service)
    console.log(`Notification: Status changed to ${status} for delivery ${id}`);

    res.json({
      success: true,
      message: 'Status updated successfully',
      data: {
        id: delivery.id,
        previousStatus: delivery.status,
        newStatus: status,
        statusLabel: STATUS_LABELS[status],
        statusDescription: STATUS_DESCRIPTIONS[status],
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get delivery status and history
 * GET /api/deliveries/:id/status
 */
export async function getDeliveryStatus(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const delivery = await prisma.deliveryRequest.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, username: true } },
        booking: {
          include: {
            driver: { select: { id: true, username: true } },
          },
        },
        statusHistory: {
          orderBy: { createdAt: 'asc' },
          include: {
            user: { select: { username: true, role: true } },
          },
        },
      },
    });

    if (!delivery) {
      throw new NotFoundError('Delivery request not found');
    }

    // Authorization check
    const isCustomer = delivery.customerId === userId;
    const isDriver = delivery.booking?.driverId === userId;
    const isAdmin = userRole === 'admin';

    if (!isCustomer && !isDriver && !isAdmin) {
      throw new ForbiddenError('You do not have permission to view this delivery');
    }

    // Build status timeline
    const timeline = delivery.statusHistory.map((history) => ({
      status: history.newStatus,
      statusLabel: STATUS_LABELS[history.newStatus],
      statusDescription: STATUS_DESCRIPTIONS[history.newStatus],
      changedBy: history.user.username,
      changedByRole: history.user.role,
      reason: history.changeReason,
      timestamp: history.createdAt,
    }));

    // Get next valid statuses
    const validNextStatuses = VALID_TRANSITIONS[delivery.status] || [];

    res.json({
      success: true,
      data: {
        id: delivery.id,
        currentStatus: delivery.status,
        currentStatusLabel: STATUS_LABELS[delivery.status],
        currentStatusDescription: STATUS_DESCRIPTIONS[delivery.status],
        validNextStatuses: validNextStatuses.map(s => ({
          status: s,
          label: STATUS_LABELS[s],
          description: STATUS_DESCRIPTIONS[s],
        })),
        timeline,
        customer: {
          id: delivery.customer.id,
          username: delivery.customer.username,
        },
        driver: delivery.booking?.driver ? {
          id: delivery.booking.driver.id,
          username: delivery.booking.driver.username,
        } : null,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get all deliveries for current user with status filtering
 * GET /api/deliveries/my-orders
 */
export async function getMyOrders(req, res, next) {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { status, limit = 50, offset = 0 } = req.query;

    let whereClause = {};

    if (userRole === 'customer') {
      whereClause.customerId = userId;
    } else if (userRole === 'driver') {
      whereClause.booking = {
        driverId: userId,
      };
    }

    if (status) {
      whereClause.status = status;
    }

    const deliveries = await prisma.deliveryRequest.findMany({
      where: whereClause,
      include: {
        customer: { select: { id: true, username: true } },
        booking: {
          include: {
            driver: { select: { id: true, username: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset),
    });

    const total = await prisma.deliveryRequest.count({ where: whereClause });

    const formattedDeliveries = deliveries.map((delivery) => ({
      id: delivery.id,
      status: delivery.status,
      statusLabel: STATUS_LABELS[delivery.status],
      statusDescription: STATUS_DESCRIPTIONS[delivery.status],
      category: delivery.category,
      itemDescription: delivery.itemDescription,
      pickupLocation: {
        latitude: delivery.pickupLatitude,
        longitude: delivery.pickupLongitude,
      },
      destinationLocation: {
        latitude: delivery.destinationLatitude,
        longitude: delivery.destinationLongitude,
      },
      customer: delivery.customer,
      driver: delivery.booking?.driver || null,
      agreedPrice: delivery.booking?.agreedPriceRWF || null,
      createdAt: delivery.createdAt,
      updatedAt: delivery.updatedAt,
    }));

    res.json({
      success: true,
      data: formattedDeliveries,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + formattedDeliveries.length < total,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get status statistics for current user
 * GET /api/deliveries/statistics
 */
export async function getStatusStatistics(req, res, next) {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    let whereClause = {};

    if (userRole === 'customer') {
      whereClause.customerId = userId;
    } else if (userRole === 'driver') {
      whereClause.booking = {
        driverId: userId,
      };
    }

    const statusCounts = await prisma.deliveryRequest.groupBy({
      by: ['status'],
      where: whereClause,
      _count: true,
    });

    const statistics = statusCounts.reduce((acc, item) => {
      acc[item.status] = {
        count: item._count,
        label: STATUS_LABELS[item.status],
      };
      return acc;
    }, {});

    const total = await prisma.deliveryRequest.count({ where: whereClause });

    res.json({
      success: true,
      data: {
        total,
        byStatus: statistics,
      },
    });
  } catch (error) {
    next(error);
  }
}
