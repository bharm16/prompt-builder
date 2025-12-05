# Logging Patterns Guide

## Overview

This document defines the logging standards for the Prompt Builder codebase. Proper logging enables debugging, monitoring, and tracing across the full stack. Inconsistent or missing logs make debugging impossible.

---

## Why Structured Logging?

```typescript
// ❌ USELESS - No context, no structure
console.log('error');
console.log(data);
console.log('done');

// ❌ UNSTRUCTURED - Hard to parse, grep, or alert on
console.log(`User ${userId} failed to process prompt at ${new Date()}`);

// ✅ STRUCTURED - Queryable, filterable, actionable
logger.error('Prompt processing failed', error, {
  userId,
  promptLength: prompt.length,
  service: 'EnhancementService',
  operation: 'generateSuggestions',
});
```

Structured logs enable:
- **Filtering** by severity, service, operation
- **Alerting** on error rates
- **Tracing** requests across services
- **Debugging** production issues without code changes

---

## 1. Logger Imports

### Backend (Server)

```typescript
// ✅ CORRECT - Use the singleton logger
import { logger } from '@infrastructure/Logger';

// ✅ CORRECT - Create child logger with context
const log = logger.child({ service: 'EnhancementService' });

// ❌ FORBIDDEN - Never use console directly
console.log('debug info');
console.error('something failed');
```

### Frontend (Client)

```typescript
// ✅ CORRECT - Use the logging service
import { logger } from '@/services/LoggingService';

// ✅ CORRECT - Create contextual logger
const log = logger.child('ComponentName');

// ❌ FORBIDDEN - Avoid raw console in production code
console.log('debugging');
```

---

## 2. Log Levels

### Level Definitions

| Level | When to Use | Production Visibility |
|-------|-------------|----------------------|
| `error` | Operation failed, needs attention | ✅ Always visible |
| `warn` | Potential issue, degraded behavior | ✅ Always visible |
| `info` | Significant business events | ✅ Always visible |
| `debug` | Detailed debugging information | ❌ Dev only |

### Choosing the Right Level

```typescript
// ERROR - Something broke, needs investigation
logger.error('Failed to generate suggestions', error, {
  userId,
  promptId,
});

// WARN - Something unexpected but handled
logger.warn('Falling back to default model', {
  requestedModel: 'gpt-4',
  fallbackModel: 'gpt-3.5-turbo',
  reason: 'Rate limited',
});

// INFO - Significant business event
logger.info('Prompt optimization completed', {
  userId,
  duration: 1234,
  suggestionCount: 5,
});

// DEBUG - Development/troubleshooting details
logger.debug('Processing request', {
  payload: summarize(payload),
  headers: sanitize(headers),
});
```

### What NOT to Log at Each Level

```typescript
// ❌ ERROR for expected conditions
logger.error('User not found'); // Use warn or just return 404

// ❌ INFO for debugging details
logger.info('Entering function processData', { args }); // Use debug

// ❌ DEBUG for sensitive data
logger.debug('User credentials', { password }); // NEVER log secrets

// ❌ Logging loop iterations
for (const item of items) {
  logger.info('Processing item', { item }); // Will spam logs
}

// ✅ Log aggregated results instead
logger.info('Batch processing complete', { 
  total: items.length, 
  successful: successCount,
  failed: failCount,
});
```

---

## 3. Structured Metadata

### Rule: Always Include Context

```typescript
// ❌ BAD - No context
logger.error('Request failed');

// ❌ BAD - Message contains data (hard to parse)
logger.error(`Request ${requestId} failed for user ${userId}`);

// ✅ GOOD - Structured metadata
logger.error('Request failed', error, {
  requestId,
  userId,
  endpoint: '/api/enhance',
  duration: 1234,
});
```

### Standard Metadata Fields

| Field | Type | When to Include |
|-------|------|-----------------|
| `service` | string | Always (via child logger) |
| `operation` | string | Always |
| `userId` | string | When user context exists |
| `requestId` | string | For HTTP requests |
| `traceId` | string | For distributed tracing |
| `duration` | number | For timed operations |
| `error` | Error | When logging errors |

### Metadata Best Practices

```typescript
// ✅ Create child logger with service context
class EnhancementService {
  private readonly log = logger.child({ service: 'EnhancementService' });
  
  async generateSuggestions(params: Params): Promise<Result> {
    const startTime = Date.now();
    
    this.log.debug('Starting suggestion generation', {
      operation: 'generateSuggestions',
      promptLength: params.prompt.length,
      category: params.category,
    });
    
    try {
      const result = await this.process(params);
      
      this.log.info('Suggestions generated', {
        operation: 'generateSuggestions',
        duration: Date.now() - startTime,
        suggestionCount: result.suggestions.length,
      });
      
      return result;
    } catch (error) {
      this.log.error('Suggestion generation failed', error as Error, {
        operation: 'generateSuggestions',
        duration: Date.now() - startTime,
        params: summarize(params),
      });
      throw error;
    }
  }
}
```

---

## 4. Error Logging

### Rule: Always Include Stack Traces

```typescript
// ❌ BAD - Lost stack trace
try {
  await riskyOperation();
} catch (error) {
  logger.error('Operation failed'); // What error? Where?
}

// ❌ BAD - Only message, no stack
try {
  await riskyOperation();
} catch (error) {
  logger.error(`Operation failed: ${(error as Error).message}`);
}

// ✅ GOOD - Full error with stack trace
try {
  await riskyOperation();
} catch (error) {
  logger.error('Operation failed', error as Error, {
    operation: 'riskyOperation',
    context: 'processing batch',
  });
}
```

### Error Context Pattern

```typescript
// ✅ Add context at each level of the call stack
async function processRequest(req: Request): Promise<Response> {
  try {
    return await handleRequest(req);
  } catch (error) {
    logger.error('Request processing failed', error as Error, {
      requestId: req.id,
      path: req.path,
      method: req.method,
    });
    throw error; // Re-throw for error handler
  }
}

async function handleRequest(req: Request): Promise<Response> {
  try {
    return await enhancementService.process(req.body);
  } catch (error) {
    // Add service-level context, then re-throw
    logger.error('Enhancement service error', error as Error, {
      service: 'EnhancementService',
      inputLength: req.body.prompt?.length,
    });
    throw error;
  }
}
```

---

## 5. Sensitive Data

### Rule: Never Log Secrets or PII

```typescript
// ❌ FORBIDDEN - Logging secrets
logger.debug('API call', {
  apiKey: process.env.API_KEY,  // NEVER
  password: user.password,       // NEVER
  creditCard: payment.cardNumber, // NEVER
});

// ❌ FORBIDDEN - Logging PII without redaction
logger.info('User registered', {
  email: user.email,     // PII
  ssn: user.ssn,         // PII
  phone: user.phone,     // PII
});

// ✅ CORRECT - Redact sensitive data
logger.info('User registered', {
  userId: user.id,
  emailDomain: user.email.split('@')[1], // Only domain
  hasPhone: !!user.phone,                 // Boolean only
});

// ✅ CORRECT - Sanitize headers
function sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
  const sanitized = { ...headers };
  const sensitiveKeys = ['authorization', 'x-api-key', 'cookie'];
  
  for (const key of sensitiveKeys) {
    if (sanitized[key]) {
      sanitized[key] = '[REDACTED]';
    }
  }
  
  return sanitized;
}

logger.debug('Request received', {
  headers: sanitizeHeaders(req.headers),
});
```

### Data Summarization Pattern

```typescript
// ✅ Summarize large payloads
function summarize(data: unknown, maxLength = 200): unknown {
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
    return {
      type: 'object',
      keys: Object.keys(data).slice(0, 10),
      keyCount: Object.keys(data).length,
    };
  }
  
  return data;
}

// Usage
logger.debug('Processing payload', {
  payload: summarize(largePayload),
});
```

---

## 6. Performance Logging

### Rule: Log Duration for Async Operations

```typescript
// ✅ Pattern: Measure and log duration
async function optimizePrompt(prompt: string): Promise<string> {
  const startTime = performance.now();
  const operation = 'optimizePrompt';
  
  logger.debug(`Starting ${operation}`, { promptLength: prompt.length });
  
  try {
    const result = await llmClient.complete(prompt);
    const duration = Math.round(performance.now() - startTime);
    
    logger.info(`${operation} completed`, {
      operation,
      duration,
      inputLength: prompt.length,
      outputLength: result.length,
    });
    
    return result;
  } catch (error) {
    const duration = Math.round(performance.now() - startTime);
    
    logger.error(`${operation} failed`, error as Error, {
      operation,
      duration,
      promptLength: prompt.length,
    });
    
    throw error;
  }
}
```

### Timing Utility

```typescript
// utils/timing.ts
export function withTiming<T>(
  operation: string,
  fn: () => Promise<T>,
  log: ILogger
): Promise<T> {
  const startTime = performance.now();
  
  return fn()
    .then((result) => {
      log.info(`${operation} completed`, {
        operation,
        duration: Math.round(performance.now() - startTime),
      });
      return result;
    })
    .catch((error) => {
      log.error(`${operation} failed`, error, {
        operation,
        duration: Math.round(performance.now() - startTime),
      });
      throw error;
    });
}

// Usage
const result = await withTiming(
  'generateSuggestions',
  () => this.process(params),
  this.log
);
```

---

## 7. Frontend Logging

### Component Logging

```typescript
// ❌ BAD - Random console.logs
function VideoBuilder() {
  console.log('render');
  
  useEffect(() => {
    console.log('mounted');
  }, []);
  
  return <div>...</div>;
}

// ✅ GOOD - Use debug logger hook
import { useDebugLogger } from '@/hooks/useDebugLogger';

function VideoBuilder(props: VideoBuilderProps) {
  const debug = useDebugLogger('VideoBuilder', props);
  
  useEffect(() => {
    debug.logEffect('mounted');
    debug.startTimer('initialization');
    
    // ... initialization logic
    
    debug.endTimer('initialization', 'Component initialized');
  }, []);
  
  const handleSubmit = async () => {
    debug.logAction('submit', { formData });
    debug.startTimer('submit');
    
    try {
      await submitForm(formData);
      debug.endTimer('submit', 'Form submitted successfully');
    } catch (error) {
      debug.logError('Form submission failed', error as Error);
    }
  };
  
  return <div>...</div>;
}
```

### API Call Logging

API calls are automatically logged via interceptors. For custom logging:

```typescript
import { logger } from '@/services/LoggingService';

async function customFetch(url: string, options: RequestInit): Promise<Response> {
  const traceId = logger.generateTraceId();
  logger.setTraceId(traceId);
  
  logger.debug('Starting custom fetch', { url, method: options.method });
  
  try {
    const response = await fetch(url, options);
    
    logger.info('Custom fetch completed', {
      url,
      status: response.status,
    });
    
    return response;
  } catch (error) {
    logger.error('Custom fetch failed', error as Error, { url });
    throw error;
  } finally {
    logger.clearTraceId();
  }
}
```

---

## 8. Request Tracing

### Backend: Request ID

```typescript
// middleware/requestId.ts
import { v4 as uuidv4 } from 'uuid';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = req.headers['x-request-id'] as string || uuidv4();
  req.id = requestId;
  res.setHeader('X-Request-Id', requestId);
  
  // Create request-scoped logger
  req.log = logger.child({ requestId });
  
  next();
}

// Usage in route handlers
app.post('/api/enhance', async (req, res) => {
  req.log.info('Enhancement request received', {
    operation: 'enhance',
    promptLength: req.body.prompt?.length,
  });
  
  // ... handler logic
});
```

### Frontend: Trace ID

```typescript
// Automatic via API interceptors, or manual:
import { logger } from '@/services/LoggingService';

async function complexOperation(): Promise<void> {
  const traceId = logger.generateTraceId();
  logger.setTraceId(traceId);
  
  try {
    logger.info('Starting complex operation');
    await step1();
    logger.debug('Step 1 complete');
    await step2();
    logger.debug('Step 2 complete');
    logger.info('Complex operation complete');
  } finally {
    logger.clearTraceId();
  }
}
```

---

## 9. Configuration

### Backend (`server/.env`)

```bash
# Log level: debug, info, warn, error
LOG_LEVEL=info

# In production, logs are JSON (no pino-pretty)
NODE_ENV=production
```

### Frontend (`client/.env`)

```bash
# Enable client-side logging
VITE_DEBUG_LOGGING=true

# Log level: debug, info, warn, error
VITE_LOG_LEVEL=debug
```

### Enable Debug Mode

```bash
# Quick enable (run from project root)
./scripts/enable-debug.sh

# Quick disable
./scripts/disable-debug.sh
```

---

## 10. Service Logging Template

### Backend Service

```typescript
import { logger } from '@infrastructure/Logger';
import type { ILogger } from '@interfaces/ILogger';

export class FeatureService {
  private readonly log: ILogger;
  
  constructor() {
    this.log = logger.child({ service: 'FeatureService' });
  }
  
  async process(input: Input): Promise<Output> {
    const startTime = performance.now();
    const operation = 'process';
    
    this.log.debug(`Starting ${operation}`, {
      operation,
      inputSize: JSON.stringify(input).length,
    });
    
    try {
      // Validate input
      const validated = InputSchema.parse(input);
      
      // Process
      const result = await this.doWork(validated);
      
      // Log success
      this.log.info(`${operation} completed`, {
        operation,
        duration: Math.round(performance.now() - startTime),
        resultSize: JSON.stringify(result).length,
      });
      
      return result;
      
    } catch (error) {
      this.log.error(`${operation} failed`, error as Error, {
        operation,
        duration: Math.round(performance.now() - startTime),
        input: summarize(input),
      });
      throw error;
    }
  }
}
```

### React Hook

```typescript
import { useCallback } from 'react';
import { logger } from '@/services/LoggingService';

export function useFeature() {
  const log = logger.child('useFeature');
  
  const doSomething = useCallback(async (params: Params) => {
    log.debug('doSomething called', { params: summarize(params) });
    logger.startTimer('doSomething');
    
    try {
      const result = await apiCall(params);
      const duration = logger.endTimer('doSomething');
      
      log.info('doSomething completed', { duration, resultCount: result.length });
      return result;
      
    } catch (error) {
      logger.endTimer('doSomething');
      log.error('doSomething failed', error as Error);
      throw error;
    }
  }, []);
  
  return { doSomething };
}
```

---

## Anti-Patterns

### ❌ Console Logging in Production Code

```typescript
// ❌ NEVER - Console statements in production
console.log('debugging');
console.error('error:', error);
console.warn('warning');
console.debug('data:', data);

// ✅ ALWAYS - Use the logger
logger.debug('debugging');
logger.error('Error occurred', error);
logger.warn('Warning condition');
logger.debug('Data received', { data: summarize(data) });
```

### ❌ Logging Without Context

```typescript
// ❌ BAD - No context
logger.error('Failed');

// ✅ GOOD - Full context
logger.error('Suggestion generation failed', error, {
  service: 'EnhancementService',
  operation: 'generateSuggestions',
  userId,
  promptLength,
});
```

### ❌ Logging Sensitive Data

```typescript
// ❌ FORBIDDEN
logger.debug('Auth', { token: authToken, password });

// ✅ CORRECT
logger.debug('Auth attempt', { 
  userId, 
  hasToken: !!authToken,
});
```

### ❌ Excessive Logging in Loops

```typescript
// ❌ BAD - N log statements
for (const item of items) {
  logger.debug('Processing', { item });
}

// ✅ GOOD - Aggregate logging
logger.debug('Starting batch processing', { count: items.length });
const results = items.map(process);
logger.info('Batch processing complete', { 
  total: items.length,
  successful: results.filter(r => r.success).length,
});
```

### ❌ String Concatenation in Messages

```typescript
// ❌ BAD - Hard to parse
logger.info(`User ${userId} created prompt ${promptId} at ${timestamp}`);

// ✅ GOOD - Structured
logger.info('Prompt created', { userId, promptId, timestamp });
```

---

## Quick Reference

### Import Patterns

```typescript
// Backend
import { logger } from '@infrastructure/Logger';
const log = logger.child({ service: 'ServiceName' });

// Frontend
import { logger } from '@/services/LoggingService';
const log = logger.child('ComponentName');
```

### Log Levels

| Level | Use For | Example |
|-------|---------|---------|
| `error` | Failures | `log.error('Failed', error, ctx)` |
| `warn` | Degraded | `log.warn('Fallback used', ctx)` |
| `info` | Events | `log.info('Completed', ctx)` |
| `debug` | Details | `log.debug('Processing', ctx)` |

### Standard Context Fields

```typescript
{
  service: 'ServiceName',      // Always (via child logger)
  operation: 'methodName',     // Always
  duration: 1234,              // For timed operations
  requestId: 'req-xxx',        // For HTTP requests
  userId: 'user-xxx',          // When available
  error: errorObject,          // For error logs
}
```

### Timing Pattern

```typescript
const startTime = performance.now();
try {
  const result = await operation();
  log.info('Operation completed', { 
    duration: Math.round(performance.now() - startTime),
  });
  return result;
} catch (error) {
  log.error('Operation failed', error, { 
    duration: Math.round(performance.now() - startTime),
  });
  throw error;
}
```

---

## Browser Console Commands

```javascript
// Access logger
window.__logger

// View stored logs
window.__logger.getStoredLogs()

// Export for bug reports
copy(window.__logger.exportLogs())

// Clear logs
window.__logger.clearStoredLogs()
```

---

*Companion docs: [ARCHITECTURE_STANDARD.md](./ARCHITECTURE_STANDARD.md), [STYLE_RULES.md](./STYLE_RULES.md), [ZOD_PATTERNS.md](./ZOD_PATTERNS.md)*
