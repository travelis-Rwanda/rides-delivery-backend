/**
 * Status Management Type Definitions
 * Comprehensive type system for delivery status lifecycle management
 */

import type { DeliveryStatus } from '../generated/prisma';

/**
 * Valid state transitions mapping
 * Key: current status, Value: array of valid next statuses
 */
export const VALID_TRANSITIONS: Record<DeliveryStatus, DeliveryStatus[]> = {
  open: ['negotiating', 'cancelled'],
  negotiating: ['confirmed', 'cancelled'],
  confirmed: ['in_progress', 'rejected', 'cancelled'],
  rejected: ['open', 'cancelled'],
  in_progress: ['completed', 'failed'],
  failed: ['returning'],
  returning: ['returned'],
  returned: ['refund_requested', 'disputed'],
  completed: ['refund_requested', 'disputed'],
  cancelled: [], // Terminal state
  refund_requested: ['refund_processed'],
  refund_processed: [], // Terminal state
  disputed: ['completed', 'refund_processed', 'returned'], // Unfrozen upon resolution
};

/**
 * Terminal statuses that cannot transition to any other status
 */
export const TERMINAL_STATUSES: DeliveryStatus[] = [
  'cancelled',
  'refund_processed',
];

/**
 * Statuses that are considered "frozen" (no transitions allowed except dispute resolution)
 */
export const FROZEN_STATUSES: DeliveryStatus[] = ['disputed'];

/**
 * Status update request interface
 */
export interface StatusUpdateRequest {
  deliveryRequestId: string;
  newStatus: DeliveryStatus;
  changedBy: string; // User ID who is making the change
  changeReason?: string;
  metadata?: Record<string, any>;
}

/**
 * Status update result interface
 */
export interface StatusUpdateResult {
  success: boolean;
  deliveryRequestId: string;
  previousStatus: DeliveryStatus;
  newStatus: DeliveryStatus;
  statusHistoryId: string;
  timestamp: Date;
}

/**
 * Status validation error details
 */
export interface StatusValidationError {
  code: 'INVALID_TRANSITION' | 'FROZEN_STATUS' | 'TERMINAL_STATUS' | 'NOT_FOUND';
  message: string;
  currentStatus?: DeliveryStatus;
  requestedStatus?: DeliveryStatus;
  validTransitions?: DeliveryStatus[];
}

/**
 * Status transition validation result
 */
export interface TransitionValidation {
  isValid: boolean;
  error?: StatusValidationError;
}
