import type { DIContainer } from '@infrastructure/DIContainer';
import { logger } from '@infrastructure/Logger';
import type { Bucket } from '@google-cloud/storage';
import AssetService from '@services/asset/AssetService';
import AssetRepository from '@services/asset/AssetRepository';
import AssetResolverService from '@services/asset/AssetResolverService';
import AssetReferenceImageService from '@services/asset/ReferenceImageService';
import type { FaceEmbeddingService } from '@services/asset/FaceEmbeddingService';
import type { FirestoreCircuitExecutor } from '@services/firestore/FirestoreCircuitExecutor';
import { BillingProfileStore } from '@services/payment/BillingProfileStore';
import { PaymentService } from '@services/payment/PaymentService';
import { StripeWebhookEventStore } from '@services/payment/StripeWebhookEventStore';
import ReferenceImageService from '@services/reference-images/ReferenceImageService';
import { SessionService } from '@services/sessions/SessionService';
import { SessionStore } from '@services/sessions/SessionStore';
import type { ServiceConfig } from './service-config.types.ts';

export function registerSessionServices(container: DIContainer): void {
  container.register(
    'billingProfileStore',
    (firestoreCircuitExecutor: FirestoreCircuitExecutor) =>
      new BillingProfileStore(firestoreCircuitExecutor),
    ['firestoreCircuitExecutor'],
    { singleton: true }
  );
  container.register(
    'paymentService',
    (config: ServiceConfig) => new PaymentService(config.stripe),
    ['config'],
    { singleton: true }
  );
  container.register(
    'stripeWebhookEventStore',
    (firestoreCircuitExecutor: FirestoreCircuitExecutor) =>
      new StripeWebhookEventStore(undefined, firestoreCircuitExecutor),
    ['firestoreCircuitExecutor'],
    { singleton: true }
  );
  container.register('sessionStore', () => new SessionStore(), [], { singleton: true });

  container.register(
    'sessionService',
    (sessionStore: SessionStore) => new SessionService(sessionStore),
    ['sessionStore'],
    { singleton: true }
  );

  container.register(
    'assetService',
    (gcsBucket: Bucket, gcsBucketName: string, faceEmbeddingService: FaceEmbeddingService | null, config: ServiceConfig) => {
      try {
        const repository = new AssetRepository({ bucket: gcsBucket, bucketName: gcsBucketName });
        const resolver = new AssetResolverService(repository);
        const referenceImages = new AssetReferenceImageService();
        const embeddingService = config.features.faceEmbedding ? faceEmbeddingService : null;
        return new AssetService(repository, referenceImages, resolver, undefined, embeddingService);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.warn('Asset service disabled', { error: errorMessage });
        return null;
      }
    },
    ['gcsBucket', 'gcsBucketName', 'faceEmbeddingService', 'config'],
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
