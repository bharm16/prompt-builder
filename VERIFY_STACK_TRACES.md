# Verify Stack Traces Are Working

## Quick Test

### 1. Trigger a Test Error

**Backend:**
```bash
curl http://localhost:3001/api/nonexistent
```

**Frontend:**
Open `test-sentry.html` and click "Test Frontend Error"

### 2. Check Sentry Dashboard

Go to: https://sentry.io

Navigate to: **Issues** tab

### 3. Click on an Error

You should see:

```
┌─────────────────────────────────────────┐
│ Error: Test frontend error              │
├─────────────────────────────────────────┤
│ STACK TRACE:                            │
│                                         │
│ at testFrontendError                    │
│   PromptOptimizerContainer.jsx:292:15  │
│                                         │
│ at onClick                              │
│   Button.jsx:45:8                       │
│                                         │
│ at callCallback                         │
│   react-dom.js:3945:14                  │
│                                         │
│ [Show more frames...]                   │
└─────────────────────────────────────────┘
```

### 4. What You'll See

✅ **File Names**: Exact source files (not minified)
✅ **Line Numbers**: Precise location of error
✅ **Function Names**: Which function threw the error
✅ **Code Snippets**: Actual source code around the error
✅ **Full Stack**: Complete call hierarchy

### Stack Trace Features

**Click on any stack frame to see:**
- Source code (5 lines before/after)
- Variable values (in some cases)
- Link to file in your repo (if configured)

**Additional Context:**
- Browser/OS information
- User who got the error
- Actions before error (breadcrumbs)
- Request details (backend errors)

## Example: Real Stack Trace in Sentry

### Frontend Error
```javascript
Error: Cannot read property 'length' of undefined
  at PromptCanvas.jsx:145:28
    142: const result = optimizedPrompt;
    143: if (result) {
    144:   const preview = result.substring(0, 100);
    145:   setPreviewLength(result.length);  ← ERROR HERE
    146:   return preview;
    147: }

Component Stack:
  PromptCanvas
    └─ PromptOptimizerContainer
       └─ App
```

### Backend Error
```javascript
TypeError: Cannot read property 'mode' of undefined
  at PromptOptimizationService.js:234:15
    231: async optimizePrompt(input, options) {
    232:   try {
    233:     const cacheKey = this.generateCacheKey(input, options);
    234:     const mode = options.mode.toLowerCase();  ← ERROR HERE
    235:     return await this.optimize(input, mode);
    236:   }

Request Context:
  POST /api/optimize
  Request ID: abc-123-def
  User: user@example.com
```

## Source Maps (Production)

In **production builds**, stack traces show:

✅ Original source files (not minified)
✅ Original line numbers
✅ Original variable names
✅ Full source code

This is because Vite automatically uploads source maps to Sentry during build.

### How It Works

```bash
npm run build
```

1. Vite generates source maps (.map files)
2. Sentry plugin uploads maps to Sentry
3. Maps are deleted from public build
4. Sentry uses maps to decode stack traces
5. You see readable traces in dashboard

## Troubleshooting

### Stack Traces Look Minified?

**Check 1:** Source maps enabled
```javascript
// vite.config.js
build: {
  sourcemap: true  ← Should be true
}
```

**Check 2:** Source maps uploaded
```bash
NODE_ENV=production npm run build
# Look for: "Uploading source maps to Sentry"
```

**Check 3:** Release configured
```bash
# .env
VITE_APP_VERSION=1.0.0  ← Should match build
```

### Missing Stack Frames?

This is normal. Sentry filters out:
- Browser internal frames
- Node.js internal frames
- React internal frames
- Unnecessary noise

Click "Show all frames" to see everything.

## What's Already Configured

### Frontend Stack Tracing
✅ `client/src/config/sentry.js` - Sentry init with source maps
✅ `client/src/components/ErrorBoundary.jsx` - React component stacks
✅ `config/build/vite.config.js` - Source map upload plugin

### Backend Stack Tracing
✅ `server/src/config/sentry.js` - Sentry init
✅ `server/index.js` - Error handler integration

### No Additional Setup Needed

Stack tracing is **fully operational** right now!

Just trigger an error and check your Sentry dashboard.

---

## Summary

✅ Stack traces are working
✅ Source maps are configured
✅ Both frontend and backend covered
✅ Production-ready

**Test it:** Run `open test-sentry.html` and click any error button!

