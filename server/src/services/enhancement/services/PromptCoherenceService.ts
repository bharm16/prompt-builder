import { logger } from '@infrastructure/Logger';
import { StructuredOutputEnforcer } from '@utils/StructuredOutputEnforcer';
import type { StructuredOutputSchema } from '@utils/structured-output/types';
import { TemperatureOptimizer } from '@utils/TemperatureOptimizer';
import { getParentCategory } from '@shared/taxonomy';
import type { AIService } from '@services/prompt-optimization/types';

export interface CoherenceSpan {
  id?: string;
  category?: string;
  text?: string;
  quote?: string;
  start?: number;
  end?: number;
  confidence?: number;
  source?: 'labeled' | 'context';
}

export interface AppliedChange {
  spanId?: string;
  category?: string;
  oldText?: string;
  newText?: string;
}

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
  title: string;
  rationale: string;
  edits: CoherenceEdit[];
  confidence?: number;
}

export interface CoherenceFinding {
  severity?: 'low' | 'medium' | 'high' | 'suggestion';
  message: string;
  reasoning: string;
  involvedSpanIds?: string[];
  recommendations: CoherenceRecommendation[];
}

export interface CoherenceResult {
  conflicts: CoherenceFinding[];
  harmonizations: CoherenceFinding[];
}

export interface CoherenceCheckParams {
  beforePrompt: string;
  afterPrompt: string;
  appliedChange?: AppliedChange;
  spans?: CoherenceSpan[];
}

const log = logger.child({ service: 'PromptCoherenceService' });

const TECHNICAL_PATTERNS: Array<{ id: string; pattern: RegExp }> = [
  {
    id: 'camera',
    pattern:
      /\b(dolly|track(ing)?|pan|tilt|crane|zoom|handheld|static|lens|mm|wide shot|close[-\s]?up|over[-\s]?the[-\s]?shoulder|angle|framing|depth of field|bokeh)\b/gi,
  },
  {
    id: 'lighting',
    pattern:
      /\b(lighting|shadow|glow|illuminat\w*|backlight|rim light|key light|fill light|high[-\s]?key|low[-\s]?key|sunlight|moonlight)\b/gi,
  },
  {
    id: 'technical',
    pattern:
      /\b(\d+fps|frame rate|aspect ratio|\d+:\d+|4k|8k|resolution|duration|mm film|film format|iso|shutter|aperture|f\/\d+(?:\.\d+)?)\b/gi,
  },
];

const CONTRADICTION_SETS = [
  {
    id: 'day-night',
    severity: 'medium' as const,
    a: {
      label: 'daylight',
      terms: ['day', 'daytime', 'sunny', 'sunlight', 'midday', 'noon', 'bright sun'],
      replaceWith: 'daytime',
      strategy: 'replace' as const,
    },
    b: {
      label: 'night',
      terms: ['night', 'midnight', 'moonlight', 'dark', 'starlit', 'stars'],
      replaceWith: 'night',
      strategy: 'replace' as const,
    },
  },
  {
    id: 'indoor-outdoor',
    severity: 'medium' as const,
    a: {
      label: 'indoors',
      terms: ['indoor', 'indoors', 'interior', 'inside', 'room', 'studio'],
      replaceWith: 'indoors',
      strategy: 'replace' as const,
    },
    b: {
      label: 'outdoors',
      terms: ['outdoor', 'outdoors', 'exterior', 'outside', 'street', 'forest', 'field'],
      replaceWith: 'outdoors',
      strategy: 'replace' as const,
    },
  },
  {
    id: 'underwater-fire',
    severity: 'high' as const,
    a: {
      label: 'underwater',
      terms: ['underwater', 'submerged', 'beneath the sea', 'ocean floor'],
      replaceWith: '',
      strategy: 'remove' as const,
    },
    b: {
      label: 'fire',
      terms: ['fire', 'flames', 'campfire', 'bonfire', 'burning'],
      replaceWith: '',
      strategy: 'remove' as const,
    },
  },
  {
    id: 'desert-arctic',
    severity: 'medium' as const,
    a: {
      label: 'desert',
      terms: ['desert', 'sand dunes', 'arid', 'sandy'],
      replaceWith: '',
      strategy: 'remove' as const,
    },
    b: {
      label: 'arctic',
      terms: ['arctic', 'snow', 'blizzard', 'ice', 'glacier', 'frozen'],
      replaceWith: '',
      strategy: 'remove' as const,
    },
  },
];

const HIGH_IMPACT_PARENTS = new Set(['environment', 'lighting', 'style']);
const HIGH_IMPACT_KEYWORDS = ['time', 'mood', 'era', 'emotion'];
const MAX_CONTEXT_SPANS = 12;
const MIN_CONTEXT_CHARS = 3;
const SENTENCE_REGEX = /[^.!?\n]+[.!?]+|[^.!?\n]+$/g;
const WORD_CHAR_REGEX = /[A-Za-z0-9]/;

const normalizeText = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokenize = (text: string): string[] =>
  normalizeText(text)
    .split(' ')
    .filter(Boolean);

const jaccardSimilarity = (aTokens: string[], bTokens: string[]): number => {
  const aSet = new Set(aTokens);
  const bSet = new Set(bTokens);
  if (aSet.size === 0 && bSet.size === 0) return 1;
  let intersection = 0;
  for (const token of aSet) {
    if (bSet.has(token)) intersection += 1;
  }
  const union = new Set([...aSet, ...bSet]).size;
  return union === 0 ? 0 : intersection / union;
};

const isTechnicalCategory = (category?: string): boolean => {
  if (!category) return false;
  const normalized = category.toLowerCase();
  return (
    normalized.startsWith('camera') ||
    normalized.startsWith('shot') ||
    normalized.startsWith('lighting') ||
    normalized.startsWith('technical')
  );
};

const collapseDuplicateWords = (text: string): string =>
  text.replace(/(\b\w+\b)(\s*,?\s*\1\b)+/gi, '$1');

const cleanText = (text: string): string =>
  text
    .replace(/\s+/g, ' ')
    .replace(/^[,\s]+|[,\s]+$/g, '')
    .trim();

const replaceTerms = (text: string, terms: string[], replacement: string): string => {
  if (!terms.length) return text;
  let result = text;
  for (const term of terms) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`\\b${escaped}\\b`, 'gi');
    result = result.replace(pattern, replacement);
  }
  return cleanText(result);
};

const removePatternMatches = (text: string, pattern: RegExp): string =>
  cleanText(text.replace(pattern, ' '));

const summarizeSpan = (span: CoherenceSpan): string =>
  (span.quote || span.text || '').trim();

const sanitizeSpans = (spans: CoherenceSpan[] | undefined): CoherenceSpan[] => {
  if (!Array.isArray(spans)) return [];
  return spans
    .map((span) => ({
      ...span,
      text: span.text ?? span.quote,
      quote: span.quote ?? span.text,
    }))
    .filter((span) => Boolean(summarizeSpan(span)));
};

interface SpanRange {
  start: number;
  end: number;
}

const buildCoverageRanges = (prompt: string, spans: CoherenceSpan[]): SpanRange[] => {
  const ranges = spans
    .map((span) => {
      const start = Number.isFinite(span.start) ? Number(span.start) : null;
      const end = Number.isFinite(span.end) ? Number(span.end) : null;
      if (start === null || end === null || end <= start) {
        return null;
      }
      const safeStart = Math.max(0, Math.min(start, prompt.length));
      const safeEnd = Math.max(safeStart, Math.min(end, prompt.length));
      if (safeEnd <= safeStart) {
        return null;
      }
      return { start: safeStart, end: safeEnd };
    })
    .filter((range): range is SpanRange => Boolean(range))
    .sort((a, b) => a.start - b.start);

  const merged: SpanRange[] = [];
  ranges.forEach((range) => {
    const last = merged[merged.length - 1];
    if (!last || range.start > last.end) {
      merged.push({ ...range });
      return;
    }
    if (range.end > last.end) {
      last.end = range.end;
    }
  });

  return merged;
};

const splitPromptSentences = (
  prompt: string
): Array<{ start: number; end: number; text: string }> => {
  const sentences: Array<{ start: number; end: number; text: string }> = [];
  SENTENCE_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = SENTENCE_REGEX.exec(prompt)) !== null) {
    const raw = match[0];
    if (!raw) {
      continue;
    }
    const leadingWhitespace = raw.match(/^\s*/)?.[0].length ?? 0;
    const trailingWhitespace = raw.match(/\s*$/)?.[0].length ?? 0;
    const start = match.index + leadingWhitespace;
    const end = match.index + raw.length - trailingWhitespace;
    if (end <= start) {
      continue;
    }
    const text = prompt.slice(start, end);
    if (!text) {
      continue;
    }
    sentences.push({ start, end, text });
  }

  return sentences;
};

const sentenceHasUncoveredText = (
  prompt: string,
  sentenceStart: number,
  sentenceEnd: number,
  coverage: SpanRange[]
): boolean => {
  if (sentenceEnd <= sentenceStart) return false;

  let cursor = sentenceStart;
  for (const range of coverage) {
    if (range.end <= sentenceStart) {
      continue;
    }
    if (range.start >= sentenceEnd) {
      break;
    }
    if (range.start > cursor) {
      const gapText = prompt.slice(cursor, Math.min(range.start, sentenceEnd));
      if (WORD_CHAR_REGEX.test(gapText)) {
        return true;
      }
    }
    cursor = Math.max(cursor, range.end);
    if (cursor >= sentenceEnd) {
      return false;
    }
  }

  if (cursor < sentenceEnd) {
    const gapText = prompt.slice(cursor, sentenceEnd);
    if (WORD_CHAR_REGEX.test(gapText)) {
      return true;
    }
  }

  return false;
};

const buildContextSpans = (prompt: string, spans: CoherenceSpan[]): CoherenceSpan[] => {
  if (!prompt) return [];
  const sentences = splitPromptSentences(prompt);
  if (sentences.length === 0) return [];

  const coverage = buildCoverageRanges(prompt, spans);
  const seen = new Set(
    spans
      .map((span) => normalizeText(summarizeSpan(span)))
      .filter(Boolean)
  );
  const contextSpans: CoherenceSpan[] = [];

  for (const sentence of sentences) {
    if (contextSpans.length >= MAX_CONTEXT_SPANS) {
      break;
    }
    if (sentence.text.length < MIN_CONTEXT_CHARS) {
      continue;
    }
    if (!sentenceHasUncoveredText(prompt, sentence.start, sentence.end, coverage)) {
      continue;
    }
    const normalized = normalizeText(sentence.text);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    contextSpans.push({
      text: sentence.text,
      quote: sentence.text,
      start: sentence.start,
      end: sentence.end,
      source: 'context',
    });
    seen.add(normalized);
  }

  return contextSpans;
};

const buildAppliedSpan = (
  spans: CoherenceSpan[],
  appliedChange?: AppliedChange
): CoherenceSpan | null => {
  if (!appliedChange) return null;
  if (appliedChange.spanId) {
    const match = spans.find((span) => span.id === appliedChange.spanId);
    if (match) return match;
  }

  const normalizedNew = normalizeText(appliedChange.newText ?? '');
  const normalizedOld = normalizeText(appliedChange.oldText ?? '');
  if (normalizedNew) {
    const match = spans.find(
      (span) => normalizeText(summarizeSpan(span)) === normalizedNew
    );
    if (match) return match;
  }
  if (normalizedOld) {
    const match = spans.find(
      (span) => normalizeText(summarizeSpan(span)) === normalizedOld
    );
    if (match) return match;
  }
  return null;
};

const isHighImpactCategory = (category?: string): boolean => {
  if (!category) return false;
  const parent = getParentCategory(category) || category;
  if (HIGH_IMPACT_PARENTS.has(parent)) {
    return true;
  }
  const normalized = category.toLowerCase();
  return HIGH_IMPACT_KEYWORDS.some((keyword) => normalized.includes(keyword));
};

export class PromptCoherenceService {
  constructor(private readonly ai: AIService) {}

  async checkCoherence({
    beforePrompt,
    afterPrompt,
    appliedChange,
    spans,
  }: CoherenceCheckParams): Promise<CoherenceResult> {
    const operation = 'prompt-coherence-check';
    const cleanSpans = sanitizeSpans(spans);
    const contextSpans = buildContextSpans(afterPrompt, cleanSpans);
    const spansForCheck = [...cleanSpans, ...contextSpans];

    try {
      const llmResult = await this.runLlmCheck({
        beforePrompt,
        afterPrompt,
        appliedChange,
        spans: spansForCheck,
      });

      return llmResult;
    } catch (error) {
      log.warn('LLM coherence check failed; returning empty results', {
        operation,
        error: error instanceof Error ? error.message : String(error),
      });
      return { conflicts: [], harmonizations: [] };
    }
  }

  private isLargeChange(appliedChange?: AppliedChange): boolean {
    if (!appliedChange?.oldText || !appliedChange.newText) {
      return false;
    }
    const oldTokens = tokenize(appliedChange.oldText);
    const newTokens = tokenize(appliedChange.newText);
    const similarity = jaccardSimilarity(oldTokens, newTokens);
    const lengthDelta = Math.abs(appliedChange.newText.length - appliedChange.oldText.length);
    const lengthRatio = appliedChange.oldText.length
      ? lengthDelta / appliedChange.oldText.length
      : 0;
    return similarity < 0.4 || lengthRatio > 0.5;
  }

  private runDeterministicChecks(
    spans: CoherenceSpan[],
    appliedSpan: CoherenceSpan | null
  ): CoherenceResult {
    const conflicts: CoherenceFinding[] = [];
    const harmonizations: CoherenceFinding[] = [];

    const appliedText = appliedSpan ? summarizeSpan(appliedSpan) : '';
    const appliedLower = appliedText.toLowerCase();

    spans.forEach((span) => {
      const spanText = summarizeSpan(span);
      if (!spanText) return;

      const isContextSpan = span.source === 'context';

      if (!isContextSpan && !isTechnicalCategory(span.category)) {
        const matchedTerms = new Set<string>();
        let cleaned = spanText;

        TECHNICAL_PATTERNS.forEach(({ pattern }) => {
          const matches = spanText.match(pattern);
          if (matches) {
            matches.forEach((match) => matchedTerms.add(match));
            cleaned = removePatternMatches(cleaned, pattern);
          }
        });

        if (matchedTerms.size > 0 && cleaned !== spanText) {
          conflicts.push({
            severity: 'low',
            message: 'Technical terms appear in a non-technical span.',
            reasoning: `Found technical terms (${Array.from(matchedTerms).join(', ')}) in a ${span.category || 'misc'} span.`,
            involvedSpanIds: span.id ? [span.id] : undefined,
            recommendations: [
              {
                title: 'Remove technical terms from this span',
                rationale: 'Keeps camera/lighting specs grouped with their proper categories.',
                edits: [
                  {
                    type: 'replaceSpanText',
                    ...(span.id ? { spanId: span.id } : { anchorQuote: spanText }),
                    replacementText: cleaned,
                  },
                ],
                confidence: 0.72,
              },
            ],
          });
        }
      }

      if (!isContextSpan) {
        const deduped = collapseDuplicateWords(spanText);
        if (deduped !== spanText) {
          harmonizations.push({
            message: 'Redundant phrasing detected.',
            reasoning: 'This span repeats descriptors; tightening improves readability.',
            involvedSpanIds: span.id ? [span.id] : undefined,
            recommendations: [
              {
                title: 'Collapse repeated words',
                rationale: 'Removes duplicate descriptors without changing meaning.',
                edits: [
                  {
                    type: 'replaceSpanText',
                    ...(span.id ? { spanId: span.id } : { anchorQuote: spanText }),
                    replacementText: deduped,
                  },
                ],
                confidence: 0.64,
              },
            ],
          });
        }
      }
    });

    if (appliedSpan && appliedLower) {
      spans.forEach((span) => {
        if (span === appliedSpan) return;
        const spanText = summarizeSpan(span);
        if (!spanText) return;

        CONTRADICTION_SETS.forEach((pair) => {
          const appliedMatchesA = pair.a.terms.some((term) => appliedLower.includes(term));
          const appliedMatchesB = pair.b.terms.some((term) => appliedLower.includes(term));

          if (!appliedMatchesA && !appliedMatchesB) {
            return;
          }

          const spanLower = spanText.toLowerCase();
          const conflictSide = appliedMatchesA ? pair.b : pair.a;
          const appliedSide = appliedMatchesA ? pair.a : pair.b;
          const conflictingTerms = conflictSide.terms.filter((term) => spanLower.includes(term));

          if (!conflictingTerms.length) {
            return;
          }

          const replacementText =
            conflictSide.strategy === 'replace'
              ? replaceTerms(spanText, conflictingTerms, appliedSide.replaceWith)
              : replaceTerms(spanText, conflictingTerms, '');

          conflicts.push({
            severity: pair.severity,
            message: `Potential ${pair.id.replace('-', ' ')} conflict.`,
            reasoning: `Applied change suggests ${appliedSide.label}, but another span references ${conflictSide.label}.`,
            involvedSpanIds: [appliedSpan.id, span.id].filter(Boolean) as string[],
            recommendations: [
              {
                title: `Align ${conflictSide.label} reference to ${appliedSide.label}`,
                rationale: 'Keeps the scene consistent with the newly applied change.',
                edits: [
                  replacementText && replacementText !== spanText
                    ? {
                        type: 'replaceSpanText',
                        ...(span.id ? { spanId: span.id } : { anchorQuote: spanText }),
                        replacementText,
                      }
                    : {
                        type: 'removeSpan',
                        ...(span.id ? { spanId: span.id } : { anchorQuote: spanText }),
                      },
                ],
                confidence: 0.66,
              },
            ],
          });
        });
      });
    }

    const seenDuplicates = new Set<string>();
    spans.forEach((span) => {
      if (span.source === 'context') {
        return;
      }
      const spanText = summarizeSpan(span);
      if (!spanText) return;
      const normalized = normalizeText(spanText);
      if (!normalized) return;
      if (seenDuplicates.has(normalized)) {
        harmonizations.push({
          message: 'Duplicate span detected.',
          reasoning: 'This descriptor already appears elsewhere in the prompt.',
          involvedSpanIds: span.id ? [span.id] : undefined,
          recommendations: [
            {
              title: 'Remove duplicate span',
              rationale: 'Avoids repetition and keeps the prompt concise.',
              edits: [
                {
                  type: 'removeSpan',
                  ...(span.id ? { spanId: span.id } : { anchorQuote: spanText }),
                },
              ],
              confidence: 0.6,
            },
          ],
        });
      } else {
        seenDuplicates.add(normalized);
      }
    });

    return { conflicts, harmonizations };
  }

  private async runLlmCheck(params: CoherenceCheckParams & { spans: CoherenceSpan[] }): Promise<CoherenceResult> {
    const prompt = this.buildSystemPrompt(params);
    const temperature = TemperatureOptimizer.getOptimalTemperature('analysis', {
      diversity: 'low',
      precision: 'high',
    });
    const schema: StructuredOutputSchema = {
      type: 'object',
      required: ['conflicts', 'harmonizations'],
    };

    const result = (await StructuredOutputEnforcer.enforceJSON(this.ai, prompt, {
      operation: 'prompt_coherence_check',
      schema,
      isArray: false,
      maxTokens: 2048,
      maxRetries: 2,
      temperature,
    })) as CoherenceResult;

    return this.sanitizeResult(result, params.spans);
  }

  private buildSystemPrompt({
    beforePrompt,
    afterPrompt,
    appliedChange,
    spans,
  }: CoherenceCheckParams & { spans: CoherenceSpan[] }): string {
    const trimmedSpans = spans.slice(0, 60).map((span) => {
      const entry: Record<string, string> = {
        text: summarizeSpan(span).slice(0, 200),
      };
      if (span.id) {
        entry.id = span.id;
      }
      if (span.category) {
        entry.category = span.category;
      }
      if (span.source) {
        entry.source = span.source;
      }
      return entry;
    });

    return `You are a prompt coherence auditor.
Your job: After a user applies a change, check the full after prompt for contradictions or optional harmonizations.

Return JSON only with this shape:
{
  "conflicts": [
    {
      "severity": "low" | "medium" | "high",
      "message": "Short description",
      "reasoning": "Why this is a conflict",
      "involvedSpanIds": ["spanIdA", "spanIdB"],
      "recommendations": [
        {
          "title": "Fix title",
          "rationale": "Why this edit helps",
          "confidence": 0-1,
          "edits": [
            { "type": "replaceSpanText", "spanId": "spanId", "replacementText": "..." },
            { "type": "removeSpan", "spanId": "spanId" }
          ]
        }
      ]
    }
  ],
  "harmonizations": [
    {
      "message": "Optional improvement",
      "reasoning": "Why it helps",
      "involvedSpanIds": ["spanIdX"],
      "recommendations": [
        {
          "title": "Adjustment title",
          "rationale": "Why this edit helps",
          "confidence": 0-1,
          "edits": [
            { "type": "replaceSpanText", "spanId": "spanId", "replacementText": "..." }
          ]
        }
      ]
    }
  ]
}

Rules:
- Conflicts are true contradictions (e.g., day vs night, indoor vs outdoor, underwater vs fire, or mismatched subject attributes like age/gender).
- Harmonizations are optional consistency upgrades (mood, palette, era, lens language).
- Prefer edits that adjust conflicting text rather than undoing the applied change.
- Scan the full after prompt for any inconsistencies across entities, attributes, actions, environment, time, physical constraints, and references (including pronouns/possessives).
- The span list is incomplete and optional. Do NOT limit your analysis to spans.
- Use span IDs only when the conflicting text is fully contained in a provided span; never invent span IDs.
- For any text outside spans, include anchorQuote with enough surrounding words to locate the text.
- Anchor quotes must be exact substrings from the after prompt.
- If the same inconsistency appears in multiple locations, include edits for each location.
- Return empty arrays if nothing is needed.

Input data:
Before prompt: """${beforePrompt}"""
After prompt (authoritative full text): """${afterPrompt}"""
Applied change: ${JSON.stringify(appliedChange ?? {}, null, 2)}
Span hints (incomplete): ${JSON.stringify(trimmedSpans, null, 2)}`;
  }

  private sanitizeResult(result: CoherenceResult, spans: CoherenceSpan[]): CoherenceResult {
    const spanIds = new Set(spans.map((span) => span.id).filter(Boolean) as string[]);
    const normalizeFindings = (findings: CoherenceFinding[]): CoherenceFinding[] =>
      findings
        .filter((finding) => Array.isArray(finding.recommendations))
        .map((finding) => ({
          ...finding,
          involvedSpanIds: Array.isArray(finding.involvedSpanIds)
            ? finding.involvedSpanIds.filter((id) => spanIds.has(id))
            : undefined,
          recommendations: finding.recommendations
            .map((rec) => ({
              ...rec,
              edits: Array.isArray(rec.edits)
                ? rec.edits
                    .map((edit) => {
                      if (edit.spanId && !spanIds.has(edit.spanId)) {
                        if (edit.anchorQuote) {
                          const { spanId: _spanId, ...rest } = edit;
                          return rest as CoherenceEdit;
                        }
                        return null;
                      }
                      return edit;
                    })
                    .filter((edit): edit is CoherenceEdit => Boolean(edit))
                    .filter((edit) => {
                    if (edit.type === 'replaceSpanText') {
                      if (!edit.replacementText) return false;
                    }
                    return Boolean(edit.spanId || edit.anchorQuote);
                  })
                : [],
            }))
            .filter((rec) => rec.edits.length > 0),
        }))
        .filter((finding) => finding.recommendations.length > 0);

    return {
      conflicts: normalizeFindings(result.conflicts || []),
      harmonizations: normalizeFindings(result.harmonizations || []),
    };
  }
}
