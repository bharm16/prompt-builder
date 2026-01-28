import type { BillingProfileStore } from '@services/payment/BillingProfileStore';
import type { PaymentService } from '@services/payment/PaymentService';
import type { StripeWebhookEventStore } from '@services/payment/StripeWebhookEventStore';
import type { UserCreditService } from '@services/credits/UserCreditService';

export interface PaymentRouteDeps {
  paymentService: PaymentService;
  billingProfileStore: BillingProfileStore;
}

export interface WebhookHandlerDeps extends PaymentRouteDeps {
  webhookEventStore: StripeWebhookEventStore;
  userCreditService: UserCreditService;
}
