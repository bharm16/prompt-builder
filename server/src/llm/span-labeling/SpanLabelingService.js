import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { SubstringPositionCache } from './cache/SubstringPositionCache.js';
import SpanLabelingConfig from './config/SpanLabelingConfig.js';
import { sanitizePolicy, sanitizeOptions, buildTaskDescription } from './utils/policyUtils.js';
import { parseJson, buildUserPayload } from './utils/jsonUtils.js';
import { formatValidationErrors } from './utils/textUtils.js';
import { validateSchemaOrThrow } from './validation/SchemaValidator.js';
import { validateSpans } from './validation/SpanValidator.js';
import { TAXONOMY } from '#shared/taxonomy.js';
import { TextChunker, countWords } from './utils/chunkingUtils.js';
import { SemanticRouter } from './routing/SemanticRouter.js';

/**
 * Span Labeling Service - Refactored Architecture
 *
 * Orchestrates LLM-based span labeling with validation and optional repair.
 * This service is a thin orchestrator delegating to specialized modules:
 * - Config: Centralized configuration
 * - Utils: Text, JSON, and policy utilities
 * - Cache: Performance-optimized substring position caching
 * - Validation: Schema and span validation
 * - Processing: Pipeline of span transformations (dedupe, overlap, filter, truncate)
 * - Router: Context-aware few-shot example injection (PDF Design B)
 * 
 * DYNAMIC TAXONOMY GENERATION:
 * The system prompt is now generated from taxonomy.js at runtime to prevent drift.
 * Changes to the taxonomy automatically propagate to the LLM's instructions.
 * 
 * PDF DESIGN B INTEGRATION:
 * SemanticRouter analyzes input characteristics and injects targeted few-shot examples
 * to improve accuracy on technical terminology and ambiguous terms.
 */

// Load detection patterns and rules from template file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const promptTemplatePath = join(__dirname, 'templates', 'span-labeling-prompt.md');
const PROMPT_TEMPLATE = readFileSync(promptTemplatePath, 'utf-8');

/**
 * Wrap user input in XML tags for adversarial safety (PDF Section 1.6)
 * This creates a clear boundary between system instructions and user data
 */
function wrapUserInput(text) {
  return `<user_input>\n${text}\n</user_input>`;
}

/**
 * Extract the detection patterns section from the template
 * This keeps the detailed role definitions and examples from the template file
 */
function extractDetectionPatterns(template) {
  // Extract everything from "## Role Definitions" to "## Rules"
  const match = template.match(/## Role Definitions with Detection Patterns([\s\S]*?)## Critical Instructions/);
  return match ? match[1].trim() : '';
}

/**
 * Extract the rules and examples section from the template
 * This keeps the operational guidelines from the template file
 */
function extractRulesSection(template) {
  // Extract everything from "## Critical Instructions" onwards
  const match = template.match(/## Critical Instructions([\s\S]*)/);
  return match ? match[0].trim() : '';
}

/**
 * Build system prompt dynamically from taxonomy.js
 * Generates the taxonomy structure section while preserving detection patterns from template
 * 
 * PDF Design B: Optionally injects context-aware few-shot examples via SemanticRouter
 */
function buildSystemPrompt(text = '', useRouter = true) {
  // Generate taxonomy structure from shared/taxonomy.js
  const parentCategories = Object.values(TAXONOMY)
    .map(cat => `- \`${cat.id}\` - ${cat.description}`)
    .join('\n');

  const attributeSections = Object.values(TAXONOMY)
    .map(cat => {
      if (!cat.attributes || Object.keys(cat.attributes).length === 0) {
        return null;
      }
      const attrs = Object.values(cat.attributes).map(id => `\`${id}\``).join(', ');
      return `- ${cat.label}: ${attrs}`;
    })
    .filter(Boolean)
    .join('\n');

  // Load detection patterns from template
  const detectionPatterns = extractDetectionPatterns(PROMPT_TEMPLATE);
  const rulesSection = extractRulesSection(PROMPT_TEMPLATE);

  // Build complete system prompt
  let systemPrompt = `# Span Labeling System Prompt

Label spans for AI video prompt elements using our unified taxonomy system.

**IMPORTANT: Respond ONLY with valid JSON. No markdown, no explanatory text, just pure JSON.**

## Taxonomy Structure

Our taxonomy has **${Object.keys(TAXONOMY).length} parent categories**, each with specific attributes:

**PARENT CATEGORIES (use when general):**
${parentCategories}

**ATTRIBUTES (use when specific):**
${attributeSections}

${detectionPatterns}

${rulesSection}
`.trim();

  // PDF Design B: Inject context-aware few-shot examples if enabled
  if (useRouter && text) {
    const router = new SemanticRouter();
    const examples = router.formatExamplesForPrompt(text);
    if (examples) {
      systemPrompt += examples;
    }
  }

  return systemPrompt;
}

// Generate base system prompt at service initialization (without context-specific examples)
const BASE_SYSTEM_PROMPT = buildSystemPrompt('', false);

/**
 * Call LLM with system prompt and user payload using AIModelService
 * @private
 */
async function callModel({ systemPrompt, userPayload, aiService, maxTokens }) {
  const response = await aiService.execute('span_labeling', {
    systemPrompt,
    userMessage: userPayload,
    maxTokens,
    jsonMode: true, // Enforce structured output per PDF guidance
    // temperature is configured in modelConfig.js
  });
  
  // Extract text from response
  return response.content[0]?.text || '';
}

/**
 * Label spans using an LLM with validation and optional repair attempt.
 * Routes to chunked processing for large texts.
 *
 * @param {Object} params
 * @param {string} params.text - Source text to label
 * @param {number} [params.maxSpans] - Maximum spans to identify
 * @param {number} [params.minConfidence] - Minimum confidence threshold
 * @param {Object} [params.policy] - Validation policy
 * @param {string} [params.templateVersion] - Template version
 * @param {boolean} [params.enableRepair] - Enable repair attempt on validation failure (default: false)
 * @param {Object} aiService - AI Model Service instance for LLM calls
 * @returns {Promise<{spans: Array, meta: {version: string, notes: string}}>}
 */
export async function labelSpans(params, aiService) {
  if (!params || typeof params.text !== 'string' || !params.text.trim()) {
    throw new Error('text is required');
  }

  if (!aiService) {
    throw new Error('aiService is required');
  }

  // Check if text needs chunking
  const wordCount = countWords(params.text);
  const maxWordsPerChunk = SpanLabelingConfig.CHUNKING.MAX_WORDS_PER_CHUNK;
  
  if (wordCount > maxWordsPerChunk) {
    console.log(`[SpanLabeling] Large text detected (${wordCount} words), using chunked processing`);
    return labelSpansChunked(params, aiService);
  }
  
  // For smaller texts, use single-pass processing
  return labelSpansSingle(params, aiService);
}

/**
 * Label spans for a single chunk of text (original implementation)
 * @private
 */
async function labelSpansSingle(params, aiService) {
  if (!params || typeof params.text !== 'string' || !params.text.trim()) {
    throw new Error('text is required');
  }

  // Create request-scoped cache for concurrent request safety
  const cache = new SubstringPositionCache();

  try {
    const policy = sanitizePolicy(params.policy);
    const sanitizedOptions = sanitizeOptions({
      maxSpans: params.maxSpans,
      minConfidence: params.minConfidence,
      templateVersion: params.templateVersion,
    });

    const estimatedMaxTokens = SpanLabelingConfig.estimateMaxTokens(
      sanitizedOptions.maxSpans || SpanLabelingConfig.DEFAULT_OPTIONS.maxSpans
    );

    const task = buildTaskDescription(sanitizedOptions.maxSpans, policy);

    const basePayload = {
      task,
      policy,
      text: params.text,
      templateVersion: sanitizedOptions.templateVersion,
    };

    // PDF Design B: Use context-aware system prompt with semantic routing
    const contextAwareSystemPrompt = buildSystemPrompt(params.text, true);

    // Primary LLM call
    const primaryResponse = await callModel({
      systemPrompt: contextAwareSystemPrompt,
      userPayload: buildUserPayload(basePayload),
      aiService,
      maxTokens: estimatedMaxTokens,
    });

    const parsedPrimary = parseJson(primaryResponse);
    if (!parsedPrimary.ok) {
      throw new Error(parsedPrimary.error);
    }

    // DEFENSIVE: Inject default meta if LLM omitted it
    // Groq/Llama models sometimes optimize by omitting "optional" fields
    // This ensures schema validation always passes
    if (parsedPrimary.value) {
      if (!parsedPrimary.value.meta || typeof parsedPrimary.value.meta !== 'object') {
        parsedPrimary.value.meta = {
          version: sanitizedOptions.templateVersion || 'v1',
          notes: `Labeled ${parsedPrimary.value.spans?.length || 0} spans`,
        };
      } else {
        // Ensure meta has required sub-fields
        if (!parsedPrimary.value.meta.version) {
          parsedPrimary.value.meta.version = sanitizedOptions.templateVersion || 'v1';
        }
        if (typeof parsedPrimary.value.meta.notes !== 'string') {
          parsedPrimary.value.meta.notes = '';
        }
      }
    }

    // Validate schema (should pass now with defensive meta injection)
    validateSchemaOrThrow(parsedPrimary.value);

    const isAdversarial =
      parsedPrimary.value?.isAdversarial === true ||
      parsedPrimary.value?.is_adversarial === true;

    if (isAdversarial) {
      // Immediately exit with an empty set while preserving the adversarial flag
      const validation = validateSpans({
        spans: [],
        meta: parsedPrimary.value.meta,
        text: params.text,
        policy,
        options: sanitizedOptions,
        attempt: 1,
        cache,
        isAdversarial: true,
      });

      return validation.result;
    }

    // Validate spans (strict mode)
    let validation = validateSpans({
      spans: parsedPrimary.value.spans || [],
      meta: parsedPrimary.value.meta,
      text: params.text,
      policy,
      options: sanitizedOptions,
      attempt: 1,
      cache,
      isAdversarial,
    });

    if (validation.ok) {
      return validation.result;
    }

    // Handle validation failure
    const enableRepair = params.enableRepair === true;

    if (!enableRepair) {
      // Lenient mode - drop invalid spans instead of failing
      validation = validateSpans({
        spans: parsedPrimary.value.spans || [],
        meta: parsedPrimary.value.meta,
        text: params.text,
        policy,
        options: sanitizedOptions,
        attempt: 2, // Lenient mode
        cache,
        isAdversarial,
      });

      return validation.result;
    }

    // Repair attempt
    const validationErrors = validation.errors;
    const repairPayload = {
      ...basePayload,
      validation: {
        errors: validationErrors,
        originalResponse: parsedPrimary.value,
        instructions:
          'Fix the indices and roles described above without changing span text. Do not invent new spans.',
      },
    };

    const repairResponse = await callModel({
      systemPrompt: `${BASE_SYSTEM_PROMPT}

If validation feedback is provided, correct the issues without altering span text.`,
      userPayload: buildUserPayload(repairPayload),
      aiService,
      maxTokens: estimatedMaxTokens,
    });

    const parsedRepair = parseJson(repairResponse);
    if (!parsedRepair.ok) {
      throw new Error(parsedRepair.error);
    }

    // Validate repair schema
    validateSchemaOrThrow(parsedRepair.value);

    // Validate repair spans (lenient mode)
    validation = validateSpans({
      spans: parsedRepair.value.spans || [],
      meta: parsedRepair.value.meta,
      text: params.text,
      policy,
      options: sanitizedOptions,
      attempt: 2,
      cache,
      isAdversarial:
        parsedRepair.value?.isAdversarial === true ||
        parsedRepair.value?.is_adversarial === true,
    });

    if (!validation.ok) {
      const errorMessage = formatValidationErrors(validation.errors);
      throw new Error(`Repair attempt failed validation:\n${errorMessage}`);
    }

    return validation.result;
  } catch (error) {
    // Re-throw errors to let caller handle them
    throw error;
  }
  // Cache is automatically garbage collected when function returns
}

/**
 * Label spans for large texts using chunking strategy
 * Splits text into processable chunks, processes them, then merges results
 * @private
 */
async function labelSpansChunked(params, aiService) {
  const chunker = new TextChunker(SpanLabelingConfig.CHUNKING.MAX_WORDS_PER_CHUNK);
  const chunks = chunker.chunkText(params.text);
  
  const wordCount = countWords(params.text);
  console.log(`[SpanLabeling] Processing ${wordCount} words in ${chunks.length} chunks`);
  
  // Process chunks (parallel or serial based on config)
  const processChunk = async (chunk) => {
    try {
      const result = await labelSpansSingle({
        ...params,
        text: chunk.text,
      }, aiService);
      
      return {
        spans: result.spans || [],
        chunkOffset: chunk.startOffset,
        meta: result.meta,
        isAdversarial: result.isAdversarial === true,
      };
    } catch (error) {
      console.error(`[SpanLabeling] Error processing chunk at offset ${chunk.startOffset}:`, error.message);
      // Return empty spans for failed chunks to avoid blocking entire request
      return {
        spans: [],
        chunkOffset: chunk.startOffset,
        meta: null,
        isAdversarial: false,
      };
    }
  };
  
  let chunkResults;
  
  if (SpanLabelingConfig.CHUNKING.PROCESS_CHUNKS_IN_PARALLEL) {
    // Process chunks in parallel with concurrency limit
    const maxConcurrent = SpanLabelingConfig.CHUNKING.MAX_CONCURRENT_CHUNKS;
    chunkResults = [];
    
    for (let i = 0; i < chunks.length; i += maxConcurrent) {
      const batch = chunks.slice(i, i + maxConcurrent);
      const batchResults = await Promise.all(batch.map(processChunk));
      chunkResults.push(...batchResults);
    }
  } else {
    // Process chunks serially
    chunkResults = [];
    for (const chunk of chunks) {
      const result = await processChunk(chunk);
      chunkResults.push(result);
    }
  }
  
  // Merge spans from all chunks
  let mergedSpans = chunker.mergeChunkedSpans(chunkResults);
  const isAdversarial = chunkResults.some(r => r.isAdversarial);

  if (isAdversarial) {
    mergedSpans = [];
  }

  const combinedMeta = {
    version: params.templateVersion || 'v1',
    notes: `Processed ${chunks.length} chunks, ${mergedSpans.length} total spans${isAdversarial ? ' | adversarial input flagged' : ''}`,
    chunked: true,
    chunkCount: chunks.length,
    totalWords: wordCount,
  };
  
  console.log(`[SpanLabeling] Chunked processing complete: ${mergedSpans.length} spans from ${chunks.length} chunks`);
  
  return {
    spans: mergedSpans,
    meta: combinedMeta,
    isAdversarial,
  };
}
