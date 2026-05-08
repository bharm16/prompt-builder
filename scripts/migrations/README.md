# Firestore Migrations

This directory contains migration scripts for updating Firestore data structures and related GCS objects.

## Script Catalog

| Script                                   | Type               | Purpose                                                                        |
| ---------------------------------------- | ------------------ | ------------------------------------------------------------------------------ |
| `backfill-highlight-cache.ts`            | Backfill           | Generate `highlightCache` for prompts that lack it                             |
| `force-highlight-rerender.ts`            | Reusable utility   | Invalidate or regenerate `highlightCache` after algorithm/model changes        |
| `normalize-taxonomy-ids.ts`              | One-time migration | Rewrite legacy span IDs in stored `highlightCache` to the V3 taxonomy          |
| `unify-sessions.ts`                      | One-time migration | Consolidate legacy prompt + `continuity_sessions` docs into unified `sessions` |
| `migrate-dev-api-key-identities.ts`      | One-time migration | Rewrite `dev-api-key:*` → `api-key:*` identity prefixes (Firestore + GCS)      |
| `cleanup-dev-api-key-objects.ts`         | Cleanup (paired)   | Delete legacy `dev-api-key:*` GCS objects after migration soak                 |
| `inventory-preview-image-references.ts`  | Read-only audit    | Inventory preview-image references across session collections                  |
| `migrate-preview-image-ownership.ts`     | One-time migration | Backfill owner-scoped preview-image GCS objects                                |
| `migrate-image-assets-to-user-scoped.ts` | One-time migration | Move flat `image-previews/{id}` to `image-previews/{userId}/{id}`              |

**Status policy:** every entry above is "verify with the team before running." Production-state of one-time migrations is not tracked in this repository — the team that owns the deploy pipeline knows what has shipped.

**Helper module:** `firebase-admin-init.ts` is the shared Firebase Admin initialiser. Migration scripts import it; do not run it directly.

**Companion docs:**

- [SETUP_GUIDE.md](./SETUP_GUIDE.md) — Firebase service-account auth setup. Read this once before running any migration.
- [QUICK_START.md](./QUICK_START.md) — common-command cheat sheet for `force-highlight-rerender` and `backfill-highlight-cache`.
- [FORCE_RERENDER_GUIDE.md](./FORCE_RERENDER_GUIDE.md) — deep usage patterns for the rerender script.

## Available Migrations

### 1. Force Highlight Rerender (`force-highlight-rerender.ts`)

Forces all existing prompts to regenerate their highlights by clearing or regenerating the `highlightCache` field. Use this when you've updated the span labeling algorithm, highlighting model, or want to apply new labeling templates to existing prompts.

#### When to Use This

- You've updated the span labeling algorithm or model
- You've made improvements to the highlighting logic
- You want all prompts to use the latest highlighting version
- Similar to how changing `templateVersion` invalidates caches

#### Prerequisites

Same as Highlight Cache Backfill (see section 2 below).

#### Usage

**Dry Run (Preview changes without committing):**

```bash
tsx --tsconfig server/tsconfig.json scripts/migrations/force-highlight-rerender.ts --dry-run
```

**Clear cache (forces rerender on next load - FAST):**

```bash
tsx --tsconfig server/tsconfig.json scripts/migrations/force-highlight-rerender.ts --mode=clear
```

**Clear and regenerate immediately (slower but complete):**

```bash
tsx --tsconfig server/tsconfig.json scripts/migrations/force-highlight-rerender.ts --mode=regenerate
```

**Process specific user's prompts:**

```bash
tsx --tsconfig server/tsconfig.json scripts/migrations/force-highlight-rerender.ts --userId=YOUR_USER_ID --mode=clear
```

**Test on limited documents:**

```bash
tsx --tsconfig server/tsconfig.json scripts/migrations/force-highlight-rerender.ts --limit=10 --dry-run
```

**Custom batch size:**

```bash
tsx --tsconfig server/tsconfig.json scripts/migrations/force-highlight-rerender.ts --batch-size=20 --mode=regenerate
```

#### Modes

- **`clear`** (default): Removes the `highlightCache` field from all prompts. Highlights will be regenerated automatically when users load those prompts. This is fast and recommended for most use cases.

- **`regenerate`**: Immediately generates new highlights for all prompts using the current algorithm. This takes longer but ensures all prompts have fresh highlights immediately. Useful before a production deployment.

#### What It Does

For each prompt document with existing `highlightCache`:

**Clear Mode:**

1. Removes the `highlightCache` field
2. Adds a version entry tracking the cache invalidation
3. Prompts will regenerate highlights on next load

**Regenerate Mode:**

1. Extracts the prompt text
2. Calls the ML span labeling service to generate new highlights
3. Updates the document with fresh `highlightCache`
4. Adds a version entry tracking the regeneration

#### Output Example

```
🔧 Force Highlight Rerender Migration

Configuration:
  Mode: CLEAR
  Dry Run: ✗ NO (will update Firestore)
  User Filter: ALL USERS
  Batch Size: 10
  Limit: NONE

ℹ️  Clear mode: Will remove highlightCache to force rerender on next load

📥 Fetching documents from Firestore...
✓ Found 150 document(s)

🔄 Processing documents...

[1/150] (1%) abc12345 (video, 1200 chars)
  ✓ Cleared cache in 0.043s
  Speed: 25.2 docs/min | ETA: 5.9 min

[2/150] (1%) def67890 (default, 800 chars)
  ✓ Cleared cache in 0.038s
  Speed: 27.1 docs/min | ETA: 5.5 min

...

============================================================
📊 Migration Summary
============================================================
Total documents found:        150
Documents processed:          150
Caches cleared:               145 ✓
Documents skipped:            5
  - No existing cache:        5
  - No prompt text:           0
Errors:                       0

Total time:                   5.8 minutes
Average time per document:    0.041s
============================================================

✓ Migration completed! 145 documents cleared, 0 failed.

💡 Next steps:
   - Highlights will be regenerated automatically when prompts are loaded
   - Or run: tsx --tsconfig server/tsconfig.json scripts/migrations/backfill-highlight-cache.ts
```

#### Safety Features

- **Two-mode operation**: Choose between fast cache clearing or immediate regeneration
- **Dry-run mode**: Test the migration without making changes
- **Idempotent**: Skips documents without existing cache
- **Progress tracking**: Real-time progress with ETA estimates
- **Version tracking**: All changes are logged in document versions
- **Error handling**: Gracefully handles errors and provides detailed reports

---

### 2. Highlight Cache Backfill (`backfill-highlight-cache.ts`)

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
tsx --tsconfig server/tsconfig.json scripts/migrations/backfill-highlight-cache.ts --dry-run
```

**Run the migration:**

```bash
tsx --tsconfig server/tsconfig.json scripts/migrations/backfill-highlight-cache.ts
```

**Process specific user's prompts:**

```bash
tsx --tsconfig server/tsconfig.json scripts/migrations/backfill-highlight-cache.ts --userId=YOUR_USER_ID
```

**Process limited number of documents (for testing):**

```bash
tsx --tsconfig server/tsconfig.json scripts/migrations/backfill-highlight-cache.ts --limit=10 --dry-run
```

**Custom batch size:**

```bash
tsx --tsconfig server/tsconfig.json scripts/migrations/backfill-highlight-cache.ts --batch-size=10
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

### 3. Taxonomy Normalization (`normalize-taxonomy-ids.ts`)

One-time migration that rewrites legacy span category and role IDs in stored `highlightCache` to the V3 taxonomy, removing the need for runtime legacy mapping. Shipped alongside the V3 taxonomy in December 2025.

**Status:** Verify with team before re-running — likely already applied in production.

**Usage:**

```bash
tsx --tsconfig server/tsconfig.json scripts/migrations/normalize-taxonomy-ids.ts --dry-run
tsx --tsconfig server/tsconfig.json scripts/migrations/normalize-taxonomy-ids.ts
```

Supports `--userId=USER_ID`, `--limit=N`, `--batch-size=N`. See script header for details.

---

### 4. Unify Sessions (`unify-sessions.ts`)

One-time migration that consolidates legacy prompt documents and `continuity_sessions` into the unified `sessions` collection. Shipped with the unified session model in February 2026.

**Status:** Verify with team before re-running.

**Usage:**

```bash
tsx --tsconfig server/tsconfig.json scripts/migrations/unify-sessions.ts --dry-run
tsx --tsconfig server/tsconfig.json scripts/migrations/unify-sessions.ts
```

Supports `--userId=USER_ID`, `--limit=N`, `--batch-size=N` (default 50).

---

### 5. Migrate Dev-API-Key Identities (`migrate-dev-api-key-identities.ts`)

One-time migration that rewrites `dev-api-key:*` identity prefixes to `api-key:*` across both Firestore and GCS. Pair with `cleanup-dev-api-key-objects.ts` (entry 6) for the post-soak cleanup.

**Status:** Verify with team before re-running.

**Usage:**

```bash
tsx --tsconfig server/tsconfig.json scripts/migrations/migrate-dev-api-key-identities.ts --dry-run
tsx --tsconfig server/tsconfig.json scripts/migrations/migrate-dev-api-key-identities.ts --apply
```

Aborts in dry-run when planned changes exceed `--threshold=N` (default 100).

---

### 6. Cleanup Dev-API-Key Objects (`cleanup-dev-api-key-objects.ts`)

Follow-up cleanup that deletes legacy `dev-api-key:*` GCS objects after the identity migration (entry 5) has soaked. Defaults to a 7-day minimum age before delete.

**Status:** Run _after_ `migrate-dev-api-key-identities.ts` has soaked in production.

**Usage:**

```bash
tsx --tsconfig server/tsconfig.json scripts/migrations/cleanup-dev-api-key-objects.ts --dry-run
tsx --tsconfig server/tsconfig.json scripts/migrations/cleanup-dev-api-key-objects.ts --apply
```

Configurable via `--min-age-days=N` (default 7).

---

### 7. Inventory Preview Image References (`inventory-preview-image-references.ts`)

Read-only audit script that inventories preview-image references across the `sessions` and `continuity_sessions` Firestore collections. Used as a diagnostic for the preview-image ownership migration (entry 8).

**Status:** Read-only — safe to run any time. Has no `--apply` mode.

**Usage:**

```bash
tsx --tsconfig server/tsconfig.json scripts/migrations/inventory-preview-image-references.ts --dry-run
tsx --tsconfig server/tsconfig.json scripts/migrations/inventory-preview-image-references.ts --dry-run --userId=<uid>
tsx --tsconfig server/tsconfig.json scripts/migrations/inventory-preview-image-references.ts --dry-run --limit=100
```

---

### 8. Migrate Preview Image Ownership (`migrate-preview-image-ownership.ts`)

One-time backfill that moves preview-image GCS objects under owner-scoped paths. Shipped alongside the preview-image ownership feature in February 2026.

**Status:** Verify with team before re-running.

**Usage:**

```bash
tsx --tsconfig server/tsconfig.json scripts/migrations/migrate-preview-image-ownership.ts --dry-run
tsx --tsconfig server/tsconfig.json scripts/migrations/migrate-preview-image-ownership.ts --apply
```

Supports `--userId=<uid>` and `--limit=N` for scoped runs.

---

### 9. Migrate Image Assets to User-Scoped Paths (`migrate-image-assets-to-user-scoped.ts`)

One-time migration that moves legacy flat `image-previews/{assetId}` GCS objects into `image-previews/{userId}/{assetId}` paths. Most recent migration script (April 2026).

**Background:** A code change introduced userId-scoped storage paths for image previews. The application currently checks both paths via fallback; this migration moves assets to the new canonical path so the fallback can eventually be removed.

**Status:** Verify with team before running. Application path-fallback is still active.

**Strategy:**

1. Scan all Firestore session documents to build an `assetId → userId` map
2. List all GCS objects at the flat prefix (`image-previews/{uuid}`)
3. For each flat object, look up the owner `userId` and copy to the new path
4. Optionally delete the original flat object (`--delete-originals`)

**Usage:**

```bash
tsx --tsconfig server/tsconfig.json scripts/migrations/migrate-image-assets-to-user-scoped.ts --dry-run
tsx --tsconfig server/tsconfig.json scripts/migrations/migrate-image-assets-to-user-scoped.ts --apply
tsx --tsconfig server/tsconfig.json scripts/migrations/migrate-image-assets-to-user-scoped.ts --apply --delete-originals
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

1. Copy `backfill-highlight-cache.ts` as a template
2. Use `initializeFirebaseAdmin()` from `firebase-admin-init.ts`
3. Include `--dry-run` flag support
4. Add progress tracking and statistics
5. Handle errors gracefully with retries
6. Document usage in this README
