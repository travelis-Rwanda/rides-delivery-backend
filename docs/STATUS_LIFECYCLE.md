# Delivery Status Lifecycle Management

## Overview

This document describes the delivery status lifecycle state machine, validation rules, and implementation details for the Delivery Service module.

## Architecture Components

### 1. **StatusValidator** (Helper Class)
Pure function helper class providing status validation logic without side effects.

**Location:** `src/helpers/StatusValidator.ts`

**Key Methods:**
- `validateTransition(current, new)` - Validates if a status transition is allowed
- `getValidNextStatuses(status)` - Returns array of valid next statuses
- `isTerminalStatus(status)` - Checks if status is terminal (cannot transition)
- `isFrozenStatus(status)` - Checks if status is frozen (locked during dispute)
- `canBeCancelled(status)` - Business rule: can delivery be cancelled?
- `canRequestRefund(status)` - Business rule: can refund be requested?
- `canRaiseDispute(status)` - Business rule: can dispute be raised?

### 2. **StatusTrackerService** (Service Class)
Service class managing status updates with ACID transactions and audit logging.

**Location:** `src/services/StatusTrackerService.ts`

**Key Methods:**
- `updateDeliveryStatus(request)` - Updates status with transaction and audit log
- `getStatusHistory(deliveryId)` - Retrieves complete status history
- `getCurrentStatus(deliveryId)` - Gets current delivery status
- `canTransitionTo(deliveryId, status)` - Pre-checks if transition is valid
- `getValidNextStatuses(deliveryId)` - Gets valid next statuses for delivery

### 3. **Type Definitions**
Comprehensive TypeScript type definitions for type safety.

**Location:** `src/types/status.types.ts`

## State Machine Rules

### Valid State Transitions

```
open → negotiating, cancelled
negotiating → confirmed, cancelled
confirmed → in_progress, rejected, cancelled
rejected → open, cancelled
in_progress → completed, failed
failed → returning
returning → returned
returned → refund_requested, disputed
completed → refund_requested, disputed
cancelled → [TERMINAL]
refund_requested → refund_processed
refund_processed → [TERMINAL]
disputed → completed, refund_processed, returned [UNFROZEN UPON RESOLUTION]
```

### Terminal Statuses
These statuses cannot transition to any other status:
- `cancelled`
- `refund_processed`

### Frozen Statuses (Requirement 12.5)
These statuses are locked and prevent transitions:
- `disputed` - Locked during dispute resolution

## Status Lifecycle Flows

### 1. **Happy Path - Successful Delivery**
```
open → negotiating → confirmed → in_progress → completed
```

### 2. **Failed Delivery with Return**
```
open → negotiating → confirmed → in_progress → failed → returning → returned
```

### 3. **Driver Rejection Flow**
```
open → negotiating → confirmed → rejected → open
```

### 4. **Customer Cancellation Flow**
```
open → negotiating → cancelled [TERMINAL]
```

### 5. **Refund Request Flow**
```
completed → refund_requested → refund_processed [TERMINAL]
```

### 6. **Dispute Flow**
```
completed → disputed [FROZEN] → completed [UNFROZEN AFTER RESOLUTION]
```

## Implementation Details

### ACID Transactions (Requirement 17.1)

Every status update is wrapped in a PostgreSQL transaction:

```typescript
await prisma.$transaction(async (tx) => {
  // 1. Lock and fetch current delivery
  // 2. Validate status transition
  // 3. Update delivery status
  // 4. Create immutable audit log
  // 5. Handle side effects
});
```

### Immutable Audit Logging (Requirement 6.6)

Every status change creates a `status_history` record with:
- `previousStatus` - Status before change
- `newStatus` - Status after change
- `changedBy` - User ID who made the change
- `changeReason` - Optional reason for change
- `metadata` - Optional JSON metadata
- `createdAt` - Automatic timestamp

### Error Handling

The service throws specific error types:

1. **StatusTransitionError** - Invalid state transition
   - Contains validation error details
   - Includes valid transitions

2. **DeliveryNotFoundError** - Delivery request not found
   - Clear error message
   - Delivery ID included

## Usage Examples

### Example 1: Update Status

```typescript
import { StatusTrackerService } from './services';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const statusTracker = new StatusTrackerService(prisma);

try {
  const result = await statusTracker.updateDeliveryStatus({
    deliveryRequestId: 'delivery-123',
    newStatus: 'in_progress',
    changedBy: 'driver-456',
    changeReason: 'Driver started delivery',
    metadata: {
      startLocation: { lat: -1.9441, lng: 30.0619 }
    }
  });

  console.log('Status updated:', result);
} catch (error) {
  if (error instanceof StatusTransitionError) {
    console.error('Invalid transition:', error.validationError);
  }
}
```

### Example 2: Validate Before Update

```typescript
import { StatusValidator } from './helpers';

// Check if transition is valid
const validation = StatusValidator.validateTransition('open', 'completed');

if (!validation.isValid) {
  console.log('Invalid transition:', validation.error?.message);
  console.log('Valid options:', validation.error?.validTransitions);
}
```

### Example 3: Get Valid Next Statuses

```typescript
// Get all valid next statuses for a delivery
const validNext = await statusTracker.getValidNextStatuses('delivery-123');
console.log('You can transition to:', validNext);
```

### Example 4: Check Business Rules

```typescript
import { StatusValidator } from './helpers';

const currentStatus = 'completed';

// Check various business rules
const canCancel = StatusValidator.canBeCancelled(currentStatus);
const canRefund = StatusValidator.canRequestRefund(currentStatus);
const canDispute = StatusValidator.canRaiseDispute(currentStatus);
const isActive = StatusValidator.isActiveDelivery(currentStatus);

console.log({
  canCancel,   // false
  canRefund,   // true
  canDispute,  // true
  isActive     // false
});
```

## Business Rules

### Cancellation Rules (Requirement 7)
Deliveries can be cancelled only in these statuses:
- `open`
- `negotiating`
- `confirmed`
- `rejected`

### Refund Rules (Requirement 11)
Refunds can be requested within 48 hours for these statuses:
- `completed`
- `failed`
- `returned`

### Dispute Rules (Requirement 12)
Disputes can be raised within 7 days for these statuses:
- `completed`
- `failed`
- `returned`

When a delivery is in `disputed` status, it is **frozen** and no status transitions are allowed until the dispute is resolved.

## Database Schema

### status_history Table
```sql
CREATE TABLE status_history (
  id UUID PRIMARY KEY,
  delivery_request_id UUID NOT NULL,
  previous_status VARCHAR(50),
  new_status VARCHAR(50) NOT NULL,
  changed_by UUID NOT NULL,
  change_reason TEXT,
  metadata TEXT, -- JSON
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

## Testing

Run unit tests:
```bash
npm test __tests__/StatusValidator.test.ts
```

## Integration with Other Services

### Automatic Status Transitions
Some transitions trigger automatic follow-up actions:

1. **failed → returning** - Automatic transition per Requirement 10.4
2. **confirmed** - Rejects all other price offers
3. **negotiating** - First price offer received

### Event Notifications
Status changes should trigger notifications:
- Customer notifications (status updates)
- Driver notifications (booking confirmations, cancellations)
- Admin notifications (disputes, refunds)

## Error Codes

| Code | Description | Action |
|------|-------------|--------|
| `INVALID_TRANSITION` | Attempted transition not allowed | Show valid transitions |
| `TERMINAL_STATUS` | Cannot transition from terminal status | Inform user status is final |
| `FROZEN_STATUS` | Status locked during dispute | Wait for dispute resolution |
| `NOT_FOUND` | Delivery request doesn't exist | Check delivery ID |

## Performance Considerations

1. **Row-Level Locking** - Uses PostgreSQL row locks during status updates
2. **Transaction Isolation** - ACID transactions prevent race conditions
3. **Indexed Queries** - status_history table is indexed on delivery_request_id
4. **Idempotent Updates** - Duplicate status updates are handled gracefully

## Security Considerations

1. **User Authorization** - Always pass `changedBy` user ID
2. **Audit Trail** - Complete immutable history of all changes
3. **Role Validation** - Verify user role before allowing status changes
4. **Business Rules** - Enforce time windows for refunds (48h) and disputes (7d)

## Future Enhancements

1. **Event System** - Pub/sub for status change notifications
2. **Webhooks** - External system notifications
3. **Status Callbacks** - Custom actions per status transition
4. **Rollback Support** - Administrative status rollback capability
5. **Scheduled Transitions** - Time-based automatic transitions
