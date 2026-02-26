import type { Server } from 'http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupGracefulShutdown } from '@server/server';

type ProcessHandler = (...args: unknown[]) => void;

describe('regression: unhandled rejection classification', () => {
  const originalMode = process.env.UNHANDLED_REJECTION_MODE;

  beforeEach(() => {
    process.env.UNHANDLED_REJECTION_MODE = 'classified';
  });

  afterEach(() => {
    process.env.UNHANDLED_REJECTION_MODE = originalMode;
    vi.restoreAllMocks();
  });

  it('does not trigger shutdown for operational rejections in classified mode', () => {
    const listeners = new Map<string, ProcessHandler>();
    vi.spyOn(process, 'on').mockImplementation(
      ((event: string, handler: ProcessHandler) => {
        listeners.set(event, handler);
        return process;
      }) as typeof process.on
    );

    const close = vi.fn();
    const server = { close } as unknown as Server;
    const container = {
      resolve: vi.fn(() => {
        throw new Error('not registered');
      }),
    };

    setupGracefulShutdown(server, container as never);
    const unhandled = listeners.get('unhandledRejection');
    expect(unhandled).toBeDefined();

    unhandled?.(new Error('poll timeout while checking provider status'), Promise.resolve());
    expect(close).not.toHaveBeenCalled();
  });

  it('triggers shutdown for fatal programmer errors in classified mode', () => {
    const listeners = new Map<string, ProcessHandler>();
    vi.spyOn(process, 'on').mockImplementation(
      ((event: string, handler: ProcessHandler) => {
        listeners.set(event, handler);
        return process;
      }) as typeof process.on
    );

    const close = vi.fn();
    const server = { close } as unknown as Server;
    const container = {
      resolve: vi.fn(() => {
        throw new Error('not registered');
      }),
    };

    setupGracefulShutdown(server, container as never);
    const unhandled = listeners.get('unhandledRejection');
    expect(unhandled).toBeDefined();

    unhandled?.(new TypeError('undefined is not a function'), Promise.resolve());
    expect(close).toHaveBeenCalledTimes(1);
  });
});

