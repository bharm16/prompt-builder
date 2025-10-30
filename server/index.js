// IMPORTANT: Import instrument.mjs FIRST, before any other imports
import './instrument.mjs';

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import compression from 'compression';
import { validateEnv } from './src/utils/validateEnv.js';
import * as Sentry from '@sentry/node';

// Import Sentry config
import { initSentry, sentryErrorHandler } from './src/config/sentry.js';

// Import infrastructure
import { logger } from './src/infrastructure/Logger.js';
import { metricsService } from './src/infrastructure/MetricsService.js';

// Import clients
import { OpenAIAPIClient } from './src/clients/OpenAIAPIClient.js';
import { GroqAPIClient } from './src/clients/GroqAPIClient.js';

// Import services
import { cacheService } from './src/services/CacheService.js';
import { PromptOptimizationService } from './src/services/PromptOptimizationService.js';
import { QuestionGenerationService } from './src/services/QuestionGenerationService.js';
import { EnhancementService } from './src/services/EnhancementService.js';
import { SceneDetectionService } from './src/services/SceneDetectionService.js';
import { VideoConceptService } from './src/services/VideoConceptService.js';
import { TextCategorizerService } from './src/services/TextCategorizerService.js';
import { initSpanLabelingCache } from './src/services/SpanLabelingCacheService.js';

// Import config
import { createRedisClient, closeRedisClient } from './src/config/redis.js';

// Import middleware
import { requestIdMiddleware } from './src/middleware/requestId.js';
import { errorHandler } from './src/middleware/errorHandler.js';
import { apiAuthMiddleware } from './src/middleware/apiAuth.js';
import { requestCoalescing } from './src/middleware/requestCoalescing.js';
import { createBatchMiddleware } from './src/middleware/requestBatching.js';

// Import routes
import { createAPIRoutes } from './src/routes/api.routes.js';
import { createHealthRoutes } from './src/routes/health.routes.js';
import { roleClassifyRoute } from './src/routes/roleClassifyRoute.js';
import { labelSpansRoute } from './src/routes/labelSpansRoute.js';

// Load environment variables
dotenv.config();

// Validate environment variables at startup
try {
  validateEnv();
  logger.info('Environment variables validated successfully');
} catch (error) {
  logger.error('Environment validation failed', error);
  console.error('❌ Environment validation failed:', error.message);
  console.error(
    'Please check your .env file. See .env.example for required variables.'
  );
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3001;

// Behind Cloud Run/ALB/Ingress, trust the upstream proxy for correct client IPs
// Ensures rate limiting, logging, and security middleware see real IPs
app.set('trust proxy', 1);

// In Vitest runs, ensure global.fetch is a fast stub unless already mocked by tests
if ((process.env.VITEST || process.env.VITEST_WORKER_ID) && !(global.fetch && typeof global.fetch === 'function' && 'mock' in global.fetch)) {
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ content: [{ text: 'Optimized code prompt response' }] }),
  });
}

// ============================================================================
// Initialize Services - Variables declared at module scope
// ============================================================================

let claudeClient;
let groqClient = null;
let promptOptimizationService;
let questionGenerationService;
let enhancementService;
let sceneDetectionService;
let videoConceptService;
let textCategorizerService;
let redisClient;
let spanLabelingCacheService;

/**
 * Initialize and validate all services asynchronously
 * Fails fast if critical dependencies (OpenAI API) are unavailable
 */
async function initializeServices() {
  // Initialize OpenAI API client with circuit breaker
  // Timeout set to 60s to accommodate large prompts (especially video mode)
  claudeClient = new OpenAIAPIClient(process.env.OPENAI_API_KEY, {
    timeout: parseInt(process.env.OPENAI_TIMEOUT_MS) || 60000,
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  });

  // Validate OpenAI API key (CRITICAL - fail fast)
  logger.info('Validating OpenAI API key...');
  const openAIHealth = await claudeClient.healthCheck();
  
  if (!openAIHealth.healthy) {
    logger.error('❌ OpenAI API key validation failed', {
      error: openAIHealth.error
    });
    console.error('\n❌ FATAL: OpenAI API key validation failed');
    console.error('The application cannot function without a valid OpenAI API key');
    console.error('Please check your OPENAI_API_KEY in .env file\n');
    process.exit(1); // Exit immediately - fail fast
  }
  
  logger.info('✅ OpenAI API key validated successfully', {
    responseTime: openAIHealth.responseTime
  });

  // Initialize Groq API client for fast draft generation (OPTIONAL)
  // Only initialized if GROQ_API_KEY is provided
  if (process.env.GROQ_API_KEY) {
    groqClient = new GroqAPIClient(process.env.GROQ_API_KEY, {
      timeout: parseInt(process.env.GROQ_TIMEOUT_MS) || 5000,
      model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
    });
    logger.info('Groq client initialized for two-stage optimization');

    // Validate Groq API key (OPTIONAL - degrade gracefully on failure)
    try {
      const groqHealth = await groqClient.healthCheck();
      
      if (!groqHealth.healthy) {
        logger.warn('⚠️  Groq API key validation failed - two-stage optimization disabled', {
          error: groqHealth.error
        });
        groqClient = null; // Disable optional feature
      } else {
        logger.info('✅ Groq API key validated successfully', {
          responseTime: groqHealth.responseTime
        });
      }
    } catch (err) {
      logger.warn('⚠️  Failed to validate Groq API key - two-stage optimization disabled', {
        error: err.message
      });
      groqClient = null; // Disable optional feature
    }
  } else {
    logger.warn('GROQ_API_KEY not provided, two-stage optimization disabled');
  }

  // Initialize business logic services
  promptOptimizationService = new PromptOptimizationService(claudeClient, groqClient);
  questionGenerationService = new QuestionGenerationService(claudeClient);
  enhancementService = new EnhancementService(claudeClient);
  sceneDetectionService = new SceneDetectionService(claudeClient);
  videoConceptService = new VideoConceptService(claudeClient);
  textCategorizerService = new TextCategorizerService(claudeClient);

  // Initialize Redis and span labeling cache
  // Redis provides 70-90% cache hit rate for span labeling, reducing API latency to <5ms
  redisClient = createRedisClient();
  spanLabelingCacheService = initSpanLabelingCache({
    redis: redisClient,
    defaultTTL: 3600, // 1 hour for exact matches
    shortTTL: 300,    // 5 minutes for large texts
    maxMemoryCacheSize: 100,
  });

  logger.info('All services initialized and validated successfully');
}

// ============================================================================
// Middleware Stack
// ============================================================================
// Note: Sentry is initialized in instrument.mjs (imported at the top)

// Request ID middleware FIRST so all responses include X-Request-Id
app.use(requestIdMiddleware);

// Security middleware - Enhanced Helmet configuration
app.use(
  helmet({
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
  })
);

// Additional security headers
app.use((req, res, next) => {
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  // Allow cross-origin requests in development for CORS to work
  // In production, these should be stricter based on deployment architecture
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  }
  // Use 'cross-origin' instead of 'same-origin' to allow CORS
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
});

// Compression middleware
app.use(
  compression({
    filter: (req, res) => {
      if (req.headers['x-no-compression']) return false;
      return compression.filter(req, res);
    },
    level: 6,
  })
);

// Rate limiting (disabled in test/Vitest environments)
const isTestEnv = process.env.NODE_ENV === 'test' || !!process.env.VITEST_WORKER_ID || !!process.env.VITEST;
const isDevEnv = process.env.NODE_ENV !== 'production' && !isTestEnv;
if (!isTestEnv) {
  // More generous limits in development to align with OpenAI's 500 RPM
  const generalMax = isDevEnv ? 500 : 100;
  const apiMax = isDevEnv ? 300 : 60;

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: generalMax, // limit each IP to 500 requests per 15min (dev) or 100 (prod)
    message: 'Too many requests from this IP',
    // Avoid rate limiting the metrics endpoint and role-classify endpoint
    skip: (req) => req.path === '/metrics' || req.path === '/api/role-classify',
  });

  // Apply a general limiter across all routes
  app.use(limiter);

  // JSON handler for rate limit responses (prod-safe structure)
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

  // Apply API-specific limiter (broad cap)
  app.use('/api/', rateLimit({
    windowMs: 60 * 1000,
    max: apiMax, // 300 req/min (dev) or 60 (prod) - aligns with OpenAI's 500 RPM
    message: 'Global rate limit exceeded',
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitJSONHandler,
  }));

  // LLM endpoints get even higher limits to support rapid span labeling during editing
  app.use('/llm/', rateLimit({
    windowMs: 60 * 1000,
    max: isDevEnv ? 400 : 100, // 400 req/min (dev) or 100 (prod) for span labeling
    message: 'Too many LLM requests',
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitJSONHandler,
  }));

  // Route-specific burst limiters to smooth spikes (prod-ready)
  const makeBurstLimiter = (windowMs, max, message) =>
    rateLimit({
      windowMs,
      max,
      message,
      standardHeaders: true,
      legacyHeaders: false,
      handler: rateLimitJSONHandler,
    });

  // Compatibility: allow moderate typing but prevent bursts
  app.use(
    '/api/video/validate',
    makeBurstLimiter(2 * 1000, 3, 'Too many compatibility checks in a short time'),
    makeBurstLimiter(60 * 1000, 30, 'Too many compatibility checks per minute')
  );

  // Suggestions: heavier calls, slightly stricter
  app.use(
    '/api/video/suggestions',
    makeBurstLimiter(3 * 1000, 2, 'Too many suggestion requests in a short time'),
    makeBurstLimiter(60 * 1000, 20, 'Too many suggestion requests per minute')
  );

  // Add a health-specific limiter to prevent abuse of health endpoints
  const healthLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 60, // allow up to 60 health checks per minute per IP
    message: 'Too many health check requests, please slow down',
  });
  app.use(['/health', '/health/ready', '/health/live'], healthLimiter);
  logger.info('Rate limiting enabled');
}

// Enhanced CORS configuration
app.use(
  cors({
    origin: (origin, callback) => {
      // Only allow requests with no origin in development (for testing tools like Postman)
      if (!origin && process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }

      // In production, require origin header
      if (!origin && process.env.NODE_ENV === 'production') {
        logger.warn('CORS blocked request with no origin in production');
        return callback(new Error('Origin header required'));
      }

      const allowedOrigins =
        process.env.NODE_ENV === 'production'
          ? (process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || '')
              .split(',')
              .map((o) => o.trim())
              .filter(Boolean)
          : ['http://localhost:5173', 'http://localhost:5174'];

      // Validate CORS configuration in production
      if (process.env.NODE_ENV === 'production' && allowedOrigins.length === 0) {
        logger.error('ALLOWED_ORIGINS not configured for production', {
          ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
          FRONTEND_URL: process.env.FRONTEND_URL
        });
        return callback(new Error('CORS configuration error: No allowed origins configured for production'));
      }

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

// Body parsers with size limits (2mb is sufficient for text prompts)
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ limit: '2mb', extended: true }));
app.use(express.raw({ limit: '2mb' }));
app.use(express.text({ limit: '2mb' }));

// Request ID middleware already applied above

// Request logging middleware
app.use(logger.requestLogger());

// Metrics middleware
app.use(metricsService.middleware());

// Request coalescing middleware (deduplicates identical in-flight requests)
// This reduces duplicate OpenAI API calls by 50-80% under concurrent load
app.use(requestCoalescing.middleware());

// ============================================================================
// Routes
// ============================================================================

// Note: Routes and error handlers will be registered after service initialization in startServer()

// ============================================================================
// Server Startup
// ============================================================================

// Only start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  // Use async IIFE to properly handle service initialization
  (async function startServer() {
    try {
      // Initialize and validate all services (fail fast if critical services unavailable)
      await initializeServices();

      // Register routes AFTER services are initialized
      const healthRoutes = createHealthRoutes({
        claudeClient,
        groqClient,
        cacheService,
        metricsService,
      });
      app.use('/', healthRoutes);

      const apiRoutes = createAPIRoutes({
        promptOptimizationService,
        questionGenerationService,
        enhancementService,
        sceneDetectionService,
        videoConceptService,
        textCategorizerService,
      });

      app.use('/llm/label-spans', apiAuthMiddleware, labelSpansRoute);
      // Batch endpoint for processing multiple span labeling requests
      // Reduces API calls by 60% under concurrent load
      app.post('/llm/label-spans-batch', apiAuthMiddleware, createBatchMiddleware());
      app.use('/api/role-classify', apiAuthMiddleware, roleClassifyRoute);
      app.use('/api', apiAuthMiddleware, apiRoutes);

      // 404 handler - must be registered AFTER all routes
      app.use((req, res) => {
        res.status(404).json({
          error: 'Not found',
          path: req.path,
          requestId: req.id,
        });
      });

      // The error handler must be registered before any other error middleware and after all controllers
      Sentry.setupExpressErrorHandler(app);

      // Optional fallthrough error handler
      app.use(function onError(err, req, res, next) {
        // The error id is attached to `res.sentry` to be returned
        // and optionally displayed to the user for support.
        res.statusCode = 500;
        res.end(res.sentry + "\n");
      });

      // Error handling middleware (must be last)
      app.use(errorHandler);

      // Start server only after successful initialization
      const server = app.listen(PORT, () => {
        logger.info('Server started successfully', {
          port: PORT,
          environment: process.env.NODE_ENV || 'development',
          nodeVersion: process.version,
        });
        console.log(`🚀 Proxy server running on http://localhost:${PORT}`);
        console.log(`📊 Metrics available at http://localhost:${PORT}/metrics`);
        console.log(`💚 Health check at http://localhost:${PORT}/health`);
      });

      // Configure server timeouts
      server.keepAliveTimeout = 65000;
      server.headersTimeout = 66000;

      // Graceful shutdown
      process.on('SIGTERM', async () => {
        logger.info('SIGTERM signal received: closing HTTP server');

        // Close HTTP server
        server.close(async () => {
          logger.info('HTTP server closed');

          // Close Redis connection
          await closeRedisClient(redisClient);

          // Stop cache cleanup interval
          if (spanLabelingCacheService) {
            spanLabelingCacheService.stopPeriodicCleanup();
          }

          process.exit(0);
        });
      });
      
    } catch (error) {
      logger.error('❌ Server initialization failed', error);
      console.error('\n❌ FATAL: Server initialization failed');
      console.error(error.message);
      process.exit(1);
    }
  })();
}

// Export app for testing
export default app;
