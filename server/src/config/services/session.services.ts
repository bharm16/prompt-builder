import type { DIContainer } from '@infrastructure/DIContainer';
import { logger } from '@infrastructure/Logger';
import AssetService from '@services/asset/AssetService';
import { BillingProfileStore } from '@services/payment/BillingProfileStore';
import { PaymentService } from '@services/payment/PaymentService';
import { StripeWebhookEventStore } from '@services/payment/StripeWebhookEventStore';
import ReferenceImageService from '@services/reference-images/ReferenceImageService';
import { SessionService } from '@services/sessions/SessionService';
import { SessionStore } from '@services/sessions/SessionStore';

export function registerSessionServices(container: DIContainer): void {
  container.registerValue('billingProfileStore', new BillingProfileStore());
  container.register('paymentService', () => new PaymentService(), [], { singleton: true });
  container.register('stripeWebhookEventStore', () => new StripeWebhookEventStore(), [], { singleton: true });
  container.register('sessionStore', () => new SessionStore(), [], { singleton: true });

  container.register(
    'sessionService',
    (sessionStore: SessionStore) => new SessionService(sessionStore),
    ['sessionStore'],
    { singleton: true }
  );

  container.register(
    'assetService',
    () => {
      try {
        return new AssetService();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.warn('Asset service disabled', { error: errorMessage });
        return null;
      }
    },
    [],
    { singleton: true }
  );

  container.register(
    'referenceImageService',
    () => {
      try {
        return new ReferenceImageService();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.warn('Reference image service disabled', { error: errorMessage });
        return null;
      }
    },
    [],
    { singleton: true }
  );
}
