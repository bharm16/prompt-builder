# Disaster Recovery Runbook

## Overview

This runbook covers backup, restore, and verification procedures for Vidra's critical data stores. All procedures target Firestore as the primary state store.

## RPO / RTO Targets

| Metric | Target | Notes |
|--------|--------|-------|
| **RPO** (Recovery Point Objective) | 1 hour | Firestore scheduled exports run hourly |
| **RTO** (Recovery Time Objective) | 30 minutes | From backup artifact to verified restore |

## Critical Collections

| Collection | Priority | Impact if Lost |
|-----------|----------|----------------|
| `users` | P0 | User accounts and auth state |
| `credit_balances` | P0 | User credit balances (financial) |
| `credit_transactions` | P0 | Credit audit trail |
| `video_jobs` | P1 | Active video generation queue |
| `video_job_dlq` | P2 | Failed job retry queue |
| `request_idempotency` | P3 | Idempotency dedup (TTL-managed) |
| `stripe_webhook_events` | P1 | Payment event dedup |

## Procedures

### 1. Scheduled Export (Automated)

Firestore exports are configured via Cloud Scheduler to run hourly to a GCS bucket.

**Bucket:** `gs://${PROJECT_ID}-firestore-backups/`
**Schedule:** Every hour at :00
**Retention:** 7 days (lifecycle policy on GCS bucket)

### 2. Manual Export

```bash
# Export all collections
scripts/ops/firestore-export.sh --project <PROJECT_ID>

# Export specific collections only
scripts/ops/firestore-export.sh --project <PROJECT_ID> --collections credit_balances,credit_transactions,users
```

### 3. Restore from Backup

```bash
# Restore to emulator (safe, for testing)
scripts/ops/firestore-restore.sh --source gs://<BUCKET>/<EXPORT_PATH> --target emulator

# Restore to project (DESTRUCTIVE - requires confirmation)
scripts/ops/firestore-restore.sh --source gs://<BUCKET>/<EXPORT_PATH> --target <PROJECT_ID>
```

**WARNING:** Restoring to a live project will overwrite existing documents. Always verify against emulator first.

### 4. Smoke Test (Post-Restore Verification)

```bash
# Run against emulator after restore
scripts/ops/dr-smoke-test.sh --target emulator

# Run against project
scripts/ops/dr-smoke-test.sh --target <PROJECT_ID>
```

The smoke test verifies:
1. User credit balance totals match transaction sums
2. Video job record counts by status match expected distribution
3. No orphaned credit transactions (user exists for every transaction)
4. DLQ entries reference valid job IDs

### 5. DR Drill Schedule

Run a full drill monthly:
1. Export from production
2. Restore to emulator
3. Run smoke test
4. Document results in drill log

## Escalation

| Severity | Contact | SLA |
|----------|---------|-----|
| P0 (data loss) | On-call engineer + team lead | 15 min response |
| P1 (degraded) | On-call engineer | 30 min response |
| P2 (non-critical) | Next business day | 24 hours |
