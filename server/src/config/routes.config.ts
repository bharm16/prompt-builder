/**
 * Route Configuration
 *
 * Orchestrates route registration by delegating to domain-scoped modules.
 * Each domain module resolves only the services it needs.
 *
 * Registration order:
 * 1. Health (no auth)
 * 2. Firestore write gate (middleware)
 * 3. Motion / convergence media (gated by PROMPT_OUTPUT_ONLY)
 * 4. Core API, LLM, role classify, suggestions (auth required)
 * 5. Preview / generation (gated by PROMPT_OUTPUT_ONLY)
 * 6. Payment (auth required)
 * 7. 404 fallthrough
 * 8. Error handlers
 */

import type { Application, Request, Response } from "express";
import type { DIContainer } from "@infrastructure/DIContainer";
import { errorHandler } from "@middleware/errorHandler";
import { createFirestoreWriteGateMiddleware } from "@middleware/firestoreWriteGate";
import { getRuntimeFlags } from "./runtime-flags";
import { registerHealthRoutes } from "./routes/health.registration.ts";
import { registerApiRoutes } from "./routes/api.registration.ts";
import { registerMotionRoutes } from "./routes/motion.registration.ts";
import { registerPreviewRoutes } from "./routes/preview.registration.ts";
import { registerPaymentRoutes } from "./routes/payment.registration.ts";

type RequestWithId = Request & {
  id?: string;
};

/**
 * Register all application routes
 */
export function registerRoutes(app: Application, container: DIContainer): void {
  const runtimeFlags = getRuntimeFlags();
  const firestoreCircuitExecutor = container.resolve(
    "firestoreCircuitExecutor",
  );

  // 1. Health routes (no auth)
  registerHealthRoutes(app, container);

  // 2. Firestore write gate: fail-closed for all mutating /api routes
  app.use("/api", createFirestoreWriteGateMiddleware(firestoreCircuitExecutor));

  // 3. Motion / convergence media (gated)
  registerMotionRoutes(app, container, runtimeFlags);

  // 4. Core API, LLM endpoints, suggestions
  registerApiRoutes(app, container, runtimeFlags);

  // 5. Preview / generation (gated)
  registerPreviewRoutes(app, container, runtimeFlags);

  // 6. Payment
  registerPaymentRoutes(app, container);

  // 7. 404 Handler (must be registered AFTER all routes)
  app.use((req: RequestWithId, res: Response): void => {
    res.status(404).json({
      error: "Not found",
      path: req.path,
      requestId: req.id,
    });
  });
}

/**
 * Register error handlers
 * Must be called AFTER all routes are registered
 */
export function registerErrorHandlers(app: Application): void {
  // Sentry error handler (must be before other error handlers)
  // Sentry.setupExpressErrorHandler(app); // Disabled

  // Optional fallthrough error handler
  app.use(function onError(
    err: Error,
    req: Request,
    res: Response & { sentry?: string },
    next: (err?: Error) => void,
  ): void {
    // Only short-circuit when Sentry has attached an error id.
    if (res.headersSent) {
      next(err);
      return;
    }
    if (res.sentry) {
      res.statusCode = 500;
      res.end(`${res.sentry}\n`);
      return;
    }
    next(err);
  });

  // Custom error handler (must be last)
  app.use(errorHandler);
}

/**
 * Configure all routes and error handlers
 * This is the main function to call from app setup
 */
export function configureRoutes(
  app: Application,
  container: DIContainer,
): void {
  registerRoutes(app, container);
  registerErrorHandlers(app);
}
