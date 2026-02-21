import type { DIContainer } from '@infrastructure/DIContainer';
import { logger } from '@infrastructure/Logger';
import type { Bucket } from '@google-cloud/storage';
import AssetService from '@services/asset/AssetService';
import AssetRepository from '@services/asset/AssetRepository';
import AssetResolverService from '@services/asset/AssetResolverService';
import AssetReferenceImageService from '@services/asset/ReferenceImageService';
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
    (gcsBucket: Bucket, gcsBucketName: string) => {
      try {
        const repository = new AssetRepository({ bucket: gcsBucket, bucketName: gcsBucketName });
        const resolver = new AssetResolverService(repository);
        const referenceImages = new AssetReferenceImageService();
        return new AssetService(repository, referenceImages, resolver);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.warn('Asset service disabled', { error: errorMessage });
        return null;
      }
    },
    ['gcsBucket', 'gcsBucketName'],
    { singleton: true }
  );

  container.register(
    'referenceImageService',
    (gcsBucket: Bucket, gcsBucketName: string) => {
      try {
        return new ReferenceImageService({ bucket: gcsBucket, bucketName: gcsBucketName });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.warn('Reference image service disabled', { error: errorMessage });
        return null;
      }
    },
    ['gcsBucket', 'gcsBucketName'],
    { singleton: true }
  );
}
