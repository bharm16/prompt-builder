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
import { logger } from '@infrastructure/Logger.js';
import { TAXONOMY } from '#shared/taxonomy.ts';
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

// Load vocabulary
let VOCAB: Record<string, string[]> = {};
try {
  VOCAB = JSON.parse(readFileSync(vocabPath, 'utf-8'));
} catch (e) {
  logger.warn('NLP Service: Could not load vocab.json', {
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

/** Labels for video prompt entity extraction */
const GLINER_LABELS = [
  'person', 'character', 'animal', 'object',
  'place', 'location', 'environment',
  'action', 'movement', 'gesture',
  'emotion', 'mood', 'atmosphere',
  'style', 'aesthetic', 'lighting'
];

/** Map GLiNER labels to taxonomy IDs */
const LABEL_TO_TAXONOMY: Record<string, string> = {
  person: 'subject.identity',
  character: 'subject.identity',
  animal: 'subject.identity',
  object: 'subject.identity',
  place: 'environment.location',
  location: 'environment.location',
  environment: 'environment.location',
  action: 'action.movement',
  movement: 'action.movement',
  gesture: 'action.gesture',
  emotion: 'subject.emotion',
  mood: 'style.aesthetic',
  atmosphere: 'lighting.quality',
  style: 'style.aesthetic',
  aesthetic: 'style.aesthetic',
  lighting: 'lighting.quality'
};

function mapLabelToTaxonomy(label: string): string {
  return LABEL_TO_TAXONOMY[label.toLowerCase()] || 'subject.identity';
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
    
    try {
      // Check for model file
      if (!existsSync(modelPath)) {
        logger.warn(`${operation}: Model file not found`, {
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
      logger.info(`${operation}: GLiNER initialized`, { operation, duration });
      
      return true;
    } catch (error) {
      glinerInitFailed = true;
      const duration = Math.round(performance.now() - startTime);
      logger.error(`${operation}: Failed`, error as Error, { operation, duration });
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
  
  const ready = await initializeGliner();
  if (!ready || !gliner) return [];
  
  try {
    const threshold = NEURO_SYMBOLIC.GLINER?.THRESHOLD || 0.3;
    
    const results = await gliner.inference({
      texts: [text],
      entities: GLINER_LABELS,
      flatNer: false,
      threshold,
      multiLabel: false,
    });
    
    const entities = results[0] || [];
    
    return entities.map(entity => ({
      text: entity.spanText,  // Node.js version uses spanText field
      role: mapLabelToTaxonomy(entity.label),
      confidence: Math.round(entity.score * 100) / 100,
      start: entity.start,
      end: entity.end,
      source: 'gliner' as const
    }));
  } catch (error) {
    logger.warn('extractOpenVocabulary: Failed', {
      textLength: text.length,
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
  
  const useGliner = options.useGliner ?? (NEURO_SYMBOLIC.GLINER?.ENABLED ?? false);
  
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
    }
    
    // Merge and deduplicate
    const mergedSpans = mergeSpans(closedSpans, openSpans);
    const uniqueSpans = deduplicateSpans(mergedSpans);
    const outputSpans = uniqueSpans.map(({ source: _, ...span }) => span);
    
    const totalTime = Math.round(performance.now() - startTime);
    
    logger.info(`${operation} completed`, {
      operation,
      duration: totalTime,
      totalSpans: outputSpans.length,
      closedVocabSpans: closedSpans.length,
      openVocabSpans: openSpans.length,
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
    logger.error(`${operation} failed`, error as Error, { operation });
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
    glinerReady: glinerInitialized && !glinerInitFailed,
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
    const ready = await initializeGliner();
    const duration = Math.round(performance.now() - startTime);
    
    logger.info(`${operation} ${ready ? 'completed' : 'failed'}`, {
      operation,
      duration,
      success: ready,
    });
    
    return { 
      success: ready, 
      message: ready ? 'GLiNER initialized' : 'GLiNER initialization failed'
    };
  } catch (error) {
    logger.error(`${operation} failed`, error as Error, { operation });
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}
