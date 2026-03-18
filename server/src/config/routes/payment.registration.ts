/**
 * Payment Route Registration
 *
 * Registers Stripe payment and billing routes.
 * Auth + starter credits required.
 */

import type { Application } from 'express';
import type { DIContainer } from '@infrastructure/DIContainer';
import { apiAuthMiddleware } from '@middleware/apiAuth';
import { createStarterCreditsMiddleware } from '@middleware/starterCredits';
import { createPaymentRoutes } from '@routes/payment.routes';
import type { PaymentRouteServices } from '@routes/payment/types';
import type { PaymentConsistencyStore } from '@services/payment/PaymentConsistencyStore';
import { resolveOptionalService } from './resolve-utils.ts';

export function registerPaymentRoutes(
  app: Application,
  container: DIContainer,
): void {
  const userCreditService = container.resolve('userCreditService');

  const paymentConsistencyStore = resolveOptionalService<PaymentConsistencyStore | null>(
    container,
    'paymentConsistencyStore',
    'payment'
  );
  const paymentMetricsService = resolveOptionalService<NonNullable<PaymentRouteServices['metricsService']> | null>(
    container,
    'metricsService',
    'payment'
  );
  const firestoreCircuitExecutor = container.resolve('firestoreCircuitExecutor');

  const paymentRouteServices: PaymentRouteServices = {
    paymentService: container.resolve<PaymentRouteServices['paymentService']>('paymentService'),
    webhookEventStore: container.resolve<PaymentRouteServices['webhookEventStore']>('stripeWebhookEventStore'),
    billingProfileStore: container.resolve<PaymentRouteServices['billingProfileStore']>('billingProfileStore'),
    userCreditService,
    ...(paymentConsistencyStore ? { paymentConsistencyStore } : {}),
    ...(paymentMetricsService ? { metricsService: paymentMetricsService } : {}),
    firestoreCircuitExecutor,
  };

  const starterCreditsMiddleware = createStarterCreditsMiddleware(userCreditService);
  const paymentRoutes = createPaymentRoutes(paymentRouteServices);
  app.use('/api/payment', apiAuthMiddleware, starterCreditsMiddleware, paymentRoutes);
}
