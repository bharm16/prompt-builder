# Update Sentry DSN (Optional)

## You Have Two Frontend DSN Options

### Option 1: Keep Current DSN (RECOMMENDED)
**Current:** `https://99382b54616f52bc920c8cfce9e5f564@o4506655473074176.ingest.us.sentry.io/4510247700004864`

✅ Already configured and working
✅ Test errors already sent here
✅ No changes needed

### Option 2: Switch to New DSN
**New:** `https://6ac8e5574fa182f6cd6fa8ffe17f6d3d@o4506655473074176.ingest.us.sentry.io/4510247701512192`

If you want to use the new project from Sentry wizard:

```bash
# Update .env file
VITE_SENTRY_DSN=https://6ac8e5574fa182f6cd6fa8ffe17f6d3d@o4506655473074176.ingest.us.sentry.io/4510247701512192

# Restart app
npm run restart
```

## Why Two DSNs?

It looks like you created a second React project in Sentry. This is fine - you can:
- Use one for development
- Use one for production
- Or just pick one and delete the other

## Current Setup

**Backend (Node.js):**
```
SENTRY_DSN=https://e612da64218e595ffd763abab1fbfb16@o4506655473074176.ingest.us.sentry.io/4510247711539200
```
✅ This matches your wizard - no change needed

**Frontend (React):**
```
VITE_SENTRY_DSN=https://99382b54616f52bc920c8cfce9e5f564@o4506655473074176.ingest.us.sentry.io/4510247700004864
```
⚠️ This is different from wizard (old project)

## What I Updated

✅ Added `sendDefaultPii: true` (as per wizard suggestion)
✅ Updated backend to use `Sentry.setupExpressErrorHandler()` (new method)
✅ Kept all enhanced features (performance, replay, etc.)

## Recommendation

**Keep current setup** - it's working fine and has more features than the basic wizard setup!

Only update the DSN if you specifically want to use the new Sentry project you created.

