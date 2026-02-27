import type { BillingProfileStore } from '@services/payment/BillingProfileStore';
import type { FirestoreCircuitExecutor } from '@services/firestore/FirestoreCircuitExecutor';
import type { PaymentConsistencyStore } from '@services/payment/PaymentConsistencyStore';
import type { PaymentService } from '@services/payment/PaymentService';
import type { StripeWebhookEventStore } from '@services/payment/StripeWebhookEventStore';

interface StarterGrantInfo {
  starterGrantCredits: number | null;
  starterGrantGrantedAtMs: number | null;
}

type CreditTransaction = unknown;

interface CreditGrantMetadata {
  source: string;
  reason: string;
  referenceId: string;
}

interface PaymentMetricsService {
  recordAlert(alertName: string, metadata?: Record<string, unknown>): void;
}

export interface PaymentUserCreditService {
  getStarterGrantInfo(userId: string): Promise<StarterGrantInfo>;
  listCreditTransactions(userId: string, limit: number): Promise<CreditTransaction[]>;
  addCredits(userId: string, amount: number, metadata: CreditGrantMetadata): Promise<void>;
}

export interface PaymentRouteServices {
  paymentService: PaymentService;
  billingProfileStore: BillingProfileStore;
  webhookEventStore: StripeWebhookEventStore;
  userCreditService: PaymentUserCreditService;
  paymentConsistencyStore?: PaymentConsistencyStore;
  metricsService?: PaymentMetricsService;
  firestoreCircuitExecutor?: Pick<FirestoreCircuitExecutor, 'isWriteAllowed' | 'getRetryAfterSeconds'>;
}

export interface PaymentRouteDeps {
  paymentService: PaymentService;
  billingProfileStore: BillingProfileStore;
  userCreditService: PaymentUserCreditService;
}

export interface WebhookHandlerDeps extends PaymentRouteServices {}
