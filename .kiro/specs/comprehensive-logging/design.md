# Design Document

## Overview

This design outlines the implementation of comprehensive structured logging across the entire Prompt Builder codebase. The implementation will follow the established logging patterns defined in `docs/architecture/typescript/LOGGING_PATTERNS.md` and ensure consistent, production-ready logging throughout both frontend (React/TypeScript) and backend (Node.js/TypeScript) code.

The primary goals are to:
1. Replace all console statements with proper structured logging
2. Fix incorrect logger method signatures (the common bug of passing Error objects to warn/info/debug)
3. Add logging to files that currently lack it
4. Ensure consistent metadata and context across all logs
5. Enable effective debugging, monitoring, and tracing in production

## Architecture

### Current State

**Backend:**
- Logger infrastructure exists (`server/src/infrastructure/Logger.ts`) using Pino
- Many services already import and use the logger
- Some files still use console statements
- Inconsistent logging patterns across services
- Some services lack logging entirely

**Frontend:**
- LoggingService exists (`client/src/services/LoggingService.ts`)
- useDebugLogger hook available for React components
- Many components use console statements instead of logger
- Inconsistent logging in hooks and utilities

### Target Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Layer                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Services   │  │    Routes    │  │  Components  │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │              │
│         └──────────────────┼──────────────────┘              │
│                            │                                 │
├────────────────────────────┼─────────────────────────────────┤
│                     Logging Layer                            │
│         ┌──────────────────┴──────────────────┐             │
│         │                                      │             │
│    ┌────▼─────┐                         ┌─────▼────┐        │
│    │  Backend │                         │ Frontend │        │
│    │  Logger  │                         │  Logger  │        │
│    │  (Pino)  │                         │ Service  │        │
│    └────┬─────┘                         └─────┬────┘        │
│         │                                     │              │
│    ┌────▼─────────────┐              ┌───────▼──────────┐   │
│    │ Child Loggers    │              │ Context Loggers  │   │
│    │ (Service Context)│              │ (Component Name) │   │
│    └──────────────────┘              └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Logging Flow

1. **Service/Component Initialization**: Create child logger with context
2. **Operation Start**: Log debug message with operation name and input summary
3. **Operation Progress**: Log debug messages for significant steps
4. **Operation Success**: Log info message with duration and result summary
5. **Operation Failure**: Log error message with Error object, duration, and context
6. **Handled Errors**: Log warn message with error details in meta object

## Components and Interfaces

### 1. Backend Logger Interface

```typescript
interface ILogger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, error?: Error, meta?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): ILogger;
}
```

**Key Points:**
- Only `error()` accepts an Error object as the second parameter
- All other methods take only `(message, meta)`
- Child loggers inherit parent context

### 2. Frontend Logger Interface

```typescript
interface LoggingService {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, error?: Error, meta?: Record<string, unknown>): void;
  child(context: string): ContextLogger;
  startTimer(operationId: string): void;
  endTimer(operationId: string): number | undefined;
  setTraceId(traceId: string): void;
  clearTraceId(): void;
}
```

### 3. Service Logging Pattern

All backend services should follow this pattern:

```typescript
export class ExampleService {
  private readonly log: ILogger;
  
  constructor(dependencies) {
    this.log = logger.child({ service: 'ExampleService' });
  }
  
  async operation(params: Params): Promise<Result> {
    const startTime = performance.now();
    const operation = 'operation';
    
    this.log.debug(`Starting ${operation}`, {
      operation,
      paramSummary: summarize(params),
    });
    
    try {
      const result = await this.doWork(params);
      
      this.log.info(`${operation} completed`, {
        operation,
        duration: Math.round(performance.now() - startTime),
        resultSummary: summarize(result),
      });
      
      return result;
    } catch (error) {
      this.log.error(`${operation} failed`, error as Error, {
        operation,
        duration: Math.round(performance.now() - startTime),
      });
      throw error;
    }
  }
}
```

### 4. Route Logging Pattern

All API routes should follow this pattern:

```typescript
router.post('/endpoint', async (req, res) => {
  const startTime = performance.now();
  const operation = 'endpointOperation';
  const requestId = req.id;
  
  logger.debug(`Starting ${operation}`, {
    operation,
    requestId,
    bodySize: JSON.stringify(req.body).length,
  });
  
  try {
    const result = await service.process(req.body);
    
    logger.info(`${operation} completed`, {
      operation,
      requestId,
      duration: Math.round(performance.now() - startTime),
      statusCode: 200,
    });
    
    res.json(result);
  } catch (error) {
    logger.error(`${operation} failed`, error as Error, {
      operation,
      requestId,
      duration: Math.round(performance.now() - startTime),
    });
    
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

### 5. Component Logging Pattern

React components should use the useDebugLogger hook:

```typescript
function ExampleComponent(props: Props) {
  const debug = useDebugLogger('ExampleComponent', props);
  
  useEffect(() => {
    debug.logEffect('Data fetch triggered');
    debug.startTimer('fetchData');
    
    fetchData()
      .then(() => {
        debug.endTimer('fetchData', 'Data fetched successfully');
      })
      .catch((error) => {
        debug.logError('Data fetch failed', error);
      });
  }, [dependency]);
  
  const handleAction = async () => {
    debug.logAction('buttonClick', { buttonId: 'submit' });
    
    try {
      await submitForm();
    } catch (error) {
      debug.logError('Form submission failed', error);
    }
  };
  
  return <div>...</div>;
}
```

### 6. Hook Logging Pattern

Custom hooks should create a child logger:

```typescript
export function useCustomHook(params: Params) {
  const log = logger.child('useCustomHook');
  
  const operation = useCallback(async () => {
    log.debug('Operation started', { params: summarize(params) });
    logger.startTimer('customOperation');
    
    try {
      const result = await apiCall(params);
      const duration = logger.endTimer('customOperation');
      
      log.info('Operation completed', { duration, resultCount: result.length });
      return result;
    } catch (error) {
      logger.endTimer('customOperation');
      log.error('Operation failed', error as Error);
      throw error;
    }
  }, [params]);
  
  return { operation };
}
```

## Data Models

### Standard Metadata Fields

All logs should include these standard fields where applicable:

```typescript
interface StandardMetadata {
  // Always included via child logger
  service?: string;           // Backend: service name
  component?: string;         // Frontend: component name
  
  // Always included in operation logs
  operation: string;          // Method/function name
  
  // Timing
  duration?: number;          // Milliseconds (for completed operations)
  
  // Request context
  requestId?: string;         // HTTP request ID
  traceId?: string;          // Distributed trace ID
  
  // User context
  userId?: string;           // When user context exists
  
  // Business context
  [key: string]: unknown;    // Domain-specific fields
}
```

### Error Metadata

When logging errors, include:

```typescript
interface ErrorMetadata extends StandardMetadata {
  // For error() calls - Error object passed as 2nd parameter
  // Pino automatically extracts: message, stack, name
  
  // For warn/info/debug with error context
  error?: string;            // error.message
  errorName?: string;        // error.name
  stack?: string;            // error.stack (if needed)
}
```

## Error Handling

### Critical: Correct Method Signatures

This is the most common logging bug in the codebase:

```typescript
// ❌ WRONG - warn() does NOT accept Error as 2nd argument
log.warn('Connection failed', error, { retryCount: 3 });

// ✅ CORRECT - Put error info in meta object
log.warn('Connection failed', {
  error: error.message,
  errorName: error.name,
  retryCount: 3,
});

// ✅ CORRECT - If it's actually a failure, use error()
log.error('Connection failed', error, { retryCount: 3 });
```

### Error Logging Decision Tree

```
Is the operation a FAILURE that needs attention?
├── YES → Use error(message, error, meta)
└── NO → Is it unexpected/degraded behavior?
         ├── YES → Use warn(message, { error: e.message, ...meta })
         └── NO → Is it a significant business event?
                  ├── YES → Use info(message, meta)
                  └── NO → Use debug(message, meta)
```

### Error Context Pattern

Add context at each level of the call stack:

```typescript
// Controller level
async function handleRequest(req: Request): Promise<Response> {
  try {
    return await service.process(req.body);
  } catch (error) {
    logger.error('Request processing failed', error as Error, {
      requestId: req.id,
      path: req.path,
      method: req.method,
    });
    throw error;
  }
}

// Service level
async function process(data: Data): Promise<Result> {
  try {
    return await repository.save(data);
  } catch (error) {
    this.log.error('Data processing failed', error as Error, {
      operation: 'process',
      dataSize: JSON.stringify(data).length,
    });
    throw error;
  }
}
```

## Testing Strategy

### Unit Tests

Each logging implementation should be verified with unit tests:

```typescript
describe('ServiceLogging', () => {
  let mockLogger: jest.Mocked<ILogger>;
  let service: ExampleService;
  
  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      child: jest.fn().mockReturnThis(),
    };
    service = new ExampleService(mockLogger);
  });
  
  it('should log operation start', async () => {
    await service.operation(params);
    
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Starting'),
      expect.objectContaining({ operation: 'operation' })
    );
  });
  
  it('should log operation success with duration', async () => {
    await service.operation(params);
    
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('completed'),
      expect.objectContaining({
        operation: 'operation',
        duration: expect.any(Number),
      })
    );
  });
  
  it('should log errors with Error object', async () => {
    const error = new Error('Test error');
    jest.spyOn(service as any, 'doWork').mockRejectedValue(error);
    
    await expect(service.operation(params)).rejects.toThrow();
    
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('failed'),
      error,
      expect.objectContaining({ operation: 'operation' })
    );
  });
});
```

### Integration Tests

Verify logging in real scenarios:

```typescript
describe('API Logging Integration', () => {
  it('should log request/response cycle', async () => {
    const response = await request(app)
      .post('/api/endpoint')
      .send(testData);
    
    expect(response.status).toBe(200);
    
    // Verify logs were written (check log output or mock)
    expect(logOutput).toContain('Starting endpointOperation');
    expect(logOutput).toContain('endpointOperation completed');
  });
});
```

### Manual Testing

1. **Enable debug logging**: Set `LOG_LEVEL=debug` or `VITE_DEBUG_LOGGING=true`
2. **Trigger operations**: Exercise all major code paths
3. **Verify log output**: Check that logs include:
   - Proper log levels
   - Structured metadata
   - Duration measurements
   - Error details with stack traces
4. **Check browser console**: For frontend, verify logs appear with proper styling
5. **Export logs**: Use `window.__logger.exportLogs()` to verify log storage

## Implementation Phases

### Phase 1: Console Statement Elimination (Backend)

**Scope**: Replace all console statements in backend code with proper logger calls

**Files to Update**:
- All files in `server/src/` that use console.log/warn/error/debug
- Focus on services, routes, middleware, utilities

**Pattern**:
```typescript
// Before
console.log('Processing request');
console.error('Error:', error);

// After
logger.debug('Processing request', { operation: 'process' });
logger.error('Processing failed', error, { operation: 'process' });
```

### Phase 2: Console Statement Elimination (Frontend)

**Scope**: Replace all console statements in frontend code with proper logger calls

**Files to Update**:
- Components: `client/src/components/**/*.tsx`
- Hooks: `client/src/hooks/**/*.ts`
- Services: `client/src/services/**/*.ts`
- Features: `client/src/features/**/*.tsx`

**Pattern**:
```typescript
// Before
console.log('Component mounted');
console.error('Error fetching data:', error);

// After
const log = logger.child('ComponentName');
log.debug('Component mounted');
log.error('Data fetch failed', error);
```

### Phase 3: Fix Incorrect Logger Signatures

**Scope**: Find and fix all instances where Error objects are passed to warn/info/debug methods

**Search Pattern**: Look for patterns like:
- `log.warn('...', error, ...)`
- `log.info('...', error, ...)`
- `log.debug('...', error, ...)`
- `logger.warn('...', error, ...)`

**Fix Pattern**:
```typescript
// Before
log.warn('Request failed', error, { context });

// After
log.warn('Request failed', {
  error: error.message,
  errorName: error.name,
  ...context,
});
```

### Phase 4: Add Logging to Services

**Scope**: Add comprehensive logging to all backend services that lack it

**Services to Update**:
- All files in `server/src/services/` without proper logging
- Focus on: operation start, completion, failure, timing

**Pattern**: Follow the Service Logging Pattern defined above

### Phase 5: Add Logging to Routes

**Scope**: Ensure all API routes have request/response logging

**Routes to Update**:
- All files in `server/src/routes/`
- Ensure: request received, response sent, errors, timing

**Pattern**: Follow the Route Logging Pattern defined above

### Phase 6: Add Logging to Components

**Scope**: Add logging to complex React components

**Components to Update**:
- Components with side effects (API calls, state management)
- Components with error boundaries
- Components with complex user interactions

**Pattern**: Use useDebugLogger hook

### Phase 7: Add Logging to Hooks

**Scope**: Add logging to custom React hooks

**Hooks to Update**:
- All hooks in `client/src/hooks/`
- Feature-specific hooks in `client/src/features/*/hooks/`

**Pattern**: Follow the Hook Logging Pattern defined above

### Phase 8: Sensitive Data Audit

**Scope**: Audit all logging calls to ensure no sensitive data is logged

**Check for**:
- Passwords, tokens, API keys
- Credit card numbers
- Full email addresses (use domain only)
- Authorization headers
- Cookie values

**Fix Pattern**:
```typescript
// Before
logger.debug('Request', { headers: req.headers });

// After
logger.debug('Request', {
  headers: sanitizeHeaders(req.headers),
});
```

### Phase 9: Metadata Standardization

**Scope**: Ensure all logs include standard metadata fields

**Standard Fields**:
- `operation`: Always include
- `duration`: For timed operations
- `requestId`: For HTTP requests
- `service`/`component`: Via child logger

**Pattern**: Review all logging calls and add missing standard fields

### Phase 10: Testing and Validation

**Scope**: Verify logging implementation

**Tasks**:
1. Run application with `LOG_LEVEL=debug`
2. Exercise all major code paths
3. Verify log output format and content
4. Check for any remaining console statements
5. Verify no sensitive data in logs
6. Test log export functionality (frontend)
7. Verify metrics collection (if applicable)

## File Organization

### Backend Files Requiring Updates

Based on grep search, these files need console statement removal:
- Load test files (k6-*.js) - Keep as-is (test scripts)
- No backend console statements found in production code

### Frontend Files Requiring Updates

Console statements found in:
- `client/src/components/PromptEnhancementEditor.tsx`
- `client/src/components/SharedPrompt.tsx`
- `client/src/components/icons/Icon.tsx`
- `client/src/components/icons/iconMapping.ts`
- `client/src/components/VideoConceptBuilder.tsx`
- `client/src/components/VideoConceptBuilder/hooks/*.ts` (multiple files)
- `client/src/components/DebugButton.tsx`
- `client/src/components/SuggestionsPanel/hooks/useCustomRequest.ts`
- `client/src/components/ErrorBoundary/ErrorBoundary.tsx`
- `client/src/hooks/usePromptDebugger.ts`
- `client/src/hooks/usePromptHistory.ts`

### Services Already Using Logger

These services already import logger (verify correct usage):
- `server/src/services/VideoConceptService.ts` ✓
- `server/src/services/enhancement/EnhancementService.ts` ✓
- `server/src/services/quality-feedback/**/*.ts`
- `server/src/services/video-concept/**/*.ts`
- `server/src/services/cache/**/*.ts`
- `server/src/services/prompt-optimization/**/*.ts`
- And many more (see grep results)

### Routes Already Using Logger

These routes already use logger (verify correct usage):
- `server/src/routes/suggestions.js` ✓
- `server/src/routes/health.routes.js` ✓

## Utility Functions

### Sanitization Helpers

```typescript
// server/src/utils/logging/sanitize.ts
export function sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
  const sanitized = { ...headers };
  const sensitiveKeys = ['authorization', 'x-api-key', 'cookie', 'set-cookie'];
  
  for (const key of sensitiveKeys) {
    if (sanitized[key.toLowerCase()]) {
      sanitized[key.toLowerCase()] = '[REDACTED]';
    }
  }
  
  return sanitized;
}

export function summarize(data: unknown, maxLength = 200): unknown {
  if (typeof data === 'string') {
    return data.length > maxLength 
      ? `${data.slice(0, maxLength)}... (${data.length} chars)`
      : data;
  }
  
  if (Array.isArray(data)) {
    return { 
      type: 'array', 
      length: data.length,
      sample: data.slice(0, 3),
    };
  }
  
  if (typeof data === 'object' && data !== null) {
    const keys = Object.keys(data);
    return {
      type: 'object',
      keys: keys.slice(0, 10),
      keyCount: keys.length,
    };
  }
  
  return data;
}
```

## Configuration

### Backend Environment Variables

```bash
# Log level: debug, info, warn, error
LOG_LEVEL=info

# Production mode (JSON output)
NODE_ENV=production
```

### Frontend Environment Variables

```bash
# Enable client-side logging
VITE_DEBUG_LOGGING=true

# Log level: debug, info, warn, error
VITE_LOG_LEVEL=debug
```

## Monitoring and Observability

### Log Aggregation

Logs should be structured for easy aggregation:

```json
{
  "level": "info",
  "time": "2025-12-05T10:30:00.000Z",
  "service": "EnhancementService",
  "operation": "getEnhancementSuggestions",
  "duration": 1234,
  "requestId": "req-abc123",
  "userId": "user-xyz789",
  "suggestionCount": 5
}
```

### Metrics Collection

Key metrics to track:
- Operation duration (P50, P95, P99)
- Error rates by service/operation
- Cache hit rates
- API call latency

### Alerting

Set up alerts for:
- Error rate > threshold
- P95 latency > threshold
- Cache hit rate < threshold
- Circuit breaker state changes

## Security Considerations

### Sensitive Data Protection

Never log:
- Passwords
- API keys / tokens
- Credit card numbers
- Full email addresses (use domain only)
- Authorization headers (redact)
- Cookie values (redact)
- Social security numbers
- Personal health information

### Log Access Control

- Restrict access to production logs
- Use role-based access control
- Audit log access
- Encrypt logs at rest and in transit

### Data Retention

- Define log retention policies
- Automatically purge old logs
- Comply with data protection regulations (GDPR, CCPA)

## Performance Considerations

### Log Volume

- Use appropriate log levels (debug only in development)
- Avoid logging in tight loops
- Aggregate batch operations
- Summarize large payloads

### Async Logging

- Pino uses async logging by default (good)
- Frontend logger stores logs in memory (limited to 500 entries)
- Consider log sampling for high-volume operations

### Impact on Latency

- Structured logging adds minimal overhead (<1ms per log)
- Avoid synchronous I/O in logging
- Use log buffering for high-throughput scenarios

## Migration Strategy

### Gradual Rollout

1. **Phase 1-2**: Console elimination (low risk)
2. **Phase 3**: Fix incorrect signatures (medium risk - requires testing)
3. **Phase 4-7**: Add new logging (low risk - additive)
4. **Phase 8-9**: Audit and standardize (low risk)
5. **Phase 10**: Validate (no code changes)

### Rollback Plan

- All changes are additive or replacements
- No breaking changes to existing functionality
- Can revert individual files if issues arise
- Monitor error rates after each phase

### Success Criteria

- Zero console statements in production code
- All services have operation logging
- All routes have request/response logging
- All errors logged with full context
- No sensitive data in logs
- Consistent metadata across all logs
- Log level configurable per environment
