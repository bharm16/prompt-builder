# Sentry Quick Reference

**One-page guide to error tracking in Prompt Builder**

---

## Setup (30 seconds)

```bash
# 1. Get your DSN from sentry.io
# 2. Add to .env:
SENTRY_DSN=https://xxx@sentry.io/123456
VITE_SENTRY_DSN=https://yyy@sentry.io/789012

# 3. Restart app
npm run restart
```

✅ **Done!** Error tracking is now active.

---

## Frontend Usage

### Import helpers
```javascript
import { 
  captureException, 
  captureMessage, 
  addSentryBreadcrumb 
} from './config/sentry';
```

### Capture errors
```javascript
try {
  riskyOperation();
} catch (error) {
  captureException(error, { 
    context: 'user_action',
    action: 'save_prompt' 
  });
}
```

### Add breadcrumbs
```javascript
addSentryBreadcrumb('user_action', 'Clicked button', {
  buttonName: 'optimize',
  mode: 'video'
});
```

### Track messages
```javascript
captureMessage('User hit limit', 'warning', { 
  userId: user.id 
});
```

---

## Backend Usage

### Import helpers
```javascript
import { 
  captureException, 
  startTransaction,
  addSentryBreadcrumb 
} from './src/config/sentry.js';
```

### Track performance
```javascript
const transaction = startTransaction('optimize', 'function');
try {
  const result = await optimize(input);
  transaction?.setStatus('ok');
  return result;
} catch (error) {
  transaction?.setStatus('error');
  captureException(error, { input, mode });
  throw error;
} finally {
  transaction?.finish();
}
```

### Add context
```javascript
addSentryBreadcrumb('api', 'Request received', {
  endpoint: '/api/optimize',
  userId: req.user?.uid
});
```

---

## What Gets Tracked

### Frontend ✅
- React component errors
- API call failures
- User interactions (breadcrumbs)
- Performance metrics
- Session replays (10% in production)

### Backend ✅
- Server crashes
- API endpoint errors (500+)
- Request timing
- OpenAI API failures
- Circuit breaker events

### User Context ✅
- Firebase user ID
- Email address
- Actions before error
- Browser/OS info

---

## View Errors

**Sentry Dashboard:** https://sentry.io

1. **Issues** → All errors
2. **Performance** → Slow endpoints
3. **Releases** → Track by version
4. **User Feedback** → Reports from users

---

## Production Settings

```env
# Production
VITE_ENVIRONMENT=production
VITE_APP_VERSION=1.0.0

# Optional: Source maps
SENTRY_ORG=your-org
SENTRY_PROJECT=your-project
SENTRY_AUTH_TOKEN=your-token
```

---

## Troubleshooting

### Errors not appearing?
```bash
# Check DSN configured
echo $SENTRY_DSN

# Enable in dev mode
SENTRY_DEBUG=true npm run dev
```

### Too many events?
```javascript
// Lower sampling in config
tracesSampleRate: 0.05,  // 5% instead of 10%
```

---

## Key Files

| File | Purpose |
|------|---------|
| `client/src/config/sentry.js` | Frontend config |
| `server/src/config/sentry.js` | Backend config |
| `docs/SENTRY_SETUP.md` | Full setup guide |
| `docs/SENTRY_EXAMPLES.md` | Code examples |
| `SENTRY_IMPLEMENTATION.md` | Complete documentation |

---

## Severity Levels

```javascript
captureMessage(msg, 'fatal');    // Critical
captureMessage(msg, 'error');    // Error
captureMessage(msg, 'warning');  // Warning
captureMessage(msg, 'info');     // Info
captureMessage(msg, 'debug');    // Debug
```

---

## Ignore Patterns

Already configured:
- ✅ Browser extensions
- ✅ Network errors
- ✅ User canceled actions
- ✅ Firebase popup closed

---

## Cost Management

**Free Tier:**
- 5,000 errors/month
- 10,000 performance transactions/month
- 50 replays/month

**Current Config:**
- 10% sampling (production)
- Development disabled by default
- Noisy errors filtered

---

## Common Tasks

### Set user context
```javascript
// Automatically done on Firebase auth
setSentryUser(user);  // ✅ Already integrated
```

### Start performance tracking
```javascript
const transaction = Sentry.startTransaction({
  name: 'operation_name',
  op: 'function'
});
// ... do work
transaction.finish();
```

### Add custom tags
```javascript
Sentry.setTag('feature', 'video-mode');
Sentry.setTag('version', '1.0.0');
```

---

## Testing

### Frontend test
```javascript
// Browser console
throw new Error('Test Sentry error');
```

### Backend test
```bash
curl http://localhost:3001/api/nonexistent
```

Check dashboard in 5 seconds ✅

---

## Support

- 📖 [Full Setup Guide](./docs/SENTRY_SETUP.md)
- 💡 [Code Examples](./docs/SENTRY_EXAMPLES.md)
- 📝 [Implementation Details](./SENTRY_IMPLEMENTATION.md)
- 🌐 [Sentry Docs](https://docs.sentry.io)

---

**Status:** ✅ Fully implemented and production-ready

Simply add your DSN to `.env` and you're tracking errors!
