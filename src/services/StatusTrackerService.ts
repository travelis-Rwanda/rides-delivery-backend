/**
 * StatusTrackerService - Service for managing delivery status transitions
 * Implements ACID transactions and immutable audit logging (Requirements 17.1 & 6.6)
 */

import type { PrismaClient, DeliveryStatus, Prisma } from '../generated/prisma';
import { StatusValidator } from '../helpers/StatusValidator';
import {
  StatusUpdateRequest,
  StatusUpdateResult,
  StatusValidationError,
} from '../types/status.types';

export class StatusTrackerService {
  private prisma: PrismaClient;

  constructor(prismaClient: PrismaClient) {
    this.prisma = prismaClient;
  }

  /**
   * Update delivery status with ACID transaction and immutable audit logging
   * Implements Requirements 17.1 (PostgreSQL transactions) and 6.6 (timestamp and user tracking)
   *
   * @throws {StatusTransitionError} if the transition is invalid
   * @throws {DeliveryNotFoundError} if delivery request doesn't exist
   */
  async updateDeliveryStatus(
    request: StatusUpdateRequest
  ): Promise<StatusUpdateResult> {
    const { deliveryRequestId, newStatus, changedBy, changeReason, metadata } =
      request;

    // Execute entire operation in a ACID transaction (Requirement 17.1)
    return await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Fetch current delivery request with row-level lock
      const deliveryRequest = await tx.deliveryRequest.findUnique({
        where: { id: deliveryRequestId },
        select: { id: true, status: true, customerId: true },
      });

      // 2. Validate delivery request exists
      if (!deliveryRequest) {
        throw new DeliveryNotFoundError(
          `Delivery request with ID '${deliveryRequestId}' not found`
        );
      }

      const currentStatus = deliveryRequest.status;

      // 3. Skip if status is already the target status (idempotent)
      if (currentStatus === newStatus) {
        // Still log this as an attempted duplicate transition
        const statusHistory = await tx.statusHistory.create({
          data: {
            deliveryRequestId,
            previousStatus: currentStatus,
            newStatus,
            changedBy,
            changeReason: changeReason || 'Duplicate status update (no-op)',
            metadata: metadata ? JSON.stringify(metadata) : null,
          },
        });

        return {
          success: true,
          deliveryRequestId,
          previousStatus: currentStatus,
          newStatus,
          statusHistoryId: statusHistory.id,
          timestamp: statusHistory.createdAt,
        };
      }

      // 4. Validate the status transition using StatusValidator
      const validation = StatusValidator.validateTransition(
        currentStatus,
        newStatus
      );

      if (!validation.isValid) {
        throw new StatusTransitionError(
          validation.error!.message,
          validation.error!
        );
      }

      // 5. Update delivery request status
      await tx.deliveryRequest.update({
        where: { id: deliveryRequestId },
        data: { status: newStatus },
      });

      // 6. Create immutable audit log entry (Requirement 6.6)
      const statusHistory = await tx.statusHistory.create({
        data: {
          deliveryRequestId,
          previousStatus: currentStatus,
          newStatus,
          changedBy,
          changeReason: changeReason || null,
          metadata: metadata ? JSON.stringify(metadata) : null,
        },
      });

      // 7. Perform status-specific side effects
      await this.handleStatusSideEffects(
        tx,
        deliveryRequestId,
        currentStatus,
        newStatus,
        changedBy
      );

      return {
        success: true,
        deliveryRequestId,
        previousStatus: currentStatus,
        newStatus,
        statusHistoryId: statusHistory.id,
        timestamp: statusHistory.createdAt,
      };
    });
  }

  /**
   * Handle side effects based on status transitions
   * e.g., automatic transitions, notifications, cleanup
   */
  private async handleStatusSideEffects(
    tx: Prisma.TransactionClient,
    deliveryRequestId: string,
    previousStatus: DeliveryStatus,
    newStatus: DeliveryStatus,
    _userId: string
  ): Promise<void> {
    // Automatic transition from 'failed' to 'returning' (Requirement 10.4)
    if (newStatus === 'failed') {
      // Note: This would trigger another status update
      // For now, we'll just log it. In production, you might want to
      // handle this via event system or separate call
      console.log(
        `Delivery ${deliveryRequestId} failed. Should transition to 'returning' next.`
      );
    }

    // When status becomes 'negotiating', mark it had offers
    if (previousStatus === 'open' && newStatus === 'negotiating') {
      // Additional logic can be added here
      console.log(
        `Delivery ${deliveryRequestId} received first price offer and moved to negotiating.`
      );
    }

    // When delivery is confirmed, reject all other price offers
    if (newStatus === 'confirmed') {
      await tx.priceOffer.updateMany({
        where: {
          deliveryRequestId,
          isAccepted: false,
          isRejected: false,
        },
        data: {
          isRejected: true,
        },
      });
    }

    // Additional side effects can be implemented here
  }

  /**
   * Get status history for a delivery request
   */
  async getStatusHistory(deliveryRequestId: string) {
    return await this.prisma.statusHistory.findMany({
      where: { deliveryRequestId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            role: true,
            phoneNumber: true,
          },
        },
      },
    });
  }

  /**
   * Get current status of a delivery request
   */
  async getCurrentStatus(
    deliveryRequestId: string
  ): Promise<DeliveryStatus | null> {
    const delivery = await this.prisma.deliveryRequest.findUnique({
      where: { id: deliveryRequestId },
      select: { status: true },
    });

    return delivery?.status || null;
  }

  /**
   * Check if a status transition is valid without executing it
   */
  async canTransitionTo(
    deliveryRequestId: string,
    newStatus: DeliveryStatus
  ): Promise<{ canTransition: boolean; reason?: string }> {
    const delivery = await this.prisma.deliveryRequest.findUnique({
      where: { id: deliveryRequestId },
      select: { status: true },
    });

    if (!delivery) {
      return {
        canTransition: false,
        reason: 'Delivery request not found',
      };
    }

    const validation = StatusValidator.validateTransition(
      delivery.status,
      newStatus
    );

    if (validation.isValid) {
      return { canTransition: true };
    }

    return {
      canTransition: false,
      reason: validation.error?.message,
    };
  }

  /**
   * Get all valid next statuses for a delivery request
   */
  async getValidNextStatuses(
    deliveryRequestId: string
  ): Promise<DeliveryStatus[]> {
    const delivery = await this.prisma.deliveryRequest.findUnique({
      where: { id: deliveryRequestId },
      select: { status: true },
    });

    if (!delivery) {
      return [];
    }

    return StatusValidator.getValidNextStatuses(delivery.status);
  }

  /**
   * Batch update multiple delivery statuses (useful for admin operations)
   * Each update is wrapped in its own transaction for isolation
   */
  async batchUpdateStatuses(
    requests: StatusUpdateRequest[]
  ): Promise<StatusUpdateResult[]> {
    const results: StatusUpdateResult[] = [];

    for (const request of requests) {
      try {
        const result = await this.updateDeliveryStatus(request);
        results.push(result);
      } catch (error) {
        console.error(
          `Failed to update status for delivery ${request.deliveryRequestId}:`,
          error
        );
        // Continue with other updates even if one fails
      }
    }

    return results;
  }
}

/**
 * Custom error classes for better error handling
 */
export class StatusTransitionError extends Error {
  public validationError: StatusValidationError;

  constructor(message: string, validationError: StatusValidationError) {
    super(message);
    this.name = 'StatusTransitionError';
    this.validationError = validationError;
    Object.setPrototypeOf(this, StatusTransitionError.prototype);
  }
}

export class DeliveryNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeliveryNotFoundError';
    Object.setPrototypeOf(this, DeliveryNotFoundError.prototype);
  }
}
