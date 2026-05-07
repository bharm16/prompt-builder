/**
 * Minimal session-store port consumed by `ContinuitySessionStore`.
 *
 * Declared in the continuity domain so continuity depends on an abstraction
 * it owns, rather than on the concrete `SessionStore` class in
 * `services/sessions/`. The real `SessionStore` structurally satisfies this
 * port and is wired in at DI time.
 */
import type { SessionRecord } from "@server/domain/session/types";

export interface SessionStorePort {
  get(sessionId: string): Promise<SessionRecord | null>;
  save(session: SessionRecord): Promise<void>;
  saveInTransaction(
    transaction: FirebaseFirestore.Transaction,
    session: SessionRecord,
  ): void;
  findContinuityByUser(
    userId: string,
    limitCount?: number,
  ): Promise<SessionRecord[]>;
  delete(sessionId: string): Promise<void>;
}
