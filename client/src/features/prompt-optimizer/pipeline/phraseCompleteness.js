import nlp from 'compromise';
import { flagSpanDropped } from './spanUtils.js';
import { logSpanLifecycle } from '../../../utils/parserDebug.js';

const MAX_SINGLE_TOKEN_CATEGORIES = new Set(['style', 'lighting', 'environment', 'camera']);

const hasPattern = (doc, pattern) => {
  try {
    return doc.has(pattern);
  } catch (error) {
    return false;
  }
};

const isCompleteSpan = (span) => {
  const text = span?.quote || span?.text || '';
  if (!text || typeof text !== 'string') {
    return false;
  }

  const doc = nlp(text);
  const tokenCount = doc.termList().length;

  switch (span.category) {
    case 'camera':
    case 'cameramove':
      return hasPattern(doc, '#Verb') || /\b(shot|move|pan|tilt|dolly|push|pull)\b/i.test(text);
    case 'lighting':
      return (hasPattern(doc, '#Adjective #Noun') || hasPattern(doc, '#Noun #Noun')) && /light|lighting|glow|wash|beam|flare/i.test(text);
    case 'technical':
      return /\d/.test(text) && /(mm|fps|k|iso|sec|seconds|s|ms|hz|t\d+|f\/\d+)/i.test(text);
    case 'style':
    case 'aesthetic':
      return (tokenCount >= 2 && hasPattern(doc, '#Adjective')) || hasPattern(doc, '#Adjective #Noun') || /palette|aesthetic|grade|treatment|style|look/i.test(text);
    case 'environment':
    case 'location':
      return hasPattern(doc, '#Noun') || /street|alley|plaza|square|forest|station|ship|market/i.test(text);
    default:
      return tokenCount > 1 || hasPattern(doc, '#Noun') || hasPattern(doc, '#Verb');
  }
};

export const filterIncompleteSpans = (spans, canonical) => {
  const kept = [];
  let dropped = 0;

  spans.forEach((span) => {
    if (span.source === 'CONTEXT') {
      kept.push(span);
      return;
    }

    const text = span?.quote || '';
    const doc = nlp(text);
    const tokenCount = doc.termList().length;

    if (tokenCount <= 1 && MAX_SINGLE_TOKEN_CATEGORIES.has(span.category || '')) {
      if (isCompleteSpan(span)) {
        kept.push(span);
        return;
      }
      flagSpanDropped(span, 'incomplete_phrase');
      logSpanLifecycle({ stage: 'dropped', span, reason: 'incomplete_phrase_single_token' });
      dropped += 1;
      return;
    }

    if (isCompleteSpan(span)) {
      kept.push(span);
    } else {
      flagSpanDropped(span, 'incomplete_phrase');
      logSpanLifecycle({ stage: 'dropped', span, reason: 'incomplete_phrase' });
      dropped += 1;
    }
  });

  return { spans: kept, dropped };
};
