import CircuitBreaker from 'opossum';
import { logger } from '@infrastructure/Logger';
import type { IMetricsCollector } from '@interfaces/IMetricsCollector';

const DEFAULT_TIMEOUT_MS = 3_000;
const DEFAULT_ERROR_THRESHOLD_PERCENT = 50;
const DEFAULT_RESET_TIMEOUT_MS = 15_000;
const DEFAULT_VOLUME_THRESHOLD = 20;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_RETRY_BASE_DELAY_MS = 120;
const DEFAULT_RETRY_JITTER_MS = 80;
const DEFAULT_READINESS_MAX_FAILURE_RATE = 0.5;
const DEFAULT_READINESS_MAX_LATENCY_MS = 1_500;

const TRANSIENT_FIRESTORE_CODES = new Set([
  'aborted',
  'cancelled',
  'deadline-exceeded',
  'internal',
  'resource-exhausted',
  'unavailable',
  'unknown',
]);

const TRANSIENT_MESSAGE_HINTS = [
  'timed out',
  'timeout',
  'etimedout',
  'econnreset',
  'service unavailable',
  'temporarily unavailable',
  'resource exhausted',
  'rate limit',
  '429',
  'deadline exceeded',
  'connection reset',
];

type FirestoreOperation = () => Promise<unknown>;
type FirestoreCircuitState = 'open' | 'half-open' | 'closed';
type FirestoreOperationKind = 'read' | 'write';

interface CircuitStats {
  failures: number;
  timeouts: number;
  rejects: number;
  fires: number;
  successes: number;
  latencyMean: number;
}

interface FirestoreCircuitExecutorOptions {
  timeoutMs?: number;
  errorThresholdPercentage?: number;
  resetTimeoutMs?: number;
  volumeThreshold?: number;
  maxRetries?: number;
  retryBaseDelayMs?: number;
  retryJitterMs?: number;
  readinessMaxFailureRate?: number;
  readinessMaxLatencyMs?: number;
  metricsCollector?: IMetricsCollector;
}

interface ExecuteOptions {
  retries?: number;
  kind?: FirestoreOperationKind;
}

export interface FirestoreCircuitReadinessSnapshot {
  state: FirestoreCircuitState;
  open: boolean;
  degraded: boolean;
  failureRate: number;
  latencyMeanMs: number;
  thresholds: {
    failureRate: number;
    latencyMs: number;
  };
  stats: {
    fires: number;
    failures: number;
    timeouts: number;
    rejects: number;
    successes: number;
  };
}

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
}

function extractErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object') {
    return null;
  }

  if (!('code' in error)) {
    return null;
  }

  const candidate = (error as { code?: unknown }).code;
  if (typeof candidate !== 'string') {
    return null;
  }

  const trimmed = candidate.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

function isTransientFirestoreError(error: unknown): boolean {
  const code = extractErrorCode(error);
  if (code && TRANSIENT_FIRESTORE_CODES.has(code)) {
    return true;
  }

  const message = toError(error).message.toLowerCase();
  return TRANSIENT_MESSAGE_HINTS.some((hint) => message.includes(hint));
}

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function computeFailureRate(stats: CircuitStats): number {
  if (stats.fires <= 0) {
    return 0;
  }

  const failures = stats.failures + stats.timeouts + stats.rejects;
  return failures / stats.fires;
}

function normalizeCircuitStats(rawStats: unknown): CircuitStats {
  const stats = (rawStats ?? {}) as Record<string, unknown>;

  const asNumber = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? value : 0;

  return {
    failures: asNumber(stats.failures),
    timeouts: asNumber(stats.timeouts),
    rejects: asNumber(stats.rejects),
    fires: asNumber(stats.fires),
    successes: asNumber(stats.successes),
    latencyMean: asNumber(stats.latencyMean),
  };
}

export class FirestoreCircuitExecutor {
  private readonly log = logger.child({ service: 'FirestoreCircuitExecutor' });
  private readonly breaker: CircuitBreaker<[FirestoreOperation], unknown>;
  private readonly resetTimeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryBaseDelayMs: number;
  private readonly retryJitterMs: number;
  private readonly readinessMaxFailureRate: number;
  private readonly readinessMaxLatencyMs: number;
  private readonly metricsCollector: IMetricsCollector | undefined;

  constructor(options: FirestoreCircuitExecutorOptions = {}) {
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const errorThresholdPercentage = options.errorThresholdPercentage ?? DEFAULT_ERROR_THRESHOLD_PERCENT;
    this.resetTimeoutMs = options.resetTimeoutMs ?? DEFAULT_RESET_TIMEOUT_MS;
    const volumeThreshold = options.volumeThreshold ?? DEFAULT_VOLUME_THRESHOLD;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.retryBaseDelayMs = options.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS;
    this.retryJitterMs = options.retryJitterMs ?? DEFAULT_RETRY_JITTER_MS;
    this.readinessMaxFailureRate = options.readinessMaxFailureRate ?? DEFAULT_READINESS_MAX_FAILURE_RATE;
    this.readinessMaxLatencyMs = options.readinessMaxLatencyMs ?? DEFAULT_READINESS_MAX_LATENCY_MS;
    this.metricsCollector = options.metricsCollector;

    this.breaker = new CircuitBreaker(async (operation: FirestoreOperation) => await operation(), {
      name: 'firestore',
      timeout: timeoutMs,
      errorThresholdPercentage,
      resetTimeout: this.resetTimeoutMs,
      volumeThreshold,
      rollingCountTimeout: 10_000,
      rollingCountBuckets: 10,
    });

    this.breaker.on('open', () => {
      this.log.error('Firestore circuit opened');
      this.metricsCollector?.updateCircuitBreakerState?.('firestore', 'open');
    });

    this.breaker.on('halfOpen', () => {
      this.log.warn('Firestore circuit half-open');
      this.metricsCollector?.updateCircuitBreakerState?.('firestore', 'half-open');
    });

    this.breaker.on('close', () => {
      this.log.info('Firestore circuit closed');
      this.metricsCollector?.updateCircuitBreakerState?.('firestore', 'closed');
    });

    this.metricsCollector?.updateCircuitBreakerState?.('firestore', 'closed');
  }

  async executeRead<T>(operationName: string, operation: () => Promise<T>, options?: ExecuteOptions): Promise<T> {
    return await this.execute(operationName, operation, { ...options, kind: 'read' });
  }

  async executeWrite<T>(operationName: string, operation: () => Promise<T>, options?: ExecuteOptions): Promise<T> {
    return await this.execute(operationName, operation, { ...options, kind: 'write' });
  }

  async execute<T>(operationName: string, operation: () => Promise<T>, options: ExecuteOptions = {}): Promise<T> {
    const retries =
      typeof options.retries === 'number' && Number.isFinite(options.retries) && options.retries >= 0
        ? Math.trunc(options.retries)
        : this.maxRetries;
    const operationKind = options.kind ?? 'read';

    try {
      const result = await this.breaker.fire(async () => {
        return await this.runWithRetry(operationName, operation, operationKind, retries);
      });
      return result as T;
    } catch (error) {
      const err = toError(error);
      this.log.warn('Firestore circuit execution failed', {
        operation: operationName,
        kind: operationKind,
        error: err.message,
        circuitState: this.getState(),
      });
      throw err;
    }
  }

  isOpen(): boolean {
    return this.breaker.opened;
  }

  isWriteAllowed(): boolean {
    return !this.breaker.opened;
  }

  getRetryAfterSeconds(): number {
    return Math.max(1, Math.ceil(this.resetTimeoutMs / 1000));
  }

  getState(): FirestoreCircuitState {
    if (this.breaker.opened) {
      return 'open';
    }
    if (this.breaker.halfOpen) {
      return 'half-open';
    }
    return 'closed';
  }

  getReadinessSnapshot(): FirestoreCircuitReadinessSnapshot {
    const stats = normalizeCircuitStats(this.breaker.stats);
    const state = this.getState();
    const failureRate = computeFailureRate(stats);
    const latencyMeanMs = stats.latencyMean;
    const degraded =
      state === 'open' ||
      failureRate >= this.readinessMaxFailureRate ||
      latencyMeanMs >= this.readinessMaxLatencyMs;

    return {
      state,
      open: state === 'open',
      degraded,
      failureRate,
      latencyMeanMs,
      thresholds: {
        failureRate: this.readinessMaxFailureRate,
        latencyMs: this.readinessMaxLatencyMs,
      },
      stats: {
        fires: stats.fires,
        failures: stats.failures,
        timeouts: stats.timeouts,
        rejects: stats.rejects,
        successes: stats.successes,
      },
    };
  }

  private async runWithRetry<T>(
    operationName: string,
    operation: () => Promise<T>,
    operationKind: FirestoreOperationKind,
    retries: number
  ): Promise<T> {
    const maxAttempts = retries + 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        const err = toError(error);
        const canRetry = attempt < maxAttempts && isTransientFirestoreError(err);

        if (!canRetry) {
          throw err;
        }

        const exponentialDelay = this.retryBaseDelayMs * 2 ** (attempt - 1);
        const jitter = Math.round(Math.random() * this.retryJitterMs);
        const delayMs = exponentialDelay + jitter;

        this.log.warn('Retrying Firestore operation after transient failure', {
          operation: operationName,
          kind: operationKind,
          attempt,
          maxAttempts,
          delayMs,
          error: err.message,
        });

        await sleep(delayMs);
      }
    }

    throw new Error('Unreachable retry state');
  }
}

let firestoreCircuitExecutorSingleton: FirestoreCircuitExecutor | null = null;

export function getFirestoreCircuitExecutor(): FirestoreCircuitExecutor {
  if (!firestoreCircuitExecutorSingleton) {
    firestoreCircuitExecutorSingleton = new FirestoreCircuitExecutor();
  }

  return firestoreCircuitExecutorSingleton;
}

export function setFirestoreCircuitExecutor(executor: FirestoreCircuitExecutor): void {
  firestoreCircuitExecutorSingleton = executor;
}

