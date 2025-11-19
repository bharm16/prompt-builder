// IMPORTANT: This file must be imported at the top of your entry point, before any other imports
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import dotenv from 'dotenv';

// Load environment variables first
dotenv.config();

const SENTRY_DSN = process.env.SENTRY_DSN;
const ENVIRONMENT = process.env.NODE_ENV || 'development';
const RELEASE = process.env.APP_VERSION || 'unknown';

Sentry.init({
  dsn: SENTRY_DSN || "https://e612da64218e595ffd763abab1fbfb16@o4506655473074176.ingest.us.sentry.io/4510247711539200",
  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: true,
  environment: ENVIRONMENT,
  release: RELEASE,

  // Performance Monitoring
  integrations: [
    // HTTP request tracking
    Sentry.httpIntegration(),
    // Express request handler - CRITICAL for Express
    Sentry.expressIntegration(),
    // Profiling (optional)
    nodeProfilingIntegration(),
  ],

  // Performance Monitoring sample rate (1.0 = 100%)
  // Disabled in development to avoid rate limits and noise
  tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 0,

  // Profiling sample rate
  // Disabled in development to avoid rate limits and noise
  profilesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 0,

  // Filter out sensitive data
  beforeSend(event, hint) {
    // Send events in development if SENTRY_DEBUG is set
    if (ENVIRONMENT === 'development' && !process.env.SENTRY_DEBUG) {
      return null;
    }

    // Remove sensitive headers
    if (event.request?.headers) {
      delete event.request.headers['authorization'];
      delete event.request.headers['cookie'];
      delete event.request.headers['x-api-key'];
    }

    return event;
  },

  // Ignore specific errors
  ignoreErrors: [
    'ECONNRESET',
    'EPIPE',
    'ECANCELED',
    'auth/id-token-expired',
    'auth/argument-error',
    'Too many requests',
  ],
});

console.log(`✓ Sentry initialized (env: ${ENVIRONMENT})`);

