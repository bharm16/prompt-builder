/**
 * Types for NLP span service
 * Shared type definitions used across NLP service modules
 */

/**
 * Span extracted from text
 */
export interface NlpSpan {
  text: string;
  role: string;
  confidence: number;
  start: number;
  end: number;
  source?: 'aho-corasick' | 'gliner' | 'pattern' | 'heuristic' | 'compromise' | 'lighting';
}

/**
 * GLiNER entity extracted from model
 */
export interface GlinerEntity {
  text: string;
  label: string;
  score: number;
  start: number;
  end: number;
}

/**
 * Extraction options
 */
export interface ExtractionOptions {
  useGliner?: boolean;
}

/**
 * Extraction statistics
 */
export interface ExtractionStats {
  phase: string;
  totalSpans: number;
  closedVocabSpans: number;
  openVocabSpans: number;
  patternSpans?: number;
  heuristicSpans?: number;
  compromiseSpans?: number;
  lightingSpans?: number;
  glinerReady?: boolean;
  tier1Latency: number;
  tier15Latency?: number;
  tier15bLatency?: number;
  tier2Latency: number;
  totalLatency: number;
}

/**
 * Extraction result
 */
export interface ExtractionResult {
  spans: NlpSpan[];
  stats: ExtractionStats;
}

/**
 * Vocabulary statistics
 */
export interface VocabStats {
  totalCategories: number;
  totalTerms: number;
  categories: Record<string, {
    termCount: number;
    sampleTerms: string[];
  }>;
  glinerLabels: number;
  glinerReady: boolean;
}

/**
 * Warmup result
 */
export interface WarmupResult {
  success: boolean;
  message: string;
}

/**
 * Pattern to taxonomy mapping
 */
export interface PatternInfo {
  taxonomyId: string;
  originalTerm: string;
}
