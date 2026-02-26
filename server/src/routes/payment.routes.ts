import express from 'express';
import { asyncHandler } from '@middleware/asyncHandler';
import { createPaymentHandlers } from './payment/handlers';
import { createStripeWebhookHandler } from './payment/webhook/handler';
import type { PaymentRouteServices } from './payment/types';

export const createPaymentRoutes = (services: PaymentRouteServices): express.Router => {
  const router = express.Router();
  const handlers = createPaymentHandlers(services);

  router.get('/status', asyncHandler(handlers.getStatus));
  router.get('/credits/history', asyncHandler(handlers.listCreditHistory));
  router.get('/invoices', asyncHandler(handlers.listInvoices));
  router.post('/portal', asyncHandler(handlers.createPortalSession));
  router.post('/checkout', asyncHandler(handlers.createCheckoutSession));

  return router;
};

export const createWebhookRoutes = (services: PaymentRouteServices): express.Router => {
  const router = express.Router();
  const webhookHandler = createStripeWebhookHandler(services);

  router.post('/webhook', express.raw({ type: 'application/json' }), webhookHandler);

  return router;
};
