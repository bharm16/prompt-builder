import { createCanonicalText } from '../../../utils/canonicalText.js';
import { extractContextSpans } from './extractContextTrie.js';
import { extractLexiconSpans } from './extractLexicon.js';
import { extractNLPSpans } from './extractNLP.js';
import { invertRanges } from './invertRanges.js';
import { validateSpan } from '../../../utils/categoryValidators.js';
import { markValidatorResult, flagSpanDropped, cloneSpan, resetSpanCounter } from './spanUtils.js';
import { smartDeduplicate } from './smartDeduplicate.js';
import { logPipelineMetric, logSpanLifecycle } from '../../../utils/parserDebug.js';
import { filterIncompleteSpans } from './phraseCompleteness.js';
import { clampSpansToClauses } from './subjectClauseClamp.js';

export const PARSER_VERSION = '2025.03.01';
export const LEXICON_VERSION = '2025.03.01';
export const EMOJI_POLICY_VERSION = 'NFC-KEEP';

const toRanges = (spans) =>
  spans.map(span => ({ start: span.start, end: span.end }));

const applyValidators = (spans) => {
  const kept = [];
  let dropped = 0;

  spans.forEach((span) => {
    const result = validateSpan(span);
    if (!result.pass) {
      markValidatorResult(span, false, result.reason);
      flagSpanDropped(span, result.reason);
      dropped += 1;
      return;
    }

    const updatedSpan = result.category !== span.category
      ? cloneSpan(span, { category: result.category })
      : span;

    markValidatorResult(updatedSpan, true);
    if (updatedSpan !== span) {
      logSpanLifecycle({
        stage: 'retyped',
        span: updatedSpan,
        extra: { from: span.category, to: updatedSpan.category },
      });
    }

    kept.push(updatedSpan);
  });

  return { spans: kept, dropped };
};

export const runExtractionPipeline = (text, promptContext, options = {}) => {
  resetSpanCounter();
  const canonical = createCanonicalText(text ?? '');
  const totalLength = canonical.normalized.length;
  const startTime = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();

  const contextSpans = extractContextSpans({ canonical, promptContext });
  const contextRanges = toRanges(contextSpans);

  const lexiconRanges = invertRanges(contextRanges, totalLength);
  const lexiconSpans = extractLexiconSpans({ canonical, ranges: lexiconRanges, promptContext });
  const combinedRanges = invertRanges([...contextRanges, ...toRanges(lexiconSpans)], totalLength);
  const nlpSpans = extractNLPSpans({ canonical, ranges: combinedRanges, promptContext });

  const candidates = [...contextSpans, ...lexiconSpans, ...nlpSpans];
  const validatorResult = applyValidators(candidates);
  const completenessResult = filterIncompleteSpans(validatorResult.spans, canonical);
  const clampedSpans = clampSpansToClauses(canonical, completenessResult.spans);
  const deduped = smartDeduplicate(clampedSpans, canonical);

  const endTime = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
  logPipelineMetric({
    metric: 'parse_time_ms',
    value: endTime - startTime,
    context: {
      spans: deduped.length,
      candidates: candidates.length,
      validatorDropped: validatorResult.dropped,
      completenessDropped: completenessResult.dropped,
    },
  });

  return {
    canonical,
    spans: deduped,
    stats: {
      totalCandidates: candidates.length,
      afterValidation: validatorResult.spans.length,
      validatorDropped: validatorResult.dropped,
      completenessDropped: completenessResult.dropped,
      final: deduped.length,
    },
    versions: {
      parser: PARSER_VERSION,
      lexicon: LEXICON_VERSION,
      emojiPolicy: EMOJI_POLICY_VERSION,
    },
  };
};

export const extractVideoPromptPhrases = (text, promptContext, options) => {
  const result = runExtractionPipeline(text, promptContext, options);
  return result.spans;
};
