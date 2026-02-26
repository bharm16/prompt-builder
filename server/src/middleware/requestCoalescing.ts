import crypto from 'crypto';
import type { Request, RequestHandler, Response } from 'express';
import { logger } from '@infrastructure/Logger';

const DEFAULT_COALESCING_WINDOW_MS = 100;

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'content-length',
]);

export interface RequestCoalescingOptions {
  keyScope: string;
  windowMs?: number;
}

type CoalescedResponseKind = 'json' | 'send' | 'end';

type CoalescedResponse = {
  kind: CoalescedResponseKind;
  statusCode: number;
  headers: Record<string, string | string[]>;
  body?: unknown;
};

type PendingEntry = {
  promise: Promise<CoalescedResponse>;
  completedAt: number | null;
  expiresAt: number | null;
};

type RequestWithPrincipal = Request & {
  user?: { uid?: string };
  auth?: { uid?: string };
  userId?: string;
  uid?: string;
};

function hashFingerprint(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex').substring(0, 32);
}

function parseMaybeJson(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) {
    return '';
  }

  const appearsJson =
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'));

  if (!appearsJson) {
    return trimmed;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

function stableStringify(value: unknown, seen: WeakSet<object> = new WeakSet()): string {
  if (value === null) {
    return 'null';
  }

  const valueType = typeof value;
  if (valueType === 'string') {
    return JSON.stringify(value);
  }

  if (valueType === 'number' || valueType === 'boolean') {
    return JSON.stringify(value);
  }

  if (valueType === 'bigint') {
    return JSON.stringify((value as bigint).toString());
  }

  if (valueType === 'undefined') {
    return '""';
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item, seen)).join(',')}]`;
  }

  if (Buffer.isBuffer(value)) {
    return stableStringify(parseMaybeJson(value.toString('utf8')), seen);
  }

  if (valueType === 'object') {
    const objectValue = value as Record<string, unknown>;
    if (seen.has(objectValue)) {
      return '"[Circular]"';
    }

    seen.add(objectValue);
    const keys = Object.keys(objectValue).sort();
    const entries = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(objectValue[key], seen)}`);
    return `{${entries.join(',')}}`;
  }

  return JSON.stringify(String(value));
}

/**
 * Fast-path canonicalization for parsed JSON objects with a `prompt` field.
 * Avoids the expensive deep-traversal of stableStringify for the common case
 * (optimization requests) by hashing only the differentiating fields.
 */
function tryFastCanonicalizeBody(body: unknown): string | null {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return null;
  }

  const obj = body as Record<string, unknown>;
  if (typeof obj.prompt !== 'string') {
    return null;
  }

  const mode = typeof obj.mode === 'string' ? obj.mode : '';
  const targetModel = typeof obj.targetModel === 'string' ? obj.targetModel : '';
  const skipCache = obj.skipCache === true ? '1' : '0';
  return `fast:${obj.prompt}|${mode}|${targetModel}|${skipCache}`;
}

function canonicalizeBody(body: unknown): string {
  const fast = tryFastCanonicalizeBody(body);
  if (fast !== null) {
    return fast;
  }

  if (typeof body === 'string') {
    return stableStringify(parseMaybeJson(body));
  }

  if (Buffer.isBuffer(body)) {
    return stableStringify(parseMaybeJson(body.toString('utf8')));
  }

  return stableStringify(body);
}

function resolvePrincipalFingerprint(req: Request): string {
  const request = req as RequestWithPrincipal;
  const principal = request.user?.uid ?? request.auth?.uid ?? request.userId ?? request.uid;
  if (typeof principal === 'string' && principal.trim().length > 0) {
    return `principal:${principal.trim()}`;
  }

  const authorization = req.get('authorization') ?? '';
  const apiKey = req.get('x-api-key') ?? '';
  const firebaseToken = req.get('x-firebase-token') ?? '';
  return `credentials:${authorization}|${apiKey}|${firebaseToken}`;
}

function normalizeHeaders(res: Response): Record<string, string | string[]> {
  const headers = res.getHeaders();
  const normalized: Record<string, string | string[]> = {};

  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined || value === null) {
      continue;
    }

    const lowerName = name.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(lowerName)) {
      continue;
    }

    if (Array.isArray(value)) {
      normalized[lowerName] = value.map((entry) => String(entry));
      continue;
    }

    normalized[lowerName] = String(value);
  }

  return normalized;
}

function isStreamingRequest(req: Request): boolean {
  const path = `${req.baseUrl ?? ''}${req.path ?? ''}`.toLowerCase();
  if (path.includes('/stream')) {
    return true;
  }

  const acceptHeader = String(req.headers.accept ?? '').toLowerCase();
  if (acceptHeader.includes('text/event-stream') || acceptHeader.includes('application/x-ndjson')) {
    return true;
  }

  const contentType = String(req.headers['content-type'] ?? '').toLowerCase();
  return contentType.includes('text/event-stream') || contentType.includes('application/x-ndjson');
}

export class RequestCoalescingMiddleware {
  private pendingRequests: Map<string, PendingEntry>;
  private stats: { coalesced: number; unique: number; totalSaved: number };
  private cleanupTimer: ReturnType<typeof setTimeout> | null;

  constructor() {
    this.pendingRequests = new Map();
    this.stats = {
      coalesced: 0,
      unique: 0,
      totalSaved: 0,
    };
    this.cleanupTimer = null;
  }

  generateKey(req: Request, options: RequestCoalescingOptions): string {
    const principalHash = hashFingerprint(resolvePrincipalFingerprint(req));
    const bodyHash = hashFingerprint(canonicalizeBody(req.body));

    return `${req.method}:${options.keyScope}:${principalHash}:${bodyHash}`;
  }

  middleware(options: RequestCoalescingOptions): RequestHandler {
    if (!options?.keyScope || options.keyScope.trim().length === 0) {
      throw new Error('request coalescing requires a non-empty keyScope');
    }

    const coalescingWindowMs = Math.max(1, options.windowMs ?? DEFAULT_COALESCING_WINDOW_MS);

    return async (req, res, next): Promise<void> => {
      if (req.method !== 'POST' || isStreamingRequest(req)) {
        next();
        return;
      }

      const requestKey = this.generateKey(req, options);
      const pendingEntry = this.pendingRequests.get(requestKey);

      if (pendingEntry && pendingEntry.completedAt === null) {
        this.stats.coalesced++;
        this.stats.totalSaved++;

        logger.debug('Request coalesced', {
          requestId: req.id,
          keyScope: options.keyScope,
          path: req.path,
        });

        try {
          const snapshot = await pendingEntry.promise;
          this.applySnapshot(res, snapshot);
          return;
        } catch (error) {
          next(error);
          return;
        }
      }

      this.stats.unique++;

      let resolvePromise: (value: CoalescedResponse) => void = () => undefined;
      let rejectPromise: (reason?: unknown) => void = () => undefined;

      const requestPromise = new Promise<CoalescedResponse>((resolve, reject) => {
        resolvePromise = resolve;
        rejectPromise = reject;
      });

      this.pendingRequests.set(requestKey, {
        promise: requestPromise,
        completedAt: null,
        expiresAt: null,
      });

      let settled = false;
      const settleSuccess = (snapshot: CoalescedResponse): void => {
        if (settled) {
          return;
        }
        settled = true;

        resolvePromise(snapshot);

        const entry = this.pendingRequests.get(requestKey);
        if (entry) {
          const now = Date.now();
          entry.completedAt = now;
          entry.expiresAt = now + coalescingWindowMs;
        }

        this._scheduleCleanup(coalescingWindowMs);
      };

      const settleFailure = (error: unknown): void => {
        if (settled) {
          return;
        }
        settled = true;
        rejectPromise(error);
        this.pendingRequests.delete(requestKey);
      };

      const captureSnapshot = (kind: CoalescedResponseKind, body?: unknown): CoalescedResponse => ({
        kind,
        body,
        statusCode: res.statusCode,
        headers: normalizeHeaders(res),
      });

      const originalJson = res.json.bind(res);
      const wrappedJson: Response['json'] = (...args) => {
        settleSuccess(captureSnapshot('json', args[0]));
        return originalJson(...args);
      };
      res.json = wrappedJson;

      const originalSend = res.send.bind(res);
      const wrappedSend: Response['send'] = (...args) => {
        settleSuccess(captureSnapshot('send', args[0]));
        return originalSend(...args);
      };
      res.send = wrappedSend;

      const originalEnd = res.end.bind(res);
      const wrappedEnd = ((
        chunk?: unknown,
        encoding?: BufferEncoding | (() => void),
        cb?: () => void
      ) => {
        settleSuccess(captureSnapshot('end', chunk));

        if (typeof encoding === 'function') {
          return originalEnd(chunk as never, encoding);
        }

        if (encoding === undefined) {
          return originalEnd(chunk as never, cb);
        }

        return originalEnd(chunk as never, encoding, cb);
      }) as Response['end'];
      res.end = wrappedEnd;

      res.once('error', (error) => {
        settleFailure(error);
      });

      res.once('close', () => {
        if (!res.writableEnded) {
          settleFailure(new Error(`Coalesced request closed before completion: ${req.path}`));
        }
      });

      next();
    };
  }

  private applySnapshot(res: Response, snapshot: CoalescedResponse): void {
    res.status(snapshot.statusCode);

    for (const [name, value] of Object.entries(snapshot.headers)) {
      res.setHeader(name, value);
    }

    if (snapshot.kind === 'json') {
      res.json(snapshot.body);
      return;
    }

    if (snapshot.kind === 'send') {
      res.send(snapshot.body as never);
      return;
    }

    res.end(snapshot.body as never);
  }

  _cleanupCompletedRequests(): void {
    const now = Date.now();

    for (const [key, entry] of this.pendingRequests.entries()) {
      if (entry.expiresAt !== null && now >= entry.expiresAt) {
        this.pendingRequests.delete(key);
      }
    }
  }

  _hasCompletedEntries(): boolean {
    for (const entry of this.pendingRequests.values()) {
      if (entry.expiresAt !== null) {
        return true;
      }
    }
    return false;
  }

  _scheduleCleanup(intervalMs: number = DEFAULT_COALESCING_WINDOW_MS): void {
    if (this.cleanupTimer) {
      return;
    }

    this.cleanupTimer = setTimeout(() => {
      this.cleanupTimer = null;
      this._cleanupCompletedRequests();
      if (this._hasCompletedEntries()) {
        this._scheduleCleanup(intervalMs);
      }
    }, intervalMs);
  }

  getStats(): {
    coalesced: number;
    unique: number;
    totalSaved: number;
    total: number;
    coalescingRate: string;
    activePending: number;
  } {
    const total = this.stats.coalesced + this.stats.unique;
    const coalescingRate = total > 0 ? (this.stats.coalesced / total) * 100 : 0;

    return {
      ...this.stats,
      total,
      coalescingRate: `${coalescingRate.toFixed(2)}%`,
      activePending: this.pendingRequests.size,
    };
  }

  resetStats(): void {
    this.stats = {
      coalesced: 0,
      unique: 0,
      totalSaved: 0,
    };
  }

  clear(): void {
    this.pendingRequests.clear();
    if (this.cleanupTimer) {
      clearTimeout(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

export const requestCoalescing = new RequestCoalescingMiddleware();
