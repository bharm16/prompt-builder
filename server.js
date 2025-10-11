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

// Import middleware
import { requestIdMiddleware } from './src/middleware/requestId.js';
import { errorHandler } from './src/middleware/errorHandler.js';

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

logger.info('All services initialized successfully');

// ============================================================================
// Middleware Stack
// ============================================================================

// Security middleware
app.use(helmet());

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

// CORS configuration
app.use(
  cors({
    origin:
      process.env.NODE_ENV === 'production'
        ? [process.env.FRONTEND_URL || 'https://yourdomain.com']
        : ['http://localhost:5173', 'http://localhost:5174'],
    credentials: true,
  })
);

// Body parser
app.use(express.json({ limit: '10mb' }));

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

// API routes
const apiRoutes = createAPIRoutes({
  promptOptimizationService,
  questionGenerationService,
  enhancementService,
  sceneDetectionService,
  creativeSuggestionService,
});
app.use('/api', apiRoutes);

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
