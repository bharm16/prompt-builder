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

import express, { type Application } from "express";
import type { AppDependencies } from "./config/app.dependencies.ts";
import { configureMiddleware } from "./config/middleware.config.ts";
import { configureRoutes } from "./config/routes.config.ts";
import { createWebhookRoutes } from "./routes/payment.routes.ts";

/**
 * Create and configure the Express application
 *
 * @param {AppDependencies} dependencies - Pre-resolved app dependencies
 * @returns {express.Application} Configured Express app
 */
export function createApp(dependencies: AppDependencies): Application {
  const app = express();
  const {
    routeContainer,
    paymentRouteServices,
    middlewareServices,
    prewarmDepthEstimator,
  } = dependencies;

  // Trust proxy for correct client IPs behind Cloud Run/ALB/Ingress
  // Ensures rate limiting, logging, and security middleware see real IPs
  app.set("trust proxy", 1);

  // Payment webhooks must run before global JSON parsing
  app.use("/api/payment", createWebhookRoutes(paymentRouteServices));

  // Configure middleware stack
  // Order matters: security, compression, rate limiting, CORS, parsing, logging, metrics
  configureMiddleware(app, middlewareServices);

  // Pre-warm fal.ai depth estimation to reduce cold starts in Create mode.
  prewarmDepthEstimator?.();

  // Register all routes and error handlers
  configureRoutes(app, routeContainer);

  return app;
}
