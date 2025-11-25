import { logger } from '@infrastructure/Logger.ts';

/**
 * Redact sensitive data from strings
 * Removes PII like emails, SSNs, credit cards, phone numbers
 */
function redactSensitiveData(obj) {
  if (typeof obj === 'string') {
    return obj
      // Redact email addresses
      .replace(/[\w.-]+@[\w.-]+\.\w+/g, '[EMAIL_REDACTED]')
      // Redact SSN patterns (XXX-XX-XXXX)
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN_REDACTED]')
      // Redact credit card numbers (16 digits)
      .replace(/\b\d{16}\b/g, '[CARD_REDACTED]')
      // Redact phone numbers (various formats)
      .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE_REDACTED]')
      // Redact API keys (common patterns)
      .replace(/\b[A-Za-z0-9]{32,}\b/g, '[KEY_REDACTED]');
  }
  
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }
  
  const redacted = Array.isArray(obj) ? [] : {};
  const sensitiveKeys = ['email', 'password', 'token', 'apikey', 'api_key', 'secret', 
                        'ssn', 'creditcard', 'credit_card', 'phone', 'address'];
  
  for (const [key, value] of Object.entries(obj)) {
    // Redact entire value if key is sensitive
    if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
      redacted[key] = '[REDACTED]';
    }
    // Recursively redact nested objects
    else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactSensitiveData(value);
    }
    // Redact long strings (likely to be prompts with PII)
    else if (typeof value === 'string' && value.length > 1000) {
      const redactedValue = redactSensitiveData(value);
      redacted[key] = redactedValue.substring(0, 200) + 
        `... [${value.length - 200} chars truncated]`;
    }
    // Redact patterns in short strings
    else if (typeof value === 'string') {
      redacted[key] = redactSensitiveData(value);
    }
    else {
      redacted[key] = value;
    }
  }
  
  return redacted;
}

/**
 * Global error handling middleware
 * Catches and formats errors consistently with sensitive data redaction
 */
export function errorHandler(err, req, res, next) {
  // Log the error
  const meta = {
    requestId: req.id,
    method: req.method,
    path: req.path,
  };

  // Always redact request bodies (even in development) to prevent PII leakage in logs
  if (req.body && Object.keys(req.body).length > 0) {
    try {
      const redactedBody = redactSensitiveData(req.body);
      const bodyStr = JSON.stringify(redactedBody);
      meta.bodyPreview = bodyStr.substring(0, 300);
      meta.bodyLength = JSON.stringify(req.body).length; // Original length
    } catch {
      // ignore serialization errors
    }
  }

  logger.error('Request error', err, meta);

  // Determine status code
  const statusCode = err.statusCode || err.status || 500;

  // Build error response
  const errorResponse = {
    error: err.message || 'Internal server error',
    requestId: req.id,
  };

  // Add stack trace in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = err.stack;
  }

  // Add additional error details if available
  if (err.details) {
    errorResponse.details = err.details;
  }

  res.status(statusCode).json(errorResponse);
}
