import nlp from 'compromise';
import { createSpan } from './spanUtils.js';
import { parserDebugLog, logSpanLifecycle } from '../../../utils/parserDebug.js';

const LIGHT_NOUNS = '(light|lighting|glow|wash|beam|flare)';
const LIGHT_PRE = '(key|fill|rim|back|ambient|practical|neon|torch|lantern|sunset|moonlit)';
const CAMERA_NOUNS = '(shot|move|movement|push|pull|sweep|tilt|pan|zoom|track|tracking|crane)';
const CAMERA_VERBS = '(dolly|truck|push|pull|pan|tilt|crane|track|tracking|zoom|sweep|follow|glide)';
const STYLE_NOUNS = '(palette|aesthetic|treatment|look|grade|tone|style|composition)';
const ENV_NOUNS = '(street|alley|rooftop|forest|desert|market|warehouse|bridge|shore|coast|temple|cathedral|plaza|diner|corridor|hallway|arcade|garden|courtyard|interior|exterior)';
const TECH_UNITS = '(mm|fps|k|°?k|kelvin|iso|bitrate|hz|khz|mhz|ms|sec|secs|seconds|s|frames|megapixels?)';

const withinRanges = (start, end, ranges) =>
  ranges.some(range => start >= range.start && end <= range.end);

const extractMatches = ({ doc, pattern, category, ranges, canonical, metadata = {} }) => {
  const matches = doc.match(pattern).out('offsets');
  const spans = [];

  matches.forEach((match) => {
    const offsetInfo = match?.offset || { start: 0, length: 0 };
    const start = typeof offsetInfo === 'number' ? offsetInfo : offsetInfo.start ?? 0;
    const length = typeof match.length === 'number'
      ? match.length
      : offsetInfo.length ?? 0;
    const end = start + length;
    if (!withinRanges(start, end, ranges)) return;
    const span = createSpan({
      canonical,
      start,
      end,
      category,
      source: 'NLP',
      metadata: {
        matcher: 'nlp',
        pattern,
        ...metadata,
      },
    });
    logSpanLifecycle({ stage: 'nlp_match', span, extra: { pattern } });
    spans.push(span);
  });

  return spans;
};

export const extractNLPSpans = ({ canonical, ranges }) => {
  if (!ranges?.length) return [];

  const doc = nlp(canonical.normalized);
  const spans = [
    ...extractMatches({
      doc,
      pattern: `(#Adjective|${LIGHT_PRE}){0,3} ${LIGHT_NOUNS}`,
      category: 'lighting',
      ranges,
      canonical,
    }),
    ...extractMatches({
      doc,
      pattern: `(${CAMERA_VERBS}|#Adjective){0,2} ${CAMERA_NOUNS}`,
      category: 'camera',
      ranges,
      canonical,
    }),
    ...extractMatches({
      doc,
      pattern: `#Value ${TECH_UNITS}`,
      category: 'technical',
      ranges,
      canonical,
      metadata: { matcher: 'nlp_value_unit' },
    }),
    ...extractMatches({
      doc,
      pattern: `#Adjective{1,2} ${STYLE_NOUNS}`,
      category: 'style',
      ranges,
      canonical,
    }),
    ...extractMatches({
      doc,
      pattern: `#Adjective{0,2} ${ENV_NOUNS}`,
      category: 'environment',
      ranges,
      canonical,
    }),
  ];

  parserDebugLog('nlp:summary', {
    count: spans.length,
  });

  return spans;
};
