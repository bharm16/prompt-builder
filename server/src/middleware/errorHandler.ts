import { logger } from '@infrastructure/Logger';
import type { NextFunction, Request, Response } from 'express';
import { isConvergenceError } from '@services/convergence';

/**
 * Redact sensitive data from strings
 * Removes PII like emails, SSNs, credit cards, phone numbers
 */
function redactSensitiveData(obj: unknown): unknown {
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
  
  const redacted: Record<string, unknown> | unknown[] = Array.isArray(obj) ? [] : {};
  const sensitiveKeys = [
    'email',
    'password',
    'token',
    'apikey',
    'api_key',
    'secret',
    'ssn',
    'creditcard',
    'credit_card',
    'phone',
    'address',
  ];
  
  for (const [key, value] of Object.entries(obj)) {
    // Redact entire value if key is sensitive
    if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
      (redacted as Record<string, unknown>)[key] = '[REDACTED]';
    }
    // Recursively redact nested objects
    else if (typeof value === 'object' && value !== null) {
      (redacted as Record<string, unknown>)[key] = redactSensitiveData(value);
    }
    // Redact long strings (likely to be prompts with PII)
    else if (typeof value === 'string' && value.length > 1000) {
      const redactedValue = redactSensitiveData(value);
      (redacted as Record<string, unknown>)[key] =
        (redactedValue as string).substring(0, 200) +
        `... [${value.length - 200} chars truncated]`;
    }
    // Redact patterns in short strings
    else if (typeof value === 'string') {
      (redacted as Record<string, unknown>)[key] = redactSensitiveData(value);
    }
    else {
      (redacted as Record<string, unknown>)[key] = value;
    }
  }
  
  return redacted;
}

/**
 * Global error handling middleware
 * Catches and formats errors consistently with sensitive data redaction
 */
type RequestWithId = Request & { id?: string; body?: Record<string, unknown> };

export function errorHandler(
  err: unknown,
  req: RequestWithId,
  res: Response,
  _next: NextFunction
): void {
  const meta: Record<string, unknown> = {
    requestId: req.id,
    method: req.method,
    path: req.path,
  };

  if (req.body && Object.keys(req.body).length > 0) {
    try {
      const redactedBody = redactSensitiveData(req.body);
      const bodyStr = JSON.stringify(redactedBody);
      meta.bodyPreview = bodyStr.substring(0, 300);
      meta.bodyLength = JSON.stringify(req.body).length;
    } catch {
      // ignore serialization errors
    }
  }

  // Handle ConvergenceError with proper HTTP status mapping
  if (isConvergenceError(err)) {
    const statusCode = err.getHttpStatus();
    const userMessage = err.getUserMessage();

    logger.warn('Convergence error', {
      ...meta,
      errorCode: err.code,
      statusCode,
      details: err.details,
    });

    res.status(statusCode).json({
      error: err.code,
      message: userMessage,
      details: err.details,
      requestId: req.id,
    });
    return;
  }

  const errorObj = err instanceof Error ? err : new Error(String(err));
  logger.error('Request error', errorObj, meta);

  const httpErr = err as Record<string, unknown>;
  const statusCode =
    (typeof httpErr === 'object' && httpErr !== null
      ? (httpErr.statusCode as number) ?? (httpErr.status as number)
      : undefined) ?? 500;

  const errorResponse: Record<string, unknown> = {
    error: errorObj.message || 'Internal server error',
    requestId: req.id,
  };

  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = errorObj.stack;
  }

  if (typeof httpErr === 'object' && httpErr !== null && 'details' in httpErr) {
    errorResponse.details = httpErr.details;
  }

  res.status(statusCode).json(errorResponse);
}
