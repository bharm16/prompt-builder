import express from 'express';
import { createPaymentHandlers } from './payment/handlers';
import { createStripeWebhookHandler } from './payment/webhook/handler';
import type { PaymentRouteServices } from './payment/types';

export const createPaymentRoutes = (services: PaymentRouteServices): express.Router => {
  const router = express.Router();
  const handlers = createPaymentHandlers(services);

  router.get('/status', handlers.getStatus);
  router.get('/credits/history', handlers.listCreditHistory);
  router.get('/invoices', handlers.listInvoices);
  router.post('/portal', handlers.createPortalSession);
  router.post('/checkout', handlers.createCheckoutSession);

  return router;
};

export const createWebhookRoutes = (services: PaymentRouteServices): express.Router => {
  const router = express.Router();
  const webhookHandler = createStripeWebhookHandler(services);

  router.post('/webhook', express.raw({ type: 'application/json' }), webhookHandler);

  return router;
};
