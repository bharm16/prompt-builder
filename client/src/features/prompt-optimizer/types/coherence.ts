export type CoherenceEdit =
  | {
      type: 'replaceSpanText';
      spanId?: string | undefined;
      replacementText?: string | undefined;
      anchorQuote?: string | undefined;
    }
  | {
      type: 'removeSpan';
      spanId?: string | undefined;
      anchorQuote?: string | undefined;
    };

export interface CoherenceRecommendation {
  id?: string | undefined;
  title: string;
  rationale: string;
  edits: CoherenceEdit[];
  confidence?: number | undefined;
}

export interface CoherenceFinding {
  id?: string | undefined;
  severity?: 'low' | 'medium' | 'high' | 'suggestion' | undefined;
  message: string;
  reasoning: string;
  involvedSpanIds?: string[] | undefined;
  recommendations: CoherenceRecommendation[];
}

export interface CoherenceSpan {
  id?: string | undefined;
  category?: string | undefined;
  text?: string | undefined;
  quote?: string | undefined;
  start?: number | undefined;
  end?: number | undefined;
  confidence?: number | undefined;
  leftCtx?: string | undefined;
  rightCtx?: string | undefined;
  [key: string]: unknown;
}

export interface AppliedChange {
  spanId?: string | undefined;
  category?: string | undefined;
  oldText?: string | undefined;
  newText?: string | undefined;
}

export interface CoherenceCheckRequest {
  beforePrompt: string;
  afterPrompt: string;
  appliedChange?: AppliedChange | undefined;
  spans?: CoherenceSpan[] | undefined;
}

export interface CoherenceCheckResult {
  conflicts: CoherenceFinding[];
  harmonizations: CoherenceFinding[];
}

export interface CoherenceReviewData extends CoherenceCheckResult {
  beforePrompt: string;
  afterPrompt: string;
  appliedChange?: AppliedChange | undefined;
  spans: CoherenceSpan[];
}
