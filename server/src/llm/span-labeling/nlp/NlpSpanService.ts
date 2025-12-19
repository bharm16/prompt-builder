/**
 * NLP Span Service - Neuro-Symbolic Architecture v3 (TypeScript)
 * 
 * 3-Tier extraction pipeline:
 * 1. Aho-Corasick (Tier 1): Closed vocabulary - O(N) single pass, 100% precision
 * 2. GLiNER (Tier 2): Open vocabulary - via official 'gliner' npm package  
 * 3. LLM Fallback (Tier 3): Complex reasoning - handled by SpanLabelingService
 * 
 * REQUIRES: npm install gliner
 */

import AhoCorasick from 'ahocorasick';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Worker } from 'worker_threads';
import { logger } from '@infrastructure/Logger.js';
import { TAXONOMY, VALID_CATEGORIES } from '#shared/taxonomy.ts';
import { NEURO_SYMBOLIC } from '@llm/span-labeling/config/SpanLabelingConfig.js';
import type {
  NlpSpan,
  ExtractionOptions,
  ExtractionResult,
  VocabStats,
  WarmupResult,
  PatternInfo
} from './types.js';

// =============================================================================
// SETUP
// =============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const vocabPath = join(__dirname, 'vocab.json');
const modelPath = join(__dirname, 'models', 'model.onnx');
const log = logger.child({ service: 'NlpSpanService' });

// Load vocabulary
let VOCAB: Record<string, string[]> = {};
try {
  VOCAB = JSON.parse(readFileSync(vocabPath, 'utf-8'));
} catch (e) {
  log.warn('NLP Service: Could not load vocab.json', {
    error: e instanceof Error ? e.message : String(e),
    vocabPath,
  });
}

// =============================================================================
// TIER 1: AHO-CORASICK - Closed Vocabulary (100% precision, O(N) time)
// =============================================================================

function buildAhoCorasickAutomaton(): { 
  ac: AhoCorasick; 
  patternToTaxonomy: Map<string, PatternInfo> 
} {
  const patterns: string[] = [];
  const patternToTaxonomy = new Map<string, PatternInfo>();
  
  for (const [taxonomyId, terms] of Object.entries(VOCAB)) {
    for (const term of terms) {
      const lowerTerm = term.toLowerCase();
      patterns.push(lowerTerm);
      patternToTaxonomy.set(lowerTerm, { taxonomyId, originalTerm: term });
    }
  }
  
  const ac = new AhoCorasick(patterns);
  return { ac, patternToTaxonomy };
}

const { ac: ahoCorasick, patternToTaxonomy } = buildAhoCorasickAutomaton();

const AMBIGUOUS_CAMERA_TERMS = new Set([
  'pan', 'roll', 'tilt', 'zoom', 'drone', 'crane', 'boom', 'truck'
]);

function hasCameraContext(text: string, start: number, end: number): boolean {
  const contextRadius = 50;
  const contextStart = Math.max(0, start - contextRadius);
  const contextEnd = Math.min(text.length, end + contextRadius);
  const context = text.substring(contextStart, contextEnd).toLowerCase();
  return /(camera|shot|lens|frame|cinematography|cinematic|filming|video|footage)/.test(context);
}

function extractClosedVocabulary(text: string): NlpSpan[] {
  if (!text || typeof text !== 'string') return [];
  
  const lowerText = text.toLowerCase();
  const results = ahoCorasick.search(lowerText) as Array<[number, string[]]>;
  const spans: NlpSpan[] = [];
  
  for (const [endIndex, patterns] of results) {
    for (const pattern of patterns) {
      const info = patternToTaxonomy.get(pattern);
      if (!info) continue;
      
      const start = endIndex - pattern.length + 1;
      const end = endIndex + 1;
      const matchedText = text.substring(start, end);
      
      if (info.taxonomyId === 'camera.movement' && AMBIGUOUS_CAMERA_TERMS.has(pattern)) {
        const beforeContext = text.substring(Math.max(0, start - 20), start).toLowerCase();
        if (/(frying|sauté|sauce|iron|bread|dinner|hair)\s*$/.test(beforeContext)) {
          continue;
        }
        if (!hasCameraContext(text, start, end)) {
          continue;
        }
      }
      
      spans.push({
        text: matchedText,
        role: info.taxonomyId,
        confidence: 1.0,
        start,
        end,
        source: 'aho-corasick'
      });
    }
  }
  
  return spans;
}

// =============================================================================
// TIER 2: GLINER - Open Vocabulary (Official npm package)
// =============================================================================

// Types from the gliner package (Node.js version)
interface GlinerResult {
  spanText: string;  // Node.js version uses spanText, not text
  label: string;
  score: number;
  start: number;
  end: number;
}

interface GlinerInstance {
  initialize(): Promise<void>;
  inference(options: {
    texts: string[];
    entities: string[];
    flatNer?: boolean;
    threshold?: number;
    multiLabel?: boolean;
  }): Promise<GlinerResult[][]>;
}

interface GlinerConstructor {
  new (config: {
    tokenizerPath: string;
    onnxSettings: {
      modelPath: string;
      // Node.js version doesn't need executionProvider or multiThread
    };
    transformersSettings?: {
      allowLocalModels?: boolean;
      useBrowserCache?: boolean;
    };
    maxWidth?: number;
    modelType?: string;
  }): GlinerInstance;
}

// GLiNER singleton state
let gliner: GlinerInstance | null = null;
let glinerInitialized = false;
let glinerInitFailed = false;
let glinerInitPromise: Promise<boolean> | null = null;

// GLiNER worker thread state (optional)
let glinerWorker: Worker | null = null;
let glinerWorkerReady = false;
let glinerWorkerInitFailed = false;
let glinerWorkerInitPromise: Promise<boolean> | null = null;
let glinerWorkerRequestId = 0;
const glinerWorkerPending = new Map<
  number,
  { resolve: (value: unknown) => void; reject: (error: Error) => void; timeout?: NodeJS.Timeout }
>();

/**
 * Labels for GLiNER extraction + mapping to internal taxonomy IDs.
 *
 * IMPORTANT: Every taxonomy ID here must exist in `shared/taxonomy.ts` (VALID_CATEGORIES),
 * otherwise validation will drop the span and coverage will look artificially low.
 */
const GLINER_LABEL_SPECS: Array<{ label: string; taxonomyId: string }> = [
  // Subjects
  { label: 'person', taxonomyId: 'subject.identity' },
  { label: 'character', taxonomyId: 'subject.identity' },
  { label: 'animal', taxonomyId: 'subject.identity' },
  { label: 'creature', taxonomyId: 'subject.identity' },
  { label: 'object', taxonomyId: 'subject.identity' },
  { label: 'item', taxonomyId: 'subject.identity' },
  { label: 'vehicle', taxonomyId: 'subject.identity' },
  { label: 'food', taxonomyId: 'subject.identity' },
  { label: 'drink', taxonomyId: 'subject.identity' },
  { label: 'clothing', taxonomyId: 'subject.wardrobe' },

  // Environment
  { label: 'place', taxonomyId: 'environment.location' },
  { label: 'location', taxonomyId: 'environment.location' },
  { label: 'building', taxonomyId: 'environment.location' },
  { label: 'room', taxonomyId: 'environment.location' },
  { label: 'environment', taxonomyId: 'environment.context' },
  { label: 'atmosphere', taxonomyId: 'environment.context' },
  { label: 'weather', taxonomyId: 'environment.weather' },
  { label: 'season', taxonomyId: 'environment.context' },

  // Actions
  { label: 'action', taxonomyId: 'action.movement' },
  { label: 'movement', taxonomyId: 'action.movement' },
  { label: 'activity', taxonomyId: 'action.movement' },
  { label: 'gesture', taxonomyId: 'action.gesture' },

  // Emotion / vibe
  { label: 'emotion', taxonomyId: 'subject.emotion' },
  { label: 'expression', taxonomyId: 'subject.emotion' },
  { label: 'mood', taxonomyId: 'style.aesthetic' },

  // Cinematography / style
  { label: 'shot type', taxonomyId: 'shot.type' },
  { label: 'camera movement', taxonomyId: 'camera.movement' },
  { label: 'camera angle', taxonomyId: 'camera.angle' },
  { label: 'camera lens', taxonomyId: 'camera.lens' },
  { label: 'lens', taxonomyId: 'camera.lens' },
  { label: 'focus', taxonomyId: 'camera.focus' },
  { label: 'depth of field', taxonomyId: 'camera.focus' },
  { label: 'style', taxonomyId: 'style.aesthetic' },
  { label: 'aesthetic', taxonomyId: 'style.aesthetic' },
  { label: 'film stock', taxonomyId: 'style.filmStock' },
  { label: 'color grade', taxonomyId: 'style.colorGrade' },
  { label: 'color', taxonomyId: 'style.colorGrade' },

  // Lighting
  { label: 'lighting', taxonomyId: 'lighting.quality' },
  { label: 'light source', taxonomyId: 'lighting.source' },
  { label: 'time of day', taxonomyId: 'lighting.timeOfDay' },
  { label: 'color temperature', taxonomyId: 'lighting.colorTemp' },

  // Technical specs
  { label: 'frame rate', taxonomyId: 'technical.frameRate' },
  { label: 'fps', taxonomyId: 'technical.frameRate' },
  { label: 'duration', taxonomyId: 'technical.duration' },
  { label: 'aspect ratio', taxonomyId: 'technical.aspectRatio' },
  { label: 'resolution', taxonomyId: 'technical.resolution' },

  // Audio
  { label: 'audio', taxonomyId: 'audio.ambient' },
  { label: 'ambient sound', taxonomyId: 'audio.ambient' },
  { label: 'sound effect', taxonomyId: 'audio.soundEffect' },
  { label: 'music', taxonomyId: 'audio.score' },
  { label: 'score', taxonomyId: 'audio.score' },
];

const GLINER_LABELS = GLINER_LABEL_SPECS.map(({ label }) => label);

/** Map GLiNER labels to taxonomy IDs */
const LABEL_TO_TAXONOMY: Record<string, string> = Object.fromEntries(
  GLINER_LABEL_SPECS.map(({ label, taxonomyId }) => [label, taxonomyId])
);

const invalidTaxonomyIds = GLINER_LABEL_SPECS.filter(({ taxonomyId }) => !VALID_CATEGORIES.has(taxonomyId));
if (invalidTaxonomyIds.length) {
  log.warn('GLiNER label mapping includes invalid taxonomy IDs (these spans will be dropped)', {
    invalid: invalidTaxonomyIds,
  });
}

function mapLabelToTaxonomy(label: string): string {
  return LABEL_TO_TAXONOMY[label.toLowerCase()] || 'subject.identity';
}

/**
 * GLiNER scores are not directly comparable to the LLM confidence scale used by the rest
 * of the span-labeling pipeline. We calibrate them so that:
 * - any detection above the GLiNER threshold maps to ≥ 0.5 (default minConfidence)
 * - higher GLiNER scores still rank higher
 */
function calibrateGlinerConfidence(score: number, threshold: number): number {
  const clamped = Math.max(0, Math.min(1, score));
  const t = Math.max(0, Math.min(0.99, threshold));

  // Map [t..1] -> [0.5..1]
  const normalized = clamped <= t ? 0 : (clamped - t) / (1 - t);
  const calibrated = 0.5 + normalized * 0.5;
  return Math.round(calibrated * 100) / 100;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return promise;
  }

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`GLiNER inference timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function shouldUseGlinerWorker(): boolean {
  return Boolean(NEURO_SYMBOLIC.GLINER?.USE_WORKER);
}

function isGlinerReady(): boolean {
  return shouldUseGlinerWorker()
    ? glinerWorkerReady && !glinerWorkerInitFailed
    : glinerInitialized && !glinerInitFailed;
}

function failPendingGlinerRequests(reason: string): void {
  for (const [id, pending] of glinerWorkerPending.entries()) {
    glinerWorkerPending.delete(id);
    if (pending.timeout) clearTimeout(pending.timeout);
    pending.reject(new Error(reason));
  }
}

function handleGlinerWorkerMessage(message: {
  id?: number;
  ok?: boolean;
  result?: unknown;
  error?: string;
}): void {
  if (!message || typeof message.id !== 'number') return;
  const pending = glinerWorkerPending.get(message.id);
  if (!pending) return;
  glinerWorkerPending.delete(message.id);
  if (pending.timeout) clearTimeout(pending.timeout);
  if (message.ok) {
    pending.resolve(message.result);
  } else {
    pending.reject(new Error(message.error || 'GLiNER worker request failed'));
  }
}

function getOrCreateGlinerWorker(): Worker | null {
  if (glinerWorker) return glinerWorker;
  const operation = 'getOrCreateGlinerWorker';

  try {
    const workerUrl = new URL('./glinerWorker.js', import.meta.url);
    glinerWorker = new Worker(workerUrl, {
      type: 'module',
      workerData: {
        modelPath,
        tokenizerPath: NEURO_SYMBOLIC.GLINER.MODEL_PATH,
        labels: GLINER_LABELS,
        labelToTaxonomy: LABEL_TO_TAXONOMY,
        maxWidth: NEURO_SYMBOLIC.GLINER.MAX_WIDTH || 12,
        defaultThreshold: NEURO_SYMBOLIC.GLINER.THRESHOLD || 0.3,
        defaultTimeoutMs: NEURO_SYMBOLIC.GLINER.TIMEOUT || 0,
      },
    });

    glinerWorker.on('message', handleGlinerWorkerMessage);
    glinerWorker.on('error', (error) => {
      glinerWorker = null;
      glinerWorkerReady = false;
      glinerWorkerInitFailed = true;
      glinerWorkerInitPromise = null;
      log.error(`${operation}: Worker error`, error as Error, { operation });
      failPendingGlinerRequests('GLiNER worker error');
    });
    glinerWorker.on('exit', (code) => {
      glinerWorker = null;
      glinerWorkerReady = false;
      glinerWorkerInitPromise = null;
      glinerWorkerInitFailed = code !== 0;
      if (code !== 0) {
        log.warn(`${operation}: Worker exited`, { operation, code });
      }
      failPendingGlinerRequests('GLiNER worker exited');
    });

    return glinerWorker;
  } catch (error) {
    glinerWorkerInitFailed = true;
    log.error(`${operation}: Failed to start worker`, error as Error, { operation });
    return null;
  }
}

function sendGlinerWorkerRequest<T>(
  type: string,
  payload: Record<string, unknown>,
  timeoutMs: number
): Promise<T> {
  const worker = getOrCreateGlinerWorker();
  if (!worker) {
    return Promise.reject(new Error('GLiNER worker unavailable'));
  }

  const id = ++glinerWorkerRequestId;
  return new Promise<T>((resolve, reject) => {
    const timeout =
      Number.isFinite(timeoutMs) && timeoutMs > 0
        ? setTimeout(() => {
            glinerWorkerPending.delete(id);
            reject(new Error(`GLiNER worker request timed out after ${timeoutMs}ms`));
          }, timeoutMs)
        : undefined;

    glinerWorkerPending.set(id, {
      resolve: resolve as (value: unknown) => void,
      reject,
      timeout,
    });

    worker.postMessage({ id, type, payload });
  });
}

async function initializeGlinerWorker(): Promise<boolean> {
  if (glinerWorkerReady) return true;
  if (glinerWorkerInitFailed) return false;
  if (glinerWorkerInitPromise) return glinerWorkerInitPromise;

  glinerWorkerInitPromise = (async () => {
    const operation = 'initializeGlinerWorker';
    const startTime = performance.now();
    try {
      const timeoutMs = Math.max(NEURO_SYMBOLIC.GLINER.TIMEOUT || 0, 15000);
      const ready = await sendGlinerWorkerRequest<boolean>('initialize', {}, timeoutMs);
      glinerWorkerReady = Boolean(ready);
      glinerWorkerInitFailed = !glinerWorkerReady;
      const duration = Math.round(performance.now() - startTime);
      if (glinerWorkerReady) {
        log.info(`${operation}: GLiNER worker initialized`, { operation, duration });
      } else {
        log.warn(`${operation}: GLiNER worker initialization failed`, { operation, duration });
      }
      return glinerWorkerReady;
    } catch (error) {
      glinerWorkerInitFailed = true;
      const duration = Math.round(performance.now() - startTime);
      log.error(`${operation}: Failed`, error as Error, { operation, duration });
      return false;
    }
  })();

  return glinerWorkerInitPromise;
}

/**
 * Initialize GLiNER from the official package
 */
async function initializeGliner(): Promise<boolean> {
  if (glinerInitialized) return true;
  if (glinerInitFailed) return false;
  if (glinerInitPromise) return glinerInitPromise;
  
  glinerInitPromise = (async () => {
    const operation = 'initializeGliner';
    const startTime = performance.now();
    log.debug('Starting GLiNER initialization', {
      operation,
      modelPath,
    });
    
    try {
      // Check for model file
      if (!existsSync(modelPath)) {
        log.warn(`${operation}: Model file not found`, {
          operation,
          modelPath,
          hint: 'Download from: https://huggingface.co/onnx-community/gliner_small-v2.1/tree/main/onnx',
        });
        glinerInitFailed = true;
        return false;
      }
      
      // Dynamic import of the gliner package (Node.js version)
      const { Gliner } = await import('gliner/node') as { Gliner: GlinerConstructor };
      
      gliner = new Gliner({
        tokenizerPath: NEURO_SYMBOLIC.GLINER.MODEL_PATH,
        onnxSettings: {
          modelPath,
          // Node.js version uses onnxruntime-node - no executionProvider needed
        },
        transformersSettings: {
          allowLocalModels: true,
          useBrowserCache: false,
        },
        maxWidth: NEURO_SYMBOLIC.GLINER.MAX_WIDTH || 12,
        modelType: 'span-level',  // gliner_small-v2.1 is span-level architecture
      });
      
      await gliner.initialize();
      glinerInitialized = true;
      
      const duration = Math.round(performance.now() - startTime);
      log.info(`${operation}: GLiNER initialized`, { 
        operation, 
        duration,
        modelPath,
        labelCount: GLINER_LABELS.length,
      });
      
      return true;
    } catch (error) {
      glinerInitFailed = true;
      const duration = Math.round(performance.now() - startTime);
      log.error(`${operation}: Failed`, error as Error, { 
        operation, 
        duration,
        modelPath,
      });
      return false;
    }
  })();
  
  return glinerInitPromise;
}

/**
 * Extract spans using GLiNER
 */
async function extractOpenVocabulary(text: string): Promise<NlpSpan[]> {
  if (!text || typeof text !== 'string') return [];

  const threshold = NEURO_SYMBOLIC.GLINER?.THRESHOLD || 0.3;
  const timeoutMs = NEURO_SYMBOLIC.GLINER?.TIMEOUT || 0;

  if (shouldUseGlinerWorker()) {
    if (!isGlinerReady()) {
      if (!glinerWorkerInitPromise && !glinerWorkerInitFailed) {
        void initializeGlinerWorker();
      }
      log.warn('GLiNER worker not ready, skipping open-vocabulary extraction', {
        operation: 'extractOpenVocabulary',
        glinerReady: isGlinerReady(),
        glinerInitFailed: glinerWorkerInitFailed,
        textLength: text.length,
      });
      return [];
    }

    try {
      const startTime = performance.now();
      log.debug('Starting GLiNER inference (worker)', {
        operation: 'extractOpenVocabulary',
        textLength: text.length,
        threshold,
        timeoutMs,
        labelCount: GLINER_LABELS.length,
      });

      const spans = await sendGlinerWorkerRequest<NlpSpan[]>(
        'inference',
        { text, threshold, timeoutMs },
        timeoutMs
      );

      const duration = Math.round(performance.now() - startTime);
      log.info('GLiNER inference completed (worker)', {
        operation: 'extractOpenVocabulary',
        duration,
        entityCount: spans.length,
        threshold,
      });

      return spans;
    } catch (error) {
      log.warn('extractOpenVocabulary (worker): Failed', {
        textLength: text.length,
        operation: 'extractOpenVocabulary',
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  if (!glinerInitialized || glinerInitFailed || !gliner) {
    if (!glinerInitPromise && !glinerInitFailed) {
      void initializeGliner();
    }
    log.warn('GLiNER not ready, skipping open-vocabulary extraction', {
      operation: 'extractOpenVocabulary',
      glinerReady: glinerInitialized && !glinerInitFailed,
      glinerInitFailed,
      textLength: text.length,
    });
    return [];
  }

  try {
    const startTime = performance.now();
    log.debug('Starting GLiNER inference', {
      operation: 'extractOpenVocabulary',
      textLength: text.length,
      threshold,
      timeoutMs,
      labelCount: GLINER_LABELS.length,
    });
    
    const results = await withTimeout(
      gliner.inference({
        texts: [text],
        entities: GLINER_LABELS,
        flatNer: false,
        threshold,
        multiLabel: false,
      }),
      timeoutMs
    );
    
    const entities = results[0] || [];
    const duration = Math.round(performance.now() - startTime);
    log.info('GLiNER inference completed', {
      operation: 'extractOpenVocabulary',
      duration,
      entityCount: entities.length,
      threshold,
    });
    
    return entities.map(entity => ({
      text: entity.spanText,  // Node.js version uses spanText field
      role: mapLabelToTaxonomy(entity.label),
      confidence: calibrateGlinerConfidence(entity.score, threshold),
      start: entity.start,
      end: entity.end,
      source: 'gliner' as const
    }));
  } catch (error) {
    log.warn('extractOpenVocabulary: Failed', {
      textLength: text.length,
      operation: 'extractOpenVocabulary',
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

// =============================================================================
// MERGE STRATEGY
// =============================================================================

function mergeSpans(closedSpans: NlpSpan[], openSpans: NlpSpan[]): NlpSpan[] {
  const allSpans = [...closedSpans];
  const occupied = new Set<number>();
  
  for (const span of closedSpans) {
    for (let i = span.start; i < span.end; i++) {
      occupied.add(i);
    }
  }
  
  for (const span of openSpans) {
    let hasOverlap = false;
    for (let i = span.start; i < span.end; i++) {
      if (occupied.has(i)) {
        hasOverlap = true;
        break;
      }
    }
    
    if (!hasOverlap) {
      allSpans.push(span);
      for (let i = span.start; i < span.end; i++) {
        occupied.add(i);
      }
    }
  }
  
  return allSpans;
}

function deduplicateSpans(spans: NlpSpan[]): NlpSpan[] {
  if (spans.length === 0) return [];
  
  const sorted = [...spans].sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    const lenDiff = (b.end - b.start) - (a.end - a.start);
    if (lenDiff !== 0) return lenDiff;
    return a.start - b.start;
  });
  
  const accepted: NlpSpan[] = [];
  const occupied = new Set<number>();
  
  for (const span of sorted) {
    let overlap = false;
    for (let i = span.start; i < span.end; i++) {
      if (occupied.has(i)) {
        overlap = true;
        break;
      }
    }
    
    if (!overlap) {
      accepted.push(span);
      for (let i = span.start; i < span.end; i++) {
        occupied.add(i);
      }
    }
  }
  
  return accepted.sort((a, b) => a.start - b.start);
}

// =============================================================================
// PUBLIC API
// =============================================================================

function generateGlinerLabelsFromTaxonomy(): string[] {
  const labels = new Set<string>();
  
  for (const category of Object.values(TAXONOMY)) {
    labels.add(category.label.toLowerCase());
    
    if (category.attributes) {
      for (const attrName of Object.keys(category.attributes)) {
        labels.add(attrName.replace(/_/g, ' ').toLowerCase());
      }
    }
  }
  
  for (const label of Object.keys(LABEL_TO_TAXONOMY)) {
    labels.add(label);
  }
  
  return Array.from(labels);
}

const ALL_GLINER_LABELS = generateGlinerLabelsFromTaxonomy();

/**
 * Extract semantic spans using neuro-symbolic pipeline
 */
export async function extractSemanticSpans(
  text: string, 
  options: ExtractionOptions = {}
): Promise<ExtractionResult> {
  const operation = 'extractSemanticSpans';
  const startTime = performance.now();
  const useGliner = options.useGliner ?? (NEURO_SYMBOLIC.GLINER?.ENABLED ?? false);
  
  log.debug('Starting semantic span extraction', {
    operation,
    useGliner,
    textLength: text?.length ?? 0,
  });
  
  if (!text || typeof text !== 'string') {
    return { 
      spans: [], 
      stats: { 
        phase: 'empty-input', 
        totalSpans: 0, 
        closedVocabSpans: 0, 
        openVocabSpans: 0, 
        tier1Latency: 0, 
        tier2Latency: 0, 
        totalLatency: 0 
      } 
    };
  }
  
  try {
    // Tier 1: Closed vocabulary
    const tier1Start = performance.now();
    const closedSpans = extractClosedVocabulary(text);
    const tier1Time = Math.round(performance.now() - tier1Start);
    
    // Tier 2: Open vocabulary
    let openSpans: NlpSpan[] = [];
    let tier2Time = 0;
    
    if (useGliner) {
      const tier2Start = performance.now();
      openSpans = await extractOpenVocabulary(text);
      tier2Time = Math.round(performance.now() - tier2Start);
    } else {
      log.debug('GLiNER disabled for semantic extraction', {
        operation,
        useGliner,
      });
    }
    
    // Merge and deduplicate
    const mergedSpans = mergeSpans(closedSpans, openSpans);
    const uniqueSpans = deduplicateSpans(mergedSpans);
    const outputSpans = uniqueSpans.map(({ source: _, ...span }) => span);
    
    const totalTime = Math.round(performance.now() - startTime);
    
    log.info(`${operation} completed`, {
      operation,
      duration: totalTime,
      totalSpans: outputSpans.length,
      closedVocabSpans: closedSpans.length,
      openVocabSpans: openSpans.length,
      useGliner,
    });
    
    return {
      spans: outputSpans,
      stats: {
        phase: 'neuro-symbolic',
        totalSpans: outputSpans.length,
        closedVocabSpans: closedSpans.length,
        openVocabSpans: openSpans.length,
        tier1Latency: tier1Time,
        tier2Latency: tier2Time,
        totalLatency: totalTime,
      }
    };
  } catch (error) {
    log.error(`${operation} failed`, error as Error, { operation });
    throw error;
  }
}

/**
 * Synchronous extraction using only closed vocabulary
 */
export function extractKnownSpans(text: string): NlpSpan[] {
  if (!text || typeof text !== 'string') return [];
  
  const closedSpans = extractClosedVocabulary(text);
  return deduplicateSpans(closedSpans).map(({ source: _, ...span }) => span);
}

/**
 * Get vocabulary statistics
 */
export function getVocabStats(): VocabStats {
  const stats: Record<string, { termCount: number; sampleTerms: string[] }> = {};
  let totalTerms = 0;
  
  for (const [taxonomyId, terms] of Object.entries(VOCAB)) {
    totalTerms += terms.length;
    stats[taxonomyId] = {
      termCount: terms.length,
      sampleTerms: terms.slice(0, 5)
    };
  }
  
  return {
    totalCategories: Object.keys(VOCAB).length,
    totalTerms,
    categories: stats,
    glinerLabels: ALL_GLINER_LABELS.length,
    glinerReady: isGlinerReady(),
  };
}

/**
 * Estimate coverage percentage
 */
export function estimateCoverage(text: string): number {
  if (!text) return 0;
  
  const spans = extractKnownSpans(text);
  const words = text.split(/\s+/).length;
  const coveredWords = spans.reduce((sum, span) => {
    return sum + span.text.split(/\s+/).length;
  }, 0);
  
  return Math.min(100, Math.round((coveredWords / words) * 100));
}

/**
 * Pre-warm GLiNER model
 */
export async function warmupGliner(): Promise<WarmupResult> {
  const operation = 'warmupGliner';
  const startTime = performance.now();
  
  try {
    const useWorker = shouldUseGlinerWorker();
    const warmupText = 'Low-Angle Shot, 24fps, 16:9, golden hour';
    const ready = useWorker ? await initializeGlinerWorker() : await initializeGliner();
    // Run a tiny inference once to avoid a slow/unstable first request (ONNX warm-up).
    // Do not fail warmup if inference fails; initialization success is still useful.
    if (ready) {
      if (useWorker) {
        try {
          await sendGlinerWorkerRequest(
            'warmup',
            { text: warmupText },
            Math.max(NEURO_SYMBOLIC.GLINER?.TIMEOUT || 0, 1000)
          );
        } catch (err) {
          log.warn('GLiNER warmup inference failed (worker, continuing)', {
            operation,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      } else if (gliner) {
        try {
          await withTimeout(
            gliner.inference({
              texts: [warmupText],
              entities: GLINER_LABELS,
              flatNer: false,
              threshold: NEURO_SYMBOLIC.GLINER?.THRESHOLD || 0.3,
              multiLabel: false,
            }),
            Math.max(NEURO_SYMBOLIC.GLINER?.TIMEOUT || 0, 1000)
          );
        } catch (err) {
          log.warn('GLiNER warmup inference failed (continuing)', {
            operation,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }
    const duration = Math.round(performance.now() - startTime);
    
    log.info(`${operation} ${ready ? 'completed' : 'failed'}`, {
      operation,
      duration,
      success: ready,
    });
    
    return { 
      success: ready, 
      message: ready ? 'GLiNER initialized' : 'GLiNER initialization failed'
    };
  } catch (error) {
    log.error(`${operation} failed`, error as Error, { operation });
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}
