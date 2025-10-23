import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import compression from 'compression';
import { validateEnv } from './src/utils/validateEnv.js';

// Import infrastructure
import { logger } from './src/infrastructure/Logger.js';
import { metricsService } from './src/infrastructure/MetricsService.js';

// Import clients
import { OpenAIAPIClient } from './src/clients/OpenAIAPIClient.js';

// Import services
import { cacheService } from './src/services/CacheService.js';
import { PromptOptimizationService } from './src/services/PromptOptimizationService.js';
import { QuestionGenerationService } from './src/services/QuestionGenerationService.js';
import { EnhancementService } from './src/services/EnhancementService.js';
import { SceneDetectionService } from './src/services/SceneDetectionService.js';
import { VideoConceptService } from './src/services/VideoConceptService.js';
import { TextCategorizerService } from './src/services/TextCategorizerService.js';

// Import middleware
import { requestIdMiddleware } from './src/middleware/requestId.js';
import { errorHandler } from './src/middleware/errorHandler.js';
import { apiAuthMiddleware } from './src/middleware/apiAuth.js';

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
// Initialize Services
// ============================================================================

// Initialize OpenAI API client with circuit breaker
// Timeout set to 60s to accommodate large prompts (especially video mode)
const claudeClient = new OpenAIAPIClient(process.env.OPENAI_API_KEY, {
  timeout: parseInt(process.env.OPENAI_TIMEOUT_MS) || 60000,
  model: process.env.OPENAI_MODEL || 'gpt-4o-mini', // Default to gpt-4o-mini, can be overridden
});

// Initialize business logic services
const promptOptimizationService = new PromptOptimizationService(claudeClient);
const questionGenerationService = new QuestionGenerationService(claudeClient);
const enhancementService = new EnhancementService(claudeClient);
const sceneDetectionService = new SceneDetectionService(claudeClient);
const videoConceptService = new VideoConceptService(claudeClient);
const textCategorizerService = new TextCategorizerService(claudeClient);

logger.info('All services initialized successfully');

// ============================================================================
// Middleware Stack
// ============================================================================

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
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
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
    max: 60, // broad per-minute cap for all API calls
    message: 'Global rate limit exceeded',
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

// ============================================================================
// Routes
// ============================================================================

// Health check and metrics routes
const healthRoutes = createHealthRoutes({
  claudeClient,
  cacheService,
  metricsService,
});
app.use('/', healthRoutes);

// API routes with authentication
const apiRoutes = createAPIRoutes({
  promptOptimizationService,
  questionGenerationService,
  enhancementService,
  sceneDetectionService,
  videoConceptService,
  textCategorizerService,
});

app.use('/llm/label-spans', apiAuthMiddleware, labelSpansRoute);
app.use('/api/role-classify', apiAuthMiddleware, roleClassifyRoute);
app.use('/api', apiAuthMiddleware, apiRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
    requestId: req.id,
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// ============================================================================
// Server Startup
// ============================================================================

// Only start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
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
  process.on('SIGTERM', () => {
    logger.info('SIGTERM signal received: closing HTTP server');
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
  });
}

// Export app for testing
export default app;
