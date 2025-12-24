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
import { logger } from '@infrastructure/Logger';
import { TAXONOMY, VALID_CATEGORIES, getParentCategory } from '#shared/taxonomy.ts';
import { NEURO_SYMBOLIC } from '@llm/span-labeling/config/SpanLabelingConfig';
import { SECTION_HEADER_WORDS } from '../config/SemanticConfig.js';
import type {
  NlpSpan,
  ExtractionOptions,
  ExtractionResult,
  VocabStats,
  WarmupResult,
  PatternInfo
} from './types';

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

// Brittle camera context heuristic removed as it was part of the fragile logic.
// We now rely on the dictionary precision or GLiNER context.

const WORD_CHAR_REGEX = /[A-Za-z0-9]/;

function isWordChar(value: string | undefined): boolean {
  return Boolean(value && WORD_CHAR_REGEX.test(value));
}

function hasSafeWordBoundaries(text: string, start: number, end: number): boolean {
  const before = start > 0 ? text[start - 1] : '';
  const after = end < text.length ? text[end] : '';
  const startChar = text[start];
  const endChar = text[end - 1];

  if (isWordChar(startChar) && isWordChar(before)) return false;
  if (isWordChar(endChar) && isWordChar(after)) return false;
  return true;
}

const COMMON_ASPECT_RATIOS = new Set([
  '1:1',
  '4:3',
  '3:2',
  '16:9',
  '9:16',
  '4:5',
  '2:3',
  '21:9',
  '1.33:1',
  '1.37:1',
  '1.43:1',
  '1.66:1',
  '1.75:1',
  '1.85:1',
  '2.00:1',
  '2.20:1',
  '2.35:1',
  '2.39:1',
  '2.40:1',
  '2.55:1',
  '2.59:1',
  '2.76:1'
]);

function isLikelyAspectRatio(text: string, start: number, end: number): boolean {
  const raw = text.slice(start, end);
  const normalized = raw.replace(/\s+/g, '');

  if (COMMON_ASPECT_RATIOS.has(normalized)) {
    return true;
  }

  const windowStart = Math.max(0, start - 30);
  const windowEnd = Math.min(text.length, end + 30);
  const context = text.slice(windowStart, windowEnd).toLowerCase();
  return context.includes('aspect') || context.includes('ratio');
}

const PATTERN_DEFINITIONS: Array<{
  role: string;
  regex: RegExp;
  confidence: number;
  context?: (text: string, start: number, end: number) => boolean;
}> = [
  {
    role: 'technical.frameRate',
    regex: /\b\d{2,3}(?:\.\d{1,2})?\s*fps\b/gi,
    confidence: 0.95,
  },
  {
    role: 'technical.duration',
    regex: /\b\d+(?:\.\d+)?\s*-\s*\d+(?:\.\d+)?\s*(?:s|sec|secs|seconds)\b/gi,
    confidence: 0.9,
  },
  {
    role: 'technical.duration',
    regex: /\b\d+(?:\.\d+)?\s*(?:s|sec|secs|seconds)\b/gi,
    confidence: 0.9,
  },
  {
    role: 'technical.resolution',
    regex: /\b\d{3,4}p\b/gi,
    confidence: 0.9,
  },
  {
    role: 'technical.resolution',
    regex: /\b[248]k\b/gi,
    confidence: 0.9,
  },
  {
    role: 'technical.aspectRatio',
    regex: /\b\d+(?:\.\d+)?\s*:\s*\d+(?:\.\d+)?\b/g,
    confidence: 0.9,
    context: isLikelyAspectRatio,
  },
  {
    role: 'camera.lens',
    regex: /\b\d{2,3}\s*mm\b/gi,
    confidence: 0.9,
  },
  {
    // f-stop ranges like f/1.8-f/2.8 or f/1.8-2.8 (must come before single f-stop pattern)
    role: 'camera.focus',
    regex: /\bf\s*\/\s*\d+(?:\.\d+)?\s*-\s*f?\s*\/?\s*\d+(?:\.\d+)?\b/gi,
    confidence: 0.9,
  },
  {
    role: 'camera.focus',
    regex: /\bf\s*\/\s*\d+(?:\.\d+)?\b/gi,
    confidence: 0.9,
  },
  {
    role: 'lighting.colorTemp',
    regex: /\b\d{4,5}\s*k\b/gi,
    confidence: 0.85,
  },
];

// NOTE: Brittle heuristic action extraction (extractActionSpans) and its 
// associated lists (ACTION_MOVEMENT_BASE, etc.) have been removed.
// We now rely on GLiNER (Tier 2) to extract actions semantically.

function extractPatternSpans(text: string): NlpSpan[] {
  const spans: NlpSpan[] = [];

  for (const pattern of PATTERN_DEFINITIONS) {
    pattern.regex.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.regex.exec(text)) !== null) {
      const matchedText = match[0];
      const start = match.index;
      const end = start + matchedText.length;

      if (pattern.context && !pattern.context(text, start, end)) {
        continue;
      }

      spans.push({
        text: matchedText,
        role: pattern.role,
        confidence: pattern.confidence,
        start,
        end,
        source: 'pattern',
      });
    }
  }

  return spans;
}

function extractClosedVocabulary(text: string): NlpSpan[] {
  if (!text || typeof text !== 'string') return [];
  
  const lowerText = text.toLowerCase();
  const results = ahoCorasick.search(lowerText);
  const spans: NlpSpan[] = [];
  
  for (const [endIndex, patterns] of results) {
    for (const pattern of patterns) {
      const info = patternToTaxonomy.get(pattern);
      if (!info) continue;
      
      const start = endIndex - pattern.length + 1;
      const end = endIndex + 1;
      const matchedText = text.substring(start, end);

      if (!hasSafeWordBoundaries(text, start, end)) {
        continue;
      }
      
      // Removed "Ambiguous Camera Terms" check. If it's in the vocab, we trust it.
      // Or rely on LLM to filter false positives later.
      
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

  spans.push(...extractPatternSpans(text));
  // Removed extractActionSpans(text) call
  
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

interface GlinerWorkerPendingEntry {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout | undefined;
}

const glinerWorkerPending = new Map<number, GlinerWorkerPendingEntry>();

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
  { label: 'appearance', taxonomyId: 'subject.appearance' },
  { label: 'physical trait', taxonomyId: 'subject.appearance' },
  { label: 'body part', taxonomyId: 'subject.appearance' },
  { label: 'clothing', taxonomyId: 'subject.wardrobe' },
  { label: 'wardrobe', taxonomyId: 'subject.wardrobe' },
  { label: 'outfit', taxonomyId: 'subject.wardrobe' },
  { label: 'accessory', taxonomyId: 'subject.wardrobe' },

  // Environment
  { label: 'place', taxonomyId: 'environment.location' },
  { label: 'location', taxonomyId: 'environment.location' },
  { label: 'building', taxonomyId: 'environment.location' },
  { label: 'room', taxonomyId: 'environment.location' },
  { label: 'environment', taxonomyId: 'environment.context' },
  { label: 'setting', taxonomyId: 'environment.context' },
  { label: 'scene', taxonomyId: 'environment.context' },
  { label: 'context', taxonomyId: 'environment.context' },
  { label: 'atmosphere', taxonomyId: 'environment.context' },
  { label: 'weather', taxonomyId: 'environment.weather' },
  { label: 'season', taxonomyId: 'environment.context' },

  // Actions
  { label: 'action', taxonomyId: 'action.movement' },
  { label: 'movement', taxonomyId: 'action.movement' },
  { label: 'activity', taxonomyId: 'action.movement' },
  { label: 'gesture', taxonomyId: 'action.gesture' },
  { label: 'pose', taxonomyId: 'action.state' },
  { label: 'state', taxonomyId: 'action.state' },

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
  { label: 'color grading', taxonomyId: 'style.colorGrade' },
  { label: 'color palette', taxonomyId: 'style.colorGrade' },
  { label: 'palette', taxonomyId: 'style.colorGrade' },
  { label: 'tones', taxonomyId: 'style.colorGrade' },
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
  { label: 'sound', taxonomyId: 'audio.ambient' },
  { label: 'ambient sound', taxonomyId: 'audio.ambient' },
  { label: 'ambience', taxonomyId: 'audio.ambient' },
  { label: 'ambiance', taxonomyId: 'audio.ambient' },
  { label: 'sound effect', taxonomyId: 'audio.soundEffect' },
  { label: 'sfx', taxonomyId: 'audio.soundEffect' },
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

function getLabelThreshold(label: string, taxonomyId: string, defaultThreshold: number): number {
  const overrides = NEURO_SYMBOLIC.GLINER?.LABEL_THRESHOLDS || {};
  const labelKey = label.toLowerCase();
  const override =
    (typeof overrides[labelKey] === 'number' ? overrides[labelKey] : undefined) ??
    (typeof overrides[taxonomyId] === 'number' ? overrides[taxonomyId] : undefined);

  if (typeof override === 'number' && Number.isFinite(override)) {
    return Math.max(0, Math.min(0.99, override));
  }

  return defaultThreshold;
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
      workerData: {
        modelPath,
        tokenizerPath: NEURO_SYMBOLIC.GLINER.MODEL_PATH,
        labels: GLINER_LABELS,
        labelToTaxonomy: LABEL_TO_TAXONOMY,
        maxWidth: NEURO_SYMBOLIC.GLINER.MAX_WIDTH || 12,
        defaultThreshold: NEURO_SYMBOLIC.GLINER.THRESHOLD || 0.3,
        defaultTimeoutMs: NEURO_SYMBOLIC.GLINER.TIMEOUT || 0,
        multiLabel: NEURO_SYMBOLIC.GLINER.MULTI_LABEL || false,
        labelThresholds: NEURO_SYMBOLIC.GLINER.LABEL_THRESHOLDS || {},
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
  const multiLabel = NEURO_SYMBOLIC.GLINER?.MULTI_LABEL ?? false;
  const labelThresholds = NEURO_SYMBOLIC.GLINER?.LABEL_THRESHOLDS || {};

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
        { text, threshold, timeoutMs, multiLabel, labelThresholds },
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
        multiLabel,
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
    
    return entities
      .map((entity): NlpSpan | null => {
        const taxonomyId = mapLabelToTaxonomy(entity.label);
        const labelThreshold = getLabelThreshold(entity.label, taxonomyId, threshold);
        if (entity.score < labelThreshold) {
          return null;
        }

        return {
          text: entity.spanText,  // Node.js version uses spanText field
          role: taxonomyId,
          confidence: calibrateGlinerConfidence(entity.score, labelThreshold),
          start: entity.start,
          end: entity.end,
          source: 'gliner' as const
        };
      })
      .filter((span): span is NlpSpan => span !== null);
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
// SECTION HEADER FILTER
// =============================================================================

/**
 * Check if a span appears to be a section header rather than actual content.
 * Section headers are standalone labels like "**Camera:**" or "## Style"
 */
function isSectionHeader(text: string, span: NlpSpan): boolean {
  const spanText = span.text.trim();
  const spanLower = spanText.toLowerCase();
  
  // Only check single-word or very short spans (headers are typically 1-2 words)
  const wordCount = spanText.split(/\s+/).length;
  if (wordCount > 2) return false;
  
  // Check if it's a known header word
  if (!SECTION_HEADER_WORDS.has(spanLower)) return false;
  
  // Look at the context around the span
  const contextBefore = text.slice(Math.max(0, span.start - 10), span.start);
  const contextAfter = text.slice(span.end, Math.min(text.length, span.end + 5));
  
  // Check for markdown header patterns: "## Camera" or "**Camera"
  if (/(?:^|\n)\s*(?:#{1,3}\s*|\*\*\s*)$/.test(contextBefore)) {
    return true;
  }
  
  // Check for label patterns: "Camera:" or "Camera**:" or "**Camera:**"
  if (/^\s*\**\s*:/.test(contextAfter)) {
    return true;
  }
  
  // Check for line-start header: starts at beginning of line and followed by colon
  if (/(?:^|\n)\s*$/.test(contextBefore) && /^\s*:/.test(contextAfter)) {
    return true;
  }
  
  return false;
}

/**
 * Filter out spans that are section headers
 */
function filterSectionHeaders(text: string, spans: NlpSpan[]): NlpSpan[] {
  return spans.filter(span => !isSectionHeader(text, span));
}

// =============================================================================
// MERGE STRATEGY
// =============================================================================

function mergeSpans(closedSpans: NlpSpan[], openSpans: NlpSpan[]): NlpSpan[] {
  return deduplicateSpans([...closedSpans, ...openSpans]);
}

function deduplicateSpans(spans: NlpSpan[]): NlpSpan[] {
  if (spans.length === 0) return [];

  const seen = new Set<string>();
  const sorted = [...spans].sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    if (a.end !== b.end) return b.end - a.end;
    return b.confidence - a.confidence;
  });

  const accepted: NlpSpan[] = [];
  for (const span of sorted) {
    const key = `${span.start}|${span.end}|${span.role}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    const overlaps: Array<{ index: number; span: NlpSpan }> = [];
    const spanParent = getParentCategory(span.role) || span.role;

    for (let i = accepted.length - 1; i >= 0; i--) {
      const existing = accepted[i];
      if (!existing) continue;
      if (existing.end <= span.start) break;

      const existingParent = getParentCategory(existing.role) || existing.role;
      if (existingParent !== spanParent) {
        continue;
      }

      const overlap = span.start < existing.end && existing.start < span.end;
      if (overlap) {
        overlaps.push({ index: i, span: existing });
      }
    }

    if (overlaps.length === 0) {
      accepted.push(span);
      continue;
    }

    const preferClosed = NEURO_SYMBOLIC.MERGE.CLOSED_VOCAB_PRIORITY;
    const strategy = NEURO_SYMBOLIC.MERGE.OVERLAP_STRATEGY;

    const getSourcePriority = (source?: NlpSpan['source']): number => {
      if (!preferClosed) return 0;
      if (source === 'aho-corasick' || source === 'pattern') return 2;
      if (source === 'gliner') return 1;
      if (source === 'heuristic') return 0;
      return 0;
    };

    const getSpecificity = (role: string): number => role.split('.').length;

    const isPreferred = (candidate: NlpSpan, current: NlpSpan): boolean => {
      const candidateSource = getSourcePriority(candidate.source);
      const currentSource = getSourcePriority(current.source);
      if (candidateSource !== currentSource) {
        return candidateSource > currentSource;
      }

      const candidateSpecificity = getSpecificity(candidate.role);
      const currentSpecificity = getSpecificity(current.role);
      if (candidateSpecificity !== currentSpecificity) {
        return candidateSpecificity > currentSpecificity;
      }

      const candidateLength = candidate.end - candidate.start;
      const currentLength = current.end - current.start;

      if (strategy === 'longest-match') {
        if (candidateLength !== currentLength) return candidateLength > currentLength;
        if (candidate.confidence !== current.confidence) return candidate.confidence > current.confidence;
      } else {
        if (candidate.confidence !== current.confidence) return candidate.confidence > current.confidence;
        if (candidateLength !== currentLength) return candidateLength > currentLength;
      }

      return candidate.start <= current.start;
    };

    let winner = span;
    for (const overlap of overlaps) {
      if (!isPreferred(winner, overlap.span)) {
        winner = overlap.span;
      }
    }

    if (winner === span) {
      overlaps
        .sort((a, b) => b.index - a.index)
        .forEach(({ index }) => {
          accepted.splice(index, 1);
        });
      accepted.push(span);
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
    const patternSpans = closedSpans.filter((span) => span.source === 'pattern').length;
    const heuristicSpans = closedSpans.filter((span) => span.source === 'heuristic').length;
    
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
    
    // Merge and deduplicate with role-aware overlap resolution
    const mergedSpans = mergeSpans(closedSpans, openSpans);
    
    // Filter out section headers (e.g., "**Camera:**" -> "Camera" false positive)
    const filteredSpans = filterSectionHeaders(text, mergedSpans);
    const outputSpans = filteredSpans.map(({ source: _, ...span }) => span);
    
    const totalTime = Math.round(performance.now() - startTime);
    
    log.info(`${operation} completed`, {
      operation,
      duration: totalTime,
      totalSpans: outputSpans.length,
      closedVocabSpans: closedSpans.length,
      patternSpans,
      heuristicSpans,
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
        patternSpans,
        heuristicSpans,
        glinerReady: isGlinerReady(),
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
 * Report whether GLiNER is initialized and ready
 */
export function isGlinerAvailable(): boolean {
  return isGlinerReady();
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