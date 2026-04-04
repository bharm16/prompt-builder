import type { DIContainer } from "@infrastructure/DIContainer";
import type { PaymentRouteServices } from "@routes/payment/types";
import { initializeDepthWarmer } from "@services/convergence/depth";
import type { PaymentConsistencyStore } from "@services/payment/PaymentConsistencyStore";
import type { MiddlewareServices } from "./middleware.config.ts";
import { getRuntimeFlags } from "./runtime-flags.ts";

export interface AppDependencies {
  routeContainer: DIContainer;
  paymentRouteServices: PaymentRouteServices;
  middlewareServices: MiddlewareServices;
  prewarmDepthEstimator?: () => void;
}

export function resolveAppDependencies(
  container: DIContainer,
): AppDependencies {
  const { promptOutputOnly, processRole } = getRuntimeFlags();

  return {
    routeContainer: container,
    paymentRouteServices: {
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
    },
    middlewareServices: {
      logger: container.resolve("logger"),
      metricsService: container.resolve("metricsService"),
      redisClient: container.resolve("redisClient"),
    },
    ...(!promptOutputOnly && processRole === "api"
      ? { prewarmDepthEstimator: initializeDepthWarmer }
      : {}),
  };
}
