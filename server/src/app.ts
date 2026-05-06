/**
 * Express Application Factory
 *
 * Creates and configures the Express application with:
 * - Middleware stack
 * - Route registration
 * - Error handling
 *
 * This module is stateless and testable - it takes the DI container and
 * returns a configured Express app.
 */

import express, { type Application } from "express";
import type { DIContainer } from "@infrastructure/DIContainer";
import type { PaymentRouteServices } from "@routes/payment/types";
import type { PaymentConsistencyStore } from "@services/payment/PaymentConsistencyStore";
import { initializeDepthWarmer } from "@services/convergence/depth";
import { configureMiddleware } from "./config/middleware.config.ts";
import { configureRoutes } from "./config/routes.config.ts";
import { getRuntimeFlags } from "./config/feature-flags.ts";
import { createWebhookRoutes } from "./routes/payment.routes.ts";

function resolvePaymentRouteServices(
  container: DIContainer,
): PaymentRouteServices {
  return {
    paymentService:
      container.resolve<PaymentRouteServices["paymentService"]>(
        "paymentService",
      ),
    webhookEventStore: container.resolve<
      PaymentRouteServices["webhookEventStore"]
    >("stripeWebhookEventStore"),
    billingProfileStore: container.resolve<
      PaymentRouteServices["billingProfileStore"]
    >("billingProfileStore"),
    userCreditService:
      container.resolve<PaymentRouteServices["userCreditService"]>(
        "userCreditService",
      ),
    paymentConsistencyStore: container.resolve<PaymentConsistencyStore>(
      "paymentConsistencyStore",
    ),
    metricsService:
      container.resolve<NonNullable<PaymentRouteServices["metricsService"]>>(
        "metricsService",
      ),
    firestoreCircuitExecutor: container.resolve<
      NonNullable<PaymentRouteServices["firestoreCircuitExecutor"]>
    >("firestoreCircuitExecutor"),
  };
}

/**
 * Create and configure the Express application
 */
export function createApp(container: DIContainer): Application {
  const app = express();

  // Trust proxy for correct client IPs behind Cloud Run/ALB/Ingress
  app.set("trust proxy", 1);

  // Payment webhooks must run before global JSON parsing
  app.use(
    "/api/payment",
    createWebhookRoutes(resolvePaymentRouteServices(container)),
  );

  // Configure middleware stack
  // Order matters: security, compression, rate limiting, CORS, parsing, logging, metrics
  configureMiddleware(app, {
    logger: container.resolve("logger"),
    metricsService: container.resolve("metricsService"),
    redisClient: container.resolve("redisClient"),
  });

  // Pre-warm fal.ai depth estimation to reduce cold starts in Create mode.
  // Workers skip this — the depth model only matters for the API role.
  if (getRuntimeFlags().processRole === "api") {
    initializeDepthWarmer();
  }

  // Register all routes and error handlers
  configureRoutes(app, container);

  return app;
}
