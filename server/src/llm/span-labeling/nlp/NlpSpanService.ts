/**
 * NLP Span Service - Neuro-Symbolic Architecture v3 (TypeScript)
 *
 * 5-Tier extraction pipeline:
 * 1.   Aho-Corasick (Tier 1): Closed vocabulary - O(N) single pass, 100% precision
 * 1.5a Compromise (Tier 1.5a): Verb phrase extraction for actions
 * 1.5b Lighting (Tier 1.5b): Pattern-based lighting extraction with semantic classification
 * 2.   GLiNER (Tier 2): Open vocabulary - via official 'gliner' npm package
 * 3.   LLM Fallback (Tier 3): Complex reasoning - handled by SpanLabelingService
 *
 * REQUIRES: npm install gliner
 */

import { NEURO_SYMBOLIC, COMPROMISE, LIGHTING } from '@llm/span-labeling/config/SpanLabelingConfig';
import {
  extractActionSpans as extractCompromiseSpans,
  warmupCompromise,
  isCompromiseAvailable,
  type CompromiseConfig
} from './CompromiseService.js';
import {
  extractLightingSpans,
  warmupLightingService,
  isLightingServiceAvailable,
  type LightingConfig
} from './LightingService.js';
import type {
  NlpSpan,
  ExtractionOptions,
  ExtractionResult,
  VocabStats,
  WarmupResult
} from './types';
import { log } from './log';
import { extractClosedVocabulary } from './tier1/closedVocabulary';
import { filterSectionHeaders } from './filters/sectionHeaders';
import { mergeSpans, deduplicateSpans } from './merge';
import { extractOpenVocabulary, isGlinerReady, warmupGliner as warmupGlinerModel, ALL_GLINER_LABELS } from './tier2/gliner';
import { VOCAB } from './vocab';

export async function extractSemanticSpans(
  text: string,
  options: ExtractionOptions = {}
): Promise<ExtractionResult> {
  const operation = 'extractSemanticSpans';
  const startTime = performance.now();
  const promptOutputOnly = process.env.PROMPT_OUTPUT_ONLY === 'true';
  const useGliner = !promptOutputOnly &&
    (options.useGliner ?? (NEURO_SYMBOLIC.GLINER?.ENABLED ?? false));
  const useCompromise = COMPROMISE?.ENABLED ?? true;
  const useLighting = LIGHTING?.ENABLED ?? true;

  log.debug('Starting semantic span extraction', {
    operation,
    useGliner,
    useCompromise,
    useLighting,
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
        tier15Latency: 0,
        tier15bLatency: 0,
        tier2Latency: 0,
        totalLatency: 0
      }
    };
  }

  try {
    const tier1Start = performance.now();
    const closedSpans = extractClosedVocabulary(text);
    const tier1Time = Math.round(performance.now() - tier1Start);
    const patternSpans = closedSpans.filter((span) => span.source === 'pattern').length;
    const heuristicSpans = closedSpans.filter((span) => span.source === 'heuristic').length;

    let compromiseSpans: NlpSpan[] = [];
    let tier15aTime = 0;

    if (useCompromise) {
      const tier15aStart = performance.now();
      const compromiseConfig: Partial<CompromiseConfig> = {
        enabled: true,
        minConfidence: COMPROMISE?.MIN_CONFIDENCE ?? 0.75,
        extractVerbPhrases: COMPROMISE?.EXTRACT_VERB_PHRASES ?? true,
        extractGerunds: COMPROMISE?.EXTRACT_GERUNDS ?? true,
        includeAdverbs: COMPROMISE?.INCLUDE_ADVERBS ?? true,
        includeObjects: COMPROMISE?.INCLUDE_OBJECTS ?? true,
        maxPhraseWords: COMPROMISE?.MAX_PHRASE_WORDS ?? 5,
      };
      const compromiseResult = await extractCompromiseSpans(text, compromiseConfig);
      compromiseSpans = compromiseResult.spans;
      tier15aTime = compromiseResult.stats.latencyMs;

      log.debug('Compromise extraction completed', {
        operation,
        spansExtracted: compromiseSpans.length,
        verbPhrases: compromiseResult.stats.verbPhrases,
        gerunds: compromiseResult.stats.gerunds,
        latencyMs: tier15aTime,
      });
    }

    let lightingSpans: NlpSpan[] = [];
    let tier15bTime = 0;

    if (useLighting) {
      const tier15bStart = performance.now();
      const lightingConfig: Partial<LightingConfig> = {
        enabled: true,
        minConfidence: LIGHTING?.MIN_CONFIDENCE ?? 0.70,
        maxPhraseWords: LIGHTING?.MAX_PHRASE_WORDS ?? 5,
      };
      const lightingResult = await extractLightingSpans(text, lightingConfig);
      lightingSpans = lightingResult.spans;
      tier15bTime = lightingResult.stats.latencyMs;

      log.debug('Lighting extraction completed', {
        operation,
        spansExtracted: lightingSpans.length,
        shadowPhrases: lightingResult.stats.shadowPhrases,
        lightPhrases: lightingResult.stats.lightPhrases,
        latencyMs: tier15bTime,
      });
    }

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

    const tier1AndCompromise = mergeSpans(closedSpans, compromiseSpans);
    const tier1AndHalfSpans = mergeSpans(tier1AndCompromise, lightingSpans);
    const mergedSpans = mergeSpans(tier1AndHalfSpans, openSpans);

    const filteredSpans = filterSectionHeaders(text, mergedSpans);
    const outputSpans = filteredSpans.map(({ source: _, ...span }) => span);

    const totalTime = Math.round(performance.now() - startTime);

    log.info(`${operation} completed`, {
      operation,
      duration: totalTime,
      totalSpans: outputSpans.length,
      closedVocabSpans: closedSpans.length,
      compromiseSpans: compromiseSpans.length,
      lightingSpans: lightingSpans.length,
      patternSpans,
      heuristicSpans,
      openVocabSpans: openSpans.length,
      useGliner,
      useCompromise,
      useLighting,
    });

    return {
      spans: outputSpans,
      stats: {
        phase: 'neuro-symbolic',
        totalSpans: outputSpans.length,
        closedVocabSpans: closedSpans.length,
        openVocabSpans: openSpans.length,
        compromiseSpans: compromiseSpans.length,
        lightingSpans: lightingSpans.length,
        patternSpans,
        heuristicSpans,
        glinerReady: isGlinerReady(),
        tier1Latency: tier1Time,
        tier15Latency: tier15aTime,
        tier15bLatency: tier15bTime,
        tier2Latency: tier2Time,
        totalLatency: totalTime,
      }
    };
  } catch (error) {
    log.error(`${operation} failed`, error as Error, { operation });
    throw error;
  }
}

export function extractKnownSpans(text: string): NlpSpan[] {
  if (!text || typeof text !== 'string') return [];

  const closedSpans = extractClosedVocabulary(text);
  return deduplicateSpans(closedSpans).map(({ source: _, ...span }) => span);
}

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

export function estimateCoverage(text: string): number {
  if (!text) return 0;

  const spans = extractKnownSpans(text);
  const words = text.split(/\s+/).length;
  const coveredWords = spans.reduce((sum, span) => {
    return sum + span.text.split(/\s+/).length;
  }, 0);

  return Math.min(100, Math.round((coveredWords / words) * 100));
}

export function isGlinerAvailable(): boolean {
  return isGlinerReady();
}

export async function warmupGliner(): Promise<WarmupResult> {
  return warmupGlinerModel();
}

export async function warmupNlpServices(): Promise<{
  gliner: WarmupResult;
  compromise: { success: boolean; latencyMs: number };
  lighting: { success: boolean; latencyMs: number };
}> {
  const operation = 'warmupNlpServices';
  log.info(`${operation}: Starting warmup of all NLP services`);

  const glinerResult = await warmupGliner();
  const compromiseResult = await warmupCompromise();
  const lightingResult = await warmupLightingService();

  log.info(`${operation}: Warmup complete`, {
    gliner: glinerResult.success,
    compromise: compromiseResult.success,
    compromiseLatencyMs: compromiseResult.latencyMs,
    lighting: lightingResult.success,
    lightingLatencyMs: lightingResult.latencyMs,
  });

  return {
    gliner: glinerResult,
    compromise: compromiseResult,
    lighting: lightingResult
  };
}

export { isCompromiseAvailable };
export { isLightingServiceAvailable };
