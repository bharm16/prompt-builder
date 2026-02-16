import express from 'express';
import { BillingProfileStore } from '@services/payment/BillingProfileStore';
import { PaymentService } from '@services/payment/PaymentService';
import { StripeWebhookEventStore } from '@services/payment/StripeWebhookEventStore';
import { userCreditService } from '@services/credits/UserCreditService';
import { createPaymentHandlers } from './payment/handlers';
import { createStripeWebhookHandler } from './payment/webhook/handler';

const paymentService = new PaymentService();
const webhookEventStore = new StripeWebhookEventStore();
const billingProfileStore = new BillingProfileStore();

export const createPaymentRoutes = (): express.Router => {
  const router = express.Router();
  const handlers = createPaymentHandlers({ paymentService, billingProfileStore, userCreditService });

  router.get('/status', handlers.getStatus);
  router.get('/credits/history', handlers.listCreditHistory);
  router.get('/invoices', handlers.listInvoices);
  router.post('/portal', handlers.createPortalSession);
  router.post('/checkout', handlers.createCheckoutSession);

  return router;
};

export const createWebhookRoutes = (): express.Router => {
  const router = express.Router();
  const webhookHandler = createStripeWebhookHandler({
    paymentService,
    webhookEventStore,
    billingProfileStore,
    userCreditService,
  });

  router.post('/webhook', express.raw({ type: 'application/json' }), webhookHandler);

  return router;
};
