import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Response } from "express";
import { createSseChannel } from "../sse";
import {
  createMockSseRequest,
  createMockSseResponse,
} from "../../../../../tests/unit/test-helpers/sse";

describe("regression: SSE heartbeat keeps idle watchdog alive", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("for any active heartbeat stream, idle timeout must not abort without sendEvent", () => {
    const res = createMockSseResponse();
    const req = createMockSseRequest({});

    const channel = createSseChannel(req, res as unknown as Response, {
      heartbeatIntervalMs: 5_000,
      idleTimeoutMs: 10_000,
    });

    vi.advanceTimersByTime(60_000);

    expect(channel.signal.aborted).toBe(false);
    channel.close();
  });
});
