/**
 * StatusValidator - Pure function helper class for status validation
 * Implements state machine rules and dispute lock logic (Requirement 12.5)
 */

import type { DeliveryStatus } from '../generated/prisma';
import {
  VALID_TRANSITIONS,
  TERMINAL_STATUSES,
  FROZEN_STATUSES,
  TransitionValidation,
} from '../types/status.types';

export class StatusValidator {
  /**
   * Check if a status is terminal (cannot transition further)
   */
  static isTerminalStatus(status: DeliveryStatus): boolean {
    return TERMINAL_STATUSES.includes(status);
  }

  /**
   * Check if a status is frozen (locked due to dispute - Requirement 12.5)
   */
  static isFrozenStatus(status: DeliveryStatus): boolean {
    return FROZEN_STATUSES.includes(status);
  }

  /**
   * Get all valid next statuses for a given current status
   */
  static getValidNextStatuses(currentStatus: DeliveryStatus): DeliveryStatus[] {
    return VALID_TRANSITIONS[currentStatus] || [];
  }

  /**
   * Validate if a transition from current status to new status is allowed
   * Implements state machine validation and dispute lock rule
   */
  static validateTransition(
    currentStatus: DeliveryStatus,
    newStatus: DeliveryStatus
  ): TransitionValidation {
    // Check if current status is terminal
    if (this.isTerminalStatus(currentStatus)) {
      return {
        isValid: false,
        error: {
          code: 'TERMINAL_STATUS',
          message: `Cannot transition from terminal status '${currentStatus}'`,
          currentStatus,
          requestedStatus: newStatus,
          validTransitions: [],
        },
      };
    }

    // Check if current status is frozen (disputed - Requirement 12.5)
    // Frozen statuses prevent further status changes while disputed
    if (this.isFrozenStatus(currentStatus)) {
      return {
        isValid: false,
        error: {
          code: 'FROZEN_STATUS',
          message: `Cannot transition from frozen status '${currentStatus}'. Status is locked during dispute resolution.`,
          currentStatus,
          requestedStatus: newStatus,
          validTransitions: [],
        },
      };
    }

    // Get valid transitions for current status
    const validNextStatuses = this.getValidNextStatuses(currentStatus);

    // Check if the requested transition is valid
    if (!validNextStatuses.includes(newStatus)) {
      return {
        isValid: false,
        error: {
          code: 'INVALID_TRANSITION',
          message: `Invalid status transition from '${currentStatus}' to '${newStatus}'`,
          currentStatus,
          requestedStatus: newStatus,
          validTransitions: validNextStatuses,
        },
      };
    }

    // Transition is valid
    return {
      isValid: true,
    };
  }

  /**
   * Validate multiple potential transitions at once
   * Useful for UI to show which statuses are currently available
   */
  static validateMultipleTransitions(
    currentStatus: DeliveryStatus,
    potentialStatuses: DeliveryStatus[]
  ): Map<DeliveryStatus, TransitionValidation> {
    const results = new Map<DeliveryStatus, TransitionValidation>();

    for (const potentialStatus of potentialStatuses) {
      results.set(
        potentialStatus,
        this.validateTransition(currentStatus, potentialStatus)
      );
    }

    return results;
  }

  /**
   * Check if status allows cancellation
   * Implements Requirement 7 cancellation rules
   */
  static canBeCancelled(currentStatus: DeliveryStatus): boolean {
    const cancellableStatuses: DeliveryStatus[] = [
      'open',
      'negotiating',
      'confirmed',
      'rejected',
    ];
    return cancellableStatuses.includes(currentStatus);
  }

  /**
   * Check if status allows refund request
   * Implements Requirement 11 refund rules
   */
  static canRequestRefund(currentStatus: DeliveryStatus): boolean {
    const refundableStatuses: DeliveryStatus[] = [
      'completed',
      'failed',
      'returned',
    ];
    return refundableStatuses.includes(currentStatus);
  }

  /**
   * Check if status allows dispute
   * Implements Requirement 12 dispute rules
   */
  static canRaiseDispute(currentStatus: DeliveryStatus): boolean {
    const disputableStatuses: DeliveryStatus[] = [
      'completed',
      'failed',
      'returned',
    ];
    return disputableStatuses.includes(currentStatus);
  }

  /**
   * Check if status indicates delivery is in active state
   */
  static isActiveDelivery(status: DeliveryStatus): boolean {
    const activeStatuses: DeliveryStatus[] = [
      'confirmed',
      'in_progress',
      'returning',
    ];
    return activeStatuses.includes(status);
  }

  /**
   * Check if status requires driver action
   */
  static requiresDriverAction(status: DeliveryStatus): boolean {
    const driverActionStatuses: DeliveryStatus[] = [
      'confirmed',
      'in_progress',
      'returning',
    ];
    return driverActionStatuses.includes(status);
  }

  /**
   * Get human-readable description of why a transition is invalid
   */
  static getTransitionErrorMessage(
    currentStatus: DeliveryStatus,
    newStatus: DeliveryStatus
  ): string {
    const validation = this.validateTransition(currentStatus, newStatus);

    if (validation.isValid) {
      return 'Transition is valid';
    }

    if (validation.error) {
      const validTransitions = validation.error.validTransitions || [];
      if (validTransitions.length > 0) {
        return `${validation.error.message}. Valid transitions: ${validTransitions.join(', ')}`;
      }
      return validation.error.message;
    }

    return 'Unknown validation error';
  }
}
