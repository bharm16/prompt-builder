# Firestore Highlight Cache Backfill - Implementation Spec

## Overview

This specification covers the implementation of a migration system to backfill existing Firestore prompt documents with ML-generated highlight cache data.

## Problem Statement

The recent changes introduced a persistent highlight cache system that stores ML-generated text highlighting data in Firestore. However, existing prompt documents in the database don't have this `highlightCache` field populated, meaning:

- Users opening old prompts won't see highlights until they regenerate them
- No version history exists for these prompts
- Inconsistent user experience between new and old prompts

## Solution

Create a migration script that:
1. Fetches existing prompt documents from Firestore
2. Generates highlight cache using the existing `labelSpans` service
3. Updates documents with `highlightCache` and version tracking
4. Provides safe, observable, and resumable execution

---

## Files Created

### 1. `scripts/migrations/firebase-admin-init.js`

**Purpose**: Firebase Admin SDK initialization helper

**Features**:
- Supports service account authentication
- Supports Application Default Credentials (ADC)
- Environment variable configuration
- Error handling with helpful setup instructions

**Exports**:
- `initializeFirebaseAdmin()` - Returns Firestore database instance
- `admin` - Firebase Admin SDK for direct access

### 2. `scripts/migrations/backfill-highlight-cache.js`

**Purpose**: Main migration script

**Features**:
- Batch processing with configurable batch size (default: 5)
- Dry-run mode for safe testing
- User-specific filtering
- Document limit for testing
- Automatic retry logic (3 attempts per document)
- Progress tracking and statistics
- Idempotent (safe to run multiple times)

**Command Line Options**:
```bash
--dry-run              # Preview without making changes
--userId=USER_ID       # Process specific user only
--batch-size=N         # Concurrent processing (default: 5)
--limit=N              # Maximum documents to process
```

**Algorithm**:
```
FOR EACH document in Firestore:
  1. Check if highlightCache already exists → SKIP
  2. Extract prompt text (optimizedPrompt || prompt)
  3. Validate text exists and is non-empty → SKIP if invalid
  4. Call labelSpans(text) with retry logic
  5. Generate signature hash
  6. Create version entry
  7. Update Firestore document (if not dry-run)
  8. Track statistics
END FOR

PRINT summary statistics
```

**Error Handling**:
- Network failures: 3 automatic retries with 1s delay
- Missing text: Skip document, track in statistics
- Already has cache: Skip document, track separately
- All errors logged with document ID and reason

### 3. `scripts/migrations/README.md`

**Purpose**: Complete documentation for running migrations

**Contents**:
- Prerequisites and setup instructions
- Firebase authentication setup (both methods)
- Usage examples
- Output samples
- Troubleshooting guide
- Best practices
- Guide for creating new migrations

---

## Dependencies Required

### New Package to Install

```bash
npm install firebase-admin
```

**Why**: Firebase Admin SDK provides server-side Firestore access with admin privileges, required for batch operations and migrations.

---

## Environment Variables

### New Optional Variable

Add to `.env`:

```bash
# Firebase Admin SDK (for migrations and server-side operations)
# Path to your Firebase service account JSON file
# Download from: https://console.firebase.google.com/project/flibberai/settings/serviceaccounts/adminsdk
FIREBASE_SERVICE_ACCOUNT_PATH=/absolute/path/to/service-account.json
```

**Alternative**: Use Application Default Credentials (no .env change needed):
```bash
gcloud auth application-default login
```

---

## Usage Instructions

### Step 1: Install Dependencies

```bash
npm install firebase-admin
```

### Step 2: Set Up Authentication

**Option A - Service Account (Recommended)**:
1. Go to [Firebase Console → Service Accounts](https://console.firebase.google.com/project/flibberai/settings/serviceaccounts/adminsdk)
2. Click "Generate New Private Key"
3. Save JSON file securely
4. Add to `.env`: `FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/key.json`

**Option B - ADC**:
```bash
gcloud auth application-default login
```

### Step 3: Test with Dry Run

```bash
# Preview on small dataset
node scripts/migrations/backfill-highlight-cache.js --dry-run --limit=5
```

### Step 4: Run Migration

```bash
# Full migration
node scripts/migrations/backfill-highlight-cache.js
```

---

## Technical Details

### Data Structure

**Before Migration**:
```javascript
{
  userId: "user123",
  uuid: "abc-def-ghi",
  optimizedPrompt: "Wide shot of a person walking...",
  mode: "video",
  timestamp: Timestamp(...)
  // No highlightCache
  // No versions
}
```

**After Migration**:
```javascript
{
  userId: "user123",
  uuid: "abc-def-ghi",
  optimizedPrompt: "Wide shot of a person walking...",
  mode: "video",
  timestamp: Timestamp(...),
  highlightCache: {
    spans: [
      { text: "Wide shot", start: 0, end: 9, role: "Framing", confidence: 0.95 },
      { text: "walking", start: 22, end: 29, role: "Descriptive", confidence: 0.85 }
    ],
    meta: { version: "v1", notes: "Auto-labeled 2 spans" },
    signature: "3f7c2a8b1d9e4f5c",
    timestamp: Timestamp(...)
  },
  versions: [
    {
      versionId: "migration-v-1729785600000",
      signature: "3f7c2a8b1d9e4f5c",
      spansCount: 2,
      timestamp: Timestamp(...)
    }
  ]
}
```

### Signature Generation

Uses the same hash function as client-side:
```javascript
function hashString(str) {
  return crypto.createHash('sha256')
    .update(str, 'utf8')
    .digest('hex')
    .slice(0, 16);
}
```

This ensures cache validation works correctly when loading migrated prompts.

### Performance Considerations

**Batch Size**: Default 5 documents in parallel
- Too high: May hit OpenAI rate limits
- Too low: Migration takes longer
- Recommendation: 5-10 for most cases

**API Costs**:
- Each document requires 1 OpenAI API call
- Using `gpt-4o-mini` (cost-effective)
- Estimate: ~$0.001 per document

**Time Estimate**:
- ~2-5 seconds per document (including API latency)
- 100 documents: ~5-10 minutes
- 1000 documents: ~45-90 minutes

---

## Safety Features

1. **Dry-Run Mode**: Test without committing changes
2. **Idempotent**: Safe to run multiple times (skips already-migrated docs)
3. **Retry Logic**: Automatic retries for transient failures
4. **Progress Tracking**: Console output shows real-time progress
5. **Statistics**: Detailed summary at completion
6. **Graceful Errors**: Failed documents don't stop the entire migration

---

## Testing Plan

### 1. Unit Test (Manual)
```bash
# Test with 1 document
node scripts/migrations/backfill-highlight-cache.js --dry-run --limit=1
```

### 2. Small Batch Test
```bash
# Test with 10 documents
node scripts/migrations/backfill-highlight-cache.js --dry-run --limit=10
```

### 3. User-Specific Test
```bash
# Test with specific user's data
node scripts/migrations/backfill-highlight-cache.js --dry-run --userId=YOUR_USER_ID
```

### 4. Production Run
```bash
# Full migration
node scripts/migrations/backfill-highlight-cache.js
```

---

## Rollback Plan

If issues occur, the migration is **non-destructive**:
- Original data remains intact
- Only adds `highlightCache` and `versions` fields
- Can delete these fields manually if needed:

```javascript
// Manual rollback (if necessary)
const batch = db.batch();
const snapshot = await db.collection('prompts').get();
snapshot.forEach(doc => {
  batch.update(doc.ref, {
    highlightCache: admin.firestore.FieldValue.delete(),
    versions: admin.firestore.FieldValue.delete()
  });
});
await batch.commit();
```

---

## Next Steps

### Immediate
1. ✅ Install `firebase-admin` package
2. ✅ Set up Firebase authentication
3. ✅ Run dry-run test with `--limit=5`
4. ✅ Review output and verify correctness

### Post-Migration
1. Monitor application logs for any issues
2. Verify users see highlights on old prompts
3. Check Firestore console to confirm data structure
4. Consider running for production environment (if separate)

---

## Monitoring

After migration completes, verify:

1. **Firestore Console**: Check random documents have `highlightCache` populated
2. **Application UI**: Open old prompts and verify highlights appear
3. **Statistics**: Review migration summary for error rate
4. **Logs**: Check for any unusual errors

---

## Support

For issues or questions:
1. Check `scripts/migrations/README.md` for troubleshooting
2. Review console output for specific error messages
3. Test with `--dry-run --limit=1` to isolate issues
4. Verify Firebase authentication is working

---

## Summary

This migration system provides a **safe, observable, and efficient** way to backfill highlight cache data for existing prompts. The implementation follows best practices with dry-run support, retry logic, and comprehensive error handling.

**Key Benefits**:
- ✅ Consistent user experience across all prompts
- ✅ No data loss or corruption risk
- ✅ Idempotent and resumable
- ✅ Clear progress tracking and reporting
- ✅ Production-ready with proper error handling
