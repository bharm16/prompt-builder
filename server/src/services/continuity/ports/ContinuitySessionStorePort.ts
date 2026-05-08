import type { ContinuitySession } from "@server/domain/continuity/types";
import { DomainError } from "@server/errors/DomainError";

/**
 * Port that domain code uses to read and write continuity sessions.
 *
 * Implementations live under `services/continuity/storage/`. Service-tier
 * collaborators (ContinuityShotGenerator, ContinuitySessionService) depend on
 * this port — they never see the Firestore SDK or any other infrastructure
 * detail.
 */
export interface ContinuitySessionStorePort {
  save(session: ContinuitySession): Promise<void>;
  saveWithVersion(
    session: ContinuitySession,
    expectedVersion: number,
  ): Promise<number>;
  get(sessionId: string): Promise<ContinuitySession | null>;
  findByUser(userId: string): Promise<ContinuitySession[]>;
  delete(sessionId: string): Promise<void>;
}

export class ContinuitySessionVersionMismatchError extends DomainError {
  readonly code = "SESSION_VERSION_CONFLICT" as const;

  constructor(
    readonly sessionId: string,
    readonly expectedVersion: number,
    readonly actualVersion?: number,
  ) {
    super(
      `Continuity session version mismatch for ${sessionId} (expected ${expectedVersion}, got ${actualVersion ?? "unknown"})`,
      { sessionId, expectedVersion, actualVersion },
    );
    this.name = "ContinuitySessionVersionMismatchError";
  }

  getHttpStatus(): number {
    return 409;
  }

  getUserMessage(): string {
    return "Your changes conflicted with another edit. Please reload to see the latest version.";
  }
}
