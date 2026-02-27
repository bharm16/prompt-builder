import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSseChannel } from '../sse';
import { createMockSseResponse, createMockSseRequest } from '../../../../../tests/unit/test-helpers/sse';
import type { Response } from 'express';

describe('SSE channel heartbeat and idle timeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('writes a heartbeat comment after the configured interval', () => {
    const res = createMockSseResponse();
    const req = createMockSseRequest({});

    const channel = createSseChannel(req, res as unknown as Response, {
      heartbeatIntervalMs: 5_000,
      idleTimeoutMs: 0, // disable idle timeout for this test
    });

    // Initial write: ': connected\n\n'
    const initialChunkCount = res.chunks.length;

    vi.advanceTimersByTime(5_000);

    // Should have written a heartbeat comment
    const heartbeats = res.chunks.slice(initialChunkCount).filter(c => c.includes(': heartbeat'));
    expect(heartbeats.length).toBe(1);

    vi.advanceTimersByTime(5_000);
    const heartbeats2 = res.chunks.slice(initialChunkCount).filter(c => c.includes(': heartbeat'));
    expect(heartbeats2.length).toBe(2);

    channel.close();
  });

  it('does not write heartbeat when heartbeatIntervalMs is 0', () => {
    const res = createMockSseResponse();
    const req = createMockSseRequest({});

    const channel = createSseChannel(req, res as unknown as Response, {
      heartbeatIntervalMs: 0,
      idleTimeoutMs: 0,
    });

    const initialChunkCount = res.chunks.length;

    vi.advanceTimersByTime(60_000);

    const heartbeats = res.chunks.slice(initialChunkCount).filter(c => c.includes(': heartbeat'));
    expect(heartbeats.length).toBe(0);

    channel.close();
  });

  it('aborts the signal after idleTimeoutMs with no sendEvent calls', () => {
    const res = createMockSseResponse();
    const req = createMockSseRequest({});

    const channel = createSseChannel(req, res as unknown as Response, {
      heartbeatIntervalMs: 0,
      idleTimeoutMs: 10_000,
    });

    expect(channel.signal.aborted).toBe(false);

    vi.advanceTimersByTime(10_000);

    expect(channel.signal.aborted).toBe(true);

    channel.close();
  });

  it('resets the idle timer when sendEvent is called', () => {
    const res = createMockSseResponse();
    const req = createMockSseRequest({});

    const channel = createSseChannel(req, res as unknown as Response, {
      heartbeatIntervalMs: 0,
      idleTimeoutMs: 10_000,
    });

    // Advance to 8s — should still be alive
    vi.advanceTimersByTime(8_000);
    expect(channel.signal.aborted).toBe(false);

    // Send an event — resets the idle timer
    channel.sendEvent('progress', { step: 1 });

    // Advance another 8s (total 16s since start, but only 8s since last event)
    vi.advanceTimersByTime(8_000);
    expect(channel.signal.aborted).toBe(false);

    // Advance past the idle timeout (2 more seconds)
    vi.advanceTimersByTime(2_000);
    expect(channel.signal.aborted).toBe(true);

    channel.close();
  });

  it('does not abort when idleTimeoutMs is 0', () => {
    const res = createMockSseResponse();
    const req = createMockSseRequest({});

    const channel = createSseChannel(req, res as unknown as Response, {
      heartbeatIntervalMs: 0,
      idleTimeoutMs: 0,
    });

    vi.advanceTimersByTime(300_000);

    expect(channel.signal.aborted).toBe(false);

    channel.close();
  });

  it('clears all timers on close()', () => {
    const res = createMockSseResponse();
    const req = createMockSseRequest({});

    const channel = createSseChannel(req, res as unknown as Response, {
      heartbeatIntervalMs: 5_000,
      idleTimeoutMs: 10_000,
    });

    const initialChunkCount = res.chunks.length;

    channel.close();

    // After close, advancing timers should NOT produce heartbeats or abort
    vi.advanceTimersByTime(30_000);

    const heartbeats = res.chunks.slice(initialChunkCount).filter(c => c.includes(': heartbeat'));
    expect(heartbeats.length).toBe(0);
    // Signal should not have been aborted by the idle timeout after close
    expect(channel.signal.aborted).toBe(false);
  });

  it('uses default intervals when no options are provided', () => {
    const res = createMockSseResponse();
    const req = createMockSseRequest({});

    const channel = createSseChannel(req, res as unknown as Response);

    const initialChunkCount = res.chunks.length;

    // Default heartbeat is 15s
    vi.advanceTimersByTime(15_000);
    const heartbeats = res.chunks.slice(initialChunkCount).filter(c => c.includes(': heartbeat'));
    expect(heartbeats.length).toBe(1);

    channel.close();
  });
});
