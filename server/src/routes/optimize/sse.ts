import type { Request, Response } from 'express';

interface SseChannel {
  signal: AbortSignal;
  sendEvent: (eventType: string, data: unknown) => void;
  markProcessingStarted: () => void;
  close: () => void;
}

export const createSseChannel = (req: Request, res: Response): SseChannel => {
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

  const sendEvent = (eventType: string, data: unknown): void => {
    if (internalAbortController.signal.aborted || res.writableEnded || !clientConnected) {
      return;
    }
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
