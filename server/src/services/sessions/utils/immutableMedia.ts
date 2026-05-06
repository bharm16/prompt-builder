/**
 * Re-exports of the neutral immutable-media helpers.
 *
 * The canonical location is `server/src/utils/immutableMedia.ts` — both
 * `services/sessions/SessionService` and
 * `services/continuity/ContinuitySessionService` use these helpers, and
 * neither domain should depend on the other.
 *
 * New code should import directly from `@utils/immutableMedia`.
 */
export {
  enforceImmutableVersions,
  enforceImmutableKeyframes,
} from "@utils/immutableMedia";
export type { ImmutableMediaWarning } from "@utils/immutableMedia";
