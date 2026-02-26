import { EventEmitter } from 'events';
import type { Request } from 'express';
import { vi } from 'vitest';

export interface ParsedSseEvent {
  event: string;
  data: unknown;
}

export interface MockSseResponse {
  chunks: string[];
  headersMap: Record<string, string>;
  statusCode: number;
  payload: unknown;
  headersSent: boolean;
  writableEnded: boolean;
  writable: boolean;
  destroyed: boolean;
  setHeader: (name: string, value: string | number | readonly string[]) => MockSseResponse;
  write: (chunk: string) => boolean;
  flushHeaders?: () => void;
  end: () => MockSseResponse;
  status: (code: number) => MockSseResponse;
  json: (payload: unknown) => MockSseResponse;
  on: (event: string, listener: (...args: unknown[]) => void) => MockSseResponse;
  removeListener: (event: string, listener: (...args: unknown[]) => void) => MockSseResponse;
  emitClose: () => void;
}

export function createMockSseResponse(): MockSseResponse {
  const emitter = new EventEmitter();
  const chunks: string[] = [];
  const headersMap: Record<string, string> = {};

  const res: MockSseResponse = {
    chunks,
    headersMap,
    statusCode: 200,
    payload: null,
    headersSent: false,
    writableEnded: false,
    writable: true,
    destroyed: false,
    setHeader: vi.fn((name: string, value: string | number | readonly string[]) => {
      headersMap[name] = String(value);
      return res;
    }),
    write: vi.fn((chunk: string) => {
      chunks.push(String(chunk));
      res.headersSent = true;
      return true;
    }),
    flushHeaders: vi.fn(() => {
      res.headersSent = true;
    }),
    end: vi.fn(() => {
      res.writableEnded = true;
      res.writable = false;
      return res;
    }),
    status: vi.fn((code: number) => {
      res.statusCode = code;
      return res;
    }),
    json: vi.fn((payload: unknown) => {
      res.payload = payload;
      res.headersSent = true;
      return res;
    }),
    on: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
      emitter.on(event, listener);
      return res;
    }),
    removeListener: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
      emitter.removeListener(event, listener);
      return res;
    }),
    emitClose: () => {
      emitter.emit('close');
    },
  };

  return res;
}

export function createMockSseRequest(
  body: Record<string, unknown>,
  overrides: Partial<Request> = {}
): Request {
  const emitter = new EventEmitter();
  const req = emitter as unknown as Request;
  Object.assign(req, {
    body,
    headers: {},
    id: 'req-test-1',
    on: emitter.on.bind(emitter),
    removeListener: emitter.removeListener.bind(emitter),
    ...overrides,
  });
  return req;
}

export function parseSseEvents(chunks: string[]): ParsedSseEvent[] {
  const events: ParsedSseEvent[] = [];
  let currentEvent = 'message';

  for (const chunk of chunks) {
    const lines = String(chunk).split('\n');
    for (const line of lines) {
      if (line.startsWith('event: ')) {
        currentEvent = line.slice(7).trim();
        continue;
      }
      if (!line.startsWith('data: ')) {
        continue;
      }

      const dataText = line.slice(6).trim();
      try {
        events.push({
          event: currentEvent,
          data: JSON.parse(dataText),
        });
      } catch {
        events.push({
          event: currentEvent,
          data: dataText,
        });
      }
    }
  }

  return events;
}
