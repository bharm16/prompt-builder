import { existsSync } from 'fs';
import { Worker } from 'worker_threads';
import { NEURO_SYMBOLIC } from '@llm/span-labeling/config/SpanLabelingConfig';
import { TAXONOMY, VALID_CATEGORIES } from '#shared/taxonomy.ts';
import { log } from '../log';
import { modelPath } from '../paths';
import type { NlpSpan } from '../types';

interface GlinerResult {
  spanText: string;
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
    };
    transformersSettings?: {
      allowLocalModels?: boolean;
      useBrowserCache?: boolean;
    };
    maxWidth?: number;
    modelType?: string;
  }): GlinerInstance;
}

let gliner: GlinerInstance | null = null;
let glinerInitialized = false;
let glinerInitFailed = false;
let glinerInitPromise: Promise<boolean> | null = null;

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

const GLINER_LABEL_SPECS: Array<{ label: string; taxonomyId: string }> = [
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

  { label: 'action', taxonomyId: 'action.movement' },
  { label: 'movement', taxonomyId: 'action.movement' },
  { label: 'activity', taxonomyId: 'action.movement' },
  { label: 'gesture', taxonomyId: 'action.gesture' },
  { label: 'pose', taxonomyId: 'action.state' },
  { label: 'state', taxonomyId: 'action.state' },

  { label: 'emotion', taxonomyId: 'subject.emotion' },
  { label: 'expression', taxonomyId: 'subject.emotion' },
  { label: 'mood', taxonomyId: 'style.aesthetic' },

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

  { label: 'lighting', taxonomyId: 'lighting.quality' },
  { label: 'light source', taxonomyId: 'lighting.source' },
  { label: 'time of day', taxonomyId: 'lighting.timeOfDay' },
  { label: 'color temperature', taxonomyId: 'lighting.colorTemp' },

  { label: 'frame rate', taxonomyId: 'technical.frameRate' },
  { label: 'fps', taxonomyId: 'technical.frameRate' },
  { label: 'duration', taxonomyId: 'technical.duration' },
  { label: 'aspect ratio', taxonomyId: 'technical.aspectRatio' },
  { label: 'resolution', taxonomyId: 'technical.resolution' },

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

function calibrateGlinerConfidence(score: number, threshold: number): number {
  const clamped = Math.max(0, Math.min(1, score));
  const t = Math.max(0, Math.min(0.99, threshold));

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

export function isGlinerReady(): boolean {
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

  if (process.env.NODE_ENV === 'test' || typeof import.meta?.url !== 'string' || !import.meta.url.startsWith('file:')) {
    log.debug('Skipping worker thread in current environment.', { operation });
    return null;
  }

  try {
    const workerUrl = new URL('../glinerWorker.js', import.meta.url);
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
      log.error('GLiNER worker error.', error as Error, { operation });
      failPendingGlinerRequests('GLiNER worker error');
    });
    glinerWorker.on('exit', (code) => {
      glinerWorker = null;
      glinerWorkerReady = false;
      glinerWorkerInitPromise = null;
      glinerWorkerInitFailed = code !== 0;
      if (code !== 0) {
        log.warn('GLiNER worker exited.', { operation, code });
      }
      failPendingGlinerRequests('GLiNER worker exited');
    });

    return glinerWorker;
  } catch (error) {
    glinerWorkerInitFailed = true;
    log.error('Failed to start GLiNER worker.', error as Error, { operation });
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
        log.info('GLiNER worker initialized.', { operation, duration });
      } else {
        log.warn('GLiNER worker initialization failed.', { operation, duration });
      }
      return glinerWorkerReady;
    } catch (error) {
      glinerWorkerInitFailed = true;
      const duration = Math.round(performance.now() - startTime);
      log.error('GLiNER worker initialization failed.', error as Error, { operation, duration });
      return false;
    }
  })();

  return glinerWorkerInitPromise;
}

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
      if (!existsSync(modelPath)) {
        log.warn('GLiNER model file not found.', {
          operation,
          modelPath,
          hint: 'Download from: https://huggingface.co/onnx-community/gliner_small-v2.1/tree/main/onnx',
        });
        glinerInitFailed = true;
        return false;
      }

      const { Gliner } = await import('gliner/node') as { Gliner: GlinerConstructor };

      gliner = new Gliner({
        tokenizerPath: NEURO_SYMBOLIC.GLINER.MODEL_PATH,
        onnxSettings: {
          modelPath,
        },
        transformersSettings: {
          allowLocalModels: true,
          useBrowserCache: false,
        },
        maxWidth: NEURO_SYMBOLIC.GLINER.MAX_WIDTH || 12,
        modelType: 'span-level',
      });

      await gliner.initialize();
      glinerInitialized = true;

      const duration = Math.round(performance.now() - startTime);
      log.info('GLiNER initialized.', {
        operation,
        duration,
        modelPath,
        labelCount: GLINER_LABELS.length,
      });

      return true;
    } catch (error) {
      glinerInitFailed = true;
      const duration = Math.round(performance.now() - startTime);
      log.error('GLiNER initialization failed.', error as Error, {
        operation,
        duration,
        modelPath,
      });
      return false;
    }
  })();

  return glinerInitPromise;
}

export async function extractOpenVocabulary(text: string): Promise<NlpSpan[]> {
  if (!text || typeof text !== 'string') return [];

  const threshold = NEURO_SYMBOLIC.GLINER?.THRESHOLD || 0.3;
  const timeoutMs = NEURO_SYMBOLIC.GLINER?.TIMEOUT || 0;
  const multiLabel = NEURO_SYMBOLIC.GLINER?.MULTI_LABEL ?? false;
  const labelThresholds = NEURO_SYMBOLIC.GLINER?.LABEL_THRESHOLDS || {};

  if (shouldUseGlinerWorker()) {
    if (!isGlinerReady()) {
      if (glinerWorkerInitFailed) {
        log.warn('GLiNER worker init previously failed, skipping open-vocabulary extraction', {
          operation: 'extractOpenVocabulary',
          textLength: text.length,
        });
        return [];
      }

      const initResult = await (glinerWorkerInitPromise ?? initializeGlinerWorker());

      if (!initResult || !isGlinerReady()) {
        log.warn('GLiNER worker not ready after awaiting init, skipping open-vocabulary extraction', {
          operation: 'extractOpenVocabulary',
          glinerReady: isGlinerReady(),
          glinerInitFailed: glinerWorkerInitFailed,
          textLength: text.length,
        });
        return [];
      }
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
    if (glinerInitFailed) {
      log.warn('GLiNER init previously failed, skipping open-vocabulary extraction', {
        operation: 'extractOpenVocabulary',
        textLength: text.length,
      });
      return [];
    }

    const initResult = await (glinerInitPromise ?? initializeGliner());

    if (!initResult || !glinerInitialized || !gliner) {
      log.warn('GLiNER not ready after awaiting init, skipping open-vocabulary extraction', {
        operation: 'extractOpenVocabulary',
        glinerReady: glinerInitialized && !glinerInitFailed,
        glinerInitFailed,
        textLength: text.length,
      });
      return [];
    }
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
          text: entity.spanText,
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

export const ALL_GLINER_LABELS = generateGlinerLabelsFromTaxonomy();

export async function warmupGliner(): Promise<{ success: boolean; message: string }> {
  const operation = 'warmupGliner';
  const startTime = performance.now();

  try {
    const useWorker = shouldUseGlinerWorker();
    const warmupText = 'Low-Angle Shot, 24fps, 16:9, golden hour';
    const ready = useWorker ? await initializeGlinerWorker() : await initializeGliner();
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

    log.info('GLiNER warmup finished.', {
      operation,
      duration,
      success: ready,
      status: ready ? 'completed' : 'failed',
    });

    return {
      success: ready,
      message: ready ? 'GLiNER initialized' : 'GLiNER initialization failed'
    };
  } catch (error) {
    log.error('GLiNER warmup failed.', error as Error, { operation });
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
