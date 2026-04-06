# PR 9: Worker Claim-Loop Fixes

## Baseline (before)
- `RefundFailureStore.claimNextPending` read up to `scanLimit` pending records in a non-transactional read, sorted them in-memory by `updatedAtMs`, then iterated through each candidate attempting a transactional claim. Under contention, multiple workers could read the same candidate list and retry against each other.
- `PaymentConsistencyStore.claimNextBillingProfileRepair` used the identical scan-and-retry pattern: non-transactional batch read, in-memory sort, iterate-and-claim loop.
- `VideoJobStore.claimNextJob`, `claimNextDlqEntry`, `failNextQueuedStaleJob`, and `failNextProcessingStaleJob` already used the correct single-item query + transaction pattern.
- `StripeWebhookEventStore.claimEvent` and `VideoJobStore.claimJob` claim by known ID in a transaction (correct, no polling).
- `inlineProcessor` claims by known job ID (correct).

## After
- `RefundFailureStore.claimNextPending` now queries `.where("status", "==", "pending").orderBy("updatedAtMs", "asc").limit(1)` inside a single Firestore transaction. One candidate per poll; if the transaction fails (already claimed), the next poll iteration naturally picks the next eligible item.
- `PaymentConsistencyStore.claimNextBillingProfileRepair` refactored identically: single-item ordered query inside one transaction.
- The `scanLimit` parameter is retained (as `_scanLimit`) for backward compatibility but is no longer used.

## Delta
- Eliminates N non-transactional reads followed by up to N transactional claim attempts per poll cycle.
- Under contention, workers no longer fight over the same candidate list; each worker atomically reads and claims exactly one item.
- Reduces Firestore read operations from O(scanLimit) to O(1) per claim attempt.

## Method
- Code review of all worker claim/poll patterns in `server/src/services/`
- Verified VideoJobStore patterns were already correct (no changes needed)
- Refactored RefundFailureStore and PaymentConsistencyStore claim methods
- Updated test mocks to match new transactional query pattern

## Rollback Gate
- Revert if workers fail to claim jobs
- Revert if contention tests show duplicate claims
