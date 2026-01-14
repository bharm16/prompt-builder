export type CoherenceEdit =
  | {
      type: 'replaceSpanText';
      spanId?: string;
      replacementText?: string;
      anchorQuote?: string;
    }
  | {
      type: 'removeSpan';
      spanId?: string;
      anchorQuote?: string;
    };

export interface CoherenceRecommendation {
  id?: string;
  title: string;
  rationale: string;
  edits: CoherenceEdit[];
  confidence?: number;
}

export interface CoherenceFinding {
  id?: string;
  severity?: 'low' | 'medium' | 'high' | 'suggestion';
  message: string;
  reasoning: string;
  involvedSpanIds?: string[];
  recommendations: CoherenceRecommendation[];
}

export interface CoherenceSpan {
  id?: string;
  category?: string;
  text?: string;
  quote?: string;
  start?: number;
  end?: number;
  confidence?: number;
  leftCtx?: string;
  rightCtx?: string;
  [key: string]: unknown;
}

export interface AppliedChange {
  spanId?: string;
  category?: string;
  oldText?: string;
  newText?: string;
}

export interface CoherenceCheckRequest {
  beforePrompt: string;
  afterPrompt: string;
  appliedChange?: AppliedChange;
  spans?: CoherenceSpan[];
}

export interface CoherenceCheckResult {
  conflicts: CoherenceFinding[];
  harmonizations: CoherenceFinding[];
}

export interface CoherenceReviewData extends CoherenceCheckResult {
  beforePrompt: string;
  afterPrompt: string;
  appliedChange?: AppliedChange;
  spans: CoherenceSpan[];
}
