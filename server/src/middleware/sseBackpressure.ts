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
  removeListener?(event: "drain", listener: () => void): unknown;
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
  // Tracked bytes MUST be counted against the overflow threshold alongside
  // the underlying stream's writableLength — otherwise a fast producer can
  // OOM the process via this in-JS queue while writableLength stays low.
  const pending: Array<{
    chunk: string | Buffer;
    bytes: number;
    resolve: (value: SseWriteResult) => void;
  }> = [];
  let pendingBytes = 0;

  const isResponseClosed = (): boolean =>
    closed || target.writableEnded === true || target.destroyed === true;

  const killForOverflow = (bytesBuffered: number): void => {
    logger.warn("SSE connection exceeded buffered-bytes threshold", {
      operation: "sseBackpressure.overflow",
      label,
      bytesBuffered,
      pendingBytes,
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
   * Returns the number of bytes currently buffered by the underlying stream.
   * Real Node ServerResponse always provides `writableLength`; the 0 fallback
   * is only hit by test mocks that don't model it, and silently disables the
   * kernel-buffer portion of the overflow check for those callers.
   */
  const getBuffered = (): number =>
    typeof target.writableLength === "number" ? target.writableLength : 0;

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

    // Overflow check — total server-held bytes = kernel/stream buffer
    // (writableLength) + anything still sitting in our pending[] queue.
    // Both must fit under the threshold, otherwise the refactor would just
    // shift the OOM risk from one buffer to another.
    const totalBuffered = getBuffered() + pendingBytes;
    if (totalBuffered > threshold) {
      killForOverflow(totalBuffered);
      return { ok: false, reason: "overflow" };
    }

    if (!wroteTrue) return "paused";
    return { ok: true };
  };

  const failPending = (reason: "closed" | "overflow"): void => {
    while (pending.length > 0) {
      const entry = pending.shift();
      if (entry) {
        pendingBytes -= entry.bytes;
        entry.resolve({ ok: false, reason });
      }
    }
    // Defensive reset — guard against any rounding drift.
    pendingBytes = 0;
  };

  let drainListener: (() => void) | null = null;

  const attachDrain = (): void => {
    drainListener = onDrain;
    target.once("drain", drainListener);
  };

  const detachDrain = (): void => {
    if (drainListener && typeof target.removeListener === "function") {
      target.removeListener("drain", drainListener);
    }
    drainListener = null;
  };

  function onDrain(): void {
    drainListener = null;
    paused = false;
    // Flush queued writes until we hit backpressure again or drain the queue.
    while (pending.length > 0 && !paused && !isResponseClosed()) {
      const entry = pending.shift();
      if (!entry) break;
      pendingBytes -= entry.bytes;
      const result = writeSync(entry.chunk);
      if (result === "paused") {
        paused = true;
        attachDrain();
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
  }

  const write = (chunk: string | Buffer): Promise<SseWriteResult> => {
    if (isResponseClosed()) {
      return Promise.resolve({ ok: false, reason: "closed" });
    }

    // If paused, queue behind prior pending writes to preserve order.
    if (paused || pending.length > 0) {
      const chunkBytes = Buffer.byteLength(chunk);
      // Pre-enqueue overflow check: count this chunk against the threshold
      // BEFORE holding its memory. Without this, a fast producer piling into
      // pending[] while drain never fires would OOM the process through the
      // in-JS queue (the `writableLength`-only check would miss it entirely).
      const projected = getBuffered() + pendingBytes + chunkBytes;
      if (projected > threshold) {
        killForOverflow(projected);
        failPending("overflow");
        return Promise.resolve({ ok: false, reason: "overflow" });
      }
      return new Promise((resolve) => {
        pending.push({ chunk, bytes: chunkBytes, resolve });
        pendingBytes += chunkBytes;
      });
    }

    const result = writeSync(chunk);
    if (result === "paused") {
      paused = true;
      attachDrain();
      return Promise.resolve({ ok: true });
    }
    return Promise.resolve(result);
  };

  const close = (): void => {
    closed = true;
    detachDrain();
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
