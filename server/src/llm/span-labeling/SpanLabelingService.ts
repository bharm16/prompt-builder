import { SubstringPositionCache } from './cache/SubstringPositionCache';
import SpanLabelingConfig from './config/SpanLabelingConfig';
import { sanitizePolicy, sanitizeOptions } from './utils/policyUtils';
import { TextChunker, countWords } from './utils/chunkingUtils';
import { NlpSpanStrategy } from './strategies/NlpSpanStrategy';
import { createLlmClient, getCurrentSpanProvider } from './services/LlmClientFactory';
import { resolveOverlaps } from './processing/OverlapResolver';
import { validateSpans } from './validation/SpanValidator';
import { detectInjectionPatterns } from '@utils/SecurityPrompts';
import { logger } from '@infrastructure/Logger';
import type { LabelSpansParams, LabelSpansResult, SpanLike } from './types';
import type { AIService as BaseAIService } from '@services/enhancement/services/types';

/**
 * Span Labeling Service - Refactored Architecture
 *
 * Orchestrates LLM-based span labeling with validation and optional repair.
 * This service is a thin orchestrator delegating to specialized modules:
 * - NlpSpanStrategy: NLP fast-path extraction
 * - LlmClientFactory: Creates provider-specific LLM clients (Groq, OpenAI)
 * - Validation: Schema and span validation
 * - Processing: Pipeline of span transformations (dedupe, overlap, filter, truncate)
 * 
 * Provider Isolation:
 * - Groq/Llama 3: Uses GroqLlmClient with logprobs confidence, min_p, stop sequences
 * - OpenAI/GPT-4o: Uses OpenAILlmClient with strict schema, developer role
 * - Provider selection via SPAN_PROVIDER env var or auto-detection
 */

/**
 * Label spans using an LLM with validation and optional repair attempt.
 * Routes to chunked processing for large texts.
 */
export async function labelSpans(
  params: LabelSpansParams,
  aiService: BaseAIService
): Promise<LabelSpansResult> {
  if (!params || typeof params.text !== 'string' || !params.text.trim()) {
    throw new Error('text is required');
  }

  if (!aiService) {
    throw new Error('aiService is required');
  }

  const adversarialCheck = detectInjectionPatterns(params.text);
  if (adversarialCheck.hasPatterns) {
    logger.warn('Span labeling precheck flagged adversarial input', {
      operation: 'labelSpans',
      patterns: adversarialCheck.patterns,
      textLength: params.text.length,
    });

    return {
      spans: [],
      meta: {
        version: params.templateVersion || SpanLabelingConfig.DEFAULT_OPTIONS.templateVersion,
        notes: 'adversarial input flagged',
      },
      isAdversarial: true,
      analysisTrace: adversarialCheck.patterns.length
        ? `adversarial precheck: ${adversarialCheck.patterns.join(', ')}`
        : 'adversarial precheck',
    };
  }

  // Check if text needs chunking
  const wordCount = countWords(params.text);
  const maxWordsPerChunk = SpanLabelingConfig.CHUNKING.MAX_WORDS_PER_CHUNK;
  
  if (wordCount > maxWordsPerChunk) {
    const provider = getCurrentSpanProvider();
    logger.debug('Large text detected, using chunked processing', {
      operation: 'labelSpans',
      wordCount,
      provider,
    });
    return labelSpansChunked(params, aiService);
  }
  
  // For smaller texts, use single-pass processing
  return labelSpansSingle(params, aiService);
}

/**
 * Label spans for a single chunk of text (original implementation)
 * 
 * Uses provider-specific LLM client via factory pattern:
 * - Groq: GroqLlmClient with Llama 3 optimizations
 * - OpenAI: OpenAILlmClient with GPT-4o optimizations
 */
async function labelSpansSingle(
  params: LabelSpansParams,
  aiService: BaseAIService
): Promise<LabelSpansResult> {
  if (!params || typeof params.text !== 'string' || !params.text.trim()) {
    throw new Error('text is required');
  }

  // Create request-scoped cache for concurrent request safety
  const cache = new SubstringPositionCache();

  try {
    const policy = sanitizePolicy(params.policy ?? null);
    const sanitizedOptions = sanitizeOptions({
      ...(params.maxSpans !== undefined && { maxSpans: params.maxSpans }),
      ...(params.minConfidence !== undefined && { minConfidence: params.minConfidence }),
      ...(params.templateVersion !== undefined && { templateVersion: params.templateVersion }),
    });

    // Try NLP fast-path first
    const nlpStrategy = new NlpSpanStrategy();
    const nlpResult = await nlpStrategy.extractSpans(params.text, policy, sanitizedOptions, cache);

    if (nlpResult) {
      // NLP fast-path succeeded
      return nlpResult;
    }

    // Fall back to LLM-based extraction with repair loop
    // Use factory to get provider-specific client
    const llmClient = createLlmClient({ operation: 'span_labeling' });
    
    return await llmClient.getSpans({
      text: params.text,
      policy,
      options: sanitizedOptions,
      enableRepair: params.enableRepair === true,
      aiService,
      cache,
      nlpSpansAttempted: 0, // Could track NLP attempt count if needed
    });
  } catch (error) {
    // Re-throw errors to let caller handle them
    throw error;
  }
  // Cache is automatically garbage collected when function returns
}

interface ChunkResult {
  spans?: SpanLike[];
  chunkOffset: number;
  meta: { version: string; notes: string; [key: string]: unknown } | null;
  isAdversarial: boolean;
}

/**
 * Label spans for large texts using chunking strategy
 * Splits text into processable chunks, processes them, then merges results
 */
async function labelSpansChunked(
  params: LabelSpansParams,
  aiService: BaseAIService
): Promise<LabelSpansResult> {
  const chunker = new TextChunker(
    SpanLabelingConfig.CHUNKING.MAX_WORDS_PER_CHUNK,
    SpanLabelingConfig.CHUNKING.OVERLAP_WORDS
  );
  const chunks = chunker.chunkText(params.text);
  
  const wordCount = countWords(params.text);
  const provider = getCurrentSpanProvider();
  logger.debug('Processing chunks', {
    operation: 'labelSpansChunked',
    wordCount,
    chunkCount: chunks.length,
    provider,
  });
  
  // Process chunks (parallel or serial based on config)
  const processChunk = async (chunk: { text: string; startOffset: number }): Promise<ChunkResult> => {
    try {
      const result = await labelSpansSingle({
        ...params,
        text: chunk.text,
      }, aiService);

      const spans: SpanLike[] = (result.spans || [])
        .filter((span) => typeof span.start === 'number' && typeof span.end === 'number')
        .map((span) => ({
          ...span,
          start: span.start as number,
          end: span.end as number,
        }));
      
      return {
        spans,
        chunkOffset: chunk.startOffset,
        meta: result.meta,
        isAdversarial: result.isAdversarial === true,
      };
    } catch (error) {
      const err = error as Error;
      logger.error('Error processing chunk', err as Error, {
        operation: 'labelSpansChunked',
        chunkOffset: chunk.startOffset,
        provider,
      });
      // Return empty spans for failed chunks to avoid blocking entire request
      return {
        spans: [],
        chunkOffset: chunk.startOffset,
        meta: null,
        isAdversarial: false,
      };
    }
  };
  
  let chunkResults: ChunkResult[];
  
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
  const policy = sanitizePolicy(params.policy ?? null);
  const sanitizedOptions = sanitizeOptions({
    ...(params.maxSpans !== undefined && { maxSpans: params.maxSpans }),
    ...(params.minConfidence !== undefined && { minConfidence: params.minConfidence }),
    ...(params.templateVersion !== undefined && { templateVersion: params.templateVersion }),
  });
  const overlapResolved = resolveOverlaps(
    mergedSpans.map(span => ({
      ...span,
      confidence: typeof span.confidence === 'number' ? span.confidence : 0,
      text: typeof span.text === 'string' ? span.text : String(span.quote ?? ''),
    })),
    policy.allowOverlap === true
  );

  mergedSpans = overlapResolved.spans;
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
    provider,
  };

  const cache = new SubstringPositionCache();
  const validation = validateSpans({
    spans: mergedSpans,
    meta: combinedMeta,
    text: params.text,
    policy,
    options: sanitizedOptions,
    attempt: 2,
    cache,
    isAdversarial,
  });
  
  logger.info('Chunked processing complete', {
    operation: 'labelSpansChunked',
    spanCount: validation.result.spans.length,
    chunkCount: chunks.length,
    provider,
  });
  
  return {
    spans: validation.result.spans,
    meta: validation.result.meta,
    ...(validation.result.isAdversarial !== undefined && { isAdversarial: validation.result.isAdversarial }),
    ...(validation.result.analysisTrace !== undefined && { analysisTrace: validation.result.analysisTrace }),
  };
}

/**
 * Stream spans using an LLM.
 * Bypasses NLP fast-path for immediate feedback.
 */
export async function* labelSpansStream(
  params: LabelSpansParams,
  aiService: BaseAIService
): AsyncGenerator<SpanLike, void, unknown> {
  if (!params || typeof params.text !== 'string' || !params.text.trim()) {
    throw new Error('text is required');
  }

  if (!aiService) {
    throw new Error('aiService is required');
  }

  // Pre-check for adversarial input
  const adversarialCheck = detectInjectionPatterns(params.text);
  if (adversarialCheck.hasPatterns) {
    logger.warn('Adversarial input detected in stream', { 
      operation: 'labelSpansStream',
      patterns: adversarialCheck.patterns 
    });
    return;
  }

  // Create client
  const llmClient = createLlmClient({ operation: 'span_labeling' });

  // Fallback if streaming not supported
  if (!llmClient.streamSpans) {
    logger.debug('Client does not support streaming, falling back to blocking', {
       operation: 'labelSpansStream',
       client: llmClient.constructor.name 
    });
    const result = await labelSpans(params, aiService);
    for (const span of result.spans) {
      yield span;
    }
    return;
  }

  // Setup params
  const policy = sanitizePolicy(params.policy ?? null);
  const sanitizedOptions = sanitizeOptions({
    ...(params.maxSpans !== undefined && { maxSpans: params.maxSpans }),
    ...(params.minConfidence !== undefined && { minConfidence: params.minConfidence }),
    ...(params.templateVersion !== undefined && { templateVersion: params.templateVersion }),
  });
  
  const cache = new SubstringPositionCache();
  const streamParams = {
      text: params.text,
      policy,
      options: sanitizedOptions,
      enableRepair: params.enableRepair === true,
      aiService,
      cache,
      nlpSpansAttempted: 0, 
  };

  // Stream
  for await (const rawSpan of llmClient.streamSpans(streamParams)) {
      // Basic validation/normalization
      const span: SpanLike = {
          text: String(rawSpan.text || ''),
          role: String(rawSpan.role || rawSpan.category || ''),
          confidence: typeof rawSpan.confidence === 'number' ? rawSpan.confidence : 0.5,
          start: typeof rawSpan.start === 'number' ? rawSpan.start : undefined,
          end: typeof rawSpan.end === 'number' ? rawSpan.end : undefined,
      };
      
      yield span;
  }
}
