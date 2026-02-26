import type { DIContainer } from '@infrastructure/DIContainer';
import { MetricsService } from '@infrastructure/MetricsService';
import { UserCreditService } from '@services/credits/UserCreditService';
import { CreditReconciliationService } from '@services/credits/CreditReconciliationService';
import { createCreditReconciliationWorker } from '@services/credits/CreditReconciliationWorker';
import { createCreditRefundSweeper } from '@services/credits/CreditRefundSweeper';
import { RefundFailureStore, setRefundFailureStore } from '@services/credits/RefundFailureStore';
import type { FirestoreCircuitExecutor } from '@services/firestore/FirestoreCircuitExecutor';
import type { ServiceConfig } from './service-config.types.ts';

export function registerCreditServices(container: DIContainer): void {
  container.register(
    'userCreditService',
    (firestoreCircuitExecutor: FirestoreCircuitExecutor) => new UserCreditService(firestoreCircuitExecutor),
    ['firestoreCircuitExecutor'],
    { singleton: true }
  );
  container.register(
    'creditReconciliationService',
    (
      userCreditService: UserCreditService,
      firestoreCircuitExecutor: FirestoreCircuitExecutor,
      metricsService: MetricsService,
      config: ServiceConfig
    ) =>
      new CreditReconciliationService(userCreditService, firestoreCircuitExecutor, {
        incrementalScanLimit: config.credits.reconciliation.incrementalScanLimit,
        fullPassPageSize: config.credits.reconciliation.fullPassPageSize,
        metrics: metricsService,
      }),
    ['userCreditService', 'firestoreCircuitExecutor', 'metricsService', 'config'],
    { singleton: true }
  );
  container.register(
    'creditReconciliationWorker',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DI registration boundary is runtime-resolved
    (creditReconciliationService: any, metricsService: MetricsService, config: ServiceConfig) =>
      createCreditReconciliationWorker(creditReconciliationService, metricsService, config.credits.reconciliation),
    ['creditReconciliationService', 'metricsService', 'config'],
    { singleton: true }
  );
  container.register(
    'refundFailureStore',
    (firestoreCircuitExecutor: FirestoreCircuitExecutor) => {
      const store = new RefundFailureStore(firestoreCircuitExecutor);
      setRefundFailureStore(store);
      return store;
    },
    ['firestoreCircuitExecutor'],
    { singleton: true }
  );

  container.register(
    'creditRefundSweeper',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DI container values are untyped at registration boundary
    (refundFailureStore: any, creditService: UserCreditService, metricsService: MetricsService, config: ServiceConfig) =>
      createCreditRefundSweeper(refundFailureStore, creditService, metricsService, config.credits.refundSweeper),
    ['refundFailureStore', 'userCreditService', 'metricsService', 'config'],
    { singleton: true }
  );
}
