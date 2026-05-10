import type { DIContainer } from '@infrastructure/DIContainer';
import type { FirestoreCircuitExecutor } from '@services/firestore/FirestoreCircuitExecutor';
import { BillingProfileStore } from '@services/payment/BillingProfileStore';
import { createBillingProfileRepairWorker } from '@services/payment/BillingProfileRepairWorker';
import { PaymentConsistencyStore } from '@services/payment/PaymentConsistencyStore';
import { PaymentService } from '@services/payment/PaymentService';
import { StripeWebhookEventStore } from '@services/payment/StripeWebhookEventStore';
import { WebhookReconciliationWorker } from '@services/payment/WebhookReconciliationWorker';
import type { UserCreditService } from '@services/credits/UserCreditService';
import type { ServiceConfig } from './service-config.types.ts';

/**
 * Registers the payment / billing / Stripe stack.
 *
 * Tokens here back the `/api/payment/*` routes plus the webhook reconciliation
 * and billing profile repair background workers. Split out of
 * session.services.ts so the file name matches what's inside.
 */
export function registerPaymentServices(container: DIContainer): void {
  container.register(
    'billingProfileStore',
    (firestoreCircuitExecutor: FirestoreCircuitExecutor) =>
      new BillingProfileStore(firestoreCircuitExecutor),
    ['firestoreCircuitExecutor']
  );
  container.register(
    'paymentService',
    (config: ServiceConfig) => new PaymentService(config.stripe),
    ['config']
  );
  container.register(
    'stripeWebhookEventStore',
    (firestoreCircuitExecutor: FirestoreCircuitExecutor) =>
      new StripeWebhookEventStore(undefined, firestoreCircuitExecutor),
    ['firestoreCircuitExecutor']
  );
  container.register(
    'paymentConsistencyStore',
    (firestoreCircuitExecutor: FirestoreCircuitExecutor) =>
      new PaymentConsistencyStore(firestoreCircuitExecutor),
    ['firestoreCircuitExecutor']
  );
  container.register(
    'webhookReconciliationWorker',
    (
      paymentService: PaymentService,
      webhookEventStore: StripeWebhookEventStore,
      billingProfileStore: BillingProfileStore,
      userCreditService: UserCreditService,
      paymentConsistencyStore: PaymentConsistencyStore,
      config: ServiceConfig
    ) => {
      const wrc = config.stripe.webhookReconciliation;
      if (wrc.disabled) {
        return null;
      }

      const pollIntervalMs = wrc.intervalSeconds * 1000;
      if (pollIntervalMs <= 0) return null;

      return new WebhookReconciliationWorker(
        paymentService,
        webhookEventStore,
        billingProfileStore,
        userCreditService,
        paymentConsistencyStore,
        {
          pollIntervalMs,
          lookbackHours: wrc.lookbackHours,
        }
      );
    },
    [
      'paymentService',
      'stripeWebhookEventStore',
      'billingProfileStore',
      'userCreditService',
      'paymentConsistencyStore',
      'config',
    ]
  );
  container.register(
    'billingProfileRepairWorker',
    (
      paymentConsistencyStore: PaymentConsistencyStore,
      billingProfileStore: BillingProfileStore,
      config: ServiceConfig
    ) =>
      createBillingProfileRepairWorker(
        paymentConsistencyStore,
        billingProfileStore,
        undefined,
        config.stripe.profileRepair
      ),
    ['paymentConsistencyStore', 'billingProfileStore', 'config']
  );
}
