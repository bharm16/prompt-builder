/**
 * Server Entry Point
 *
 * Minimal orchestration that:
 * 1. Validates environment
 * 2. Configures dependency injection
 * 3. Initializes services
 * 4. Creates Express app
 * 5. Starts server
 * 6. Sets up graceful shutdown
 *
 * All business logic is delegated to specialized modules.
 */

// IMPORTANT: Import instrument.mjs FIRST, before any other imports
import './instrument.mjs';

import dotenv from 'dotenv';
import { validateEnv } from './src/utils/validateEnv.js';
import { logger } from './src/infrastructure/Logger.js';
import { configureServices, initializeServices } from './src/config/services.config.js';
import { createApp } from './src/app.js';
import { startServer, setupGracefulShutdown } from './src/server.js';

// Load environment variables
dotenv.config();

/**
 * Bootstrap the application
 */
async function bootstrap() {
  try {
    // ========================================================================
    // 1. Validate Environment
    // ========================================================================
    logger.info('Validating environment variables...');
    validateEnv();
    logger.info('✅ Environment variables validated successfully');

    // ========================================================================
    // 2. Configure Dependency Injection Container
    // ========================================================================
    logger.info('Configuring dependency injection container...');
    const container = configureServices();
    logger.info('✅ DI container configured with all service definitions');

    // ========================================================================
    // 3. Initialize and Validate Services
    // ========================================================================
    logger.info('Initializing services...');
    await initializeServices(container);
    logger.info('✅ All services initialized and validated');

    // ========================================================================
    // 4. Create Express Application
    // ========================================================================
    logger.info('Creating Express application...');
    const app = createApp(container);
    logger.info('✅ Express app created with middleware and routes');

    // ========================================================================
    // 5. Start HTTP Server
    // ========================================================================
    logger.info('Starting HTTP server...');
    const server = await startServer(app, container);
    logger.info('✅ Server started successfully');

    // ========================================================================
    // 6. Setup Graceful Shutdown
    // ========================================================================
    setupGracefulShutdown(server, container);
    logger.info('✅ Graceful shutdown handlers registered');

    return { app, server, container };

  } catch (error) {
    logger.error('❌ Application bootstrap failed', error);
    console.error('\n❌ FATAL: Application failed to start');
    console.error(error.message);

    // Throw error instead of process.exit to allow parent processes to handle
    throw error;
  }
}

// ============================================================================
// Application Initialization
// ============================================================================

// In test environment, initialize app synchronously without starting server
// In production, start the full server
const isTestEnv = process.env.NODE_ENV === 'test' || process.env.VITEST || process.env.VITEST_WORKER_ID;

let appInstance = null;
let containerInstance = null;

if (isTestEnv) {
  // Test mode: Initialize services but don't start server
  // Use top-level await (supported in ES modules)
  try {
    logger.info('Initializing application in test mode...');
    containerInstance = configureServices();
    await initializeServices(containerInstance);
    appInstance = createApp(containerInstance);
    logger.info('Application initialized successfully for testing');
  } catch (error) {
    logger.error('Failed to initialize app in test mode', error);
    console.error('Test initialization failed:', error);
    throw error;
  }
} else {
  // Production mode: Full bootstrap with server startup
  bootstrap().catch((error) => {
    console.error('Fatal error during bootstrap:', error);
    process.exit(1);
  });
}

// ============================================================================
// Exports
// ============================================================================

// Export app for testing (default export for backward compatibility)
export default appInstance;

// Export bootstrap function and instances for programmatic use
export { bootstrap, appInstance, containerInstance };
