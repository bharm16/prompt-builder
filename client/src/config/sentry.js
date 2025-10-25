import * as Sentry from '@sentry/react';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
const ENVIRONMENT = import.meta.env.VITE_ENVIRONMENT || import.meta.env.MODE || 'development';
const RELEASE = import.meta.env.VITE_APP_VERSION || 'unknown';

export function initSentry() {
  // Only initialize Sentry if DSN is provided
  if (!SENTRY_DSN) {
    if (import.meta.env.DEV) {
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
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],

    // Performance Monitoring sample rate (1.0 = 100%)
    tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,

    // Session Replay sample rate
    replaysSessionSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,
    replaysOnErrorSampleRate: 1.0, // Always capture replays on errors

    // Filter out local development errors
    beforeSend(event, hint) {
      // Don't send events in development unless explicitly enabled
      if (ENVIRONMENT === 'development' && !import.meta.env.VITE_SENTRY_DEBUG) {
        return null;
      }

      // Filter out errors from browser extensions
      const error = hint.originalException;
      if (error && error.message) {
        if (
          error.message.includes('chrome-extension://') ||
          error.message.includes('moz-extension://')
        ) {
          return null;
        }
      }

      return event;
    },

    // Ignore specific errors
    ignoreErrors: [
      // Browser extension errors
      'chrome-extension://',
      'moz-extension://',
      // Network errors that aren't actionable
      'NetworkError',
      'Network request failed',
      // User canceled actions
      'AbortError',
      'The operation was aborted',
      // Firebase auth cancelled flows
      'auth/popup-closed-by-user',
      'auth/cancelled-popup-request',
    ],

    // Set context for all events
    initialScope: {
      tags: {
        platform: 'web',
        app: 'prompt-builder',
      },
    },
  });

  // Set up custom context
  Sentry.setTag('browser', navigator.userAgent);
}

// Helper to set user context (call after Firebase auth)
export function setSentryUser(user) {
  if (!SENTRY_DSN) return;

  if (user) {
    Sentry.setUser({
      id: user.uid,
      email: user.email,
      username: user.displayName || user.email?.split('@')[0],
    });
  } else {
    Sentry.setUser(null);
  }
}

// Helper to add breadcrumbs for debugging
export function addSentryBreadcrumb(category, message, data = {}) {
  if (!SENTRY_DSN) return;

  Sentry.addBreadcrumb({
    category,
    message,
    level: 'info',
    data,
  });
}

// Helper to capture exceptions manually
export function captureException(error, context = {}) {
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
export function captureMessage(message, level = 'info', context = {}) {
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

export default Sentry;
