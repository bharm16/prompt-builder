import express, { type Request, type Response } from 'express';
import type Stripe from 'stripe';
import { logger } from '@infrastructure/Logger';
import { admin } from '@infrastructure/firebaseAdmin';
import { PaymentService } from '@services/payment/PaymentService';
import { userCreditService } from '@services/credits/UserCreditService';

const paymentService = new PaymentService();

async function resolveUserId(req: Request): Promise<string | null> {
  const reqWithAuth = req as Request & { user?: { uid?: string }; apiKey?: string; body?: { userId?: string } };

  if (reqWithAuth.user?.uid) {
    return reqWithAuth.user.uid;
  }

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.substring('Bearer '.length).trim()
    : undefined;

  if (token) {
    try {
      const decoded = await admin.auth().verifyIdToken(token);
      const uid = decoded.uid;
      reqWithAuth.user = { uid };
      return uid;
    } catch (error) {
      logger.warn('Failed to verify auth token for payment request', {
        path: req.path,
        error: (error as Error).message,
      });
    }
  }

  if (reqWithAuth.body?.userId) {
    return reqWithAuth.body.userId;
  }

  if (reqWithAuth.apiKey) {
    return reqWithAuth.apiKey;
  }

  return null;
}

export const createPaymentRoutes = (): express.Router => {
  const router = express.Router();

  router.post('/checkout', async (req: Request, res: Response) => {
    const { priceId } = req.body ?? {};
    const userId = await resolveUserId(req);

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (typeof priceId !== 'string' || priceId.trim() === '') {
      return res.status(400).json({ error: 'Invalid priceId' });
    }

    const origin = req.headers.origin || process.env.FRONTEND_URL;
    if (!origin) {
      logger.error('Missing origin for checkout return URL');
      return res.status(500).json({ error: 'Billing return URL is not configured' });
    }

    try {
      const session = await paymentService.createCheckoutSession(userId, priceId, `${origin}/settings/billing`);
      res.json(session);
    } catch (error) {
      logger.error('Failed to create checkout session', error as Error, { userId, priceId });
      res.status(500).json({ error: 'Failed to create checkout session' });
    }
  });

  return router;
};

export const createWebhookRoutes = (): express.Router => {
  const router = express.Router();

  router.post('/webhook', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
    const signature = req.headers['stripe-signature'];

    if (!signature) {
      return res.status(400).send('Missing stripe-signature header');
    }

    try {
      const event = paymentService.constructEvent(req.body, signature as string);

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const credits = Number.parseInt(session.metadata?.creditAmount ?? '0', 10);

        if (userId && credits > 0) {
          await userCreditService.addCredits(userId, credits);
          logger.info('Credits funded via Stripe', { userId, credits, sessionId: session.id });
        } else {
          logger.warn('Checkout session missing credit metadata', { sessionId: session.id });
        }
      }

      res.json({ received: true });
    } catch (err) {
      logger.error('Webhook signature verification failed', err as Error);
      res.status(400).send(`Webhook Error: ${(err as Error).message}`);
    }
  });

  return router;
};
