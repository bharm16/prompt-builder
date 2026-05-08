import type { BillingProfileStore } from "@services/payment/BillingProfileStore";
import type { FirestoreCircuitExecutor } from "@services/firestore/FirestoreCircuitExecutor";
import type { PaymentConsistencyStore } from "@services/payment/PaymentConsistencyStore";
import type { IPaymentGateway } from "@services/payment/IPaymentGateway";
import type { StripeWebhookEventStore } from "@services/payment/StripeWebhookEventStore";

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
  getBalance(userId: string): Promise<number>;
  getStarterGrantInfo(userId: string): Promise<StarterGrantInfo>;
  listCreditTransactions(
    userId: string,
    limit: number,
  ): Promise<CreditTransaction[]>;
  addCredits(
    userId: string,
    amount: number,
    metadata: CreditGrantMetadata,
  ): Promise<void>;
}

export interface PaymentRouteServices {
  paymentService: IPaymentGateway;
  billingProfileStore: BillingProfileStore;
  webhookEventStore: StripeWebhookEventStore;
  userCreditService: PaymentUserCreditService;
  paymentConsistencyStore?: PaymentConsistencyStore;
  metricsService?: PaymentMetricsService;
  firestoreCircuitExecutor?: Pick<
    FirestoreCircuitExecutor,
    "isWriteAllowed" | "getRetryAfterSeconds"
  >;
}

export interface PaymentRouteDeps {
  paymentService: IPaymentGateway;
  billingProfileStore: BillingProfileStore;
  userCreditService: PaymentUserCreditService;
}

export interface WebhookHandlerDeps extends PaymentRouteServices {}
