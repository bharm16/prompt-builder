import { afterAll, beforeAll, describe, expect, it } from 'vitest';

interface CreditService {
  addCredits: (userId: string, amount: number) => Promise<void>;
  getBalance: (userId: string) => Promise<number>;
  reserveCredits: (userId: string, cost: number) => Promise<boolean>;
  refundCredits: (
    userId: string,
    cost: number,
    options?: {
      refundKey: string;
      reason?: string;
    }
  ) => Promise<boolean>;
}

type FirestoreLike = {
  collection: (name: string) => {
    doc: (id: string) => {
      delete: () => Promise<unknown>;
    };
  };
};

const shouldRunFirestoreIntegration =
  process.env.RUN_FIREBASE_INTEGRATION === 'true' &&
  typeof process.env.FIRESTORE_EMULATOR_HOST === 'string' &&
  process.env.FIRESTORE_EMULATOR_HOST.trim().length > 0;

const describeFirestore = shouldRunFirestoreIntegration ? describe : describe.skip;

const uniqueId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;

describeFirestore('Credit Reservation Flow (integration)', () => {
  let userCreditService: CreditService;
  let db: FirestoreLike | null = null;

  const userId = uniqueId('it-credit-user');
  const refundKey = uniqueId('it-credit-refund');

  beforeAll(async () => {
    const [{ UserCreditService }, { getFirestore }] = await Promise.all([
      import('@services/credits/UserCreditService'),
      import('@infrastructure/firebaseAdmin'),
    ]);

    userCreditService = new UserCreditService();
    db = getFirestore() as FirestoreLike;
  });

  afterAll(async () => {
    if (!db) {
      return;
    }

    await Promise.all([
      db.collection('users').doc(userId).delete().catch(() => undefined),
      db.collection('credit_refunds').doc(refundKey).delete().catch(() => undefined),
    ]);
  });

  it('addCredits increases balance', async () => {
    await userCreditService.addCredits(userId, 100);

    const balance = await userCreditService.getBalance(userId);
    expect(balance).toBe(100);
  });

  it('reserveCredits deducts balance atomically', async () => {
    const reserved = await userCreditService.reserveCredits(userId, 30);
    const balance = await userCreditService.getBalance(userId);

    expect(reserved).toBe(true);
    expect(balance).toBe(70);
  });

  it('reserveCredits returns false when credits are insufficient', async () => {
    const reserved = await userCreditService.reserveCredits(userId, 200);
    const balance = await userCreditService.getBalance(userId);

    expect(reserved).toBe(false);
    expect(balance).toBe(70);
  });

  it('refundCredits restores balance with an idempotency key', async () => {
    const refunded = await userCreditService.refundCredits(userId, 30, {
      refundKey,
      reason: 'integration test refund',
    });
    const balance = await userCreditService.getBalance(userId);

    expect(refunded).toBe(true);
    expect(balance).toBe(100);
  });

  it('balance never goes negative on failed reservations', async () => {
    const reserved = await userCreditService.reserveCredits(userId, 9999);
    const balance = await userCreditService.getBalance(userId);

    expect(reserved).toBe(false);
    expect(balance).toBeGreaterThanOrEqual(0);
  });
});
