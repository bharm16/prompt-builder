# Sentry Error Tracking Setup Guide

This guide walks you through setting up Sentry error tracking for the Prompt Builder application.

## Why Sentry?

Sentry provides:
- **Real-time error tracking** with detailed stack traces
- **Performance monitoring** to identify bottlenecks
- **User context** to understand which users are affected
- **Release tracking** to correlate errors with deployments
- **Session replay** to see what users did before an error
- **Alerts** via Slack, email, or other integrations

## Quick Setup (5 minutes)

### Step 1: Create a Sentry Account

1. Go to [sentry.io](https://sentry.io)
2. Sign up for a free account (5,000 errors/month free)
3. Choose "React" for frontend and "Node.js" for backend when prompted

### Step 2: Create Projects

Create two projects in Sentry:

1. **Frontend Project**
   - Platform: React
   - Name: `prompt-builder-client` (or your choice)
   - Copy the DSN (looks like: `https://xxx@sentry.io/123456`)

2. **Backend Project**
   - Platform: Node.js/Express
   - Name: `prompt-builder-api` (or your choice)
   - Copy the DSN

### Step 3: Configure Environment Variables

Add to your `.env` file:

```env
# Sentry DSNs (Required)
SENTRY_DSN=https://your_backend_dsn@sentry.io/project_id
VITE_SENTRY_DSN=https://your_frontend_dsn@sentry.io/project_id

# Sentry Configuration (Optional)
VITE_ENVIRONMENT=development
VITE_APP_VERSION=1.0.0

# For Production Source Maps Upload (Optional)
SENTRY_ORG=your_sentry_org_slug
SENTRY_PROJECT=your_sentry_project_slug
SENTRY_AUTH_TOKEN=your_auth_token
```

### Step 4: Restart Your Application

```bash
npm run restart
```

That's it! Sentry is now tracking errors.

## Verifying Setup

### Test Frontend Error Tracking

1. Open browser console
2. Throw a test error:
   ```javascript
   throw new Error('Test Sentry frontend error');
   ```
3. Check Sentry dashboard - error should appear within seconds

### Test Backend Error Tracking

Make a request that triggers an error:

```bash
curl http://localhost:3001/api/test-error
```

Check Sentry dashboard for the backend error.

## Features Enabled

### Frontend Features

✅ **Error Boundaries**
- React component errors are automatically caught and sent to Sentry
- Users see a friendly error page with option to report feedback

✅ **Performance Monitoring**
- Page load times
- Component render performance
- API request timing

✅ **Session Replay**
- See user interactions leading up to errors
- Replay the last 60 seconds before an error occurred

✅ **User Context**
- Firebase user ID and email automatically attached to errors
- See which users are affected by specific errors

✅ **Breadcrumbs**
- Authentication events (sign in/out)
- Navigation events
- User interactions
- API calls

### Backend Features

✅ **Request Tracking**
- All HTTP requests are tracked
- Response times and status codes

✅ **Error Context**
- Stack traces with source maps
- Request headers (sanitized)
- User information (when authenticated)

✅ **Performance Monitoring**
- API endpoint performance
- Database query timing
- External API calls (OpenAI, Firebase)

✅ **Circuit Breaker Integration**
- OpenAI API failures tracked
- Circuit breaker state changes logged

## Advanced Configuration

### Source Maps (Production)

For detailed stack traces in production, set up source map upload:

1. **Create Sentry Auth Token**
   - Go to Sentry → Settings → Auth Tokens
   - Create token with `project:releases` and `org:read` permissions
   - Add to `.env`: `SENTRY_AUTH_TOKEN=your_token`

2. **Configure Organization & Project**
   ```env
   SENTRY_ORG=your-org-slug
   SENTRY_PROJECT=prompt-builder-client
   ```

3. **Build with Source Maps**
   ```bash
   NODE_ENV=production npm run build
   ```
   
   Source maps are automatically uploaded during production builds.

### Environment-Based Sampling

Adjust sampling rates in production to control costs:

**Frontend** (`client/src/config/sentry.js`):
```javascript
tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,
replaysSessionSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,
```

**Backend** (`server/src/config/sentry.js`):
```javascript
tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,
profilesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,
```

### Custom Error Tracking

Use the helper functions in your code:

**Frontend:**
```javascript
import { captureException, captureMessage, addSentryBreadcrumb } from './config/sentry';

// Track an error
try {
  riskyOperation();
} catch (error) {
  captureException(error, { context: 'user_action', action: 'save_prompt' });
}

// Track a message
captureMessage('User reached premium limit', 'warning', { userId: user.id });

// Add breadcrumb for debugging
addSentryBreadcrumb('user_action', 'Clicked optimize button', {
  mode: 'video',
  promptLength: 150,
});
```

**Backend:**
```javascript
import { captureException, captureMessage, startTransaction } from './src/config/sentry.js';

// Track performance
const transaction = startTransaction('optimize_prompt', 'function');
try {
  const result = await optimizePrompt(input);
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

## Alerts & Integrations

### Set Up Alerts

1. Go to Sentry → Alerts → Create Alert
2. Recommended alerts:
   - **Error spike**: Fires when error rate increases 100%
   - **New issue**: Fires when a new error type appears
   - **High severity**: Fires for errors marked as high severity

### Integrate with Slack

1. Go to Sentry → Settings → Integrations
2. Search for Slack and install
3. Configure which alerts go to which channels

### Email Notifications

1. Go to Sentry → Settings → Notifications
2. Configure email frequency (real-time, daily digest, weekly)

## Monitoring Dashboard

View your errors in Sentry:
- **Issues**: All errors grouped by type
- **Performance**: API endpoint and page load performance
- **Releases**: Track errors by deployment version
- **User Feedback**: See feedback submitted by users

## Cost Management

### Free Tier Limits
- 5,000 errors/month
- 10,000 performance transactions/month
- 50 replays/month

### Tips to Stay Under Limits

1. **Filter Noise**
   - Configure `ignoreErrors` in sentry config
   - Filter out known browser extension errors
   - Ignore expected errors (rate limiting, validation)

2. **Adjust Sampling**
   - Lower `tracesSampleRate` in production (0.1 = 10%)
   - Lower `replaysSessionSampleRate` (0.05 = 5%)

3. **Use Development Mode**
   - Sentry disabled by default in development
   - Set `SENTRY_DEBUG=true` to enable for testing

## Troubleshooting

### Errors Not Appearing

1. **Check DSN is configured**
   ```bash
   echo $SENTRY_DSN
   echo $VITE_SENTRY_DSN
   ```

2. **Check browser console**
   - Look for Sentry initialization messages
   - Check for CORS errors

3. **Verify environment**
   - Sentry is disabled in development by default
   - Set `SENTRY_DEBUG=true` to enable

### Source Maps Not Working

1. **Ensure sourcemaps are enabled**
   ```javascript
   // vite.config.js
   build: {
     sourcemap: true
   }
   ```

2. **Verify auth token has permissions**
   - Token needs `project:releases` scope

3. **Check upload logs**
   ```bash
   NODE_ENV=production npm run build 2>&1 | grep -i sentry
   ```

### Too Many Events

If you're hitting rate limits:

1. **Lower sample rates**
2. **Add more ignore patterns**
3. **Filter by environment** (don't track staging)
4. **Upgrade plan** (starts at $26/month for 50k errors)

## Security Best Practices

✅ **Sensitive Data Filtering**
- Authorization headers automatically removed
- API keys redacted from query strings
- Cookie headers stripped

✅ **PII Protection**
- User emails only sent if user is authenticated
- No passwords or tokens in error context

✅ **Environment Separation**
- Use different projects for dev/staging/prod
- Tag releases with environment

## Further Reading

- [Sentry React Docs](https://docs.sentry.io/platforms/javascript/guides/react/)
- [Sentry Node.js Docs](https://docs.sentry.io/platforms/node/)
- [Performance Monitoring](https://docs.sentry.io/product/performance/)
- [Session Replay](https://docs.sentry.io/product/session-replay/)

## Support

For issues with Sentry setup:
1. Check [Sentry Status Page](https://status.sentry.io/)
2. Review [Sentry Documentation](https://docs.sentry.io/)
3. Open issue in this repository with `[Sentry]` prefix
