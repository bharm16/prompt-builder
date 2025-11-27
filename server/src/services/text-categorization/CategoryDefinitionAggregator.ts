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

import { logger } from '@infrastructure/Logger.js';
import { CATEGORY_CONSTRAINTS } from '../enhancement/config/CategoryConstraints.js';
import type { CategoryDefinition } from './types.js';

interface PromptContextModule {
  PromptContext?: new () => {
    elements?: Record<string, unknown>;
  };
  getCategoryColor?: (key: string) => string | null;
}

interface CategoryValidatorsModule {
  CATEGORY_CAPS?: Record<string, unknown>;
}

let PromptContextModule: PromptContextModule | null = null;
let categoryValidatorsModule: CategoryValidatorsModule | null = null;

/**
 * Lazily load shared modules that also power the client pipeline.
 * We wrap these in try/catch so server boot won't fail if paths change.
 */
async function loadSharedModules(): Promise<void> {
  if (!PromptContextModule) {
    try {
      PromptContextModule = await import('../../../client/src/utils/PromptContext.js') as PromptContextModule;
    } catch (error) {
      const err = error as Error;
      logger.warn('[CategoryDefinitionAggregator] Failed to load PromptContext', { error: err.message });
      PromptContextModule = { PromptContext: undefined };
    }
  }

  if (!categoryValidatorsModule) {
    try {
      categoryValidatorsModule = await import('../../../client/src/utils/categoryValidators.js') as CategoryValidatorsModule;
    } catch (error) {
      const err = error as Error;
      logger.warn('[CategoryDefinitionAggregator] Failed to load categoryValidators', { error: err.message });
      categoryValidatorsModule = { CATEGORY_CAPS: {} };
    }
  }
}

const cachedDefinitions: {
  value: CategoryDefinition[] | null;
  version: number;
} = {
  value: null,
  version: 0,
};

const MAX_EXAMPLES_PER_CATEGORY = 8;

const DEFAULT_DESCRIPTION = '';

const formatLabel = (key: string = ''): string =>
  key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const mergeExamples = (existing: string[] = [], incoming: string[] = []): string[] => {
  const deduped = new Set([...existing, ...incoming].filter(Boolean));
  return Array.from(deduped).slice(0, MAX_EXAMPLES_PER_CATEGORY);
};

interface PartialDefinition {
  label?: string;
  description?: string;
  examples?: string[];
  color?: string;
}

const mergeDefinition = (
  accumulator: Map<string, CategoryDefinition>,
  key: string | null | undefined,
  partial: PartialDefinition = {}
): void => {
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
    ...(partial.color && { color: partial.color }),
  });
};

const extractFromPromptContext = (
  definitions: Map<string, CategoryDefinition>,
  PromptContext: PromptContextModule['PromptContext']
): void => {
  if (!PromptContext) return;

  try {
    const context = new PromptContext();
    const elementKeys = Object.keys(context.elements || {});
    elementKeys.forEach((key) => {
      mergeDefinition(definitions, key);
    });

    if (typeof (PromptContextModule as PromptContextModule & { getCategoryColor?: (key: string) => string | null }).getCategoryColor === 'function') {
      const getCategoryColor = (PromptContextModule as PromptContextModule & { getCategoryColor: (key: string) => string | null }).getCategoryColor;
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
        const color = getCategoryColor(key);
        if (color) {
          mergeDefinition(definitions, key, { color });
        }
      });
    }
  } catch (error) {
    const err = error as Error;
    logger.warn('[CategoryDefinitionAggregator] Failed to extract PromptContext categories', {
      error: err.message,
    });
  }
};

const extractFromValidators = (
  definitions: Map<string, CategoryDefinition>,
  CATEGORY_CAPS: Record<string, unknown> | undefined
): void => {
  if (!CATEGORY_CAPS || typeof CATEGORY_CAPS !== 'object') return;
  Object.keys(CATEGORY_CAPS).forEach((key) => {
    mergeDefinition(definitions, key);
  });
};

interface ConstraintValue {
  instruction?: string;
  fallbacks?: Array<{ text?: string }>;
  [key: string]: unknown;
}

const extractFromConstraints = (
  definitions: Map<string, CategoryDefinition>,
  constraints: Record<string, unknown>
): void => {
  if (!constraints || typeof constraints !== 'object') return;

  Object.entries(constraints).forEach(([categoryKey, value]) => {
    if (!value) return;

    // If constraint itself has instruction/fallbacks, use them directly.
    if (typeof value === 'object' && !Array.isArray(value)) {
      const constraintValue = value as ConstraintValue;
      if (typeof constraintValue.instruction === 'string') {
        mergeDefinition(definitions, categoryKey, {
          description: constraintValue.instruction,
        });
      }

      if (Array.isArray(constraintValue.fallbacks)) {
        mergeDefinition(definitions, categoryKey, {
          examples: constraintValue.fallbacks.map((item) => item?.text).filter((text): text is string => Boolean(text)),
        });
      }

      // Some entries (e.g., technical) contain sub-definitions.
      Object.values(constraintValue).forEach((maybeNested) => {
        if (
          maybeNested &&
          typeof maybeNested === 'object' &&
          !Array.isArray(maybeNested)
        ) {
          const nested = maybeNested as ConstraintValue;
          const nestedInstruction =
            typeof nested.instruction === 'string' ? nested.instruction : null;
          const nestedExamples = Array.isArray(nested.fallbacks)
            ? nested.fallbacks.map((item) => item?.text).filter((text): text is string => Boolean(text))
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
 */
export async function getCategoryDefinitions(): Promise<CategoryDefinition[]> {
  if (cachedDefinitions.value) {
    return cachedDefinitions.value;
  }

  await loadSharedModules();

  const definitions = new Map<string, CategoryDefinition>();

  // Prompt context (user-provided categories, UI colors)
  extractFromPromptContext(definitions, PromptContextModule?.PromptContext);

  // Validator caps (pipeline categories)
  extractFromValidators(definitions, categoryValidatorsModule?.CATEGORY_CAPS);

  // Server-side constraints (suggestion guidance)
  extractFromConstraints(definitions, CATEGORY_CONSTRAINTS);

  // Remove any entries that still have empty labels after extraction
  const finalList: CategoryDefinition[] = Array.from(definitions.values()).map((entry) => ({
    key: entry.key,
    label: entry.label || formatLabel(entry.key),
    description: entry.description,
    examples: entry.examples,
    ...(entry.color && { color: entry.color }),
  }));

  finalList.sort((a, b) => a.label.localeCompare(b.label));

  cachedDefinitions.value = finalList;
  cachedDefinitions.version += 1;

  return finalList;
}

