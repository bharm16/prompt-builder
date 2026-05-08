import type {
  BillingPortalLink,
  CheckoutSessionLink,
  InvoiceCreditCalculation,
  PaymentCustomer,
  PaymentEvent,
  PaymentInvoice,
} from "./types";

export interface IPaymentGateway {
  isPriceIdConfigured(priceId: string): boolean;
  getCreditsForPriceId(priceId: string): number;
  calculateCreditsForInvoice(invoice: PaymentInvoice): InvoiceCreditCalculation;
  resolveUserIdForInvoice(invoice: PaymentInvoice): Promise<string | null>;
  createCheckoutSession(
    userId: string,
    priceId: string,
    returnUrl: string,
    customerId?: string,
  ): Promise<CheckoutSessionLink>;
  createCustomer(userId: string): Promise<PaymentCustomer>;
  createBillingPortalSession(
    customerId: string,
    returnUrl: string,
  ): Promise<BillingPortalLink>;
  listInvoices(customerId: string, limit?: number): Promise<PaymentInvoice[]>;
  listRecentEvents(
    type: string,
    createdAfterUnix: number,
  ): Promise<PaymentEvent[]>;
  constructEvent(payload: string | Buffer, signature: string): PaymentEvent;
}
