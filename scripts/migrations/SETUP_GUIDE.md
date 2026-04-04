# Firebase Service Account Setup Guide

## Quick Start

You need a Firebase service account to run the migration. Follow these steps:

### Step 1: Download Service Account Key

1. **Open Firebase Console**
   - Go to: https://console.firebase.google.com/project/flibberai/settings/serviceaccounts/adminsdk
   - Or navigate manually:
     - Firebase Console → Your Project (flibberai)
     - Click ⚙️ Settings (top left)
     - Click "Service accounts" tab

2. **Generate New Key**
   - Click "Generate new private key"
   - Confirm by clicking "Generate key"
   - A JSON file will download (e.g., `flibberai-firebase-adminsdk-xxxxx.json`)

3. **Save the File Securely**

   ```bash
   # Create a secure directory (optional)
   mkdir -p ~/.firebase-keys

   # Move the downloaded file there
   mv ~/Downloads/flibberai-firebase-adminsdk-*.json ~/.firebase-keys/flibberai-service-account.json

   # Set restrictive permissions
   chmod 600 ~/.firebase-keys/flibberai-service-account.json
   ```

### Step 2: Configure Environment Variable

Add this line to your `.env` file:

```bash
# Firebase Admin SDK Service Account
FIREBASE_SERVICE_ACCOUNT_PATH=/Users/bryceharmon/.firebase-keys/flibberai-service-account.json
```

**Or use the absolute path to wherever you saved the file:**

```bash
FIREBASE_SERVICE_ACCOUNT_PATH=/absolute/path/to/your/service-account.json
```

### Step 3: Test the Connection

```bash
# Test with a dry run on 1 document
tsx --tsconfig server/tsconfig.json scripts/migrations/backfill-highlight-cache.ts --dry-run --limit=1
```

You should see:

```
✓ Connected to Firestore project: flibberai
📥 Fetching documents from Firestore...
✓ Found X document(s)
```

---

## Security Best Practices

⚠️ **IMPORTANT**: The service account file contains sensitive credentials!

### DO:

- ✅ Store it outside your project directory (e.g., `~/.firebase-keys/`)
- ✅ Add it to `.gitignore` if stored in project
- ✅ Set file permissions to 600 (read/write for owner only)
- ✅ Never commit it to version control
- ✅ Rotate keys periodically (Firebase Console)

### DON'T:

- ❌ Commit service account JSON to Git
- ❌ Share the file publicly
- ❌ Store in cloud storage without encryption
- ❌ Use the same key for development and production

---

## Troubleshooting

### "FIREBASE_SERVICE_ACCOUNT_PATH not found"

**Solution**: Check that:

1. The path in `.env` is absolute (starts with `/`)
2. The file exists at that path: `ls -l /path/to/service-account.json`
3. You've restarted any running servers after updating `.env`

### "Permission denied" errors

**Solution**:

```bash
chmod 600 /path/to/service-account.json
```

### "Could not load the default credentials"

**Solution**: You're not using the service account method. Add `FIREBASE_SERVICE_ACCOUNT_PATH` to `.env`

---

## Alternative: Application Default Credentials (Advanced)

If you have `gcloud` CLI installed:

```bash
# Install gcloud (if not installed)
# https://cloud.google.com/sdk/docs/install

# Authenticate
gcloud auth application-default login

# Run migration (no .env change needed)
tsx --tsconfig server/tsconfig.json scripts/migrations/backfill-highlight-cache.ts --dry-run
```

---

## Next Steps

Once configured, run the migration:

```bash
# 1. Test with dry-run
tsx --tsconfig server/tsconfig.json scripts/migrations/backfill-highlight-cache.ts --dry-run --limit=5

# 2. Review the output

# 3. Run the actual migration
tsx --tsconfig server/tsconfig.json scripts/migrations/backfill-highlight-cache.ts
```

---

## Help

If you encounter issues:

1. Check this guide first
2. Verify your service account has Firestore read/write permissions
3. Check the Firebase Console for IAM role assignments
4. Refer to `scripts/migrations/README.md` for more details
