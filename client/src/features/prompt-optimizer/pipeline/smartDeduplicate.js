import { flagSpanDropped, spansOverlap } from './spanUtils.js';
import { CATEGORY_CAPS } from '../../../utils/categoryValidators.js';
import { logSpanLifecycle, parserDebugLog } from '../../../utils/parserDebug.js';

const TIER_WEIGHTS = {
  CONTEXT: 3,
  LEXICON: 2,
  NLP: 1,
};

const GENERIC_ADJECTIVES = new Set([
  'beautiful',
  'cinematic',
  'stunning',
  'amazing',
  'cool',
  'epic',
  'dramatic',
]);

const containsNumericSpecifics = (span) => /\d/.test(span.text || '');
const containsUnit = (span) => /\b(?:mm|fps|k|°?k|kelvin|iso|sec|secs|seconds|s|ms|hz|khz|mhz|f\/\d+(?:\.\d+)?|t\d+(?:\.\d+)?|1\/\d+)\b/i.test(span.text || '');

const computeSpecificity = (span) => {
  let score = 0;
  if (span.metadata?.specificity) score += span.metadata.specificity;
  if (containsUnit(span)) score += 2;
  if (containsNumericSpecifics(span)) score += 1;

  const adjMatches = (span.text || '').toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
  const genericAdjCount = adjMatches.filter(word => GENERIC_ADJECTIVES.has(word)).length;
  if (genericAdjCount && genericAdjCount === adjMatches.length) {
    score -= 1;
  }
  return score;
};

const computeTierWeight = (span) => TIER_WEIGHTS[span.source] ?? 0;

const computeScoreTuple = (span) => {
  const tier = computeTierWeight(span);
  const specificity = computeSpecificity(span);
  const confidence = Number.isFinite(span.confidence) ? span.confidence : 0.5;
  const lengthScore = (span.text || '').length;
  return [tier, specificity, confidence, lengthScore];
};

const compareTuplesDesc = (a, b) => {
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] > b[i]) return -1;
    if (a[i] < b[i]) return 1;
  }
  return 0;
};

const computeCategoryLimit = (category, wordCount) => {
  const base = CATEGORY_CAPS[category];
  if (!base) return Infinity;
  const scale = Math.max(1, Math.ceil(wordCount / 100));
  return base * scale;
};

export const smartDeduplicate = (spans, canonical) => {
  if (!spans?.length) return [];

  const withScores = spans.map((span, index) => ({
    span,
    score: computeScoreTuple(span),
    index,
  }));

  withScores.sort((a, b) => {
    const cmp = compareTuplesDesc(a.score, b.score);
    if (cmp !== 0) return cmp;
    return a.index - b.index;
  });

  const selected = [];
  const categoryCounts = new Map();
  const wordCount = (canonical?.normalized?.match(/\b\w+\b/g) || []).length;

  withScores.forEach(({ span }) => {
    const tier = computeTierWeight(span);

    if (span.source === 'CONTEXT') {
      const overlapping = selected.find(existing => existing.source === 'CONTEXT' && spansOverlap(existing, span));
      if (overlapping) {
        if ((span.text || '').length > (overlapping.text || '').length) {
          const index = selected.indexOf(overlapping);
          if (index !== -1) {
            selected.splice(index, 1, span);
          } else {
            selected.push(span);
          }
          logSpanLifecycle({ stage: 'dedupe_keep', span, extra: { reason: 'context_replace' } });
        } else {
          logSpanLifecycle({ stage: 'dedupe_keep', span: overlapping, extra: { reason: 'context_existing' } });
        }
      } else {
        selected.push(span);
        logSpanLifecycle({ stage: 'dedupe_keep', span, extra: { reason: 'context_lock' } });
      }
      const count = categoryCounts.get(span.category) || 0;
      categoryCounts.set(span.category, count + 1);
      return;
    }

    const limit = computeCategoryLimit(span.category, wordCount);
    const currentCount = categoryCounts.get(span.category) || 0;
    if (currentCount >= limit) {
      flagSpanDropped(span, 'category_cap');
      return;
    }

    const overlapsHigherTier = selected.some(existing => {
      if (!spansOverlap(existing, span)) return false;
      return computeTierWeight(existing) >= tier;
    });

    if (overlapsHigherTier) {
      flagSpanDropped(span, 'overlap_with_higher_tier');
      return;
    }

    selected.push(span);
    categoryCounts.set(span.category, currentCount + 1);
    logSpanLifecycle({ stage: 'dedupe_keep', span, extra: { reason: 'score_priority' } });
  });

  parserDebugLog('dedupe:summary', {
    input: spans.length,
    output: selected.length,
  });

  return selected;
};

