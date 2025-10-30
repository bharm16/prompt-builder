/**
 * Express Application Factory
 *
 * Creates and configures the Express application with:
 * - Middleware stack
 * - Route registration
 * - Error handling
 *
 * This module is stateless and testable - it takes dependencies as parameters
 * and returns a configured Express app.
 */

import express from 'express';
import { configureMiddleware } from './config/middleware.config.js';
import { configureRoutes } from './config/routes.config.js';

/**
 * Create and configure the Express application
 *
 * @param {DIContainer} container - Dependency injection container with all services
 * @returns {express.Application} Configured Express app
 */
export function createApp(container) {
  const app = express();

  // Trust proxy for correct client IPs behind Cloud Run/ALB/Ingress
  // Ensures rate limiting, logging, and security middleware see real IPs
  app.set('trust proxy', 1);

  // Configure middleware stack
  // Order matters: security, compression, rate limiting, CORS, parsing, logging, metrics
  configureMiddleware(app, {
    logger: container.resolve('logger'),
    metricsService: container.resolve('metricsService'),
  });

  // Register all routes and error handlers
  configureRoutes(app, container);

  return app;
}
