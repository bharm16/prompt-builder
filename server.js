import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import { validateEnv } from './utils/validateEnv.js';

// Import infrastructure
import { logger } from './src/infrastructure/Logger.js';
import { metricsService } from './src/infrastructure/MetricsService.js';

// Import clients
import { ClaudeAPIClient } from './src/clients/ClaudeAPIClient.js';

// Import services
import { cacheService } from './src/services/CacheService.js';
import { PromptOptimizationService } from './src/services/PromptOptimizationService.js';
import { QuestionGenerationService } from './src/services/QuestionGenerationService.js';
import { EnhancementService } from './src/services/EnhancementService.js';
import { SceneDetectionService } from './src/services/SceneDetectionService.js';
import { CreativeSuggestionService } from './src/services/CreativeSuggestionService.js';
import { CreativeSuggestionEnhancedService } from './src/services/CreativeSuggestionEnhancedService.js';

// Import middleware
import { requestIdMiddleware } from './src/middleware/requestId.js';
import { errorHandler } from './src/middleware/errorHandler.js';
import { apiAuthMiddleware } from './src/middleware/apiAuth.js';

// Import routes
import { createAPIRoutes } from './src/routes/api.routes.js';
import { createHealthRoutes } from './src/routes/health.routes.js';

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

// ============================================================================
// Initialize Services
// ============================================================================

// Initialize Claude API client with circuit breaker
// Timeout set to 60s to accommodate large prompts (especially video mode)
const claudeClient = new ClaudeAPIClient(process.env.VITE_ANTHROPIC_API_KEY, {
  timeout: parseInt(process.env.CLAUDE_TIMEOUT_MS) || 60000,
});

// Initialize business logic services
const promptOptimizationService = new PromptOptimizationService(claudeClient);
const questionGenerationService = new QuestionGenerationService(claudeClient);
const enhancementService = new EnhancementService(claudeClient);
const sceneDetectionService = new SceneDetectionService(claudeClient);
const creativeSuggestionService = new CreativeSuggestionService(claudeClient);
// Initialize enhanced service for new features (keeping original for backward compatibility)
const creativeSuggestionEnhancedService = new CreativeSuggestionEnhancedService(claudeClient);

logger.info('All services initialized successfully');

// ============================================================================
// Middleware Stack
// ============================================================================

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
          'https://api.anthropic.com',
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
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
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

// Rate limiting (disabled in test environment)
if (process.env.NODE_ENV !== 'test') {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP',
  });

  const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 10, // max 10 Claude API calls per minute
    message: 'Too many API requests, please try again later',
  });

  app.use('/api/', apiLimiter);
  logger.info('Rate limiting enabled');
}

// Enhanced CORS configuration
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) {
        return callback(null, true);
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

// Body parsers with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(express.raw({ limit: '10mb' }));
app.use(express.text({ limit: '10mb' }));

// Request ID middleware
app.use(requestIdMiddleware);

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
  creativeSuggestionService,
  creativeSuggestionEnhancedService, // Add enhanced service
});
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
