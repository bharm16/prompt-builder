/**
 * Category Definition Aggregator
 * 
 * Aggregates category definitions from multiple sources for semantic text parsing:
 * 1. Client-side PromptContext (video element categories)
 * 2. Client-side categoryValidators (validation caps)
 * 3. Server-side CategoryConstraints (enhancement constraints)
 * 
 * Used by: TextCategorizerService for AI-powered semantic parsing
 * 
 * NOTE: Currently imports from client code (architectural debt).
 *       Consider moving shared definitions to /shared/ directory.
 */

import { logger } from '../../infrastructure/Logger.ts';
import { CATEGORY_CONSTRAINTS } from '../enhancement/config/CategoryConstraints.js';

let PromptContextModule = null;
let categoryValidatorsModule = null;

/**
 * Lazily load shared modules that also power the client pipeline.
 * We wrap these in try/catch so server boot won't fail if paths change.
 */
async function loadSharedModules() {
  if (!PromptContextModule) {
    try {
      PromptContextModule = await import('../../../client/src/utils/PromptContext.js');
    } catch (error) {
      logger.warn('[CategoryDefinitionAggregator] Failed to load PromptContext', { error: error.message });
      PromptContextModule = { PromptContext: null };
    }
  }

  if (!categoryValidatorsModule) {
    try {
      categoryValidatorsModule = await import('../../../client/src/utils/categoryValidators.js');
    } catch (error) {
      logger.warn('[CategoryDefinitionAggregator] Failed to load categoryValidators', { error: error.message });
      categoryValidatorsModule = { CATEGORY_CAPS: {} };
    }
  }
}

const cachedDefinitions = {
  value: null,
  version: 0,
};

const MAX_EXAMPLES_PER_CATEGORY = 8;

const DEFAULT_DESCRIPTION = '';

const formatLabel = (key = '') =>
  key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const mergeExamples = (existing = [], incoming = []) => {
  const deduped = new Set([...existing, ...incoming].filter(Boolean));
  return Array.from(deduped).slice(0, MAX_EXAMPLES_PER_CATEGORY);
};

const mergeDefinition = (accumulator, key, partial = {}) => {
  if (!key) return;
  const normalizedKey = String(key).trim();
  if (!normalizedKey) return;

  const current = accumulator.get(normalizedKey) ?? {
    key: normalizedKey,
    label: formatLabel(normalizedKey),
    description: DEFAULT_DESCRIPTION,
    examples: [],
  };

  const description =
    typeof partial.description === 'string' && partial.description.trim().length > 0
      ? partial.description.trim()
      : current.description;

  const label =
    typeof partial.label === 'string' && partial.label.trim().length > 0
      ? partial.label.trim()
      : current.label;

  const mergedExamples = mergeExamples(current.examples, partial.examples);

  accumulator.set(normalizedKey, {
    ...current,
    label,
    description,
    examples: mergedExamples,
  });
};

const extractFromPromptContext = (definitions, PromptContext) => {
  if (!PromptContext) return;

  try {
    const context = new PromptContext();
    const elementKeys = Object.keys(context.elements || {});
    elementKeys.forEach((key) => {
      mergeDefinition(definitions, key);
    });

    if (typeof PromptContext.getCategoryColor === 'function') {
      const colorAwareKeys = [
        ...elementKeys,
        'technical',
        'descriptive',
        'lighting',
        'cameraMove',
        'framing',
        'environment',
        'color',
        'depthOfField',
      ];

      colorAwareKeys.forEach((key) => {
        const color = PromptContext.getCategoryColor(key);
        if (color) {
          mergeDefinition(definitions, key, { color });
        }
      });
    }
  } catch (error) {
    logger.warn('[CategoryDefinitionAggregator] Failed to extract PromptContext categories', {
      error: error.message,
    });
  }
};

const extractFromValidators = (definitions, CATEGORY_CAPS) => {
  if (!CATEGORY_CAPS || typeof CATEGORY_CAPS !== 'object') return;
  Object.keys(CATEGORY_CAPS).forEach((key) => {
    mergeDefinition(definitions, key);
  });
};

const extractFromConstraints = (definitions, constraints) => {
  if (!constraints || typeof constraints !== 'object') return;

  Object.entries(constraints).forEach(([categoryKey, value]) => {
    if (!value) return;

    // If constraint itself has instruction/fallbacks, use them directly.
    if (typeof value === 'object' && !Array.isArray(value)) {
      if (typeof value.instruction === 'string') {
        mergeDefinition(definitions, categoryKey, {
          description: value.instruction,
        });
      }

      if (Array.isArray(value.fallbacks)) {
        mergeDefinition(definitions, categoryKey, {
          examples: value.fallbacks.map((item) => item?.text).filter(Boolean),
        });
      }

      // Some entries (e.g., technical) contain sub-definitions.
      Object.values(value).forEach((maybeNested) => {
        if (
          maybeNested &&
          typeof maybeNested === 'object' &&
          !Array.isArray(maybeNested)
        ) {
          const nestedInstruction =
            typeof maybeNested.instruction === 'string' ? maybeNested.instruction : null;
          const nestedExamples = Array.isArray(maybeNested.fallbacks)
            ? maybeNested.fallbacks.map((item) => item?.text).filter(Boolean)
            : [];

          if (nestedInstruction || nestedExamples.length > 0) {
            mergeDefinition(definitions, categoryKey, {
              description: nestedInstruction || undefined,
              examples: nestedExamples,
            });
          }
        }
      });
    }
  });
};

/**
 * Collect the authoritative set of category definitions used across the video workflow.
 * The data is gathered from shared modules (PromptContext, validators, constraints).
 *
 * @returns {Promise<Array<{key:string,label:string,description:string,examples:string[]}>>}
 */
export async function getCategoryDefinitions() {
  if (cachedDefinitions.value) {
    return cachedDefinitions.value;
  }

  await loadSharedModules();

  const definitions = new Map();

  // Prompt context (user-provided categories, UI colors)
  extractFromPromptContext(definitions, PromptContextModule?.PromptContext);

  // Validator caps (pipeline categories)
  extractFromValidators(definitions, categoryValidatorsModule?.CATEGORY_CAPS);

  // Server-side constraints (suggestion guidance)
  extractFromConstraints(definitions, CATEGORY_CONSTRAINTS);

  // Remove any entries that still have empty labels after extraction
  const finalList = Array.from(definitions.values()).map((entry) => ({
    key: entry.key,
    label: entry.label || formatLabel(entry.key),
    description: entry.description,
    examples: entry.examples,
  }));

  finalList.sort((a, b) => a.label.localeCompare(b.label));

  cachedDefinitions.value = finalList;
  cachedDefinitions.version += 1;

  return finalList;
}

