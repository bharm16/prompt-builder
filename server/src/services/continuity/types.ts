/**
 * Re-exports of the neutral continuity domain types.
 *
 * The canonical location is `server/src/domain/continuity/types.ts` — that is
 * where the type shapes live so both `services/sessions/` and
 * `services/continuity/` can depend on the same graph without importing
 * from each other.
 *
 * New code should import directly from `@domain/continuity/types`.
 */
export type {
  GenerationMode,
  ContinuityMode,
  ContinuityMechanismUsed,
  StyleReference,
  StyleAnalysisMetadata,
  ProviderContinuityCapabilities,
  SeedInfo,
  FrameBridge,
  SceneProxy,
  SceneProxyRender,
  ContinuityShot,
  ContinuitySessionSettings,
  ContinuitySession,
  StyleMatchOptions,
  CharacterKeyframeOptions,
  CreateShotRequest,
  CreateSessionRequest,
  ContinuityStrategy,
  QualityGateResult,
} from "@server/domain/continuity/types";
