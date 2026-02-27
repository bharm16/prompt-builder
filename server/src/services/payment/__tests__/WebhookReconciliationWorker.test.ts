import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the logger and webhook handlers before import
vi.mock('@infrastructure/Logger', () => ({
  logger: {
    child: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

vi.mock('@routes/payment/webhook/handlers', () => ({
  createWebhookEventHandlers: vi.fn(() => ({
    handleCheckoutSessionCompleted: vi.fn(),
    handleInvoicePaid: vi.fn(),
  })),
}));

import { WebhookReconciliationWorker } from '../WebhookReconciliationWorker';

function createMockDeps() {
    return {
      paymentService: {
        listRecentEvents: vi.fn().mockResolvedValue([]),
      },
    webhookEventStore: {
      hasProcessedEvent: vi.fn().mockResolvedValue(false),
      claimEvent: vi.fn().mockResolvedValue({ state: 'claimed' }),
      markProcessed: vi.fn().mockResolvedValue(undefined),
      markFailed: vi.fn().mockResolvedValue(undefined),
      getUnprocessedSummary: vi.fn().mockResolvedValue({
        processingCount: 0,
        failedCount: 0,
        totalUnprocessed: 0,
        oldestUnprocessedAgeMs: null,
      }),
    },
    billingProfileStore: {} as never,
    userCreditService: {} as never,
    paymentConsistencyStore: {
      recordUnresolvedEvent: vi.fn().mockResolvedValue(undefined),
      getUnresolvedSummary: vi.fn().mockResolvedValue({ openCount: 0, oldestOpenAgeMs: null }),
    },
    metrics: {
      recordAlert: vi.fn(),
    },
  };
}

describe('WebhookReconciliationWorker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('edge-of-window alerting', () => {
    it('fires webhook_lookback_edge_warning when unprocessed events are near the boundary', async () => {
      const deps = createMockDeps();
      const nowSec = Math.floor(Date.now() / 1000);
      const lookbackHours = 72;
      const lookbackSeconds = lookbackHours * 3600;
      const createdAfterUnix = nowSec - lookbackSeconds;
      // Event created just inside the edge (within 10% of lookback from the boundary)
      const nearEdgeTimestamp = createdAfterUnix + Math.floor(lookbackSeconds * 0.05);

      deps.paymentService.listRecentEvents.mockImplementation(
        async (type: string) => {
          if (type === 'checkout.session.completed') {
            return [
              {
                id: 'evt_near_edge',
                type: 'checkout.session.completed',
                created: nearEdgeTimestamp,
                livemode: false,
                data: { object: { id: 'cs_test' } },
              },
            ];
          }
          return [];
        }
      );

      deps.webhookEventStore.hasProcessedEvent.mockResolvedValue(false);
      deps.webhookEventStore.claimEvent.mockResolvedValue({ state: 'claimed' });

      const worker = new WebhookReconciliationWorker(
        deps.paymentService as never,
        deps.webhookEventStore as never,
        deps.billingProfileStore,
        deps.userCreditService,
        deps.paymentConsistencyStore as never,
        {
          pollIntervalMs: 1_000, // Short interval for testing
          lookbackHours,
          metrics: deps.metrics,
        }
      );

      worker.start();
      // Advance past the poll interval to trigger runOnce
      await vi.advanceTimersByTimeAsync(1_100);
      worker.stop();

      expect(deps.metrics.recordAlert).toHaveBeenCalledWith(
        'webhook_lookback_edge_warning',
        expect.objectContaining({
          count: 1,
          lookbackHours: 72,
        })
      );
    });

    it('does not fire edge warning when all events are well within the window', async () => {
      const deps = createMockDeps();
      const nowSec = Math.floor(Date.now() / 1000);

      deps.paymentService.listRecentEvents.mockImplementation(
        async (type: string) => {
          if (type === 'checkout.session.completed') {
            return [
              {
                id: 'evt_recent',
                type: 'checkout.session.completed',
                created: nowSec - 3600, // 1 hour ago
                livemode: false,
                data: { object: { id: 'cs_recent' } },
              },
            ];
          }
          return [];
        }
      );

      deps.webhookEventStore.hasProcessedEvent.mockResolvedValue(false);
      deps.webhookEventStore.claimEvent.mockResolvedValue({ state: 'claimed' });

      const worker = new WebhookReconciliationWorker(
        deps.paymentService as never,
        deps.webhookEventStore as never,
        deps.billingProfileStore,
        deps.userCreditService,
        deps.paymentConsistencyStore as never,
        {
          pollIntervalMs: 1_000,
          lookbackHours: 72,
          metrics: deps.metrics,
        }
      );

      worker.start();
      await vi.advanceTimersByTimeAsync(1_100);
      worker.stop();

      const edgeCalls = deps.metrics.recordAlert.mock.calls.filter(
        (c: unknown[]) => c[0] === 'webhook_lookback_edge_warning'
      );
      expect(edgeCalls.length).toBe(0);
    });
  });

  describe('lastSuccessfulRunAt tracking', () => {
    it('updates lastSuccessfulRunAt on successful runs', async () => {
      const deps = createMockDeps();

      const worker = new WebhookReconciliationWorker(
        deps.paymentService as never,
        deps.webhookEventStore as never,
        deps.billingProfileStore,
        deps.userCreditService,
        deps.paymentConsistencyStore as never,
        { pollIntervalMs: 1_000, metrics: deps.metrics }
      );

      expect(worker.getStatus().lastSuccessfulRunAt).toBeNull();

      worker.start();
      await vi.advanceTimersByTimeAsync(1_100);
      worker.stop();

      const status = worker.getStatus();
      expect(status.lastSuccessfulRunAt).toBeInstanceOf(Date);
      expect(status.lastRunAt).toBeInstanceOf(Date);
    });

    it('does not update lastSuccessfulRunAt on failed runs', async () => {
      const deps = createMockDeps();
      deps.paymentService.listRecentEvents.mockRejectedValue(new Error('Stripe API down'));

      const worker = new WebhookReconciliationWorker(
        deps.paymentService as never,
        deps.webhookEventStore as never,
        deps.billingProfileStore,
        deps.userCreditService,
        deps.paymentConsistencyStore as never,
        { pollIntervalMs: 1_000, metrics: deps.metrics }
      );

      worker.start();
      await vi.advanceTimersByTimeAsync(1_100);
      worker.stop();

      const status = worker.getStatus();
      expect(status.lastSuccessfulRunAt).toBeNull();
      expect(status.lastRunAt).toBeInstanceOf(Date);
      expect(status.consecutiveFailures).toBe(1);
    });
  });

  describe('backlog alerting', () => {
    it('alerts when unprocessed webhook backlog and unresolved payment events exist', async () => {
      const deps = createMockDeps();
      deps.webhookEventStore.getUnprocessedSummary.mockResolvedValue({
        processingCount: 2,
        failedCount: 1,
        totalUnprocessed: 3,
        oldestUnprocessedAgeMs: 120_000,
      });
      deps.paymentConsistencyStore.getUnresolvedSummary.mockResolvedValue({
        openCount: 2,
        oldestOpenAgeMs: 240_000,
      });

      const worker = new WebhookReconciliationWorker(
        deps.paymentService as never,
        deps.webhookEventStore as never,
        deps.billingProfileStore,
        deps.userCreditService,
        deps.paymentConsistencyStore as never,
        { pollIntervalMs: 1_000, metrics: deps.metrics }
      );

      worker.start();
      await vi.advanceTimersByTimeAsync(1_100);
      worker.stop();

      expect(deps.metrics.recordAlert).toHaveBeenCalledWith(
        'stripe_webhook_backlog_warning',
        expect.objectContaining({
          totalUnprocessed: 3,
          processingCount: 2,
          failedCount: 1,
        })
      );
      expect(deps.metrics.recordAlert).toHaveBeenCalledWith(
        'payment_unresolved_events_warning',
        expect.objectContaining({
          openCount: 2,
        })
      );
    });
  });
});
