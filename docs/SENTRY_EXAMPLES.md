# Sentry Usage Examples

This guide shows practical examples of using Sentry in your code for better error tracking and debugging.

## Frontend Examples

### Example 1: Catching API Call Errors

```javascript
// client/src/hooks/usePromptOptimizer.js
import { captureException, addSentryBreadcrumb } from '../config/sentry';

export const usePromptOptimizer = () => {
  const optimize = async (input, options) => {
    // Add breadcrumb before API call
    addSentryBreadcrumb('api', 'Starting prompt optimization', {
      mode: options.mode,
      inputLength: input.length,
      modelName: options.modelName,
    });

    try {
      const response = await fetch('/api/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input, ...options }),
      });

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const result = await response.json();
      
      // Add success breadcrumb
      addSentryBreadcrumb('api', 'Optimization successful', {
        qualityScore: result.qualityScore,
        responseLength: result.optimizedPrompt.length,
      });

      return result;
    } catch (error) {
      // Capture error with context
      captureException(error, {
        endpoint: '/api/optimize',
        input: input.substring(0, 100), // First 100 chars only
        mode: options.mode,
        modelName: options.modelName,
      });

      throw error;
    }
  };

  return { optimize };
};
```

### Example 2: Component Error Tracking

```javascript
// client/src/components/VideoConceptBuilder.jsx
import { captureException, addSentryBreadcrumb } from '../config/sentry';

const VideoConceptBuilder = ({ onConceptComplete }) => {
  const handleSuggestionClick = async (suggestion) => {
    try {
      addSentryBreadcrumb('user_action', 'Clicked suggestion', {
        suggestionText: suggestion.text.substring(0, 50),
        elementType: suggestion.type,
      });

      await applySuggestion(suggestion);
    } catch (error) {
      captureException(error, {
        component: 'VideoConceptBuilder',
        action: 'apply_suggestion',
        suggestionType: suggestion.type,
      });

      // Show error to user
      toast.error('Failed to apply suggestion');
    }
  };

  return (
    // Component JSX
  );
};
```

### Example 3: Tracking User Actions

```javascript
// client/src/features/prompt-optimizer/PromptOptimizerContainer.jsx
import { addSentryBreadcrumb, captureMessage } from '../../config/sentry';

const PromptOptimizerContainer = () => {
  const handleModeChange = (newMode) => {
    // Track mode changes
    addSentryBreadcrumb('navigation', 'User changed mode', {
      fromMode: selectedMode,
      toMode: newMode,
    });

    setSelectedMode(newMode);
  };

  const handleExport = (format) => {
    // Track exports
    addSentryBreadcrumb('user_action', 'Exported prompt', {
      format,
      promptLength: displayedPrompt.length,
      mode: selectedMode,
    });

    if (format === 'json') {
      // Track when users use advanced features
      captureMessage('User exported as JSON', 'info', {
        mode: selectedMode,
        hasResult: !!promptOptimizer.result,
      });
    }
  };

  return (
    // Component JSX
  );
};
```

### Example 4: Performance Tracking

```javascript
// client/src/hooks/useSpanLabeling.js
import * as Sentry from '@sentry/react';

export const useSpanLabeling = () => {
  const labelSpans = async (prompt) => {
    // Start performance transaction
    const transaction = Sentry.startTransaction({
      name: 'label_spans',
      op: 'llm',
    });

    try {
      const span = transaction.startChild({
        op: 'api.call',
        description: 'Call /llm/label-spans',
      });

      const result = await fetch('/llm/label-spans', {
        method: 'POST',
        body: JSON.stringify({ prompt }),
      });

      span.finish();
      transaction.setStatus('ok');

      return result;
    } catch (error) {
      transaction.setStatus('error');
      throw error;
    } finally {
      transaction.finish();
    }
  };

  return { labelSpans };
};
```

### Example 5: Contextual Error Messages

```javascript
// client/src/components/PromptCanvas.jsx
import { captureMessage, addSentryBreadcrumb } from '../config/sentry';

const PromptCanvas = ({ result, qualityScore }) => {
  useEffect(() => {
    // Track low quality scores for investigation
    if (qualityScore < 50) {
      captureMessage('Low quality score generated', 'warning', {
        qualityScore,
        resultLength: result.length,
        resultPreview: result.substring(0, 100),
      });
    }

    // Track unusually high quality scores (might indicate issue)
    if (qualityScore > 95) {
      addSentryBreadcrumb('quality', 'Unusually high quality score', {
        qualityScore,
        resultLength: result.length,
      });
    }
  }, [qualityScore, result]);

  return (
    // Component JSX
  );
};
```

---

## Backend Examples

### Example 1: API Endpoint Error Handling

```javascript
// server/src/routes/api.routes.js
import { captureException, addSentryBreadcrumb } from '../config/sentry.js';

router.post('/optimize', async (req, res, next) => {
  const { input, mode, modelName } = req.body;

  // Add request context
  addSentryBreadcrumb('request', 'Optimization request received', {
    mode,
    modelName,
    inputLength: input?.length,
    userId: req.user?.uid,
  });

  try {
    const result = await promptOptimizationService.optimizePrompt(
      input,
      { mode, modelName }
    );

    // Track successful optimizations
    addSentryBreadcrumb('response', 'Optimization successful', {
      qualityScore: result.qualityScore,
      expansionRatio: result.expansionRatio,
    });

    res.json(result);
  } catch (error) {
    // Capture with full context
    captureException(error, {
      endpoint: '/api/optimize',
      mode,
      modelName,
      inputLength: input?.length,
      userId: req.user?.uid,
    });

    next(error);
  }
});
```

### Example 2: Service Layer Error Tracking

```javascript
// server/src/services/PromptOptimizationService.js
import { captureException, startTransaction } from '../config/sentry.js';

class PromptOptimizationService {
  async optimizePrompt(input, options) {
    const transaction = startTransaction('optimize_prompt', 'function');
    
    try {
      // Add tags for filtering
      transaction.setTag('mode', options.mode);
      transaction.setTag('model', options.modelName);

      // Track cache lookup
      const cacheSpan = transaction.startChild({
        op: 'cache.get',
        description: 'Check cache for prompt',
      });
      const cached = await this.cacheService.get(cacheKey);
      cacheSpan.finish();

      if (cached) {
        transaction.setData('cache_hit', true);
        transaction.finish();
        return cached;
      }

      // Track OpenAI API call
      const apiSpan = transaction.startChild({
        op: 'api.call',
        description: 'Call OpenAI API',
      });

      const result = await this.claudeClient.optimize(input, options);
      
      apiSpan.finish();
      transaction.setStatus('ok');
      
      return result;
    } catch (error) {
      transaction.setStatus('error');
      
      // Capture with service context
      captureException(error, {
        service: 'PromptOptimizationService',
        method: 'optimizePrompt',
        mode: options.mode,
        inputLength: input.length,
      });

      throw error;
    } finally {
      transaction.finish();
    }
  }
}
```

### Example 3: Circuit Breaker Integration

```javascript
// server/src/clients/OpenAIAPIClient.js
import { captureMessage, addSentryBreadcrumb } from '../config/sentry.js';

class OpenAIAPIClient {
  constructor(apiKey, options) {
    this.breaker = new CircuitBreaker(
      this.callAPI.bind(this),
      {
        timeout: options.timeout,
        errorThresholdPercentage: 50,
      }
    );

    // Track circuit breaker state changes
    this.breaker.on('open', () => {
      captureMessage('Circuit breaker opened', 'warning', {
        client: 'OpenAIAPIClient',
        failureRate: this.breaker.stats.failures / this.breaker.stats.fires,
      });
    });

    this.breaker.on('halfOpen', () => {
      addSentryBreadcrumb('circuit_breaker', 'Half-open state', {
        client: 'OpenAIAPIClient',
      });
    });

    this.breaker.on('close', () => {
      addSentryBreadcrumb('circuit_breaker', 'Circuit closed', {
        client: 'OpenAIAPIClient',
      });
    });
  }

  async callAPI(messages) {
    const transaction = startTransaction('openai_api_call', 'http');
    
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages }),
      });

      transaction.setHttpStatus(response.status);

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      transaction.setStatus('ok');

      return data;
    } catch (error) {
      transaction.setStatus('error');
      
      captureException(error, {
        api: 'OpenAI',
        messageCount: messages.length,
        circuitBreakerState: this.breaker.status.name,
      });

      throw error;
    } finally {
      transaction.finish();
    }
  }
}
```

### Example 4: Rate Limiting Monitoring

```javascript
// server/src/middleware/rateLimiting.js
import { captureMessage } from '../config/sentry.js';

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  handler: (req, res) => {
    // Track when users hit rate limits
    captureMessage('Rate limit exceeded', 'warning', {
      endpoint: req.path,
      userId: req.user?.uid,
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.status(429).json({
      error: 'Too many requests',
      retryAfter: req.rateLimit.resetTime,
    });
  },
});
```

### Example 5: Database Operation Tracking

```javascript
// server/src/config/firebase.js
import { captureException, startTransaction } from './sentry.js';

export const savePromptToFirestore = async (userId, promptData) => {
  const transaction = startTransaction('firestore_save', 'db');
  
  try {
    transaction.setData('userId', userId);
    transaction.setData('dataSize', JSON.stringify(promptData).length);

    const docRef = await addDoc(collection(db, 'prompts'), {
      userId,
      ...promptData,
      timestamp: serverTimestamp(),
    });

    transaction.setStatus('ok');
    return { id: docRef.id };
  } catch (error) {
    transaction.setStatus('error');
    
    captureException(error, {
      operation: 'firestore_save',
      userId,
      dataSize: JSON.stringify(promptData).length,
    });

    throw error;
  } finally {
    transaction.finish();
  }
};
```

---

## Testing Examples

### Test Error Capture (Frontend)

```javascript
// In browser console or test file
import { captureException } from '../config/sentry';

// Test error capture
try {
  throw new Error('Test error from frontend');
} catch (error) {
  captureException(error, {
    test: true,
    component: 'TestComponent',
  });
}
```

### Test Error Capture (Backend)

```javascript
// server/test-sentry.js
import { captureException, captureMessage } from './src/config/sentry.js';

// Test error
captureException(new Error('Test backend error'), {
  test: true,
  environment: 'test',
});

// Test message
captureMessage('Test message from backend', 'info', {
  test: true,
});

console.log('Check Sentry dashboard for test events');
```

---

## Advanced Patterns

### Pattern 1: Custom Scopes

```javascript
import * as Sentry from '@sentry/react';

// Create custom scope for specific operation
Sentry.withScope((scope) => {
  scope.setLevel('warning');
  scope.setTag('operation', 'bulk_import');
  scope.setContext('import_details', {
    fileSize: file.size,
    fileName: file.name,
    recordCount: records.length,
  });

  Sentry.captureMessage('Starting bulk import', 'info');
});
```

### Pattern 2: Span Nesting

```javascript
const transaction = Sentry.startTransaction({
  name: 'process_video_prompt',
  op: 'function',
});

// Parent span
const validateSpan = transaction.startChild({
  op: 'validation',
  description: 'Validate input',
});
// ... validation logic
validateSpan.finish();

// Sibling span
const optimizeSpan = transaction.startChild({
  op: 'optimization',
  description: 'Optimize prompt',
});
// ... optimization logic
optimizeSpan.finish();

transaction.finish();
```

### Pattern 3: Fingerprinting

```javascript
// Group similar errors together
Sentry.captureException(error, {
  fingerprint: ['{{ default }}', 'openai-timeout', error.status],
});
```

---

## Best Practices

### DO:
✅ Add context to every error
✅ Use breadcrumbs for debugging flow
✅ Track performance of critical operations
✅ Filter sensitive data before sending
✅ Use appropriate severity levels
✅ Group similar errors with fingerprints

### DON'T:
❌ Capture expected errors (validation, 404s)
❌ Send sensitive data (passwords, tokens)
❌ Over-sample in production (stay under limits)
❌ Ignore error handling in favor of Sentry
❌ Log everything (creates noise)
❌ Forget to test in staging first

---

## Common Scenarios

### Scenario 1: API Timeout

```javascript
try {
  const result = await fetch('/api/optimize', { 
    signal: AbortSignal.timeout(30000) 
  });
} catch (error) {
  if (error.name === 'TimeoutError') {
    captureException(error, {
      type: 'api_timeout',
      endpoint: '/api/optimize',
      timeout: 30000,
    });
  }
  throw error;
}
```

### Scenario 2: Firebase Auth Error

```javascript
try {
  await signInWithGoogle();
} catch (error) {
  if (error.code === 'auth/popup-closed-by-user') {
    // Don't send to Sentry (user action)
    return;
  }
  
  captureException(error, {
    type: 'auth_error',
    code: error.code,
    message: error.message,
  });
}
```

### Scenario 3: Cache Miss Rate

```javascript
let cacheMisses = 0;
let cacheAttempts = 0;

const checkCache = async (key) => {
  cacheAttempts++;
  const value = await cache.get(key);
  
  if (!value) {
    cacheMisses++;
    
    // Alert if miss rate is high
    const missRate = cacheMisses / cacheAttempts;
    if (missRate > 0.8 && cacheAttempts > 100) {
      captureMessage('High cache miss rate', 'warning', {
        missRate,
        cacheAttempts,
        cacheMisses,
      });
    }
  }
  
  return value;
};
```

---

## Resources

- [Sentry React SDK](https://docs.sentry.io/platforms/javascript/guides/react/)
- [Sentry Node SDK](https://docs.sentry.io/platforms/node/)
- [Best Practices](https://docs.sentry.io/platforms/javascript/best-practices/)
- [Performance Monitoring](https://docs.sentry.io/product/performance/)
