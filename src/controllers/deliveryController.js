/**
 * Delivery Request Controller
 * Handles delivery order creation and management
 */

import prisma from '../db/index.js';
import { AppError, ValidationError, NotFoundError } from '../errors.js';

/**
 * Create a new delivery request (order)
 * POST /api/deliveries
 */
export async function createDelivery(req, res, next) {
  try {
    const userId = req.user.id;
    const {
      pickupLatitude,
      pickupLongitude,
      destinationLatitude,
      destinationLongitude,
      category,
      itemDescription,
      recipientPhoneNumber,
      // Category-specific fields
      temperatureControl,
      preparationTimeMinutes,
      requiredVehicleType,
      cargoWeightKg,
      cargoDimensionsCm,
      fragilityLevel,
      packageSize,
    } = req.body;

    // Validation
    if (!pickupLatitude || !pickupLongitude || !destinationLatitude || !destinationLongitude) {
      throw new ValidationError('Pickup and destination coordinates are required', {
        fields: ['pickupLatitude', 'pickupLongitude', 'destinationLatitude', 'destinationLongitude'],
      });
    }

    if (!category) {
      throw new ValidationError('Delivery category is required', { field: 'category' });
    }

    const validCategories = ['Parcel', 'Restaurant', 'Shop', 'Cargo'];
    if (!validCategories.includes(category)) {
      throw new ValidationError(`Category must be one of: ${validCategories.join(', ')}`, {
        field: 'category',
      });
    }

    if (!itemDescription || itemDescription.trim().length === 0) {
      throw new ValidationError('Item description is required', { field: 'itemDescription' });
    }

    // Validate coordinates are within valid ranges
    if (pickupLatitude < -90 || pickupLatitude > 90 || destinationLatitude < -90 || destinationLatitude > 90) {
      throw new ValidationError('Latitude must be between -90 and 90 degrees');
    }

    if (pickupLongitude < -180 || pickupLongitude > 180 || destinationLongitude < -180 || destinationLongitude > 180) {
      throw new ValidationError('Longitude must be between -180 and 180 degrees');
    }

    // Validate phone number if provided
    if (recipientPhoneNumber) {
      const phoneRegex = /^\+250[0-9]{9}$/;
      if (!phoneRegex.test(recipientPhoneNumber)) {
        throw new ValidationError('Recipient phone number must be in Rwanda format: +250XXXXXXXXX', {
          field: 'recipientPhoneNumber',
        });
      }
    }

    // Get customer phone number
    const customer = await prisma.user.findUnique({
      where: { id: userId },
      select: { phoneNumber: true },
    });

    if (!customer) {
      throw new NotFoundError('User not found');
    }

    // Calculate estimated distance (simple Haversine formula)
    const estimatedDistanceKm = calculateDistance(
      pickupLatitude,
      pickupLongitude,
      destinationLatitude,
      destinationLongitude
    );

    // Category-specific validation
    if (category === 'Cargo' && !requiredVehicleType) {
      throw new ValidationError('Vehicle type is required for Cargo deliveries', {
        field: 'requiredVehicleType',
      });
    }

    // Create delivery request
    const delivery = await prisma.deliveryRequest.create({
      data: {
        customerId: userId,
        pickupLatitude,
        pickupLongitude,
        destinationLatitude,
        destinationLongitude,
        category,
        itemDescription: itemDescription.trim(),
        status: 'open',
        customerPhoneNumber: customer.phoneNumber,
        recipientPhoneNumber: recipientPhoneNumber || null,
        estimatedDistanceKm,
        // Category-specific fields
        temperatureControl: temperatureControl || null,
        preparationTimeMinutes: preparationTimeMinutes || null,
        requiredVehicleType: requiredVehicleType || null,
        cargoWeightKg: cargoWeightKg || null,
        cargoDimensionsCm: cargoDimensionsCm || null,
        fragilityLevel: fragilityLevel || null,
        packageSize: packageSize || null,
      },
      include: {
        customer: {
          select: {
            id: true,
            username: true,
            email: true,
            phoneNumber: true,
          },
        },
      },
    });

    // Create initial status history
    await prisma.statusHistory.create({
      data: {
        deliveryRequestId: delivery.id,
        previousStatus: null,
        newStatus: 'open',
        changedBy: userId,
        changeReason: 'Order created',
        metadata: JSON.stringify({
          category: delivery.category,
          estimatedDistanceKm: delivery.estimatedDistanceKm,
        }),
      },
    });

    res.status(201).json({
      success: true,
      message: 'Delivery order created successfully',
      data: {
        id: delivery.id,
        status: delivery.status,
        statusLabel: 'Order Placed',
        statusDescription: 'Your order has been successfully placed and is waiting for driver offers.',
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
        estimatedDistanceKm: delivery.estimatedDistanceKm,
        customer: delivery.customer,
        createdAt: delivery.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get delivery by ID
 * GET /api/deliveries/:id
 */
export async function getDelivery(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const delivery = await prisma.deliveryRequest.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            username: true,
            email: true,
            phoneNumber: true,
          },
        },
        booking: {
          include: {
            driver: {
              select: {
                id: true,
                username: true,
                email: true,
                phoneNumber: true,
              },
            },
          },
        },
        priceOffers: {
          where: { isRejected: false },
          orderBy: { offeredPriceRWF: 'asc' },
          take: 10,
          include: {
            driver: {
              select: {
                id: true,
                username: true,
                phoneNumber: true,
              },
            },
          },
        },
      },
    });

    if (!delivery) {
      throw new NotFoundError('Delivery not found');
    }

    // Authorization check
    const isCustomer = delivery.customerId === userId;
    const isDriver = delivery.booking?.driverId === userId;
    const isAdmin = userRole === 'admin';

    if (!isCustomer && !isDriver && !isAdmin) {
      throw new AppError('FORBIDDEN', 'You do not have permission to view this delivery', 403);
    }

    res.json({
      success: true,
      data: {
        id: delivery.id,
        status: delivery.status,
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
        estimatedDistanceKm: delivery.estimatedDistanceKm,
        customer: delivery.customer,
        driver: delivery.booking?.driver || null,
        agreedPrice: delivery.booking?.agreedPriceRWF || null,
        priceOffers: delivery.priceOffers,
        // Category-specific fields
        temperatureControl: delivery.temperatureControl,
        preparationTimeMinutes: delivery.preparationTimeMinutes,
        requiredVehicleType: delivery.requiredVehicleType,
        cargoWeightKg: delivery.cargoWeightKg,
        cargoDimensionsCm: delivery.cargoDimensionsCm,
        fragilityLevel: delivery.fragilityLevel,
        packageSize: delivery.packageSize,
        createdAt: delivery.createdAt,
        updatedAt: delivery.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get all deliveries (with filters)
 * GET /api/deliveries
 */
export async function getAllDeliveries(req, res, next) {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { status, category, limit = 50, offset = 0 } = req.query;

    let whereClause = {};

    // Role-based filtering
    if (userRole === 'customer') {
      whereClause.customerId = userId;
    } else if (userRole === 'driver') {
      // Drivers see orders they can bid on (open/negotiating) or their assigned orders
      whereClause.OR = [
        { status: { in: ['open', 'negotiating'] } },
        { booking: { driverId: userId } },
      ];
    }

    // Additional filters
    if (status) {
      whereClause.status = status;
    }

    if (category) {
      whereClause.category = category;
    }

    const deliveries = await prisma.deliveryRequest.findMany({
      where: whereClause,
      include: {
        customer: {
          select: { id: true, username: true },
        },
        booking: {
          include: {
            driver: {
              select: { id: true, username: true },
            },
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
      estimatedDistanceKm: delivery.estimatedDistanceKm,
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
 * Cancel delivery
 * DELETE /api/deliveries/:id
 */
export async function cancelDelivery(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;
    const { reason } = req.body;

    const delivery = await prisma.deliveryRequest.findUnique({
      where: { id },
      include: { customer: true },
    });

    if (!delivery) {
      throw new NotFoundError('Delivery not found');
    }

    // Authorization check
    const isCustomer = delivery.customerId === userId;
    const isAdmin = userRole === 'admin';

    if (!isCustomer && !isAdmin) {
      throw new AppError('FORBIDDEN', 'Only the customer or admin can cancel this delivery', 403);
    }

    // Check if can be cancelled
    const cancellableStatuses = ['open', 'negotiating', 'confirmed'];
    if (!cancellableStatuses.includes(delivery.status)) {
      throw new AppError(
        'INVALID_OPERATION',
        `Cannot cancel delivery with status '${delivery.status}'. Can only cancel: ${cancellableStatuses.join(', ')}`,
        400
      );
    }

    // Update status to cancelled
    await prisma.$transaction(async (tx) => {
      await tx.deliveryRequest.update({
        where: { id },
        data: { status: 'cancelled' },
      });

      await tx.statusHistory.create({
        data: {
          deliveryRequestId: id,
          previousStatus: delivery.status,
          newStatus: 'cancelled',
          changedBy: userId,
          changeReason: reason || 'Order cancelled by customer',
        },
      });
    });

    res.json({
      success: true,
      message: 'Delivery cancelled successfully',
      data: {
        id: delivery.id,
        status: 'cancelled',
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 100) / 100; // Round to 2 decimal places
}

function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}
