import type { Request, Response } from 'express';

interface SseChannel {
  signal: AbortSignal;
  sendEvent: (eventType: string, data: unknown) => void;
  markProcessingStarted: () => void;
  close: () => void;
}

export interface SseChannelOptions {
  /** Interval (ms) between heartbeat comments. 0 disables. Default: 15000. */
  heartbeatIntervalMs?: number;
  /** Max idle time (ms) with no sendEvent call before aborting. 0 disables. Default: 20000. */
  idleTimeoutMs?: number;
}

export const createSseChannel = (
  req: Request,
  res: Response,
  options: SseChannelOptions = {}
): SseChannel => {
  const { heartbeatIntervalMs = 15_000, idleTimeoutMs = 20_000 } = options;
  const internalAbortController = new AbortController();
  let clientConnected = true;
  let processingStarted = false;

  const onClientDisconnect = (): void => {
    clientConnected = false;
    if (processingStarted && !res.writableEnded && res.writable) {
      internalAbortController.abort();
    }
  };

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  res.write(': connected\n\n');
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  res.on('close', onClientDisconnect);
  req.on('aborted', onClientDisconnect);

  // ── Idle timeout: aborts the stream if no sendEvent call within the window ──
  let idleTimer: NodeJS.Timeout | null = null;

  const resetIdleTimer = (): void => {
    if (idleTimer) clearTimeout(idleTimer);
    if (idleTimeoutMs > 0) {
      idleTimer = setTimeout(() => {
        if (!internalAbortController.signal.aborted) {
          internalAbortController.abort();
        }
      }, idleTimeoutMs);
    }
  };

  resetIdleTimer();

  // ── Heartbeat: prevents proxy/LB idle disconnects ──
  const heartbeatTimer =
    heartbeatIntervalMs > 0
      ? setInterval(() => {
          if (!internalAbortController.signal.aborted && !res.writableEnded && clientConnected) {
            try {
              res.write(': heartbeat\n\n');
            } catch {
              /* ignore write errors on dead connections */
            }
          }
        }, heartbeatIntervalMs)
      : null;

  const sendEvent = (eventType: string, data: unknown): void => {
    if (internalAbortController.signal.aborted || res.writableEnded || !clientConnected) {
      return;
    }
    resetIdleTimer();
    try {
      res.write(`event: ${eventType}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (error) {
      if (!clientConnected) {
        return;
      }
      throw error;
    }
  };

  const close = (): void => {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    if (idleTimer) clearTimeout(idleTimer);
    res.removeListener('close', onClientDisconnect);
    req.removeListener('aborted', onClientDisconnect);
    if (!res.writableEnded) {
      res.end();
    }
  };

  return {
    signal: internalAbortController.signal,
    sendEvent,
    markProcessingStarted: () => {
      processingStarted = true;
    },
    close,
  };
};
