# Manual Testing Guide for Logging Implementation

## Quick Start

This guide provides step-by-step instructions for manually testing the logging implementation.

---

## Prerequisites

- Application running locally
- Access to terminal and browser console
- `.env` file configured

---

## Test 1: Backend Logging with Debug Level

### Steps:

1. **Set environment variable**:
   ```bash
   export LOG_LEVEL=debug
   ```

2. **Start the backend**:
   ```bash
   npm run dev
   ```

3. **Verify startup logs**:
   - Look for colorized output (development mode)
   - Verify server startup messages
   - Check for any errors

4. **Make an API request**:
   ```bash
   curl -X POST http://localhost:3000/api/enhance \
     -H "Content-Type: application/json" \
     -d '{"text": "test prompt"}'
   ```

5. **Check logs for**:
   - ✅ Request received log with requestId
   - ✅ Operation start log (debug level)
   - ✅ Operation completion log with duration
   - ✅ Response sent log with status code

### Expected Output:
```
[DEBUG] Starting enhance operation { operation: 'enhance', requestId: 'req-123' }
[INFO] Enhance operation completed { operation: 'enhance', duration: 234, requestId: 'req-123' }
[DEBUG] HTTP Request { method: 'POST', path: '/api/enhance', statusCode: 200, duration: 235 }
```

---

## Test 2: Frontend Logging with Debug Level

### Steps:

1. **Set environment variables**:
   ```bash
   export VITE_DEBUG_LOGGING=true
   export VITE_LOG_LEVEL=debug
   ```

2. **Start the frontend**:
   ```bash
   cd client && npm run dev
   ```

3. **Open browser and navigate to app**:
   ```
   http://localhost:5173
   ```

4. **Open browser console** (F12 or Cmd+Option+I)

5. **Perform actions**:
   - Enter a prompt
   - Click "Get Suggestions"
   - Edit a span
   - Save the prompt

6. **Check console for**:
   - ✅ Styled log messages with colors
   - ✅ Component names in brackets
   - ✅ Operation names and metadata
   - ✅ Duration measurements

### Expected Output:
```
[trace-abc123][PromptOptimizerContainer] Component mounted { props: {...} }
[trace-abc123][PromptOptimizerContainer] Fetching suggestions { promptLength: 45 }
[trace-abc123][PromptOptimizerContainer] Suggestions fetched { duration: 1234, count: 5 }
```

---

## Test 3: Log Export Functionality

### Steps:

1. **With frontend running and console open**:

2. **Generate some logs** by using the app

3. **Export logs**:
   ```javascript
   window.__logger.exportLogs()
   ```

4. **Verify output**:
   - ✅ Returns JSON string
   - ✅ Contains array of log entries
   - ✅ Each entry has: level, message, timestamp, meta

5. **Check stored logs**:
   ```javascript
   window.__logger.getStoredLogs()
   ```

6. **Clear logs**:
   ```javascript
   window.__logger.clearStoredLogs()
   ```

### Expected Output:
```json
[
  {
    "level": "info",
    "message": "Suggestions fetched",
    "timestamp": "2025-12-05T10:30:00.000Z",
    "traceId": "trace-abc123",
    "context": "PromptOptimizerContainer",
    "meta": {
      "duration": 1234,
      "count": 5
    }
  }
]
```

---

## Test 4: Error Logging

### Steps:

1. **Trigger an error** (e.g., invalid API request):
   ```bash
   curl -X POST http://localhost:3000/api/enhance \
     -H "Content-Type: application/json" \
     -d '{"invalid": "data"}'
   ```

2. **Check backend logs for**:
   - ✅ Error log with error message
   - ✅ Stack trace included
   - ✅ Request context (requestId, path, method)
   - ✅ Duration measurement

3. **Trigger frontend error** (e.g., network failure):
   - Disconnect network
   - Try to fetch suggestions
   - Reconnect network

4. **Check browser console for**:
   - ✅ Error log in red
   - ✅ Error name and message
   - ✅ Stack trace (in development)
   - ✅ Component context

### Expected Output:

**Backend**:
```
[ERROR] Enhance operation failed {
  operation: 'enhance',
  duration: 45,
  requestId: 'req-123',
  err: {
    message: 'Invalid request data',
    stack: '...',
    name: 'ValidationError'
  }
}
```

**Frontend**:
```
[ErrorBoundary] Component error {
  errorName: 'TypeError',
  errorMessage: 'Cannot read property...',
  stack: '...',
  component: 'PromptOptimizerContainer'
}
```

---

## Test 5: Sensitive Data Protection

### Steps:

1. **Make authenticated request**:
   ```bash
   curl -X POST http://localhost:3000/api/enhance \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer secret-token-123" \
     -d '{"text": "test"}'
   ```

2. **Check logs for**:
   - ✅ Authorization header is `[REDACTED]`
   - ✅ No token values visible
   - ✅ Request logged with sanitized headers

3. **Check for other sensitive data**:
   ```bash
   grep -r "password\|token\|apiKey" server.log
   ```
   - ✅ Should only find sanitized/redacted values

### Expected Output:
```
[DEBUG] Request received {
  headers: {
    'content-type': 'application/json',
    'authorization': '[REDACTED]'
  }
}
```

---

## Test 6: Timing Accuracy

### Steps:

1. **Make a request and note the duration**:
   ```bash
   time curl -X POST http://localhost:3000/api/enhance \
     -H "Content-Type: application/json" \
     -d '{"text": "test prompt"}'
   ```

2. **Check log duration**:
   - ✅ Duration in logs should match actual time
   - ✅ Duration in milliseconds
   - ✅ Rounded to nearest millisecond

3. **Verify frontend timing**:
   - Open browser console
   - Perform an action
   - Check duration in logs
   - ✅ Should be reasonable (e.g., API call ~100-2000ms)

### Expected Output:
```
[INFO] Operation completed { duration: 1234 }
```
(Where 1234ms ≈ actual time taken)

---

## Test 7: Log Levels

### Steps:

1. **Test different log levels**:

   **Debug level** (see everything):
   ```bash
   LOG_LEVEL=debug npm run dev
   ```
   - ✅ See debug, info, warn, error logs

   **Info level** (production default):
   ```bash
   LOG_LEVEL=info npm run dev
   ```
   - ✅ See info, warn, error logs
   - ✅ No debug logs

   **Warn level**:
   ```bash
   LOG_LEVEL=warn npm run dev
   ```
   - ✅ See warn, error logs
   - ✅ No debug or info logs

   **Error level**:
   ```bash
   LOG_LEVEL=error npm run dev
   ```
   - ✅ See only error logs

2. **Verify frontend log levels**:
   ```bash
   VITE_LOG_LEVEL=info npm run dev
   ```
   - ✅ Check browser console for appropriate logs

---

## Test 8: Production Mode

### Steps:

1. **Build and run in production mode**:
   ```bash
   NODE_ENV=production npm run build
   NODE_ENV=production npm start
   ```

2. **Check logs for**:
   - ✅ JSON format (not pretty-printed)
   - ✅ Default log level is 'info'
   - ✅ No debug logs
   - ✅ Structured output

### Expected Output:
```json
{"level":"info","time":"2025-12-05T10:30:00.000Z","service":"EnhancementService","operation":"enhance","duration":1234,"msg":"Operation completed"}
```

---

## Test 9: Request Correlation

### Steps:

1. **Make a request and note the requestId**:
   ```bash
   curl -v -X POST http://localhost:3000/api/enhance \
     -H "Content-Type: application/json" \
     -d '{"text": "test"}'
   ```

2. **Check logs for**:
   - ✅ Same requestId in all logs for that request
   - ✅ Request received log
   - ✅ Operation logs
   - ✅ Response sent log

3. **Verify frontend traceId**:
   - Open browser console
   - Perform an action
   - ✅ Check that related logs share the same traceId

### Expected Output:
```
[INFO] Request received { requestId: 'req-abc123' }
[DEBUG] Starting operation { requestId: 'req-abc123', operation: 'enhance' }
[INFO] Operation completed { requestId: 'req-abc123', duration: 234 }
[DEBUG] HTTP Request { requestId: 'req-abc123', statusCode: 200 }
```

---

## Test 10: Console Statement Check

### Steps:

1. **Search for console statements**:
   ```bash
   # Backend
   grep -rn "console\.\(log\|warn\|error\|debug\)" server/src \
     --include="*.ts" --include="*.js" | \
     grep -v "node_modules" | grep -v "\.test\."
   
   # Frontend
   grep -rn "console\.\(log\|warn\|error\|debug\)" client/src \
     --include="*.ts" --include="*.tsx" | \
     grep -v "node_modules" | grep -v "\.test\."
   ```

2. **Verify results**:
   - ✅ Only configuration/initialization files
   - ✅ No console statements in business logic
   - ✅ No console statements in services/routes/components

---

## Troubleshooting

### Issue: No logs appearing

**Solution:**
- Check LOG_LEVEL environment variable
- Verify logger is imported correctly
- Check that log level allows the message (e.g., debug logs won't show if level is 'info')

### Issue: Logs not stored in frontend

**Solution:**
- Check VITE_DEBUG_LOGGING is set to 'true'
- Verify running in development mode
- Check browser localStorage is not disabled

### Issue: Sensitive data in logs

**Solution:**
- Use sanitizeHeaders() for HTTP headers
- Use sanitizeUserData() for user objects
- Use redactSensitiveFields() for request bodies

### Issue: Timing measurements seem wrong

**Solution:**
- Verify using performance.now() not Date.now()
- Check that startTime is captured before operation
- Ensure duration is calculated after operation completes

---

## Checklist

Use this checklist to verify all manual tests:

- [ ] Backend logging with debug level works
- [ ] Frontend logging with debug level works
- [ ] Log export functionality works
- [ ] Error logging includes stack traces
- [ ] Sensitive data is properly sanitized
- [ ] Timing measurements are accurate
- [ ] Log levels work correctly
- [ ] Production mode uses JSON format
- [ ] Request correlation works (requestId/traceId)
- [ ] No console statements in production code

---

## Success Criteria

All tests should pass with:
- ✅ Logs appear in expected format
- ✅ All metadata fields present
- ✅ No sensitive data exposed
- ✅ Timing measurements accurate
- ✅ Error logs include full context
- ✅ Log levels work as expected
- ✅ Export functionality works
- ✅ Request correlation works

---

## Next Steps

After completing manual testing:
1. Document any issues found
2. Update validation report
3. Mark task 10.2 as complete
4. Consider adding automated tests for logging
