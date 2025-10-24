# Firestore Migrations

This directory contains migration scripts for updating Firestore data structures.

## Available Migrations

### 1. Highlight Cache Backfill (`backfill-highlight-cache.js`)

Generates and populates `highlightCache` data for existing prompt documents that don't have ML-powered highlighting data.

#### Prerequisites

Before running the migration, you need to:

1. **Install Firebase Admin SDK** (if not already installed):
   ```bash
   npm install firebase-admin
   ```

2. **Set up Firebase authentication** using one of these methods:

   **Option A: Service Account (Recommended for local development)**
   
   a. Download your service account key:
      - Go to [Firebase Console](https://console.firebase.google.com/)
      - Select your project (`flibberai`)
      - Go to Project Settings → Service Accounts
      - Click "Generate New Private Key"
      - Save the JSON file somewhere secure (e.g., `~/firebase-service-account.json`)
   
   b. Add to your `.env` file:
      ```bash
      FIREBASE_SERVICE_ACCOUNT_PATH=/absolute/path/to/your/service-account.json
      ```
   
   **Option B: Application Default Credentials (For Cloud environments)**
   
   Run this command to authenticate with your Google Cloud account:
   ```bash
   gcloud auth application-default login
   ```

#### Usage

**Dry Run (Preview changes without committing):**
```bash
node scripts/migrations/backfill-highlight-cache.js --dry-run
```

**Run the migration:**
```bash
node scripts/migrations/backfill-highlight-cache.js
```

**Process specific user's prompts:**
```bash
node scripts/migrations/backfill-highlight-cache.js --userId=YOUR_USER_ID
```

**Process limited number of documents (for testing):**
```bash
node scripts/migrations/backfill-highlight-cache.js --limit=10 --dry-run
```

**Custom batch size:**
```bash
node scripts/migrations/backfill-highlight-cache.js --batch-size=10
```

#### What It Does

For each prompt document without `highlightCache`:

1. Extracts the `optimizedPrompt` or `prompt` text
2. Calls the ML span labeling service (`labelSpans`) to generate highlights
3. Creates a signature hash for cache validation
4. Updates the document with:
   - `highlightCache`: Object containing `spans`, `meta`, `signature`, `timestamp`
   - `versions`: Array with version entry tracking the migration

#### Output

```
🔧 Firestore Highlight Cache Backfill Migration

Configuration:
  Dry Run: ✗ NO (will update Firestore)
  User Filter: ALL USERS
  Batch Size: 5
  Limit: NONE

📥 Fetching documents from Firestore...
✓ Found 42 document(s)

🔄 Processing documents...

[1/42] Processing: abc12345...
    Mode: video
    Created: 2025-10-20T10:30:00.000Z
  📝 Generating highlights for doc abc12345... (456 chars)
    ✓ Updated with 12 spans (signature: 3f7c2a8b)

[2/42] Processing: def67890...
    Mode: default
    Created: 2025-10-21T14:20:00.000Z
    ⊘ Skipped: already-has-cache

...

============================================================
📊 Migration Summary
============================================================
Total documents found:        42
Documents processed:          42
Documents updated:            35 ✓
Documents skipped:            7
  - Already had cache:        5
  - No prompt text:           2
Errors:                       0
============================================================

✓ Migration completed successfully!
```

#### Error Handling

- **Automatic retries**: Failed API calls are retried up to 3 times with 1-second delays
- **Graceful skips**: Documents without prompt text or already having cache are skipped
- **Error tracking**: All errors are logged and counted in the summary

#### Safety Features

- **Dry-run mode**: Test the migration without making changes
- **Idempotent**: Safe to run multiple times (skips already-migrated documents)
- **Progress tracking**: Clear console output showing what's happening
- **Detailed statistics**: Summary report at the end

---

### 2. Timestamp Migration (`migrate-timestamps.js`)

Legacy script to delete old prompts with incompatible timestamp formats.

**Usage:**
```bash
node scripts/migrations/migrate-timestamps.js
```

---

## Best Practices

1. **Always run with `--dry-run` first** to preview changes
2. **Test on limited dataset** using `--limit=10` before full migration
3. **Run during low-traffic periods** to minimize API quota usage
4. **Monitor console output** for errors or unexpected behavior
5. **Back up critical data** before running migrations (Firestore exports)

## Troubleshooting

### "Failed to initialize Firebase Admin"

**Solution**: Make sure you've set up authentication (see Prerequisites above)

### "Permission denied" errors

**Solution**: Your service account needs Firestore read/write permissions. Check IAM roles in Firebase Console.

### Rate limiting / quota errors

**Solution**: Reduce `--batch-size` or add delays between batches

### "labelSpans is not a function"

**Solution**: Make sure your server dependencies are installed (`npm install`)

---

## Creating New Migrations

When creating new migration scripts:

1. Copy `backfill-highlight-cache.js` as a template
2. Use `initializeFirebaseAdmin()` from `firebase-admin-init.js`
3. Include `--dry-run` flag support
4. Add progress tracking and statistics
5. Handle errors gracefully with retries
6. Document usage in this README
