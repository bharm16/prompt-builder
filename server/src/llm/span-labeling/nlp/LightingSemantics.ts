/**
 * Semantic Lighting Classification using Embeddings
 *
 * Uses sentence-transformers to classify lighting phrases by semantic similarity
 * to prototype phrases, rather than relying on adjective word lists.
 *
 * Approach:
 * 1. Pre-compute embeddings for prototype lighting descriptions in each class
 * 2. At runtime, compute embedding for input phrase (e.g., "soft shadows")
 * 3. Classify by cosine similarity to nearest prototype cluster
 *
 * This scales because:
 * - We only need ~8 prototypes per class
 * - New adjective variations work automatically via semantic similarity
 * - "gentle shadows" matches "soft diffused shadows" prototype
 */

import { pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';
import { logger } from '@infrastructure/Logger';

const log = logger.child({ service: 'LightingSemantics' });

/**
 * Prototype phrases for each lighting class (small, representative set)
 *
 * These are examples that capture the semantic essence of each category.
 * The embedding model generalizes from these to handle infinite variations.
 */
const PROTOTYPES = {
  // lighting.quality - describes HOW light behaves (soft/hard, diffused/direct)
  quality: [
    'soft diffused lighting',
    'harsh dramatic shadows',
    'gentle ambient glow',
    'hard directional light',
    'dappled filtered sunlight',
    'subtle rim lighting',
    'deep dark shadows',
    'bright even illumination',
  ],

  // lighting.source - describes WHERE light comes from
  source: [
    'neon signs glowing',
    'candlelight flickering',
    'sunlight streaming through',
    'moonlight shining',
    'streetlight overhead',
    'firelight dancing',
    'window light coming in',
    'spotlight shining down',
  ],

  // lighting.timeOfDay - describes WHEN (temporal lighting conditions)
  timeOfDay: [
    'golden hour sunset light',
    'blue hour twilight',
    'dawn morning light',
    'dusk evening glow',
    'midday harsh sun',
    'magic hour warm tones',
    'midnight darkness',
    'overcast daylight',
  ],

  // lighting.colorTemp - describes color temperature (warm/cool)
  colorTemp: [
    'warm tungsten orange',
    'cool blue tones',
    'neutral daylight balanced',
    'warm golden hues',
    'cold clinical white',
    'warm amber glow',
    'cool moonlit blue',
    'mixed warm cool contrast',
  ],
} as const;

export type LightingClass = keyof typeof PROTOTYPES;

// Cached embeddings and model (shared with VerbSemantics if same model)
let embeddingModel: FeatureExtractionPipeline | null = null;
let prototypeEmbeddings: Map<LightingClass, number[][]> | null = null;
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
      log.info('Initializing lighting semantic classifier');
      const startTime = performance.now();

      // Load a small, fast embedding model (same as VerbSemantics)
      const createEmbeddingPipeline = pipeline as unknown as (
        task: 'feature-extraction',
        model: string,
        options: { dtype: 'fp32' }
      ) => Promise<FeatureExtractionPipeline>;

      embeddingModel = await createEmbeddingPipeline(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2',
        { dtype: 'fp32' }
      );

      // Pre-compute prototype embeddings
      prototypeEmbeddings = new Map();

      for (const [className, prototypes] of Object.entries(PROTOTYPES)) {
        const embeddings: number[][] = [];
        for (const proto of prototypes) {
          const embedding = await getEmbedding(proto);
          if (embedding) embeddings.push(embedding);
        }
        prototypeEmbeddings.set(className as LightingClass, embeddings);
      }

      const latency = Math.round(performance.now() - startTime);
      log.info('Lighting semantic classifier initialized', {
        latencyMs: latency,
        prototypeCount: Object.values(PROTOTYPES).flat().length,
      });
    } catch (error) {
      log.error('Failed to initialize lighting semantic classifier', error as Error);
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
function classScore(embedding: number[], classEmbeddings: number[][]): number {
  if (classEmbeddings.length === 0) return 0;

  let totalSim = 0;
  for (const protoEmb of classEmbeddings) {
    totalSim += cosineSimilarity(embedding, protoEmb);
  }
  return totalSim / classEmbeddings.length;
}

/**
 * Classify a lighting phrase semantically
 *
 * @param phrase - The lighting phrase to classify (e.g., "soft shadows", "warm glow")
 * @returns The lighting class and confidence score
 */
export async function classifyLightingSemantically(
  phrase: string
): Promise<{ lightingClass: LightingClass; confidence: number }> {
  // Ensure model is initialized
  await initialize();

  if (!embeddingModel || !prototypeEmbeddings) {
    // Fallback to quality if model not available
    return { lightingClass: 'quality', confidence: 0.5 };
  }

  const embedding = await getEmbedding(phrase);
  if (!embedding) {
    return { lightingClass: 'quality', confidence: 0.5 };
  }

  // Score against each class
  const scores: Record<LightingClass, number> = {
    quality: classScore(embedding, prototypeEmbeddings.get('quality') || []),
    source: classScore(embedding, prototypeEmbeddings.get('source') || []),
    timeOfDay: classScore(embedding, prototypeEmbeddings.get('timeOfDay') || []),
    colorTemp: classScore(embedding, prototypeEmbeddings.get('colorTemp') || []),
  };

  // Find highest scoring class
  let bestClass: LightingClass = 'quality';
  let bestScore = scores.quality;

  for (const [className, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestClass = className as LightingClass;
    }
  }

  log.debug('Lighting classification result', {
    phrase,
    bestClass,
    bestScore: Math.round(bestScore * 100) / 100,
    scores: Object.fromEntries(
      Object.entries(scores).map(([k, v]) => [k, Math.round(v * 100) / 100])
    ),
  });

  return { lightingClass: bestClass, confidence: bestScore };
}

/**
 * Map lighting class to taxonomy ID
 */
export function lightingClassToTaxonomy(lightingClass: LightingClass): string {
  const mapping: Record<LightingClass, string> = {
    quality: 'lighting.quality',
    source: 'lighting.source',
    timeOfDay: 'lighting.timeOfDay',
    colorTemp: 'lighting.colorTemp',
  };
  return mapping[lightingClass];
}

/**
 * Warm up the semantic classifier
 */
export async function warmupLightingSemantics(): Promise<{
  success: boolean;
  latencyMs: number;
}> {
  const startTime = performance.now();

  try {
    await initialize();

    // Test classification
    const result = await classifyLightingSemantically('soft gentle shadows');
    const latencyMs = Math.round(performance.now() - startTime);

    log.info('Lighting semantics warmup completed', {
      testResult: result,
      latencyMs,
    });

    return { success: true, latencyMs };
  } catch (error) {
    log.error('Lighting semantics warmup failed', error as Error);
    return { success: false, latencyMs: 0 };
  }
}

/**
 * Check if the semantic classifier is ready
 */
export function isLightingSemanticsReady(): boolean {
  return embeddingModel !== null && prototypeEmbeddings !== null;
}

export default {
  classifyLightingSemantically,
  lightingClassToTaxonomy,
  warmupLightingSemantics,
  isLightingSemanticsReady,
};
