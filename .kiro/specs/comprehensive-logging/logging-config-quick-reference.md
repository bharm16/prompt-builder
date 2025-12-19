# Logging Configuration Quick Reference

## Environment Variables

### Backend (Node.js)

```bash
# Set log level (optional)
LOG_LEVEL=debug|info|warn|error

# Set environment (affects defaults)
NODE_ENV=development|production
```

**Defaults**:
- Development: `LOG_LEVEL=debug`, pretty-printed output
- Production: `LOG_LEVEL=info`, JSON output

### Frontend (Vite/React)

```bash
# Enable/disable logging (optional)
VITE_DEBUG_LOGGING=true|false

# Set log level (optional)
VITE_LOG_LEVEL=debug|info|warn|error
```

**Defaults**:
- Development: Enabled, `VITE_LOG_LEVEL=debug`, stores logs
- Production: Disabled, `VITE_LOG_LEVEL=warn`, no storage

## Quick Start

### Enable Debug Logging Everywhere

```bash
# Add to .env
LOG_LEVEL=debug
VITE_DEBUG_LOGGING=true
VITE_LOG_LEVEL=debug
```

Or use the convenience script:
```bash
./scripts/enable-debug.sh
```

### Disable Debug Logging

```bash
# Add to .env
LOG_LEVEL=info
VITE_DEBUG_LOGGING=false
VITE_LOG_LEVEL=warn
```

Or use the convenience script:
```bash
./scripts/disable-debug.sh
```

## Browser Console Access

### Access the Logger

```javascript
window.__logger
```

### View Stored Logs

```javascript
window.__logger.getStoredLogs()
```

### Export Logs (for bug reports)

```javascript
window.__logger.exportLogs()
```

### Clear Stored Logs

```javascript
window.__logger.clearStoredLogs()
```

### Test Logging

```javascript
window.__logger.debug('Debug message', { test: true })
window.__logger.info('Info message', { test: true })
window.__logger.warn('Warning message', { test: true })
window.__logger.error('Error message', new Error('Test'), { test: true })
```

## Common Scenarios

### Debugging Production Issues

1. Enable debug logging temporarily:
   ```bash
   LOG_LEVEL=debug npm start
   ```

2. Check logs for the specific operation

3. Revert to info level:
   ```bash
   LOG_LEVEL=info npm start
   ```

### Debugging Frontend Issues

1. Enable debug logging in browser:
   ```javascript
   localStorage.setItem('debug', 'true')
   ```

2. Reload the page

3. Export logs:
   ```javascript
   console.log(window.__logger.exportLogs())
   ```

### Testing Log Levels

```bash
# Test each level
LOG_LEVEL=debug npm start    # See all logs
LOG_LEVEL=info npm start     # See info, warn, error
LOG_LEVEL=warn npm start     # See warn, error only
LOG_LEVEL=error npm start    # See error only
```

## Log Output Examples

### Backend Development (Pretty)

```
[2025-12-05 10:30:00] INFO: Starting operation
    service: "EnhancementService"
    operation: "getEnhancementSuggestions"
    requestId: "req-abc123"
```

### Backend Production (JSON)

```json
{
  "level": "info",
  "time": "2025-12-05T10:30:00.000Z",
  "service": "EnhancementService",
  "operation": "getEnhancementSuggestions",
  "requestId": "req-abc123",
  "msg": "Starting operation"
}
```

### Frontend Console (Styled)

```
[trace-xyz][ComponentName] Operation started { operation: 'fetchData' }
```

## Troubleshooting

### Logs Not Appearing

**Backend**:
- Check `LOG_LEVEL` is set correctly
- Verify `NODE_ENV` is set
- Check console for errors

**Frontend**:
- Check `VITE_DEBUG_LOGGING` is true
- Check `VITE_LOG_LEVEL` is appropriate
- Open browser console (F12)
- Check `window.__logger` exists

### Too Many Logs

**Backend**:
```bash
LOG_LEVEL=warn  # Only warnings and errors
```

**Frontend**:
```bash
VITE_LOG_LEVEL=warn  # Only warnings and errors
```

### Logs Not Persisting (Frontend)

- Check localStorage is enabled
- Check browser privacy settings
- Verify development mode is active
- Check storage quota

## Best Practices

1. **Development**: Use `debug` level to see everything
2. **Staging**: Use `info` level for normal operations
3. **Production**: Use `info` level, switch to `debug` for troubleshooting
4. **CI/CD**: Use `warn` level to reduce noise

## Related Documentation

- Full patterns: `docs/architecture/typescript/LOGGING_PATTERNS.md`
- Backend implementation: `server/src/infrastructure/Logger.ts`
- Frontend implementation: `client/src/services/LoggingService.ts`
- Requirements: `.kiro/specs/comprehensive-logging/requirements.md`
- Design: `.kiro/specs/comprehensive-logging/design.md`
