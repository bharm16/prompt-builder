import type { DIContainer } from '@infrastructure/DIContainer';
import { VideoJobStore } from '@services/video-generation/jobs/VideoJobStore';
import { RequestIdempotencyService } from '@services/idempotency/RequestIdempotencyService';
import type { FirestoreCircuitExecutor } from '@services/firestore/FirestoreCircuitExecutor';
import type { ServiceConfig } from './service-config.types.ts';

export function registerVideoJobServices(container: DIContainer): void {
  container.register(
    'videoJobStore',
    (firestoreCircuitExecutor: FirestoreCircuitExecutor, config: ServiceConfig) =>
      new VideoJobStore(firestoreCircuitExecutor, config.videoJobs.maxAttempts),
    ['firestoreCircuitExecutor', 'config'],
    { singleton: true }
  );

  container.register(
    'requestIdempotencyService',
    (firestoreCircuitExecutor: FirestoreCircuitExecutor, config: ServiceConfig) =>
      new RequestIdempotencyService(firestoreCircuitExecutor, {
        pendingLockTtlMs: config.idempotency.pendingLockTtlMs,
        replayTtlMs: config.idempotency.replayTtlMs,
      }),
    ['firestoreCircuitExecutor', 'config'],
    { singleton: true }
  );
}
