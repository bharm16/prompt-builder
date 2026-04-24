// Contract types are defined once in shared/ so server and client can't drift.
// UI-only types (CoherenceReviewData) stay local to the feature.
export type {
  CoherenceEdit,
  CoherenceRecommendation,
  CoherenceFinding,
  CoherenceSpan,
  AppliedChange,
  CoherenceCheckRequest,
  CoherenceCheckResult,
} from "@shared/types/coherence";

import type {
  CoherenceCheckResult,
  AppliedChange,
  CoherenceSpan,
} from "@shared/types/coherence";

export interface CoherenceReviewData extends CoherenceCheckResult {
  beforePrompt: string;
  afterPrompt: string;
  appliedChange?: AppliedChange | undefined;
  spans: CoherenceSpan[];
}
