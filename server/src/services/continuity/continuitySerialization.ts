/**
 * Re-exports of the neutral continuity serialization helpers.
 *
 * The canonical location is `server/src/domain/continuity/serialization.ts` —
 * keeping the pure functions outside `services/` lets both
 * `services/sessions/SessionStore` and `services/continuity/` use them
 * without one service domain importing from the other.
 *
 * New code should import directly from `@server/domain/continuity/serialization`.
 */
export {
  serializeContinuitySession,
  deserializeContinuitySession,
  serializeShot,
  deserializeShot,
  serializeStyleReference,
  deserializeStyleReference,
  serializeSceneProxy,
  deserializeSceneProxy,
} from "@server/domain/continuity/serialization";
export type { StoredContinuitySession } from "@server/domain/continuity/serialization";
