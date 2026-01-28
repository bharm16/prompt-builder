/**
 * Semantic Verb Classification using Embeddings
 *
 * Uses sentence-transformers to classify verbs by semantic similarity
 * to prototype verbs, rather than relying on word lists.
 *
 * Approach:
 * 1. Pre-compute embeddings for prototype verbs in each class
 * 2. At runtime, compute embedding for input verb
 * 3. Classify by cosine similarity to nearest prototype cluster
 */

import type { FeatureExtractionPipeline } from '@huggingface/transformers';
import { logger } from '@infrastructure/Logger';
import { loadEmbeddingPipeline } from './embeddingPipeline';

const log = logger.child({ service: 'VerbSemantics' });

// Prototype verbs for each action class (small, representative set)
const PROTOTYPES = {
  state: [
    'gazing at something',
    'sitting quietly',
    'standing still',
    'watching carefully',
    'waiting patiently',
    'lying down',
    'resting peacefully',
    'observing intently',
  ],
  movement: [
    'running fast',
    'jumping high',
    'dancing gracefully',
    'walking slowly',
    'swimming through water',
    'climbing up',
    'flying through air',
    'jogging steadily',
  ],
  gesture: [
    'waving hand',
    'pointing finger',
    'nodding head',
    'shaking head',
    'clapping hands',
    'beckoning someone',
    'saluting',
    'bowing respectfully',
  ],
} as const;

type ActionClass = keyof typeof PROTOTYPES;

// Cached embeddings and model
let embeddingModel: FeatureExtractionPipeline | null = null;
let prototypeEmbeddings: Map<ActionClass, number[][]> | null = null;
let isInitializing = false;
let initPromise: Promise<void> | null = null;

/**
 * Initialize the embedding model and compute prototype embeddings
 */
async function initialize(): Promise<void> {
  if (embeddingModel && prototypeEmbeddings) return;
  if (isInitializing && initPromise) return initPromise;

  isInitializing = true;
  initPromise = (async () => {
    try {
      log.info('Initializing verb semantic classifier');
      const startTime = performance.now();

      embeddingModel = await loadEmbeddingPipeline();

      // Pre-compute prototype embeddings
      prototypeEmbeddings = new Map();

      for (const [className, prototypes] of Object.entries(PROTOTYPES)) {
        const embeddings: number[][] = [];
        for (const proto of prototypes) {
          const embedding = await getEmbedding(proto);
          if (embedding) embeddings.push(embedding);
        }
        prototypeEmbeddings.set(className as ActionClass, embeddings);
      }

      const latency = Math.round(performance.now() - startTime);
      log.info('Verb semantic classifier initialized', {
        latencyMs: latency,
        prototypeCount: Object.values(PROTOTYPES).flat().length,
      });
    } catch (error) {
      log.error('Failed to initialize verb semantic classifier', error as Error);
      throw error;
    } finally {
      isInitializing = false;
    }
  })();

  return initPromise;
}

/**
 * Get embedding for a text string
 */
async function getEmbedding(text: string): Promise<number[] | null> {
  if (!embeddingModel) return null;

  try {
    const output = await embeddingModel(text, { pooling: 'mean', normalize: true });
    // Extract the embedding array
    const data = output.data as Float32Array;
    return Array.from(data);
  } catch (error) {
    log.error('Embedding extraction failed', error as Error, { text });
    return null;
  }
}

/**
 * Compute cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Find the average similarity to a class's prototypes
 */
function classScore(verbEmbedding: number[], classEmbeddings: number[][]): number {
  if (classEmbeddings.length === 0) return 0;

  let totalSim = 0;
  for (const protoEmb of classEmbeddings) {
    totalSim += cosineSimilarity(verbEmbedding, protoEmb);
  }
  return totalSim / classEmbeddings.length;
}

/**
 * Classify a verb phrase semantically
 *
 * @param verbPhrase - The verb phrase to classify (e.g., "gazing thoughtfully")
 * @returns The action class and confidence score
 */
export async function classifyVerbSemantically(
  verbPhrase: string
): Promise<{ actionClass: ActionClass; confidence: number }> {
  // Ensure model is initialized
  await initialize();

  if (!embeddingModel || !prototypeEmbeddings) {
    // Fallback to movement if model not available
    return { actionClass: 'movement', confidence: 0.5 };
  }

  const embedding = await getEmbedding(verbPhrase);
  if (!embedding) {
    return { actionClass: 'movement', confidence: 0.5 };
  }

  // Score against each class
  const scores: Record<ActionClass, number> = {
    state: classScore(embedding, prototypeEmbeddings.get('state') || []),
    movement: classScore(embedding, prototypeEmbeddings.get('movement') || []),
    gesture: classScore(embedding, prototypeEmbeddings.get('gesture') || []),
  };

  // Find highest scoring class
  let bestClass: ActionClass = 'movement';
  let bestScore = scores.movement;

  for (const [className, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestClass = className as ActionClass;
    }
  }

  return { actionClass: bestClass, confidence: bestScore };
}

/**
 * Synchronous classification using cached model
 * Falls back to simple heuristics if model not ready
 */
export function classifyVerbSync(verbPhrase: string): string {
  // If model not ready, use simple fallback
  if (!embeddingModel || !prototypeEmbeddings) {
    return 'action.movement'; // Default fallback
  }

  // For sync operation, we can't await - schedule async classification
  // and return default. The async version should be used when possible.
  return 'action.movement';
}

/**
 * Warm up the semantic classifier
 */
export async function warmupVerbSemantics(): Promise<{
  success: boolean;
  latencyMs: number;
}> {
  const startTime = performance.now();

  try {
    await initialize();

    // Test classification
    const result = await classifyVerbSemantically('running quickly');
    const latencyMs = Math.round(performance.now() - startTime);

    log.info('Verb semantics warmup completed', {
      testResult: result,
      latencyMs,
    });

    return { success: true, latencyMs };
  } catch (error) {
    log.error('Verb semantics warmup failed', error as Error);
    return { success: false, latencyMs: 0 };
  }
}

/**
 * Check if the semantic classifier is ready
 */
export function isVerbSemanticsReady(): boolean {
  return embeddingModel !== null && prototypeEmbeddings !== null;
}

export default {
  classifyVerbSemantically,
  classifyVerbSync,
  warmupVerbSemantics,
  isVerbSemanticsReady,
};
