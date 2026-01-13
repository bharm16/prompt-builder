export interface SpanLabel {
  start: number;
  end: number;
  category: string;
  confidence: number;
  text?: string;
  role?: string;
}

export interface LabelSpansPayload {
  text: string;
  maxSpans?: number;
  minConfidence?: number;
  policy?: unknown;
  templateVersion?: string;
}

export interface LabelSpansResponse {
  spans: SpanLabel[];
  meta: Record<string, unknown> | null;
}
