# Sanitization Utilities Usage Guide

## Overview

This guide provides practical examples of when and how to use the sanitization utilities in the logging system. While the current codebase doesn't log sensitive data (verified in Task 7.1 audit), these utilities are available for future use.

## When to Use Sanitization Utilities

### 1. When Logging HTTP Headers

**Use:** `sanitizeHeaders()`

**When:**
- Debugging HTTP requests/responses
- Logging API call details
- Troubleshooting authentication issues

**Example:**
```typescript
import { sanitizeHeaders } from '@utils/logging';

// ❌ NEVER do this - exposes credentials
logger.debug('Request headers', { headers: req.headers });

// ✅ ALWAYS do this - redacts sensitive headers
logger.debug('Request headers', { 
  headers: sanitizeHeaders(req.headers) 
});

// Result: authorization, x-api-key, cookie are [REDACTED]
```

### 2. When Logging Large Payloads

**Use:** `summarize()`

**When:**
- Logging request/response bodies
- Debugging data processing
- Logging arrays or objects with many items

**Example:**
```typescript
import { summarize } from '@utils/logging';

// ❌ BAD - logs entire 10KB payload
logger.debug('Processing data', { data: largePayload });

// ✅ GOOD - logs summary only
logger.debug('Processing data', { 
  data: summarize(largePayload) 
});

// Results:
// String: "abc..." (5000 chars)
// Array: { type: 'array', length: 100, sample: [1, 2, 3] }
// Object: { type: 'object', keys: ['a', 'b', ...], keyCount: 50 }
```

### 3. When Logging User-Provided Data

**Use:** `redactSensitiveFields()`

**When:**
- Logging form submissions
- Debugging user input
- Logging API request bodies

**Example:**
```typescript
import { redactSensitiveFields } from '@utils/logging';

const formData = {
  username: 'john',
  email: 'john@example.com',
  password: 'secret123',
  apiKey: 'key-abc',
};

// ❌ NEVER do this - exposes password and API key
logger.debug('Form submitted', { formData });

// ✅ ALWAYS do this - redacts sensitive fields
logger.debug('Form submitted', { 
  formData: redactSensitiveFields(formData) 
});

// Result: { username: 'john', email: '[REDACTED]', password: '[REDACTED]', apiKey: '[REDACTED]' }
```

### 4. When Logging User Objects

**Use:** `sanitizeUserData()`

**When:**
- Logging user actions
- Debugging authentication
- Tracking user events

**Example:**
```typescript
import { sanitizeUserData } from '@utils/logging';

const user = {
  id: 'user-123',
  email: 'john@example.com',
  password: 'hashed-password',
  name: 'John Doe',
  phone: '+1-555-0123',
  createdAt: '2025-01-01',
};

// ❌ NEVER do this - exposes PII
logger.info('User logged in', { user });

// ✅ ALWAYS do this - includes only safe metadata
logger.info('User logged in', { 
  user: sanitizeUserData(user) 
});

// Result: { userId: 'user-123', emailDomain: 'example.com', createdAt: '2025-01-01' }
```

### 5. When Logging Email Addresses

**Use:** `getEmailDomain()`

**When:**
- Analytics and metrics
- User segmentation
- Debugging email-related features

**Example:**
```typescript
import { getEmailDomain } from '@utils/logging';

// ❌ BAD - exposes full email
logger.info('User registered', { email: user.email });

// ✅ GOOD - logs only domain
logger.info('User registered', { 
  emailDomain: getEmailDomain(user.email) 
});

// Result: 'example.com' instead of 'john@example.com'
```

## Real-World Scenarios

### Scenario 1: Debugging API Requests

```typescript
import { sanitizeHeaders, summarize } from '@utils/logging';

async function makeApiCall(url: string, options: RequestInit) {
  logger.debug('Making API call', {
    url,
    method: options.method,
    headers: sanitizeHeaders(options.headers as Record<string, string>),
    body: summarize(options.body),
  });
  
  try {
    const response = await fetch(url, options);
    const data = await response.json();
    
    logger.info('API call successful', {
      url,
      status: response.status,
      responseSize: JSON.stringify(data).length,
      // Don't log the actual response data - could be large or sensitive
    });
    
    return data;
  } catch (error) {
    logger.error('API call failed', error as Error, { url });
    throw error;
  }
}
```

### Scenario 2: Logging Form Submissions

```typescript
import { redactSensitiveFields, summarize } from '@utils/logging';

async function handleFormSubmit(formData: FormData) {
  const data = Object.fromEntries(formData);
  
  logger.info('Form submitted', {
    formType: 'registration',
    fieldCount: Object.keys(data).length,
    // Redact sensitive fields before logging
    data: redactSensitiveFields(data),
  });
  
  try {
    const result = await submitToApi(data);
    logger.info('Form submission successful', {
      resultId: result.id,
    });
    return result;
  } catch (error) {
    logger.error('Form submission failed', error as Error, {
      formType: 'registration',
      // Don't log the actual form data in error case
    });
    throw error;
  }
}
```

### Scenario 3: Logging User Authentication

```typescript
import { sanitizeUserData } from '@utils/logging';

async function authenticateUser(credentials: { email: string; password: string }) {
  logger.debug('Authentication attempt', {
    email: getEmailDomain(credentials.email), // Only log domain
    // NEVER log password
  });
  
  try {
    const user = await authService.authenticate(credentials);
    
    logger.info('Authentication successful', {
      user: sanitizeUserData(user), // Safe user metadata only
    });
    
    return user;
  } catch (error) {
    logger.warn('Authentication failed', {
      error: (error as Error).message,
      emailDomain: getEmailDomain(credentials.email),
      // Don't log credentials
    });
    throw error;
  }
}
```

### Scenario 4: Logging Database Queries

```typescript
import { summarize } from '@utils/logging';

async function queryDatabase(query: string, params: unknown[]) {
  logger.debug('Executing database query', {
    query: summarize(query, 100), // Truncate long queries
    paramCount: params.length,
    // Don't log actual param values - might contain PII
  });
  
  const startTime = performance.now();
  
  try {
    const result = await db.query(query, params);
    const duration = Math.round(performance.now() - startTime);
    
    logger.info('Database query completed', {
      duration,
      rowCount: result.rows.length,
      // Don't log actual result data
    });
    
    return result;
  } catch (error) {
    const duration = Math.round(performance.now() - startTime);
    logger.error('Database query failed', error as Error, {
      duration,
      query: summarize(query, 100),
    });
    throw error;
  }
}
```

## Import Statements

### Backend (Server)

```typescript
import { 
  sanitizeHeaders, 
  summarize, 
  redactSensitiveFields,
  sanitizeUserData,
  getEmailDomain,
} from '@utils/logging';
```

Or import from the full path:
```typescript
import { sanitizeHeaders } from '../utils/logging/sanitize';
```

### Frontend (Client)

```typescript
import { 
  sanitizeHeaders, 
  summarize, 
  redactSensitiveFields,
  sanitizeUserData,
  getEmailDomain,
  sanitizeError,
} from '@/utils/logging';
```

Or import from the full path:
```typescript
import { sanitizeHeaders } from '@/utils/logging/sanitize';
```

## Best Practices

### ✅ DO

1. **Always sanitize headers** when logging HTTP requests/responses
2. **Always summarize large payloads** to prevent log bloat
3. **Always redact user-provided data** that might contain sensitive fields
4. **Always use email domains** instead of full email addresses
5. **Always sanitize user objects** before logging

### ❌ DON'T

1. **Don't log raw request/response bodies** without sanitization
2. **Don't log full email addresses** - use domains only
3. **Don't log passwords, tokens, or API keys** - even redacted
4. **Don't log credit card numbers, SSNs, or other PII**
5. **Don't assume data is safe** - always sanitize when in doubt

## Checklist for New Code

When adding logging to new code, ask yourself:

- [ ] Am I logging HTTP headers? → Use `sanitizeHeaders()`
- [ ] Am I logging a large payload? → Use `summarize()`
- [ ] Am I logging user-provided data? → Use `redactSensitiveFields()`
- [ ] Am I logging a user object? → Use `sanitizeUserData()`
- [ ] Am I logging an email address? → Use `getEmailDomain()`
- [ ] Could this data contain sensitive information? → Sanitize it!

## Testing Sanitization

To verify sanitization is working:

```typescript
// Test in development
const testData = {
  username: 'test',
  password: 'secret',
  apiKey: 'key-123',
};

console.log('Original:', testData);
console.log('Sanitized:', redactSensitiveFields(testData));
// Should show: { username: 'test', password: '[REDACTED]', apiKey: '[REDACTED]' }
```

## Additional Resources

- **LOGGING_PATTERNS.md Section 6**: Complete documentation with examples
- **Task 7.1 Audit Report**: Verification that no sensitive data is currently logged
- **Sanitization utility source code**: 
  - Backend: `server/src/utils/logging/sanitize.ts`
  - Frontend: `client/src/utils/logging/sanitize.ts`

## Summary

The sanitization utilities are:
- ✅ Fully implemented and tested
- ✅ Properly exported and accessible
- ✅ Documented with examples
- ✅ Ready to use in new code

**Remember:** When in doubt, sanitize! It's better to redact too much than to accidentally expose sensitive data in logs.
