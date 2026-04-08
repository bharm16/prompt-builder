import type { ServerResponse } from "node:http";
import { logger } from "@infrastructure/Logger";

/**
 * Default overflow threshold — 1 MB of server-buffered bytes per SSE channel.
 *
 * When a slow client drops below its throughput target for long enough, Node
 * starts buffering unsent chunks in the heap via the Writable queue. Without a
 * ceiling this can accumulate hundreds of KB per client and OOM the process
 * under real-world network conditions. Exceeding this threshold force-closes
 * the connection so the kernel can release the associated memory.
 */
export const DEFAULT_MAX_BUFFERED_BYTES = 1_048_576;

export type SseWriteResult =
  | { ok: true }
  | { ok: false; reason: "closed" | "overflow" };

export interface SseWriterOptions {
  /** Overflow kill-switch threshold in bytes. Defaults to 1 MB. */
  maxBufferedBytes?: number;
  /** Optional label for logs (e.g. route name). */
  label?: string;
}

export interface SseWriter {
  /**
   * Write a chunk. Resolves when the chunk has been handed to the socket and,
   * if the socket applied backpressure, after the 'drain' event fires. Writes
   * are serialized per writer — a subsequent write waits for the prior one to
   * settle.
   */
  write: (chunk: string | Buffer) => Promise<SseWriteResult>;
  /** Mark the writer closed; subsequent writes return { ok: false, reason: "closed" }. */
  close: () => void;
  /** Total bytes successfully handed to res.write so far. */
  readonly bytesWritten: number;
}

/**
 * Response surface we actually need. Works for both the raw Node
 * ServerResponse and Express's Response (which extends it).
 */
interface WritableResponseLike {
  write(chunk: string | Buffer): boolean;
  end(): void;
  destroy(error?: Error): void;
  once(event: "drain", listener: () => void): unknown;
  writableLength?: number;
  writableEnded?: boolean;
  destroyed?: boolean;
}

/**
 * Create a backpressure-aware SSE writer around a Node/Express response.
 *
 * Behavior:
 *   - Awaits 'drain' when the underlying write returns false.
 *   - Force-closes the connection (end + destroy) if writableLength exceeds
 *     the configured threshold; further writes become no-ops with reason
 *     "closed".
 *   - All writes are strictly sequential, so chunk order is preserved.
 */
export function createSseWriter(
  res: ServerResponse | WritableResponseLike,
  options: SseWriterOptions = {},
): SseWriter {
  const threshold = options.maxBufferedBytes ?? DEFAULT_MAX_BUFFERED_BYTES;
  const label = options.label ?? "sse";
  const target = res as WritableResponseLike;

  let bytesWritten = 0;
  let closed = false;
  let paused = false;
  // Pending writes queued while the stream is paused (awaiting 'drain').
  const pending: Array<{
    chunk: string | Buffer;
    resolve: (value: SseWriteResult) => void;
  }> = [];

  const isResponseClosed = (): boolean =>
    closed || target.writableEnded === true || target.destroyed === true;

  const killForOverflow = (bytesBuffered: number): void => {
    logger.warn("SSE connection exceeded buffered-bytes threshold", {
      operation: "sseBackpressure.overflow",
      label,
      bytesBuffered,
      bytesWritten,
      threshold,
    });
    try {
      if (target.writableEnded !== true) {
        target.end();
      }
    } catch {
      // swallow — we're about to destroy anyway
    }
    try {
      if (target.destroyed !== true) {
        target.destroy();
      }
    } catch {
      // swallow
    }
    closed = true;
  };

  /**
   * Synchronously hand `chunk` to the underlying stream and evaluate
   * backpressure/overflow state. Returns:
   *   - { ok: true } if the socket accepted the chunk and still has headroom
   *   - "paused" if the chunk was written but the socket signaled backpressure
   *   - { ok: false, reason } on closed/overflow
   */
  const writeSync = (chunk: string | Buffer): SseWriteResult | "paused" => {
    if (isResponseClosed()) {
      return { ok: false, reason: "closed" };
    }

    let wroteTrue: boolean;
    try {
      wroteTrue = target.write(chunk);
    } catch {
      closed = true;
      return { ok: false, reason: "closed" };
    }

    bytesWritten += Buffer.byteLength(chunk);

    // Overflow check — writableLength reflects bytes currently buffered in
    // the stream that the kernel has not yet accepted.
    const buffered =
      typeof target.writableLength === "number" ? target.writableLength : 0;
    if (buffered > threshold) {
      killForOverflow(buffered);
      return { ok: false, reason: "overflow" };
    }

    if (!wroteTrue) return "paused";
    return { ok: true };
  };

  const failPending = (reason: "closed" | "overflow"): void => {
    while (pending.length > 0) {
      const entry = pending.shift();
      if (entry) entry.resolve({ ok: false, reason });
    }
  };

  const onDrain = (): void => {
    paused = false;
    // Flush queued writes until we hit backpressure again or drain the queue.
    while (pending.length > 0 && !paused && !isResponseClosed()) {
      const entry = pending.shift();
      if (!entry) break;
      const result = writeSync(entry.chunk);
      if (result === "paused") {
        paused = true;
        target.once("drain", onDrain);
        entry.resolve({ ok: true });
        return;
      }
      entry.resolve(result);
      if (!result.ok) {
        failPending(result.reason);
        return;
      }
    }
    if (isResponseClosed()) {
      failPending("closed");
    }
  };

  const write = (chunk: string | Buffer): Promise<SseWriteResult> => {
    if (isResponseClosed()) {
      return Promise.resolve({ ok: false, reason: "closed" });
    }

    // If paused, queue behind prior pending writes to preserve order.
    if (paused || pending.length > 0) {
      return new Promise((resolve) => {
        pending.push({ chunk, resolve });
      });
    }

    const result = writeSync(chunk);
    if (result === "paused") {
      paused = true;
      target.once("drain", onDrain);
      return Promise.resolve({ ok: true });
    }
    return Promise.resolve(result);
  };

  const close = (): void => {
    closed = true;
    failPending("closed");
  };

  return {
    write,
    close,
    get bytesWritten() {
      return bytesWritten;
    },
  };
}
