import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import type { Application } from 'express';
import type { Request, Response, NextFunction } from 'express';

const SENTRY_DSN = process.env.SENTRY_DSN;

export function initSentry(app: Application): void {
  // Read environment variables inside function (after dotenv.config() has run)
  const ENVIRONMENT = process.env.NODE_ENV || 'development';
  const RELEASE = process.env.APP_VERSION || 'unknown';
  
  // Only initialize Sentry if DSN is provided
  if (!SENTRY_DSN) {
    if (ENVIRONMENT === 'development') {
      console.warn('Sentry DSN not configured. Error tracking is disabled.');
    }
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENVIRONMENT,
    release: RELEASE,
    
    // Send default PII (IP addresses, user info)
    sendDefaultPii: true,

    // Performance Monitoring
    integrations: [
      // HTTP request tracking
      Sentry.httpIntegration(),
      // Profiling (optional, can be resource-intensive)
      nodeProfilingIntegration(),
    ],

    // Performance Monitoring sample rate
    tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,

    // Profiling sample rate
    profilesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,

    // Filter out sensitive data
    beforeSend(event, hint) {
      // Don't send events in development unless explicitly enabled
      if (ENVIRONMENT === 'development' && !process.env.SENTRY_DEBUG) {
        return null;
      }

      // Remove sensitive headers
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
        delete event.request.headers['x-api-key'];
        delete event.request.headers['x-firebase-token'];
      }

      // Remove sensitive query parameters
      if (event.request?.query_string) {
        const queryString = event.request.query_string;
        if (typeof queryString === 'string') {
          const sanitized = queryString
            .replace(/api[_-]?key=[^&]*/gi, 'api_key=[REDACTED]')
            .replace(/token=[^&]*/gi, 'token=[REDACTED]')
            .replace(/secret=[^&]*/gi, 'secret=[REDACTED]');
          event.request.query_string = sanitized;
        }
      }

      return event;
    },

    // Ignore specific errors
    ignoreErrors: [
      // Client disconnects
      'ECONNRESET',
      'EPIPE',
      'ECANCELED',
      // Expected Firebase errors
      'auth/id-token-expired',
      'auth/argument-error',
      // Rate limiting (not really errors)
      'Too many requests',
    ],

    // Set context for all events
    initialScope: {
      tags: {
        platform: 'node',
        app: 'prompt-builder-api',
      },
    },
  });

  // Sentry request handling is now done automatically through integrations
  // No need for explicit middleware in newer versions
  
  console.log(`✓ Sentry initialized (env: ${ENVIRONMENT})`);
}

// Error handler must be registered after all routes but before other error middleware
export function sentryErrorHandler(): (err: Error, req: Request, res: Response, next: NextFunction) => void {
  // Return a middleware that captures errors to Sentry
  return (err: Error & { status?: number; isValidationError?: boolean }, req: Request, res: Response, next: NextFunction): void => {
    if (!SENTRY_DSN) {
      return next(err);
    }

    // Capture errors with status code >= 500
    if (err.status && err.status >= 500) {
      Sentry.captureException(err);
    }
    
    // Also capture specific 4xx errors that are bugs
    if (err.status === 400 && err.isValidationError !== true) {
      Sentry.captureException(err);
    }

    next(err);
  };
}

interface SentryUser {
  uid: string;
  email?: string;
  displayName?: string;
}

// Helper to set user context (call when user authenticates)
export function setSentryUser(user: SentryUser | null): void {
  if (!SENTRY_DSN) return;

  if (user) {
    const email = user.email;
    const displayName = user.displayName;
    Sentry.setUser({
      id: user.uid,
      ...(email && { email }),
      ...(displayName && { username: displayName }),
      ...(!displayName && email && { username: email.split('@')[0] }),
    });
  } else {
    Sentry.setUser(null);
  }
}

// Helper to add breadcrumbs for debugging
export function addSentryBreadcrumb(category: string, message: string, data: Record<string, unknown> = {}): void {
  if (!SENTRY_DSN) return;

  Sentry.addBreadcrumb({
    category,
    message,
    level: 'info',
    data,
  });
}

// Helper to capture exceptions manually
export function captureException(error: unknown, context: Record<string, unknown> = {}): void {
  if (!SENTRY_DSN) {
    console.error('Error:', error, context);
    return;
  }

  Sentry.captureException(error, {
    contexts: {
      custom: context,
    },
  });
}

// Helper to capture messages
export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context: Record<string, unknown> = {}): void {
  if (!SENTRY_DSN) {
    console.log(`[${level}]`, message, context);
    return;
  }

  Sentry.captureMessage(message, {
    level,
    contexts: {
      custom: context,
    },
  });
}

// Helper to start a span for performance tracking (replaces deprecated startTransaction)
export function startSpan(name: string, op: string): Sentry.Span | null {
  if (!SENTRY_DSN) return null;

  return Sentry.startInactiveSpan({
    name,
    op,
  });
}

export default Sentry;
