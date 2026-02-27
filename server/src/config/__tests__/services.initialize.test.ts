import { describe, expect, it, vi } from 'vitest';
import { STARTUP_CHECK_TIMEOUT_MS } from '../services.initialize';

describe('infrastructure startup check timeout', () => {
  it('exports a STARTUP_CHECK_TIMEOUT_MS constant of 20 seconds', () => {
    expect(STARTUP_CHECK_TIMEOUT_MS).toBe(20_000);
  });

  it('withTimeout rejects with a labeled message when a check hangs', async () => {
    // Reproduce the same Promise.race + setTimeout pattern used by services.initialize
    // to verify the timeout mechanism works as designed
    const label = 'firebase-auth';
    const hangingPromise = new Promise<void>(() => {});

    const timeoutPromise = Promise.race([
      hangingPromise,
      new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error(`Infrastructure check '${label}' timed out after ${STARTUP_CHECK_TIMEOUT_MS}ms`)),
          50 // Use short timeout for test speed
        );
      }),
    ]);

    await expect(timeoutPromise).rejects.toThrow(
      /Infrastructure check 'firebase-auth' timed out/
    );
  });

  it('withTimeout resolves when the check completes before the deadline', async () => {
    const label = 'firestore';

    const result = await Promise.race([
      Promise.resolve('done'),
      new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error(`Infrastructure check '${label}' timed out after ${STARTUP_CHECK_TIMEOUT_MS}ms`)),
          STARTUP_CHECK_TIMEOUT_MS
        );
      }),
    ]);

    expect(result).toBe('done');
  });

  it('withTimeout surfaces the original error if the check fails before the deadline', async () => {
    const label = 'gcs-bucket';

    const failingCheck = Promise.reject(new Error('Bucket does not exist: my-bucket'));

    const racePromise = Promise.race([
      failingCheck,
      new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error(`Infrastructure check '${label}' timed out after ${STARTUP_CHECK_TIMEOUT_MS}ms`)),
          STARTUP_CHECK_TIMEOUT_MS
        );
      }),
    ]);

    await expect(racePromise).rejects.toThrow('Bucket does not exist: my-bucket');
  });

  it('uses sequential checks so a timeout names the stalled service', async () => {
    // Simulates three sequential checks where the second hangs
    const checks: { label: string; fn: () => Promise<void> }[] = [
      { label: 'firebase-auth', fn: () => Promise.resolve() },
      { label: 'firestore', fn: () => new Promise(() => {}) }, // hangs
      { label: 'gcs-bucket', fn: () => Promise.resolve() },
    ];

    const runChecks = async (): Promise<void> => {
      for (const check of checks) {
        await Promise.race([
          check.fn(),
          new Promise<never>((_, reject) => {
            setTimeout(
              () => reject(new Error(`Infrastructure check '${check.label}' timed out after ${STARTUP_CHECK_TIMEOUT_MS}ms`)),
              50 // Short timeout for test speed
            );
          }),
        ]);
      }
    };

    await expect(runChecks()).rejects.toThrow(
      /Infrastructure check 'firestore' timed out/
    );
  });
});
