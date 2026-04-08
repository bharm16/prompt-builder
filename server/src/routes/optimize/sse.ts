import type { Request, Response } from "express";
import { createSseWriter } from "@middleware/sseBackpressure";

interface SseChannel {
  signal: AbortSignal;
  sendEvent: (eventType: string, data: unknown) => void;
  markProcessingStarted: () => void;
  close: () => void;
}

export interface SseChannelOptions {
  heartbeatIntervalMs?: number;
  idleTimeoutMs?: number;
  /** Override the buffered-bytes kill-switch threshold. */
  maxBufferedBytes?: number;
}

export const createSseChannel = (
  req: Request,
  res: Response,
  options: SseChannelOptions = {},
): SseChannel => {
  const {
    heartbeatIntervalMs = 15_000,
    idleTimeoutMs = 20_000,
    maxBufferedBytes,
  } = options;
  const internalAbortController = new AbortController();
  let clientConnected = true;
  let processingStarted = false;

  const onClientDisconnect = (): void => {
    clientConnected = false;
    if (processingStarted && !res.writableEnded && res.writable) {
      internalAbortController.abort();
    }
  };

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const writer = createSseWriter(res, {
    ...(maxBufferedBytes !== undefined ? { maxBufferedBytes } : {}),
    label: "optimize.sse",
  });

  const handleWriteResult = (result: {
    ok: boolean;
    reason?: string;
  }): void => {
    if (!result.ok) {
      clientConnected = false;
      if (!internalAbortController.signal.aborted) {
        internalAbortController.abort();
      }
    }
  };

  void writer.write(": connected\n\n").then(handleWriteResult);
  if (typeof res.flushHeaders === "function") {
    res.flushHeaders();
  }

  res.on("close", onClientDisconnect);
  req.on("aborted", onClientDisconnect);

  let idleTimer: NodeJS.Timeout | null = null;

  const resetIdleTimer = (): void => {
    if (idleTimer) {
      clearTimeout(idleTimer);
    }
    if (idleTimeoutMs > 0) {
      idleTimer = setTimeout(() => {
        if (!internalAbortController.signal.aborted) {
          internalAbortController.abort();
        }
      }, idleTimeoutMs);
    }
  };

  resetIdleTimer();

  const heartbeatTimer =
    heartbeatIntervalMs > 0
      ? setInterval(() => {
          if (
            !internalAbortController.signal.aborted &&
            !res.writableEnded &&
            clientConnected
          ) {
            resetIdleTimer();
            void writer.write(": heartbeat\n\n").then(handleWriteResult);
          }
        }, heartbeatIntervalMs)
      : null;

  const sendEvent = (eventType: string, data: unknown): void => {
    if (
      internalAbortController.signal.aborted ||
      res.writableEnded ||
      !clientConnected
    ) {
      return;
    }
    resetIdleTimer();
    void writer
      .write(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`)
      .then(handleWriteResult);
  };

  const close = (): void => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
    }
    if (idleTimer) {
      clearTimeout(idleTimer);
    }
    writer.close();
    res.removeListener("close", onClientDisconnect);
    req.removeListener("aborted", onClientDisconnect);
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
