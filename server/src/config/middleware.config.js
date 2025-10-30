/**
 * Middleware Configuration
 *
 * Centralizes all Express middleware configuration.
 * This module defines the middleware stack in a clear, ordered manner.
 *
 * Middleware Order:
 * 1. Request ID (for tracing)
 * 2. Security (Helmet, CORS, headers)
 * 3. Compression
 * 4. Rate limiting
 * 5. Body parsing
 * 6. Logging
 * 7. Metrics
 * 8. Request coalescing
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';

import { requestIdMiddleware } from '../middleware/requestId.js';
import { requestCoalescing } from '../middleware/requestCoalescing.js';
import { logger } from '../infrastructure/Logger.js';

/**
 * Rate limiting configuration
 * Extracted for clarity and maintainability
 */
const RATE_LIMIT_CONFIG = {
  // General rate limits
  general: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    dev: 500,
    prod: 100,
  },
  // API endpoint rate limits
  api: {
    windowMs: 60 * 1000, // 1 minute
    dev: 300,
    prod: 60,
  },
  // LLM endpoint rate limits (higher for span labeling)
  llm: {
    windowMs: 60 * 1000,
    dev: 400,
    prod: 100,
  },
  // Health check rate limits
  health: {
    windowMs: 60 * 1000,
    max: 60,
  },
  // Route-specific burst limits
  videoValidate: {
    burst: { windowMs: 2 * 1000, max: 3 },
    minute: { windowMs: 60 * 1000, max: 30 },
  },
  videoSuggestions: {
    burst: { windowMs: 3 * 1000, max: 2 },
    minute: { windowMs: 60 * 1000, max: 20 },
  },
};

/**
 * CORS configuration
 * Manages allowed origins based on environment
 */
const CORS_CONFIG = {
  development: ['http://localhost:5173', 'http://localhost:5174'],
  // Production origins come from environment variables
};

/**
 * Security headers configuration
 */
const SECURITY_CONFIG = {
  helmet: {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: [
          "'self'",
          'https://api.openai.com',
          'https://*.firebaseapp.com',
          'https://*.googleapis.com',
          'https://*.google.com',
        ],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin',
    },
    permittedCrossDomainPolicies: {
      permittedPolicies: 'none',
    },
  },
  additionalHeaders: {
    'X-Permitted-Cross-Domain-Policies': 'none',
    'Cross-Origin-Resource-Policy': 'cross-origin',
  },
  productionHeaders: {
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Opener-Policy': 'same-origin',
  },
};

/**
 * Compression configuration
 */
const COMPRESSION_CONFIG = {
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
  level: 6,
};

/**
 * Apply request ID middleware
 * Must be first to ensure all responses include X-Request-Id
 */
export function applyRequestIdMiddleware(app) {
  app.use(requestIdMiddleware);
}

/**
 * Apply security middleware (Helmet + custom headers)
 */
export function applySecurityMiddleware(app) {
  // Helmet with CSP and other security headers
  app.use(helmet(SECURITY_CONFIG.helmet));

  // Additional security headers
  app.use((req, res, next) => {
    // Set additional headers
    Object.entries(SECURITY_CONFIG.additionalHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    // Production-only headers
    if (process.env.NODE_ENV === 'production') {
      Object.entries(SECURITY_CONFIG.productionHeaders).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
    }

    next();
  });
}

/**
 * Apply compression middleware
 */
export function applyCompressionMiddleware(app) {
  app.use(compression(COMPRESSION_CONFIG));
}

/**
 * Apply rate limiting middleware
 * Disabled in test environments
 */
export function applyRateLimitingMiddleware(app) {
  const isTestEnv =
    process.env.NODE_ENV === 'test' ||
    !!process.env.VITEST_WORKER_ID ||
    !!process.env.VITEST;

  if (isTestEnv) {
    logger.info('Rate limiting disabled in test environment');
    return;
  }

  const isDevEnv = process.env.NODE_ENV !== 'production' && !isTestEnv;
  const generalMax = isDevEnv
    ? RATE_LIMIT_CONFIG.general.dev
    : RATE_LIMIT_CONFIG.general.prod;
  const apiMax = isDevEnv
    ? RATE_LIMIT_CONFIG.api.dev
    : RATE_LIMIT_CONFIG.api.prod;
  const llmMax = isDevEnv
    ? RATE_LIMIT_CONFIG.llm.dev
    : RATE_LIMIT_CONFIG.llm.prod;

  // JSON handler for rate limit responses
  const rateLimitJSONHandler = (req, res, _next, options) => {
    const retryAfter = res.getHeader('Retry-After');
    res.status(options.statusCode).json({
      error: 'Too Many Requests',
      message: options.message,
      retryAfter,
      path: req.path,
      requestId: req.id,
    });
  };

  // General limiter (all routes)
  const generalLimiter = rateLimit({
    windowMs: RATE_LIMIT_CONFIG.general.windowMs,
    max: generalMax,
    message: 'Too many requests from this IP',
    skip: (req) => req.path === '/metrics' || req.path === '/api/role-classify',
  });
  app.use(generalLimiter);

  // API-specific limiter
  app.use(
    '/api/',
    rateLimit({
      windowMs: RATE_LIMIT_CONFIG.api.windowMs,
      max: apiMax,
      message: 'Global rate limit exceeded',
      standardHeaders: true,
      legacyHeaders: false,
      handler: rateLimitJSONHandler,
    })
  );

  // LLM endpoints limiter (higher limits for span labeling)
  app.use(
    '/llm/',
    rateLimit({
      windowMs: RATE_LIMIT_CONFIG.llm.windowMs,
      max: llmMax,
      message: 'Too many LLM requests',
      standardHeaders: true,
      legacyHeaders: false,
      handler: rateLimitJSONHandler,
    })
  );

  // Route-specific burst limiters
  const makeBurstLimiter = (windowMs, max, message) =>
    rateLimit({
      windowMs,
      max,
      message,
      standardHeaders: true,
      legacyHeaders: false,
      handler: rateLimitJSONHandler,
    });

  // Video validation endpoint burst limits
  app.use(
    '/api/video/validate',
    makeBurstLimiter(
      RATE_LIMIT_CONFIG.videoValidate.burst.windowMs,
      RATE_LIMIT_CONFIG.videoValidate.burst.max,
      'Too many compatibility checks in a short time'
    ),
    makeBurstLimiter(
      RATE_LIMIT_CONFIG.videoValidate.minute.windowMs,
      RATE_LIMIT_CONFIG.videoValidate.minute.max,
      'Too many compatibility checks per minute'
    )
  );

  // Video suggestions endpoint burst limits
  app.use(
    '/api/video/suggestions',
    makeBurstLimiter(
      RATE_LIMIT_CONFIG.videoSuggestions.burst.windowMs,
      RATE_LIMIT_CONFIG.videoSuggestions.burst.max,
      'Too many suggestion requests in a short time'
    ),
    makeBurstLimiter(
      RATE_LIMIT_CONFIG.videoSuggestions.minute.windowMs,
      RATE_LIMIT_CONFIG.videoSuggestions.minute.max,
      'Too many suggestion requests per minute'
    )
  );

  // Health check limiter
  app.use(
    ['/health', '/health/ready', '/health/live'],
    rateLimit({
      windowMs: RATE_LIMIT_CONFIG.health.windowMs,
      max: RATE_LIMIT_CONFIG.health.max,
      message: 'Too many health check requests, please slow down',
    })
  );

  logger.info('Rate limiting enabled', {
    environment: isDevEnv ? 'development' : 'production',
    generalMax,
    apiMax,
    llmMax,
  });
}

/**
 * Apply CORS middleware
 */
export function applyCorsMiddleware(app) {
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin in development (testing tools)
        if (!origin && process.env.NODE_ENV !== 'production') {
          return callback(null, true);
        }

        // Require origin header in production
        if (!origin && process.env.NODE_ENV === 'production') {
          logger.warn('CORS blocked request with no origin in production');
          return callback(new Error('Origin header required'));
        }

        // Get allowed origins based on environment
        const allowedOrigins =
          process.env.NODE_ENV === 'production'
            ? (process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || '')
                .split(',')
                .map((o) => o.trim())
                .filter(Boolean)
            : CORS_CONFIG.development;

        // Validate CORS configuration in production
        if (process.env.NODE_ENV === 'production' && allowedOrigins.length === 0) {
          logger.error('ALLOWED_ORIGINS not configured for production', {
            ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
            FRONTEND_URL: process.env.FRONTEND_URL,
          });
          return callback(
            new Error('CORS configuration error: No allowed origins configured for production')
          );
        }

        // Check if origin is allowed
        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          logger.warn('CORS blocked request from unauthorized origin', {
            origin,
            allowedOrigins,
          });
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
      exposedHeaders: ['X-Request-Id'],
      maxAge: 86400, // 24 hours
      preflightContinue: false,
      optionsSuccessStatus: 204,
    })
  );
}

/**
 * Apply body parser middleware
 */
export function applyBodyParserMiddleware(app) {
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ limit: '2mb', extended: true }));
  app.use(express.raw({ limit: '2mb' }));
  app.use(express.text({ limit: '2mb' }));
}

/**
 * Apply logging and metrics middleware
 * Requires services to be passed in
 */
export function applyLoggingAndMetricsMiddleware(app, { logger, metricsService }) {
  app.use(logger.requestLogger());
  app.use(metricsService.middleware());
}

/**
 * Apply request coalescing middleware
 * Reduces duplicate API calls by 50-80%
 */
export function applyRequestCoalescingMiddleware(app) {
  app.use(requestCoalescing.middleware());
}

/**
 * Configure all middleware in the correct order
 * This is the main function to call from app setup
 *
 * @param {express.Application} app - Express app instance
 * @param {Object} services - Services required by middleware (logger, metrics)
 */
export function configureMiddleware(app, services) {
  // 1. Request ID (must be first)
  applyRequestIdMiddleware(app);

  // 2. Security
  applySecurityMiddleware(app);

  // 3. Compression
  applyCompressionMiddleware(app);

  // 4. Rate limiting
  applyRateLimitingMiddleware(app);

  // 5. CORS
  applyCorsMiddleware(app);

  // 6. Body parsers
  applyBodyParserMiddleware(app);

  // 7. Logging and metrics
  applyLoggingAndMetricsMiddleware(app, services);

  // 8. Request coalescing
  applyRequestCoalescingMiddleware(app);

  logger.info('All middleware configured successfully');
}
