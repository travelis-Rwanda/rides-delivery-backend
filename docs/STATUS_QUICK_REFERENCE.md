# Status Lifecycle Quick Reference

## Quick State Machine Diagram

```
┌─────────┐
│  OPEN   │────────┐
└────┬────┘        │
     │             │
     ↓             ↓
┌──────────────┐ ┌───────────┐
│ NEGOTIATING  │→│ CANCELLED │ [TERMINAL]
└──────┬───────┘ └───────────┘
       │
       ↓
┌───────────┐
│ CONFIRMED │────────┐
└─────┬─────┘        │
      │              ↓
      │         ┌──────────┐
      │         │ REJECTED │
      │         └────┬─────┘
      │              │
      ↓              ↓
┌──────────────┐    │
│ IN_PROGRESS  │←───┘ (back to OPEN)
└──────┬───────┘
       │
       ├─────────────┐
       │             │
       ↓             ↓
┌───────────┐  ┌────────┐
│ COMPLETED │  │ FAILED │
└─────┬─────┘  └────┬───┘
      │             │
      │             ↓
      │        ┌───────────┐
      │        │ RETURNING │
      │        └─────┬─────┘
      │              │
      │              ↓
      │        ┌──────────┐
      │        │ RETURNED │
      │        └─────┬────┘
      │              │
      └──────┬───────┘
             │
             ├─────────────────────┐
             │                     │
             ↓                     ↓
    ┌──────────────────┐    ┌──────────┐
    │ REFUND_REQUESTED │    │ DISPUTED │ [FROZEN]
    └────────┬─────────┘    └────┬─────┘
             │                   │
             ↓                   ↓
    ┌──────────────────┐    (resolved to
    │ REFUND_PROCESSED │     COMPLETED,
    └──────────────────┘     RETURNED, or
         [TERMINAL]          REFUND_PROCESSED)
```

## Status Transition Matrix

| FROM ↓ / TO → | open | negotiating | confirmed | rejected | in_progress | completed | failed | returning | returned | cancelled | refund_req | refund_proc | disputed |
|---------------|------|-------------|-----------|----------|-------------|-----------|--------|-----------|----------|-----------|------------|-------------|----------|
| open          | -    | ✓           | -         | -        | -           | -         | -      | -         | -        | ✓         | -          | -           | -        |
| negotiating   | -    | -           | ✓         | -        | -           | -         | -      | -         | -        | ✓         | -          | -           | -        |
| confirmed     | -    | -           | -         | ✓        | ✓           | -         | -      | -         | -        | ✓         | -          | -           | -        |
| rejected      | ✓    | -           | -         | -        | -           | -         | -      | -         | -        | ✓         | -          | -           | -        |
| in_progress   | -    | -           | -         | -        | -           | ✓         | ✓      | -         | -        | -         | -          | -           | -        |
| completed     | -    | -           | -         | -        | -           | -         | -      | -         | -        | -         | ✓          | -           | ✓        |
| failed        | -    | -           | -         | -        | -           | -         | -      | ✓         | -        | -         | -          | -           | -        |
| returning     | -    | -           | -         | -        | -           | -         | -      | -         | ✓        | -         | -          | -           | -        |
| returned      | -    | -           | -         | -        | -           | -         | -      | -         | -        | -         | ✓          | -           | ✓        |
| cancelled     | -    | -           | -         | -        | -           | -         | -      | -         | -        | -         | -          | -           | -        |
| refund_req    | -    | -           | -         | -        | -           | -         | -      | -         | -        | -         | -          | ✓           | -        |
| refund_proc   | -    | -           | -         | -        | -           | -         | -      | -         | -        | -         | -          | -           | -        |
| disputed      | -    | -           | -         | -        | -           | ✓         | -      | -         | ✓        | -         | -          | ✓           | -        |

✓ = Valid transition  
\- = Invalid transition

## Business Rules Cheat Sheet

### Cancellation (Requirement 7)
```typescript
canBeCancelled(status):
  ✓ open, negotiating, confirmed, rejected
  ✗ in_progress, completed, failed, returning, returned
```

### Refund (Requirement 11)
```typescript
canRequestRefund(status):
  ✓ completed, failed, returned
  ✗ open, negotiating, confirmed, in_progress
  Time Window: 48 hours
```

### Dispute (Requirement 12)
```typescript
canRaiseDispute(status):
  ✓ completed, failed, returned
  ✗ open, negotiating, confirmed, in_progress
  Time Window: 7 days
  Effect: Status becomes FROZEN (no transitions allowed)
```

### Active Deliveries
```typescript
isActiveDelivery(status):
  ✓ confirmed, in_progress, returning
  ✗ open, negotiating, completed, failed, cancelled
```

## Code Snippets

### Update Status
```typescript
const result = await statusTracker.updateDeliveryStatus({
  deliveryRequestId: 'uuid',
  newStatus: 'in_progress',
  changedBy: 'user-id',
  changeReason: 'Driver started delivery'
});
```

### Validate Transition
```typescript
const validation = StatusValidator.validateTransition('open', 'completed');
if (!validation.isValid) {
  console.error(validation.error?.message);
}
```

### Get Valid Next Statuses
```typescript
const validNext = StatusValidator.getValidNextStatuses('confirmed');
// Returns: ['in_progress', 'rejected', 'cancelled']
```

### Check Business Rules
```typescript
StatusValidator.canBeCancelled('open');        // true
StatusValidator.canRequestRefund('completed'); // true
StatusValidator.canRaiseDispute('failed');     // true
```

## Common Error Codes

| Code | When | Solution |
|------|------|----------|
| `INVALID_TRANSITION` | Transition not allowed by state machine | Use getValidNextStatuses() |
| `TERMINAL_STATUS` | Attempting to change from cancelled/refund_processed | Status is final |
| `FROZEN_STATUS` | Attempting to change disputed status | Wait for dispute resolution |
| `NOT_FOUND` | Delivery doesn't exist | Verify delivery ID |

## Testing Commands

```bash
# Run unit tests
npm test __tests__/StatusValidator.test.ts

# Run with coverage
npm test -- --coverage

# Watch mode
npm run test:watch
```

## Import Statements

```typescript
// Services
import { StatusTrackerService } from './services';

// Helpers
import { StatusValidator } from './helpers';

// Types
import { 
  StatusUpdateRequest, 
  StatusUpdateResult,
  VALID_TRANSITIONS 
} from './types/status.types';

// Errors
import { 
  StatusTransitionError, 
  DeliveryNotFoundError 
} from './services/StatusTrackerService';
```

## Automatic Behaviors

1. **failed → returning**: Automatic transition (Req 10.4)
2. **confirmed**: Rejects all other price offers
3. **disputed**: Freezes all transitions until resolved

## Time Windows

- **Cancellation within 5 minutes**: No penalty
- **Cancellation after 5 minutes**: Cancellation fee applied
- **Refund request window**: 48 hours after completion/return
- **Dispute window**: 7 days after completion/return
