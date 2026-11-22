/**
 * Unit tests for StatusValidator
 * Tests state machine validation logic
 */

import { DeliveryStatus } from '@prisma/client';
import { StatusValidator } from '../src/helpers/StatusValidator';

describe('StatusValidator', () => {
  describe('isTerminalStatus', () => {
    it('should identify terminal statuses correctly', () => {
      expect(StatusValidator.isTerminalStatus('cancelled')).toBe(true);
      expect(StatusValidator.isTerminalStatus('refund_processed')).toBe(true);
      expect(StatusValidator.isTerminalStatus('completed')).toBe(false);
      expect(StatusValidator.isTerminalStatus('open')).toBe(false);
    });
  });

  describe('isFrozenStatus', () => {
    it('should identify frozen statuses correctly', () => {
      expect(StatusValidator.isFrozenStatus('disputed')).toBe(true);
      expect(StatusValidator.isFrozenStatus('completed')).toBe(false);
      expect(StatusValidator.isFrozenStatus('in_progress')).toBe(false);
    });
  });

  describe('getValidNextStatuses', () => {
    it('should return correct next statuses for "open"', () => {
      const validNext = StatusValidator.getValidNextStatuses('open');
      expect(validNext).toEqual(['negotiating', 'cancelled']);
    });

    it('should return correct next statuses for "confirmed"', () => {
      const validNext = StatusValidator.getValidNextStatuses('confirmed');
      expect(validNext).toEqual(['in_progress', 'rejected', 'cancelled']);
    });

    it('should return empty array for terminal statuses', () => {
      const validNext = StatusValidator.getValidNextStatuses('cancelled');
      expect(validNext).toEqual([]);
    });
  });

  describe('validateTransition', () => {
    it('should validate correct transition from open to negotiating', () => {
      const result = StatusValidator.validateTransition('open', 'negotiating');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should invalidate incorrect transition from open to completed', () => {
      const result = StatusValidator.validateTransition('open', 'completed');
      expect(result.isValid).toBe(false);
      expect(result.error?.code).toBe('INVALID_TRANSITION');
      expect(result.error?.currentStatus).toBe('open');
      expect(result.error?.requestedStatus).toBe('completed');
      expect(result.error?.validTransitions).toEqual(['negotiating', 'cancelled']);
    });

    it('should prevent transition from terminal status', () => {
      const result = StatusValidator.validateTransition('cancelled', 'open');
      expect(result.isValid).toBe(false);
      expect(result.error?.code).toBe('TERMINAL_STATUS');
      expect(result.error?.message).toContain('terminal status');
    });

    it('should prevent transition from frozen status (disputed)', () => {
      const result = StatusValidator.validateTransition('disputed', 'completed');
      expect(result.isValid).toBe(false);
      expect(result.error?.code).toBe('FROZEN_STATUS');
      expect(result.error?.message).toContain('frozen status');
      expect(result.error?.message).toContain('dispute');
    });

    it('should validate complete delivery flow', () => {
      const flow: DeliveryStatus[] = [
        'open',
        'negotiating',
        'confirmed',
        'in_progress',
        'completed',
      ];

      for (let i = 0; i < flow.length - 1; i++) {
        const current = flow[i];
        const next = flow[i + 1];
        const result = StatusValidator.validateTransition(current, next);
        expect(result.isValid).toBe(true);
      }
    });

    it('should validate failed delivery return flow', () => {
      const flow: DeliveryStatus[] = [
        'in_progress',
        'failed',
        'returning',
        'returned',
      ];

      for (let i = 0; i < flow.length - 1; i++) {
        const current = flow[i];
        const next = flow[i + 1];
        const result = StatusValidator.validateTransition(current, next);
        expect(result.isValid).toBe(true);
      }
    });

    it('should validate refund flow', () => {
      let result = StatusValidator.validateTransition('completed', 'refund_requested');
      expect(result.isValid).toBe(true);

      result = StatusValidator.validateTransition('refund_requested', 'refund_processed');
      expect(result.isValid).toBe(true);
    });
  });

  describe('canBeCancelled', () => {
    it('should allow cancellation for early stages', () => {
      expect(StatusValidator.canBeCancelled('open')).toBe(true);
      expect(StatusValidator.canBeCancelled('negotiating')).toBe(true);
      expect(StatusValidator.canBeCancelled('confirmed')).toBe(true);
      expect(StatusValidator.canBeCancelled('rejected')).toBe(true);
    });

    it('should not allow cancellation for active deliveries', () => {
      expect(StatusValidator.canBeCancelled('in_progress')).toBe(false);
      expect(StatusValidator.canBeCancelled('completed')).toBe(false);
      expect(StatusValidator.canBeCancelled('returning')).toBe(false);
    });
  });

  describe('canRequestRefund', () => {
    it('should allow refund request for eligible statuses', () => {
      expect(StatusValidator.canRequestRefund('completed')).toBe(true);
      expect(StatusValidator.canRequestRefund('failed')).toBe(true);
      expect(StatusValidator.canRequestRefund('returned')).toBe(true);
    });

    it('should not allow refund request for ineligible statuses', () => {
      expect(StatusValidator.canRequestRefund('open')).toBe(false);
      expect(StatusValidator.canRequestRefund('in_progress')).toBe(false);
      expect(StatusValidator.canRequestRefund('negotiating')).toBe(false);
    });
  });

  describe('canRaiseDispute', () => {
    it('should allow dispute for eligible statuses', () => {
      expect(StatusValidator.canRaiseDispute('completed')).toBe(true);
      expect(StatusValidator.canRaiseDispute('failed')).toBe(true);
      expect(StatusValidator.canRaiseDispute('returned')).toBe(true);
    });

    it('should not allow dispute for ineligible statuses', () => {
      expect(StatusValidator.canRaiseDispute('open')).toBe(false);
      expect(StatusValidator.canRaiseDispute('in_progress')).toBe(false);
      expect(StatusValidator.canRaiseDispute('negotiating')).toBe(false);
    });
  });

  describe('isActiveDelivery', () => {
    it('should identify active deliveries', () => {
      expect(StatusValidator.isActiveDelivery('confirmed')).toBe(true);
      expect(StatusValidator.isActiveDelivery('in_progress')).toBe(true);
      expect(StatusValidator.isActiveDelivery('returning')).toBe(true);
    });

    it('should not identify inactive deliveries as active', () => {
      expect(StatusValidator.isActiveDelivery('open')).toBe(false);
      expect(StatusValidator.isActiveDelivery('completed')).toBe(false);
      expect(StatusValidator.isActiveDelivery('cancelled')).toBe(false);
    });
  });

  describe('requiresDriverAction', () => {
    it('should identify statuses requiring driver action', () => {
      expect(StatusValidator.requiresDriverAction('confirmed')).toBe(true);
      expect(StatusValidator.requiresDriverAction('in_progress')).toBe(true);
      expect(StatusValidator.requiresDriverAction('returning')).toBe(true);
    });

    it('should not flag completed deliveries', () => {
      expect(StatusValidator.requiresDriverAction('completed')).toBe(false);
      expect(StatusValidator.requiresDriverAction('open')).toBe(false);
    });
  });

  describe('getTransitionErrorMessage', () => {
    it('should return descriptive error for invalid transition', () => {
      const message = StatusValidator.getTransitionErrorMessage('open', 'completed');
      expect(message).toContain('Invalid status transition');
      expect(message).toContain('open');
      expect(message).toContain('completed');
      expect(message).toContain('Valid transitions');
    });

    it('should return success message for valid transition', () => {
      const message = StatusValidator.getTransitionErrorMessage('open', 'negotiating');
      expect(message).toBe('Transition is valid');
    });
  });

  describe('validateMultipleTransitions', () => {
    it('should validate multiple transitions at once', () => {
      const potentials: DeliveryStatus[] = ['negotiating', 'completed', 'cancelled'];
      const results = StatusValidator.validateMultipleTransitions('open', potentials);

      expect(results.get('negotiating')?.isValid).toBe(true);
      expect(results.get('completed')?.isValid).toBe(false);
      expect(results.get('cancelled')?.isValid).toBe(true);
    });
  });
});
