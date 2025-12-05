# Frontend Logging Quick Reference

## Environment Variables

### VITE_DEBUG_LOGGING
Enable or disable frontend logging.

```bash
# Enable logging in production
VITE_DEBUG_LOGGING=true

# Disable logging in development
VITE_DEBUG_LOGGING=false
```

**Default**: `true` in development, `false` in production

---

### VITE_LOG_LEVEL
Set the minimum log level to display.

```bash
# Show all logs
VITE_LOG_LEVEL=debug

# Show info, warn, and error
VITE_LOG_LEVEL=info

# Show only warnings and errors
VITE_LOG_LEVEL=warn

# Show only errors
VITE_LOG_LEVEL=error
```

**Default**: `debug` in development, `warn` in production

---

## Browser Console Access

### View Stored Logs
```javascript
// Get all stored logs
window.__logger.getStoredLogs()

// Filter by level
window.__logger.getStoredLogs().filter(log => log.level === 'error')

// Get recent logs
window.__logger.getStoredLogs().slice(-10)
```

### Export Logs
```javascript
// Export as JSON string
window.__logger.exportLogs()

// Copy to clipboard
copy(window.__logger.exportLogs())

// Download as file
const logs = window.__logger.exportLogs();
const blob = new Blob([logs], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'logs.json';
a.click();
```

### Clear Logs
```javascript
// Clear all stored logs
window.__logger.clearStoredLogs()
```

### Manual Logging
```javascript
// Debug message
window.__logger.debug('Debug info', { key: 'value' })

// Info message
window.__logger.info('User action', { action: 'click' })

// Warning
window.__logger.warn('Deprecated feature used', { feature: 'oldAPI' })

// Error
window.__logger.error('Operation failed', new Error('test'), { context: 'data' })
```

### Trace ID Management
```javascript
// Generate and set trace ID
const traceId = window.__logger.generateTraceId()
window.__logger.setTraceId(traceId)

// All subsequent logs will include this trace ID

// Clear trace ID
window.__logger.clearTraceId()
```

### Operation Timing
```javascript
// Start timing
window.__logger.startTimer('myOperation')

// Do work...

// End timing and get duration
const duration = window.__logger.endTimer('myOperation')
console.log(`Operation took ${duration}ms`)
```

### Create Child Logger
```javascript
// Create context-specific logger
const componentLogger = window.__logger.child('MyComponent')

// All logs from this logger will include [MyComponent] prefix
componentLogger.info('Component mounted')
componentLogger.debug('State updated', { newState: {...} })
```

---

## Log Storage

### Storage Location
Logs are stored in `localStorage` under the key `prompt_builder_logs`.

### Storage Limits
- Maximum 500 log entries
- Oldest logs automatically removed when limit reached
- Only enabled in development by default

### Manual Storage Access
```javascript
// Get raw storage
const rawLogs = localStorage.getItem('prompt_builder_logs')
const logs = JSON.parse(rawLogs)

// Clear storage
localStorage.removeItem('prompt_builder_logs')
```

---

## Log Entry Format

Each log entry contains:

```typescript
{
  level: 'debug' | 'info' | 'warn' | 'error',
  message: string,
  timestamp: string,  // ISO 8601 format
  traceId?: string,   // Optional trace ID
  context?: string,   // Optional context (from child logger)
  meta?: {            // Optional metadata
    [key: string]: unknown
  },
  duration?: number   // Optional duration in milliseconds
}
```

---

## Console Output Styling

Logs appear in the browser console with color coding:

- **Debug**: Gray text (`#6b7280`)
- **Info**: Blue text (`#3b82f6`)
- **Warn**: Orange bold text (`#f59e0b`)
- **Error**: Red bold text (`#ef4444`)

Format: `[traceId][context] message`

Example: `[trace-abc][MyComponent] User clicked button`

---

## Common Use Cases

### Debugging a Component
```javascript
// In browser console
const log = window.__logger.child('MyComponent')
log.debug('Checking component state')

// View all logs from this component
window.__logger.getStoredLogs()
  .filter(log => log.context === 'MyComponent')
```

### Tracking a Request
```javascript
// Generate trace ID
const traceId = window.__logger.generateTraceId()
window.__logger.setTraceId(traceId)

// Make request (all logs will include trace ID)
await fetch('/api/endpoint')

// View all logs for this request
window.__logger.getStoredLogs()
  .filter(log => log.traceId === traceId)

// Clear trace ID
window.__logger.clearTraceId()
```

### Performance Debugging
```javascript
// Time an operation
window.__logger.startTimer('dataFetch')
await fetchData()
const duration = window.__logger.endTimer('dataFetch')

// View all operations with timing
window.__logger.getStoredLogs()
  .filter(log => log.duration !== undefined)
  .sort((a, b) => b.duration - a.duration)
```

### Bug Report
```javascript
// Export logs for bug report
const logs = window.__logger.exportLogs()

// Copy to clipboard
copy(logs)

// Or download as file
const blob = new Blob([logs], { type: 'application/json' })
const url = URL.createObjectURL(blob)
const a = document.createElement('a')
a.href = url
a.download = `logs-${new Date().toISOString()}.json`
a.click()
```

---

## Testing Configuration

### Test in Development
```bash
# Start dev server
npm run dev

# In browser console
window.__logger.info('Test log')
window.__logger.getStoredLogs()  // Should show the log
```

### Test in Production Build
```bash
# Build and preview
npm run build
npm run preview

# In browser console
window.__logger  // Should be defined but disabled
window.__logger.info('Test')  // Should not appear (unless VITE_DEBUG_LOGGING=true)
```

### Test with Environment Variables
```bash
# Enable debug logging in production
VITE_DEBUG_LOGGING=true npm run build
npm run preview

# Set specific log level
VITE_LOG_LEVEL=info npm run dev
```

---

## Troubleshooting

### Logs Not Appearing
1. Check if logging is enabled: `window.__logger` should be defined
2. Check log level: `window.__logger.getStoredLogs()` to see if logs are stored
3. Check environment variables in `.env` file
4. Restart dev server after changing environment variables

### Storage Full
```javascript
// Clear old logs
window.__logger.clearStoredLogs()

// Or increase limit (requires code change)
// In LoggingService.ts: maxStoredLogs: 1000
```

### Performance Issues
1. Reduce log level in production: `VITE_LOG_LEVEL=warn`
2. Disable storage: Set `persistToStorage: false` in config
3. Avoid logging in tight loops

---

## Best Practices

1. **Use appropriate log levels**:
   - `debug`: Detailed diagnostic information
   - `info`: Significant events (user actions, API calls)
   - `warn`: Unexpected but handled situations
   - `error`: Failures that need attention

2. **Include context**:
   - Use child loggers for components/services
   - Add relevant metadata to logs
   - Use trace IDs for request correlation

3. **Protect sensitive data**:
   - Never log passwords, tokens, or API keys
   - Sanitize user data before logging
   - Use summarization for large payloads

4. **Performance**:
   - Use debug level for verbose logs
   - Avoid logging in render loops
   - Use timing for performance-critical operations

5. **Production**:
   - Keep logging disabled by default
   - Use warn/error levels only
   - Monitor log volume
   - Set up log aggregation for analysis
