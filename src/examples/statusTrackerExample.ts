/**
 * Example usage of StatusTrackerService and StatusValidator
 * Demonstrates state machine validation and ACID transaction flow
 */

import type { PrismaClient } from '../generated/prisma';
import { StatusTrackerService } from '../services/StatusTrackerService';
import { StatusValidator } from '../helpers/StatusValidator';

// This would be initialized with actual Prisma instance in production
const prisma = null as unknown as PrismaClient;
const statusTracker = new StatusTrackerService(prisma);

/**
 * Example 1: Validate transitions before attempting them
 */
async function example1_ValidateTransitions() {
  console.log('=== Example 1: Validate Transitions ===\n');

  // Check valid transitions from 'open' status
  const validFromOpen = StatusValidator.getValidNextStatuses('open');
  console.log('Valid transitions from "open":', validFromOpen);
  // Output: ['negotiating', 'cancelled']

  // Validate a specific transition
  const validation = StatusValidator.validateTransition('open', 'in_progress');
  console.log('\nValidating open -> in_progress:');
  console.log('Is valid:', validation.isValid);
  if (!validation.isValid) {
    console.log('Error:', validation.error?.message);
    console.log('Valid transitions:', validation.error?.validTransitions);
  }

  // Check if status is terminal
  console.log('\nIs "cancelled" terminal?', StatusValidator.isTerminalStatus('cancelled'));
  console.log('Is "completed" terminal?', StatusValidator.isTerminalStatus('completed'));
}

/**
 * Example 2: Update delivery status with audit logging
 */
async function example2_UpdateStatus() {
  console.log('\n\n=== Example 2: Update Status with Audit Logging ===\n');

  try {
    // Assume we have a delivery request ID
    const deliveryId = 'some-delivery-id';
    const userId = 'some-user-id';

    // Update status from 'open' to 'negotiating'
    const result = await statusTracker.updateDeliveryStatus({
      deliveryRequestId: deliveryId,
      newStatus: 'negotiating',
      changedBy: userId,
      changeReason: 'First price offer received from driver',
      metadata: {
        driverId: 'driver-123',
        offeredPrice: 5000,
      },
    });

    console.log('Status updated successfully:');
    console.log('- Previous:', result.previousStatus);
    console.log('- New:', result.newStatus);
    console.log('- History ID:', result.statusHistoryId);
    console.log('- Timestamp:', result.timestamp);
  } catch (error) {
    console.error('Failed to update status:', error);
  }
}

/**
 * Example 3: Handle invalid transitions gracefully
 */
async function example3_InvalidTransition() {
  console.log('\n\n=== Example 3: Handle Invalid Transitions ===\n');

  try {
    const deliveryId = 'some-delivery-id';
    const userId = 'some-user-id';

    // Try to transition from 'open' directly to 'completed' (invalid)
    await statusTracker.updateDeliveryStatus({
      deliveryRequestId: deliveryId,
      newStatus: 'completed',
      changedBy: userId,
      changeReason: 'Attempting invalid transition',
    });
  } catch (error: any) {
    console.log('Caught expected error:');
    console.log('- Error name:', error.name);
    console.log('- Message:', error.message);
    if (error.validationError) {
      console.log('- Valid transitions:', error.validationError.validTransitions);
    }
  }
}

/**
 * Example 4: Check if transitions are possible before attempting
 */
async function example4_CheckBeforeTransition() {
  console.log('\n\n=== Example 4: Pre-check Transitions ===\n');

  const deliveryId = 'some-delivery-id';

  // Check if we can transition to a specific status
  const canComplete = await statusTracker.canTransitionTo(
    deliveryId,
    'completed'
  );
  console.log('Can transition to "completed"?', canComplete.canTransition);
  if (!canComplete.canTransition) {
    console.log('Reason:', canComplete.reason);
  }

  // Get all valid next statuses
  const validNext = await statusTracker.getValidNextStatuses(deliveryId);
  console.log('\nAll valid next statuses:', validNext);
}

/**
 * Example 5: Complete delivery lifecycle
 */
async function example5_CompleteLifecycle() {
  console.log('\n\n=== Example 5: Complete Delivery Lifecycle ===\n');

  const userId = 'user-123';

  try {
    // Create a test delivery request
    const delivery = await prisma.deliveryRequest.create({
      data: {
        customerId: userId,
        pickupLatitude: -1.9441,
        pickupLongitude: 30.0619,
        destinationLatitude: -1.9506,
        destinationLongitude: 30.0588,
        category: 'Parcel',
        itemDescription: 'Test package',
        customerPhoneNumber: '+250788123456',
      },
    });

    console.log('Created delivery:', delivery.id);
    console.log('Initial status:', delivery.status);

    // Lifecycle: open -> negotiating -> confirmed -> in_progress -> completed
    const transitions = [
      { status: 'negotiating', reason: 'Driver submitted price offer' },
      { status: 'confirmed', reason: 'Customer accepted price offer' },
      { status: 'in_progress', reason: 'Driver started delivery' },
      { status: 'completed', reason: 'Delivery completed successfully' },
    ] as const;

    for (const transition of transitions) {
      const result = await statusTracker.updateDeliveryStatus({
        deliveryRequestId: delivery.id,
        newStatus: transition.status,
        changedBy: userId,
        changeReason: transition.reason,
      });

      console.log(`\n✓ ${result.previousStatus} -> ${result.newStatus}`);
      console.log(`  Reason: ${transition.reason}`);
    }

    // Get complete status history
    const history = await statusTracker.getStatusHistory(delivery.id);
    console.log('\n\nComplete Status History:');
    history.forEach((record: any, index: number) => {
      console.log(`${index + 1}. ${record.previousStatus || 'initial'} -> ${record.newStatus}`);
      console.log(`   Changed by: ${record.user.role}`);
      console.log(`   Reason: ${record.changeReason || 'N/A'}`);
      console.log(`   Time: ${record.createdAt.toISOString()}`);
    });

    // Cleanup
    await prisma.deliveryRequest.delete({ where: { id: delivery.id } });
  } catch (error) {
    console.error('Error in lifecycle example:', error);
  }
}

/**
 * Example 6: Dispute lock behavior (Requirement 12.5)
 */
async function example6_DisputeLock() {
  console.log('\n\n=== Example 6: Dispute Lock Behavior ===\n');

  // Check if disputed status is frozen
  const isFrozen = StatusValidator.isFrozenStatus('disputed');
  console.log('Is "disputed" status frozen?', isFrozen);

  // Try to validate transition from disputed
  const validation = StatusValidator.validateTransition('disputed', 'completed');
  console.log('\nValidating disputed -> completed:');
  console.log('Is valid:', validation.isValid);
  if (!validation.isValid) {
    console.log('Error:', validation.error?.message);
    console.log('Code:', validation.error?.code);
  }

  // Show valid transitions after dispute resolution
  // (In practice, you'd resolve the dispute first, changing status from 'disputed')
  console.log('\nValid transitions after dispute resolution:');
  const validAfterDispute = StatusValidator.getValidNextStatuses('disputed');
  console.log(validAfterDispute);
}

/**
 * Example 7: Business rule validations
 */
async function example7_BusinessRules() {
  console.log('\n\n=== Example 7: Business Rule Validations ===\n');

  // Check cancellation eligibility
  console.log('Can "open" be cancelled?', StatusValidator.canBeCancelled('open'));
  console.log('Can "in_progress" be cancelled?', StatusValidator.canBeCancelled('in_progress'));

  // Check refund eligibility
  console.log('\nCan "completed" request refund?', StatusValidator.canRequestRefund('completed'));
  console.log('Can "open" request refund?', StatusValidator.canRequestRefund('open'));

  // Check dispute eligibility
  console.log('\nCan "completed" raise dispute?', StatusValidator.canRaiseDispute('completed'));
  console.log('Can "negotiating" raise dispute?', StatusValidator.canRaiseDispute('negotiating'));

  // Check active delivery status
  console.log('\nIs "in_progress" active?', StatusValidator.isActiveDelivery('in_progress'));
  console.log('Is "completed" active?', StatusValidator.isActiveDelivery('completed'));
}

/**
 * Run all examples
 */
async function _runAllExamples() {
  try {
    await example1_ValidateTransitions();
    // await example2_UpdateStatus(); // Requires actual delivery ID
    await example3_InvalidTransition();
    // await example4_CheckBeforeTransition(); // Requires actual delivery ID
    // await example5_CompleteLifecycle(); // Creates test data
    await example6_DisputeLock();
    await example7_BusinessRules();
  } catch (error) {
    console.error('Error running examples:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Uncomment to run examples
// runAllExamples();

export {
  example1_ValidateTransitions,
  example2_UpdateStatus,
  example3_InvalidTransition,
  example4_CheckBeforeTransition,
  example5_CompleteLifecycle,
  example6_DisputeLock,
  example7_BusinessRules,
};
