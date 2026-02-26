import { describe, expect, it } from 'vitest';
import { getRuntimeFlags } from '../runtime-flags';

describe('getRuntimeFlags', () => {
  it('defaults to worker role outside production', () => {
    const flags = getRuntimeFlags({} as NodeJS.ProcessEnv);
    expect(flags.processRole).toBe('worker');
    expect(flags.videoWorkerDisabled).toBe(false);
    expect(flags.videoJobInlineEnabled).toBe(false);
    expect(flags.videoWorkerShutdownDrainSeconds).toBe(45);
  });

  it('enables worker role and honors explicit worker disable flag', () => {
    const flags = getRuntimeFlags({
      PROCESS_ROLE: 'worker',
      VIDEO_JOB_WORKER_DISABLED: 'true',
      VIDEO_JOB_INLINE_ENABLED: 'true',
      VIDEO_WORKER_SHUTDOWN_DRAIN_SECONDS: '60',
    } as NodeJS.ProcessEnv);
    expect(flags.processRole).toBe('worker');
    expect(flags.videoWorkerDisabled).toBe(true);
    expect(flags.videoJobInlineEnabled).toBe(true);
    expect(flags.videoWorkerShutdownDrainSeconds).toBe(60);
  });

  it('keeps worker enabled when process role is worker and disable flag is absent', () => {
    const flags = getRuntimeFlags({
      PROCESS_ROLE: 'worker',
    } as NodeJS.ProcessEnv);
    expect(flags.processRole).toBe('worker');
    expect(flags.videoWorkerDisabled).toBe(false);
  });

  it('defaults to api role in production', () => {
    const flags = getRuntimeFlags({
      NODE_ENV: 'production',
    } as NodeJS.ProcessEnv);
    expect(flags.processRole).toBe('api');
    expect(flags.videoWorkerDisabled).toBe(true);
  });
});
