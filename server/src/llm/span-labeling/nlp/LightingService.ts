/**
 * Lighting Extraction Service - Pattern-Based Lighting Span Extraction (Tier 1.5)
 *
 * Uses Compromise.js for grammatical pattern matching to extract lighting-related spans.
 * Positioned alongside CompromiseService in the pipeline (Tier 1.5).
 *
 * Architecture:
 * 1. Extract using POS patterns: #Adjective* + lighting_noun
 * 2. Classify using semantic embeddings (LightingSemantics.ts)
 *
 * Why this scales:
 * - Only need a small set of anchor NOUNS (shadow, light, glow) - closed class
 * - Adjectives are open class - handled by semantic similarity, not lists
 * - "gentle shadows" works because it's semantically similar to "soft shadows" prototype
 *
 * Extracts patterns like:
 * - "soft shadows" → lighting.quality
 * - "warm ambient glow" → lighting.quality
 * - "golden hour light" → lighting.timeOfDay
 * - "neon light" → lighting.source
 */

import nlp from 'compromise';
import { logger } from '@infrastructure/Logger';
import type { NlpSpan } from './types';
import {
  classifyLightingSemantically,
  lightingClassToTaxonomy,
  isLightingSemanticsReady,
  warmupLightingSemantics,
} from './LightingSemantics';

const log = logger.child({ service: 'LightingService' });

// =============================================================================
// CONFIGURATION
// =============================================================================

export interface LightingConfig {
  enabled: boolean;
  minConfidence: number;
  maxPhraseWords: number;
}

export const DEFAULT_LIGHTING_CONFIG: LightingConfig = {
  enabled: true,
  minConfidence: 0.70,
  maxPhraseWords: 5,
};

// =============================================================================
// ANCHOR NOUNS (The only "list" we need - stable linguistic concepts)
// =============================================================================

/**
 * Lighting anchor nouns - these are the stable set of nouns that indicate
 * a phrase is about lighting. This is a CLOSED class (unlike adjectives).
 *
 * We pattern match: #Adjective* + anchor_noun
 */
const SHADOW_NOUNS = new Set([
  'shadow', 'shadows',
  'silhouette', 'silhouettes',
]);

const LIGHT_NOUNS = new Set([
  'light', 'lights', 'lighting',
  'glow', 'glows',
  'highlight', 'highlights',
  'illumination',
  'luminance',
  'radiance',
  'beam', 'beams',
  'ray', 'rays',
]);

const ALL_LIGHTING_NOUNS = new Set([...SHADOW_NOUNS, ...LIGHT_NOUNS]);

/**
 * Words that should NOT be extracted even if they contain lighting nouns
 * (e.g., "traffic light" is not about lighting quality)
 */
const EXCLUDED_COMPOUNDS = new Set([
  'traffic light',
  'traffic lights',
  'light switch',
  'light bulb',
  'light fixture',
  'light meter',
  'highlight reel',
  'flashlight', // This is a subject/prop, not lighting description
]);

/**
 * Context words that indicate the lighting phrase is about the light SOURCE
 * rather than quality (helps with classification disambiguation)
 */
const SOURCE_INDICATORS = new Set([
  'from', 'through', 'via', 'by', 'of',
]);

// =============================================================================
// EXTRACTION LOGIC
// =============================================================================

interface LightingMatch {
  text: string;
  start: number;
  end: number;
  anchorNoun: string;
  isShadow: boolean;
}

/**
 * Find the position of a phrase in the original text
 */
function findPhrasePosition(
  text: string,
  phrase: string,
  afterIndex: number = 0
): { start: number; end: number } | null {
  const lowerText = text.toLowerCase();
  const lowerPhrase = phrase.toLowerCase().trim();

  let start = lowerText.indexOf(lowerPhrase, afterIndex);

  if (start === -1) {
    // Try without extra whitespace
    const normalizedPhrase = lowerPhrase.replace(/\s+/g, ' ');
    start = lowerText.indexOf(normalizedPhrase, afterIndex);
  }

  if (start === -1) return null;

  return {
    start,
    end: start + lowerPhrase.length,
  };
}

/**
 * Check if a word is a lighting anchor noun
 */
function isLightingNoun(word: string): boolean {
  return ALL_LIGHTING_NOUNS.has(word.toLowerCase());
}

/**
 * Check if a phrase should be excluded
 */
function isExcludedPhrase(phrase: string): boolean {
  const lower = phrase.toLowerCase();
  for (const excluded of EXCLUDED_COMPOUNDS) {
    if (lower.includes(excluded)) return true;
  }
  return false;
}

/**
 * Extract lighting phrases using Compromise POS patterns
 *
 * Pattern: #Adjective* #Noun (where noun is a lighting anchor)
 */
function extractLightingPatterns(
  doc: ReturnType<typeof nlp>,
  text: string,
  config: LightingConfig
): LightingMatch[] {
  const matches: LightingMatch[] = [];
  const seenPositions = new Set<string>();

  // Strategy 1: Find adjective(s) + lighting noun patterns
  // e.g., "soft shadows", "warm ambient glow", "harsh dramatic light"
  doc.match('#Adjective+ #Noun').forEach((match) => {
    const matchText = match.text().trim();
    const words = matchText.split(/\s+/);

    if (words.length > config.maxPhraseWords) return;

    // Check if the last word (noun) is a lighting anchor
    const lastWord = words[words.length - 1]?.toLowerCase() || '';
    if (!isLightingNoun(lastWord)) return;

    // Check for exclusions
    if (isExcludedPhrase(matchText)) return;

    const pos = findPhrasePosition(text, matchText);
    if (pos) {
      const key = `${pos.start}-${pos.end}`;
      if (!seenPositions.has(key)) {
        seenPositions.add(key);
        matches.push({
          ...pos,
          text: text.slice(pos.start, pos.end),
          anchorNoun: lastWord,
          isShadow: SHADOW_NOUNS.has(lastWord),
        });
      }
    }
  });

  // Strategy 2: Find standalone lighting nouns with preceding adjectives
  // This catches cases where Compromise might not tag perfectly
  doc.match('#Noun').forEach((match) => {
    const nounText = match.text().trim().toLowerCase();

    if (!isLightingNoun(nounText)) return;

    // Look for adjectives before this noun in the original text
    const nounPos = findPhrasePosition(text, nounText);
    if (!nounPos) return;

    // Check if we already have this position from Strategy 1
    const key = `${nounPos.start}-${nounPos.end}`;
    if (seenPositions.has(key)) return;

    // Look backwards for adjectives
    const beforeText = text.slice(Math.max(0, nounPos.start - 50), nounPos.start).trim();
    const beforeWords = beforeText.split(/\s+/).slice(-3); // Last 3 words before noun

    // Try to find adjective + noun pattern
    for (let i = beforeWords.length - 1; i >= 0; i--) {
      const potentialPhrase = [...beforeWords.slice(i), nounText].join(' ');
      const phraseDoc = nlp(potentialPhrase);

      // Check if it matches adjective + noun pattern
      if (phraseDoc.match('#Adjective+ #Noun').found) {
        const phrasePos = findPhrasePosition(text, potentialPhrase);
        if (phrasePos && !isExcludedPhrase(potentialPhrase)) {
          const phraseKey = `${phrasePos.start}-${phrasePos.end}`;
          if (!seenPositions.has(phraseKey)) {
            seenPositions.add(phraseKey);
            matches.push({
              ...phrasePos,
              text: text.slice(phrasePos.start, phrasePos.end),
              anchorNoun: nounText,
              isShadow: SHADOW_NOUNS.has(nounText),
            });
          }
        }
        break;
      }
    }
  });

  return matches;
}

/**
 * Remove overlapping matches, keeping the longest/most specific
 */
function deduplicateMatches(matches: LightingMatch[]): LightingMatch[] {
  if (matches.length === 0) return [];

  // Sort by start position, then by length (longer first)
  const sorted = [...matches].sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return (b.end - b.start) - (a.end - a.start);
  });

  const result: LightingMatch[] = [];
  let lastEnd = -1;

  for (const match of sorted) {
    if (match.start < lastEnd) {
      // Overlapping - check if this is longer
      const lastMatch = result[result.length - 1];
      if (lastMatch && match.start === lastMatch.start &&
          (match.end - match.start) > (lastMatch.end - lastMatch.start)) {
        result.pop();
        result.push(match);
        lastEnd = match.end;
      }
      continue;
    }

    result.push(match);
    lastEnd = match.end;
  }

  return result;
}

// =============================================================================
// PUBLIC API
// =============================================================================

export interface LightingExtractionResult {
  spans: NlpSpan[];
  stats: {
    patternsFound: number;
    shadowPhrases: number;
    lightPhrases: number;
    totalExtracted: number;
    latencyMs: number;
  };
}

/**
 * Extract lighting spans using pattern matching + semantic classification
 */
export async function extractLightingSpans(
  text: string,
  config: Partial<LightingConfig> = {}
): Promise<LightingExtractionResult> {
  const startTime = performance.now();
  const mergedConfig = { ...DEFAULT_LIGHTING_CONFIG, ...config };

  if (!mergedConfig.enabled || !text || typeof text !== 'string') {
    return {
      spans: [],
      stats: { patternsFound: 0, shadowPhrases: 0, lightPhrases: 0, totalExtracted: 0, latencyMs: 0 },
    };
  }

  try {
    const doc = nlp(text);

    // Extract patterns
    const matches = extractLightingPatterns(doc, text, mergedConfig);
    const dedupedMatches = deduplicateMatches(matches);

    const shadowCount = dedupedMatches.filter(m => m.isShadow).length;
    const lightCount = dedupedMatches.length - shadowCount;

    // Classify each match semantically and convert to NlpSpan
    const spans: NlpSpan[] = await Promise.all(
      dedupedMatches.map(async (match) => {
        // Use semantic classification to determine the lighting category
        const { lightingClass, confidence } = await classifyLightingSemantically(match.text);
        const taxonomyId = lightingClassToTaxonomy(lightingClass);

        // Use the higher of semantic confidence or min confidence
        const finalConfidence = Math.max(confidence, mergedConfig.minConfidence);

        return {
          text: match.text,
          role: taxonomyId,
          confidence: Math.round(finalConfidence * 100) / 100,
          start: match.start,
          end: match.end,
          source: 'lighting' as const,
        };
      })
    );

    const latencyMs = Math.round(performance.now() - startTime);

    log.debug('Lighting extraction completed', {
      operation: 'extractLightingSpans',
      textLength: text.length,
      patternsFound: dedupedMatches.length,
      shadowPhrases: shadowCount,
      lightPhrases: lightCount,
      totalExtracted: spans.length,
      latencyMs,
    });

    return {
      spans,
      stats: {
        patternsFound: dedupedMatches.length,
        shadowPhrases: shadowCount,
        lightPhrases: lightCount,
        totalExtracted: spans.length,
        latencyMs,
      },
    };
  } catch (error) {
    log.error('Lighting extraction failed', error as Error, {
      operation: 'extractLightingSpans',
      textLength: text.length,
    });

    return {
      spans: [],
      stats: { patternsFound: 0, shadowPhrases: 0, lightPhrases: 0, totalExtracted: 0, latencyMs: 0 },
    };
  }
}

/**
 * Check if LightingService is available and working
 */
export function isLightingServiceAvailable(): boolean {
  try {
    const doc = nlp('test sentence');
    return doc !== null && typeof doc.match === 'function';
  } catch {
    return false;
  }
}

/**
 * Warm up LightingService and semantic classifier
 */
export async function warmupLightingService(): Promise<{ success: boolean; latencyMs: number }> {
  const startTime = performance.now();

  try {
    // Warm up the semantic classifier first
    await warmupLightingSemantics();

    // Run a sample extraction
    const result = await extractLightingSpans(
      'The scene features soft shadows and warm ambient glow with golden hour light.'
    );

    const latencyMs = Math.round(performance.now() - startTime);

    log.info('LightingService warmup completed', {
      operation: 'warmupLightingService',
      spansExtracted: result.spans.length,
      semanticsReady: isLightingSemanticsReady(),
      latencyMs,
    });

    return { success: result.spans.length > 0, latencyMs };
  } catch (error) {
    log.error('LightingService warmup failed', error as Error, {
      operation: 'warmupLightingService',
    });
    return { success: false, latencyMs: 0 };
  }
}

export default {
  extractLightingSpans,
  isLightingServiceAvailable,
  warmupLightingService,
  DEFAULT_LIGHTING_CONFIG,
};
