import { logger } from '@infrastructure/Logger.js';
import { cacheService } from '../cache/CacheService.js';
import { StructuredOutputEnforcer } from '@utils/StructuredOutputEnforcer.js';
import { getCategoryDefinitions } from './CategoryDefinitionAggregator.js';
import type { CategoryDefinition, CategorizedSpan, LLMParseResult } from './types.js';

interface AIService {
  // Minimal interface - actual implementation may vary
  [key: string]: unknown;
}

const CACHE_NAMESPACE = 'video-llm-parse';
const CACHE_TYPE = 'video-llm-parse';
const CONTEXT_WINDOW = 60;
const MODEL_TEMPERATURE = 0.2;
const MAX_TOKENS = 1024;
const PARSER_VERSION = 'llm-v1';

const toDeterministicJSON = (value: unknown): string =>
  JSON.stringify(value, (key, val) => (val === undefined ? null : val), 2);

const normalizePhrase = (phrase: string | null | undefined): string =>
  typeof phrase === 'string' ? phrase.trim() : '';

interface SpanCandidate {
  start: number;
  end: number;
}

const overlapExists = (candidate: SpanCandidate, used: SpanCandidate[] = []): boolean =>
  used.some(
    (span) => !(candidate.end <= span.start || candidate.start >= span.end)
  );

const findPhraseLocation = (text: string, phrase: string, startIndex: number = 0): number => {
  if (!phrase) return -1;

  // Try exact match first
  const exactIndex = text.indexOf(phrase, startIndex);
  if (exactIndex !== -1) {
    return exactIndex;
  }

  // Fallback to case-insensitive search
  const lowerText = text.toLowerCase();
  const lowerPhrase = phrase.toLowerCase();
  return lowerText.indexOf(lowerPhrase, startIndex);
};

interface BuildSpanParams {
  category: string;
  phrase: string;
  start: number;
  end: number;
  text: string;
}

const buildSpan = ({ category, phrase, start, end, text }: BuildSpanParams): CategorizedSpan => {
  const actualPhrase = text.slice(start, end);
  const leftCtx = text.slice(Math.max(0, start - CONTEXT_WINDOW), start);
  const rightCtx = text.slice(end, Math.min(text.length, end + CONTEXT_WINDOW));

  return {
    id: `llm_${category}_${start}_${end}`,
    category,
    phrase: actualPhrase,
    start,
    end,
    leftContext: leftCtx,
    rightContext: rightCtx,
    source: 'llm',
    version: PARSER_VERSION,
  };
};

const computeSpans = (
  text: string,
  tags: Array<{ key: string; phrases: string[] }>,
  categories: CategoryDefinition[]
): CategorizedSpan[] => {
  if (!Array.isArray(tags) || tags.length === 0) {
    return [];
  }

  const validCategories = new Set(categories.map((c) => c.key));
  const used: SpanCandidate[] = [];
  const spans: CategorizedSpan[] = [];

  tags.forEach(({ key, phrases }) => {
    if (!validCategories.has(key) || !Array.isArray(phrases)) return;

    phrases.forEach((rawPhrase) => {
      const phrase = normalizePhrase(rawPhrase);
      if (!phrase || phrase.length < 2) return;

      let searchIndex = 0;
      while (searchIndex < text.length) {
        const location = findPhraseLocation(text, phrase, searchIndex);
        if (location === -1) break;

        const candidate: SpanCandidate = {
          start: location,
          end: location + phrase.length,
        };

        if (!overlapExists(candidate, used)) {
          used.push(candidate);
          spans.push(buildSpan({
            category: key,
            phrase,
            start: candidate.start,
            end: candidate.end,
            text,
          }));
          break;
        }

        searchIndex = location + phrase.length;
      }
    });
  });

  return spans.sort((a, b) => a.start - b.start);
};

export class TextCategorizerService {
  private readonly ai: AIService;
  private readonly cacheTTL: number;
  private readonly log = logger.child({ service: 'TextCategorizerService' });

  constructor(aiService: AIService) {
    this.ai = aiService;
    this.cacheTTL = cacheService.getConfig('creative')?.ttl ?? 3600;
    
    this.log.debug('TextCategorizerService initialized', {
      operation: 'constructor',
      cacheTTL: this.cacheTTL,
    });
  }

  async parseText({ text }: { text: string | null | undefined }): Promise<CategorizedSpan[]> {
    const operation = 'parseText';
    const startTime = performance.now();
    
    const normalizedText = typeof text === 'string' ? text.normalize('NFC') : '';
    if (!normalizedText.trim()) {
      this.log.debug(`${operation}: Empty input`, {
        operation,
        textType: typeof text,
      });
      return [];
    }

    this.log.debug(`Starting ${operation}`, {
      operation,
      textLength: normalizedText.length,
    });

    const categories = await getCategoryDefinitions();
    if (!Array.isArray(categories) || categories.length === 0) {
      this.log.warn(`${operation}: No categories available`, {
        operation,
        duration: Math.round(performance.now() - startTime),
      });
      return [];
    }

    const cacheKey = cacheService.generateKey(CACHE_NAMESPACE, {
      text: normalizedText,
      categories: categories.map((c) => c.key).sort(),
      version: PARSER_VERSION,
    });

    const cached = await cacheService.get(cacheKey, CACHE_TYPE) as CategorizedSpan[] | null;
    if (cached) {
      const duration = Math.round(performance.now() - startTime);
      this.log.debug(`${operation}: Cache hit`, {
        operation,
        duration,
        cacheKey,
        spanCount: cached.length,
      });
      return cached;
    }

    const promptPayload = {
      instructions: [
        'You are a semantic tagger for video prompts.',
        'Given TEXT and CATEGORY_DEFINITIONS, list exact phrases from TEXT that belong to each category.',
      ],
      rules: [
        'Use phrases verbatim from TEXT (no paraphrasing).',
        'If unsure about a category assignment, omit the phrase.',
        'Return empty arrays for categories with no matches.',
        'Do not fabricate indices or metadata; only group phrases by category.',
      ],
      text: normalizedText,
      category_definitions: categories.map((c) => ({
        key: c.key,
        label: c.label,
        description: c.description,
        examples: c.examples,
      })),
      output_schema: {
        type: 'object',
        properties: {
          tags: {
            type: 'array',
            description: 'Detected category matches',
            items: {
              type: 'object',
              required: ['key', 'phrases'],
              properties: {
                key: { type: 'string', description: 'Category key from CATEGORY_DEFINITIONS' },
                phrases: {
                  type: 'array',
                  description: 'Distinct verbatim phrases from TEXT',
                  items: { type: 'string' },
                },
              },
            },
          },
        },
        required: ['tags'],
      },
      required_response: {
        tags: [
          {
            key: 'category-key-from-input',
            phrases: ['exact phrase from text'],
          },
        ],
      },
      reminder: 'Respond with valid JSON only. No markdown code fences.',
    };

    const systemPrompt = `You are part of a structured parsing pipeline. Analyse the provided TEXT and return a JSON object with semantic tags.

${toDeterministicJSON(promptPayload)}`;

    const schema = {
      type: 'object',
      required: ['tags'],
      properties: {
        tags: {
          type: 'array',
          items: {
            type: 'object',
            required: ['key', 'phrases'],
            properties: {
              key: { type: 'string' },
              phrases: {
                type: 'array',
                items: { type: 'string' },
              },
            },
          },
        },
      },
    };

    this.log.debug(`${operation}: Calling LLM for categorization`, {
      operation,
      textLength: normalizedText.length,
      categoryCount: categories.length,
      temperature: MODEL_TEMPERATURE,
      maxTokens: MAX_TOKENS,
    });

    let llmResult: LLMParseResult;
    const llmStartTime = performance.now();
    try {
      llmResult = await StructuredOutputEnforcer.enforceJSON(
        this.ai,
        systemPrompt,
        {
          schema,
          maxTokens: MAX_TOKENS,
          temperature: MODEL_TEMPERATURE,
          maxRetries: 2,
          operation: 'text_categorization', // Route through aiService
        }
      ) as LLMParseResult;
      
      const llmDuration = Math.round(performance.now() - llmStartTime);
      this.log.debug(`${operation}: LLM call completed`, {
        operation,
        llmDuration,
        tagCount: llmResult.tags?.length ?? 0,
      });
    } catch (error) {
      const duration = Math.round(performance.now() - startTime);
      const llmDuration = Math.round(performance.now() - llmStartTime);
      this.log.error(`${operation}: LLM parsing failed`, error as Error, {
        operation,
        duration,
        llmDuration,
        textLength: normalizedText.length,
        categoryCount: categories.length,
      });
      throw error;
    }

    const spans = computeSpans(normalizedText, llmResult.tags ?? [], categories);

    await cacheService.set(cacheKey, spans, { ttl: this.cacheTTL });
    
    const duration = Math.round(performance.now() - startTime);
    this.log.info(`${operation} completed`, {
      operation,
      duration,
      spanCount: spans.length,
      textLength: normalizedText.length,
      categoryCount: categories.length,
      cached: false,
    });

    return spans;
  }
}

