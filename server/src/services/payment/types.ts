export interface PaymentInvoice {
  id: string;
  number: string | null;
  status: string | null;
  created: number | null;
  currency: string | null;
  amountDue: number | null;
  amountPaid: number;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
  livemode: boolean;
  customerId: string | null;
  subscriptionId: string | null;
  subscriptionDetailsUserId: string | null;
  lineItems: PaymentInvoiceLineItem[];
}

export interface PaymentInvoiceLineItem {
  priceId: string | null;
  quantity: number | null;
  amount: number | null;
  proration: boolean;
  metadataUserId: string | null;
}

export interface PaymentCheckoutSession {
  id: string;
  mode: "subscription" | "payment" | "setup" | string;
  livemode: boolean;
  metadataUserId: string | null;
  clientReferenceId: string | null;
  customerId: string | null;
  subscriptionId: string | null;
  creditAmountMetadata: string | null;
}

interface PaymentEventBase {
  id: string;
  livemode: boolean;
  created: number;
}

export interface CheckoutSessionCompletedEvent extends PaymentEventBase {
  type: "checkout.session.completed";
  payload: PaymentCheckoutSession;
}

export interface InvoicePaidEvent extends PaymentEventBase {
  type: "invoice.paid";
  payload: PaymentInvoice;
}

export interface OtherPaymentEvent extends PaymentEventBase {
  type: "__other__";
  rawType: string;
  payload: unknown;
}

export type PaymentEvent =
  | CheckoutSessionCompletedEvent
  | InvoicePaidEvent
  | OtherPaymentEvent;

export function describePaymentEventType(event: PaymentEvent): string {
  return event.type === "__other__" ? event.rawType : event.type;
}

export interface CheckoutSessionLink {
  url: string;
}

export interface BillingPortalLink {
  url: string;
}

export interface PaymentCustomer {
  id: string;
  livemode: boolean;
}

export interface InvoiceCreditCalculation {
  credits: number;
  missingPriceIds: string[];
}
