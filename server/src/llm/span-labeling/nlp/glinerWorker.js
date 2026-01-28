import { parentPort, workerData } from 'worker_threads';
import { existsSync } from 'fs';
import { performance } from 'perf_hooks';

if (!parentPort) {
  throw new Error('GLiNER worker requires a parent port');
}

const {
  modelPath,
  tokenizerPath,
  labels,
  labelToTaxonomy,
  maxWidth,
  defaultThreshold,
  defaultTimeoutMs,
  multiLabel: defaultMultiLabel,
  labelThresholds: defaultLabelThresholds,
} = workerData || {};

let gliner = null;
let glinerInitialized = false;
let glinerInitFailed = false;
let glinerInitPromise = null;

function mapLabelToTaxonomy(label) {
  if (typeof label !== 'string') return 'subject.identity';
  const normalized = label.toLowerCase();
  return labelToTaxonomy?.[normalized] || 'subject.identity';
}

function calibrateGlinerConfidence(score, threshold) {
  const clamped = Math.max(0, Math.min(1, score));
  const t = Math.max(0, Math.min(0.99, threshold));

  const normalized = clamped <= t ? 0 : (clamped - t) / (1 - t);
  const calibrated = 0.5 + normalized * 0.5;
  return Math.round(calibrated * 100) / 100;
}

function getLabelThreshold(label, taxonomyId, fallbackThreshold, overrides) {
  if (!overrides || typeof overrides !== 'object') return fallbackThreshold;
  const normalizedLabel = typeof label === 'string' ? label.toLowerCase() : '';
  const override =
    (typeof overrides[normalizedLabel] === 'number' ? overrides[normalizedLabel] : undefined) ??
    (typeof overrides[taxonomyId] === 'number' ? overrides[taxonomyId] : undefined);

  if (typeof override === 'number' && Number.isFinite(override)) {
    return Math.max(0, Math.min(0.99, override));
  }

  return fallbackThreshold;
}

function withTimeout(promise, timeoutMs) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return promise;
  }

  return new Promise((resolve, reject) => {
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

async function initializeGliner() {
  if (glinerInitialized) return true;
  if (glinerInitFailed) return false;
  if (glinerInitPromise) return glinerInitPromise;

  glinerInitPromise = (async () => {
    const startTime = performance.now();

    try {
      if (!modelPath || !existsSync(modelPath)) {
        glinerInitFailed = true;
        return false;
      }

      const { Gliner } = await import('gliner/node');

      gliner = new Gliner({
        tokenizerPath,
        onnxSettings: {
          modelPath,
        },
        transformersSettings: {
          allowLocalModels: true,
          useBrowserCache: false,
        },
        maxWidth: maxWidth || 12,
        modelType: 'span-level',
      });

      await gliner.initialize();
      glinerInitialized = true;

      const duration = Math.round(performance.now() - startTime);
      parentPort.postMessage({
        type: 'log',
        level: 'info',
        message: 'GLiNER worker initialized',
        duration,
      });

      return true;
    } catch (error) {
      glinerInitFailed = true;
      const duration = Math.round(performance.now() - startTime);
      parentPort.postMessage({
        type: 'log',
        level: 'error',
        message: 'GLiNER worker initialization failed',
        duration,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  })();

  return glinerInitPromise;
}

async function runInference(text, thresholdOverride, timeoutOverride, options = {}) {
  if (!text || typeof text !== 'string') return [];

  const ready = await initializeGliner();
  if (!ready || !gliner) {
    throw new Error('GLiNER not initialized');
  }

  const threshold = typeof thresholdOverride === 'number' ? thresholdOverride : defaultThreshold || 0.3;
  const timeoutMs = typeof timeoutOverride === 'number' ? timeoutOverride : defaultTimeoutMs || 0;
  const labelThresholds = options?.labelThresholds || defaultLabelThresholds || {};
  const multiLabel = typeof options?.multiLabel === 'boolean' ? options.multiLabel : defaultMultiLabel;

  const results = await withTimeout(
    gliner.inference({
      texts: [text],
      entities: Array.isArray(labels) ? labels : [],
      flatNer: false,
      threshold,
      multiLabel: typeof multiLabel === 'boolean' ? multiLabel : false,
    }),
    timeoutMs
  );

  const entities = results?.[0] || [];
  return entities
    .map((entity) => {
      const taxonomyId = mapLabelToTaxonomy(entity.label);
      const labelThreshold = getLabelThreshold(entity.label, taxonomyId, threshold, labelThresholds);
      if (entity.score < labelThreshold) {
        return null;
      }
      return {
        text: entity.spanText,
        role: taxonomyId,
        confidence: calibrateGlinerConfidence(entity.score, labelThreshold),
        start: entity.start,
        end: entity.end,
        source: 'gliner',
      };
    })
    .filter(Boolean);
}

async function handleMessage(message) {
  const { id, type, payload } = message || {};
  if (typeof id !== 'number') return;

  try {
    if (type === 'initialize') {
      const ready = await initializeGliner();
      if (!ready) {
        parentPort.postMessage({ id, ok: false, error: 'GLiNER initialization failed' });
        return;
      }
      parentPort.postMessage({ id, ok: true, result: true });
      return;
    }

    if (type === 'warmup') {
      const ready = await initializeGliner();
      if (!ready) {
        parentPort.postMessage({ id, ok: false, error: 'GLiNER initialization failed' });
        return;
      }

      const warmupText = payload?.text || 'Low-Angle Shot, 24fps, 16:9, golden hour';
      try {
        await runInference(warmupText, payload?.threshold, payload?.timeoutMs, payload);
      } catch (error) {
        parentPort.postMessage({
          type: 'log',
          level: 'warn',
          message: 'GLiNER worker warmup inference failed',
          error: error instanceof Error ? error.message : String(error),
        });
      }

      parentPort.postMessage({ id, ok: true, result: true });
      return;
    }

    if (type === 'inference') {
      const spans = await runInference(payload?.text, payload?.threshold, payload?.timeoutMs, payload);
      parentPort.postMessage({ id, ok: true, result: spans });
      return;
    }

    parentPort.postMessage({ id, ok: false, error: `Unknown message type: ${type}` });
  } catch (error) {
    parentPort.postMessage({
      id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

let queue = Promise.resolve();
parentPort.on('message', (message) => {
  queue = queue.then(() => handleMessage(message)).catch((error) => {
    const id = message?.id;
    if (typeof id === 'number') {
      parentPort.postMessage({
        id,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
});
