/**
 * Job handler interface — pluggable processor contract consumed by the
 * generic worker machinery.
 *
 * The worker owns: claim, lease, heartbeat lifecycle, concurrency, polling
 * cadence, shutdown draining. The handler owns: the actual provider call,
 * result persistence, credit commitment/refund. This separation is the seam
 * where future job types (image generation, continuity shots) plug in.
 *
 * See `docs/architecture/ASYNC_JOB_UNIFICATION.md` for the roadmap.
 */

export interface JobExecutionContext {
  /** Worker-assigned identifier used for heartbeats and log correlation. */
  workerId: string;
  /** Lease duration in ms. Handler should assume heartbeat renews the lease. */
  leaseMs: number;
  /**
   * Cancellation signal raised by the worker when it decides the job must be
   * aborted (e.g. consecutive heartbeat failures indicate a zombie lease).
   */
  signal: AbortSignal;
  /**
   * Heartbeat manager already started by the worker. Handler may pass it
   * further down the stack but does not own its lifecycle.
   */
  heartbeat: {
    start(): void;
    stop(): void;
  };
}

export interface JobHandler<TJob> {
  /**
   * Process a claimed job. Exceptions propagate to the worker, which applies
   * retry/DLQ policy. Handlers should respect `ctx.signal` for cancellation.
   */
  process(job: TJob, ctx: JobExecutionContext): Promise<void>;
}
