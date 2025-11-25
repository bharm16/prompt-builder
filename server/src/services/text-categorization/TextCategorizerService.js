import { logger } from '../../infrastructure/Logger.ts';
import { cacheService } from '../cache/CacheService.js';
import { StructuredOutputEnforcer } from '../../utils/StructuredOutputEnforcer.js';
import { getCategoryDefinitions } from './CategoryDefinitionAggregator.js';

const CACHE_NAMESPACE = 'video-llm-parse';
const CACHE_TYPE = 'video-llm-parse';
const CONTEXT_WINDOW = 60;
const MODEL_TEMPERATURE = 0.2;
const MAX_TOKENS = 1024;
const PARSER_VERSION = 'llm-v1';

const toDeterministicJSON = (value) =>
  JSON.stringify(value, (key, val) => (val === undefined ? null : val), 2);

const normalizePhrase = (phrase) =>
  typeof phrase === 'string' ? phrase.trim() : '';

const overlapExists = (candidate, used = []) =>
  used.some(
    (span) => !(candidate.end <= span.start || candidate.start >= span.end)
  );

const findPhraseLocation = (text, phrase, startIndex = 0) => {
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

const buildSpan = ({ category, phrase, start, end, text }) => {
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

const computeSpans = (text, tags, categories) => {
  if (!Array.isArray(tags) || tags.length === 0) {
    return [];
  }

  const validCategories = new Set(categories.map((c) => c.key));
  const used = [];
  const spans = [];

  tags.forEach(({ key, phrases }) => {
    if (!validCategories.has(key) || !Array.isArray(phrases)) return;

    phrases.forEach((rawPhrase) => {
      const phrase = normalizePhrase(rawPhrase);
      if (!phrase || phrase.length < 2) return;

      let searchIndex = 0;
      while (searchIndex < text.length) {
        const location = findPhraseLocation(text, phrase, searchIndex);
        if (location === -1) break;

        const candidate = {
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
  constructor(aiService) {
    this.ai = aiService;
    this.cacheTTL = cacheService.getConfig('creative')?.ttl ?? 3600;
  }

  async parseText({ text }) {
    const normalizedText = typeof text === 'string' ? text.normalize('NFC') : '';
    if (!normalizedText.trim()) {
      return [];
    }

    const categories = await getCategoryDefinitions();
    if (!Array.isArray(categories) || categories.length === 0) {
      logger.warn('[TextCategorizerService] No categories available; returning empty spans');
      return [];
    }

    const cacheKey = cacheService.generateKey(CACHE_NAMESPACE, {
      text: normalizedText,
      categories: categories.map((c) => c.key).sort(),
      version: PARSER_VERSION,
    });

    const cached = await cacheService.get(cacheKey, CACHE_TYPE);
    if (cached) {
      logger.debug('[TextCategorizerService] Cache hit', { cacheKey });
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

    let llmResult;
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
      );
    } catch (error) {
      logger.error('[TextCategorizerService] LLM parsing failed', { error: error.message });
      throw error;
    }

    const spans = computeSpans(normalizedText, llmResult.tags ?? [], categories);

    await cacheService.set(cacheKey, spans, { ttl: this.cacheTTL });
    logger.info('[TextCategorizerService] Parsed spans', {
      spanCount: spans.length,
      textLength: normalizedText.length,
    });

    return spans;
  }
}

