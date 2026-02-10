import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

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
    where: (field: string, operator: '==', value: string) => {
      get: () => Promise<{
        docs: Array<{
          ref: {
            delete: () => Promise<unknown>;
          };
        }>;
      }>;
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

describeFirestore('Refund Idempotency (integration)', () => {
  let userCreditService: CreditService;
  let buildRefundKey: (parts: Array<string | number | null | undefined>) => string;
  let refundWithGuard: (params: any) => Promise<boolean>;
  let db: FirestoreLike | null = null;

  const createdUserIds = new Set<string>();

  beforeAll(async () => {
    const [{ UserCreditService }, refundGuardModule, { getFirestore }] = await Promise.all([
      import('@services/credits/UserCreditService'),
      import('@services/credits/refundGuard'),
      import('@infrastructure/firebaseAdmin'),
    ]);

    userCreditService = new UserCreditService();
    buildRefundKey = refundGuardModule.buildRefundKey;
    refundWithGuard = refundGuardModule.refundWithGuard;
    db = getFirestore() as FirestoreLike;
  });

  afterAll(async () => {
    if (!db) {
      return;
    }

    for (const userId of createdUserIds) {
      await db.collection('users').doc(userId).delete().catch(() => undefined);

      const refundsSnapshot = await db
        .collection('credit_refunds')
        .where('userId', '==', userId)
        .get()
        .catch(() => null);

      if (!refundsSnapshot) {
        continue;
      }

      await Promise.all(
        refundsSnapshot.docs.map((doc) => doc.ref.delete().catch(() => undefined))
      );
    }
  });

  it('duplicate refund with the same key is idempotent', async () => {
    const userId = uniqueId('it-idempotent-user');
    createdUserIds.add(userId);

    await userCreditService.addCredits(userId, 50);
    const reserved = await userCreditService.reserveCredits(userId, 20);
    expect(reserved).toBe(true);

    const refundKey = buildRefundKey(['idempotent', userId, 'job-123']);

    const firstRefunded = await userCreditService.refundCredits(userId, 20, { refundKey });
    const balanceAfterFirst = await userCreditService.getBalance(userId);

    const secondRefunded = await userCreditService.refundCredits(userId, 20, { refundKey });
    const balanceAfterSecond = await userCreditService.getBalance(userId);

    expect(firstRefunded).toBe(true);
    expect(secondRefunded).toBe(true);
    expect(balanceAfterFirst).toBe(50);
    expect(balanceAfterSecond).toBe(50);
  });

  it('different refund keys apply separate refunds', async () => {
    const userId = uniqueId('it-multi-refund-user');
    createdUserIds.add(userId);

    await userCreditService.addCredits(userId, 100);
    const reserved = await userCreditService.reserveCredits(userId, 60);
    expect(reserved).toBe(true);

    const firstKey = buildRefundKey(['multi', userId, 'first']);
    const secondKey = buildRefundKey(['multi', userId, 'second']);

    await userCreditService.refundCredits(userId, 20, { refundKey: firstKey });
    await userCreditService.refundCredits(userId, 20, { refundKey: secondKey });

    const balance = await userCreditService.getBalance(userId);
    expect(balance).toBe(80);
  });

  it('refundWithGuard retries transient failures and eventually succeeds', async () => {
    const userId = uniqueId('it-refund-guard-user');
    createdUserIds.add(userId);

    await userCreditService.addCredits(userId, 30);
    const reserved = await userCreditService.reserveCredits(userId, 10);
    expect(reserved).toBe(true);

    const refundKey = buildRefundKey(['guard', userId, 'retry']);
    let attempts = 0;

    const flakyUserCreditService = {
      refundCredits: vi.fn(async (targetUserId: string, amount: number, options?: { refundKey: string }) => {
        attempts += 1;
        if (attempts < 3) {
          return false;
        }
        return userCreditService.refundCredits(targetUserId, amount, options);
      }),
    };

    const refunded = await refundWithGuard({
      userCreditService: flakyUserCreditService,
      userId,
      amount: 10,
      refundKey,
      requestRetries: 3,
      baseDelayMs: 1,
      reason: 'integration retry test',
    });

    const balance = await userCreditService.getBalance(userId);

    expect(refunded).toBe(true);
    expect(flakyUserCreditService.refundCredits).toHaveBeenCalledTimes(3);
    expect(balance).toBe(30);
  });
});
