import { createSpan, spansOverlap } from './spanUtils.js';
import { LEXICON_PHRASES, RANGE_PATTERNS, SINGLE_PATTERNS } from './lexiconConfig.js';
import { parserDebugLog, logSpanLifecycle } from '../../../utils/parserDebug.js';

const isWithinRanges = (start, end, ranges) =>
  ranges.some(range => start >= range.start && end <= range.end);

const claimSpan = (span, claimed) => {
  if (claimed.some(existing => spansOverlap(existing, span))) {
    return false;
  }
  claimed.push({ start: span.start, end: span.end });
  return true;
};

const collectPhraseMatches = ({ canonical, ranges, claimed }) => {
  const results = [];
  const lower = canonical.normalized.toLowerCase();

  LEXICON_PHRASES.forEach((entry) => {
    entry.phrases.forEach((phrase) => {
      const loweredPhrase = phrase.toLowerCase();
      let cursor = 0;
      while (cursor < lower.length) {
        const index = lower.indexOf(loweredPhrase, cursor);
        if (index === -1) break;
        const start = index;
        const end = start + loweredPhrase.length;
        cursor = end;

        if (!isWithinRanges(start, end, ranges)) {
          continue;
        }

        const span = createSpan({
          canonical,
          start,
          end,
          category: entry.category,
          source: 'LEXICON',
          metadata: {
            matcher: 'phrase',
            lexiconKey: phrase,
          },
        });

        if (claimSpan(span, claimed)) {
          logSpanLifecycle({ stage: 'lexicon_phrase', span, extra: { phrase } });
          results.push(span);
        }
      }
    });
  });

  return results;
};

const collectRegexMatches = ({ canonical, ranges, claimed }) => {
  const results = [];
  const lower = canonical.normalized.toLowerCase();

  ranges.forEach((range) => {
    const slice = lower.slice(range.start, range.end);
    const offset = range.start;
    const mask = new Array(slice.length).fill(false);

    const maskInterval = (start, end) => {
      for (let i = start; i < end; i += 1) {
        mask[i] = true;
      }
    };

    const isMasked = (start, end) => {
      for (let i = start; i < end; i += 1) {
        if (mask[i]) return true;
      }
      return false;
    };

    RANGE_PATTERNS.forEach((patternConfig) => {
      const regex = new RegExp(patternConfig.regex);
      let match;
      while ((match = regex.exec(slice)) !== null) {
        const localStart = match.index;
        const localEnd = match.index + match[0].length;
        if (isMasked(localStart, localEnd)) {
          continue;
        }
        maskInterval(localStart, localEnd);

        const start = offset + localStart;
        const end = offset + localEnd;
        const span = createSpan({
          canonical,
          start,
          end,
          category: patternConfig.category,
          source: 'LEXICON',
          metadata: {
            matcher: 'range_regex',
            ...patternConfig.metadata,
            match: match[0],
          },
        });
        if (claimSpan(span, claimed)) {
          logSpanLifecycle({
            stage: 'lexicon_range',
            span,
            extra: { pattern: patternConfig.regex.toString() },
          });
          results.push(span);
        }
      }
    });

    SINGLE_PATTERNS.forEach((patternConfig) => {
      const regex = new RegExp(patternConfig.regex);
      let match;
      while ((match = regex.exec(slice)) !== null) {
        const localStart = match.index;
        const localEnd = match.index + match[0].length;
        if (isMasked(localStart, localEnd)) {
          continue;
        }
        maskInterval(localStart, localEnd);

        const start = offset + localStart;
        const end = offset + localEnd;
        const metadata = {
          matcher: 'single_regex',
          match: match[0],
          specificity: patternConfig.specificity ?? 0,
        };

        if (patternConfig.category === 'technical') {
          const unitMatch = match[0].match(/\b(?:mm|fps|k|°?k|kelvin|sec|secs|seconds|s|ms|hz|khz|mhz|iso|f\/\d+(?:\.\d+)?|t\d+(?:\.\d+)?|1\/\d+)\b/i);
          if (unitMatch) {
            metadata.unitMatch = unitMatch[0];
          }
        }

        const span = createSpan({
          canonical,
          start,
          end,
          category: patternConfig.category,
          source: 'LEXICON',
          metadata,
        });

        if (claimSpan(span, claimed)) {
          logSpanLifecycle({
            stage: 'lexicon_regex',
            span,
            extra: { pattern: patternConfig.regex.toString() },
          });
          results.push(span);
        }
      }
    });
  });

  return results;
};

export const extractLexiconSpans = ({ canonical, ranges }) => {
  if (!ranges?.length) return [];

  const claimed = [];
  const phraseMatches = collectPhraseMatches({ canonical, ranges, claimed });
  const regexMatches = collectRegexMatches({ canonical, ranges, claimed });

  const all = [...phraseMatches, ...regexMatches];

  parserDebugLog('lexicon:summary', {
    count: all.length,
    phraseMatches: phraseMatches.length,
    regexMatches: regexMatches.length,
  });

  return all;
};
