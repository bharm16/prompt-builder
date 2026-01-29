import type { LabelSpansPayload } from './spanLabelingTypes';

/**
 * Builds the request body for span labeling API calls.
 */
export function buildLabelSpansBody(payload: LabelSpansPayload): string {
  const body = {
    text: payload.text,
    maxSpans: payload.maxSpans,
    minConfidence: payload.minConfidence,
    policy: payload.policy,
    templateVersion: payload.templateVersion,
    isI2VMode: payload.isI2VMode,
  };

  return JSON.stringify(body);
}
