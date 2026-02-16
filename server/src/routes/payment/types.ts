import type { BillingProfileStore } from '@services/payment/BillingProfileStore';
import type { PaymentService } from '@services/payment/PaymentService';
import type { StripeWebhookEventStore } from '@services/payment/StripeWebhookEventStore';
import type { UserCreditService } from '@services/credits/UserCreditService';

export interface PaymentRouteDeps {
  paymentService: PaymentService;
  billingProfileStore: BillingProfileStore;
  userCreditService: UserCreditService;
}

export interface WebhookHandlerDeps extends PaymentRouteDeps {
  webhookEventStore: StripeWebhookEventStore;
}
