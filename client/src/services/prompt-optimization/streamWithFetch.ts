import type { StreamWithFetchOptions } from './types';
import { buildFirebaseAuthHeaders } from '@/services/http/firebaseAuth';

interface StreamWithFetchDeps {
  log: {
    warn: (message: string, meta?: Record<string, unknown>) => void;
    error: (message: string, error?: Error) => void;
  };
}

export async function streamWithFetch(
  {
    url,
    method,
    body,
    onMessage,
    onError,
    onComplete,
    signal,
  }: StreamWithFetchOptions,
  { log }: StreamWithFetchDeps
): Promise<void> {
  try {
    const authHeaders = await buildFirebaseAuthHeaders();
    const requestInit: RequestInit = {
      method: method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify(body),
    };
    if (signal) {
      requestInit.signal = signal;
    }

    const response = await fetch(url, requestInit);

    if (!response.ok) {
      const error = new Error(
        `HTTP ${response.status}: ${response.statusText}`
      ) as Error & { status?: number; statusText?: string };
      error.status = response.status;
      error.statusText = response.statusText;
      throw error;
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let buffer = '';
    let currentEvent = 'message'; // Default event type

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Parse SSE messages
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          const dataStr = line.slice(6);
          try {
            const data = JSON.parse(dataStr) as Record<string, unknown>;
            onMessage(currentEvent, data);
          } catch (e) {
            log.warn('Failed to parse SSE data', {
              dataStr: dataStr.substring(0, 100),
              error: (e as Error).message,
            });
          }
        }
      }
    }
    if (typeof onComplete === 'function') {
      onComplete();
    }
  } catch (error) {
    const err = error as Error & {
      status?: number | null;
      response?: { status?: number };
    };
    if (err && typeof err.status === 'undefined') {
      const statusValue = err.response?.status;
      err.status = statusValue !== undefined ? statusValue : null;
    }

    log.error('Streaming fetch error', err);
    onError(err);
  }
}
