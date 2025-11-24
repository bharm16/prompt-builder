import nlp from 'compromise';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

/**
 * NLP Span Service - Fast Dictionary-Based Span Extraction
 * 
 * Replaces expensive LLM calls with deterministic vocabulary matching
 * using compromise.js for 60-70% of span labeling tasks.
 * 
 * Expected Performance:
 * - Latency: ~5ms (vs ~500-2000ms for LLM)
 * - Cost: $0 (vs $0.0001-0.001 per request)
 * - Accuracy: 100% for known terms (deterministic)
 */

// Load vocabulary lists
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const vocabPath = join(__dirname, '../data/vocab.json');
const VOCAB = JSON.parse(readFileSync(vocabPath, 'utf-8'));

// Build reverse lookup: term -> taxonomy ID
// This allows us to quickly find which taxonomy category a matched term belongs to
const TERM_TO_TAXONOMY = new Map();

// Build case-insensitive patterns for matching
// Store both the original term and its lowercase version
const TAXONOMY_PATTERNS = {};

Object.entries(VOCAB).forEach(([taxonomyId, terms]) => {
  TAXONOMY_PATTERNS[taxonomyId] = terms.map(term => ({
    original: term,
    lower: term.toLowerCase(),
    pattern: escapeRegExp(term)
  }));
  
  terms.forEach(term => {
    TERM_TO_TAXONOMY.set(term.toLowerCase(), taxonomyId);
  });
});

/**
 * Escape special regex characters in a string
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Configure compromise.js with custom tags for our taxonomy
 * This allows compromise to recognize our technical terms
 */
nlp.plugin((Doc, world) => {
  const words = {};
  
  // Create custom tags for each taxonomy category
  // e.g., 'camera.movement' -> 'CameraMovement' tag
  Object.entries(VOCAB).forEach(([taxonomyId, terms]) => {
    const tagName = taxonomyId
      .split('.')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
    
    // Register each term with its tag
    terms.forEach(term => {
      // Handle multi-word terms
      words[term.toLowerCase()] = tagName;
    });
    
    // Register the tag in the world
    world.addTags({
      [tagName]: {
        isA: 'Noun', // Default behavior
        notA: 'Verb' // Prevent these from being tagged as verbs
      }
    });
  });
  
  world.addWords(words);
});

/**
 * Extract spans using NLP dictionary matching
 * 
 * @param {string} text - Input text to analyze
 * @returns {Array<{text: string, role: string, confidence: number, start: number, end: number}>}
 */
export function extractKnownSpans(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }
  
  const spans = [];
  const textLower = text.toLowerCase();
  
  // Strategy: Use regex-based matching for multi-word terms
  // This is more reliable than compromise for exact phrase matching
  Object.entries(TAXONOMY_PATTERNS).forEach(([taxonomyId, patterns]) => {
    patterns.forEach(({ original, lower, pattern }) => {
      // Create case-insensitive regex with word boundaries
      // But be careful with punctuation and special characters
      const regex = new RegExp(`\\b${pattern}\\b`, 'gi');
      
      let match;
      while ((match = regex.exec(text)) !== null) {
        const matchedText = match[0];
        const start = match.index;
        const end = start + matchedText.length;
        
        // Apply disambiguation rules
        if (shouldIncludeMatch(text, matchedText, start, end, taxonomyId)) {
          spans.push({
            text: matchedText,
            role: taxonomyId,
            confidence: 1.0, // Dictionary match = 100% confidence
            start,
            end
          });
        }
      }
    });
  });
  
  // Also check for verb conjugations for camera movements
  // e.g., "pans" -> "pan", "dollies" -> "dolly"
  if (textLower.includes('pan') || textLower.includes('dolly') || 
      textLower.includes('truck') || textLower.includes('roll') ||
      textLower.includes('tilt') || textLower.includes('zoom')) {
    
    // Camera verb patterns with conjugations
    const verbPatterns = [
      { base: 'pan', variations: ['pans', 'panning', 'panned'] },
      { base: 'tilt', variations: ['tilts', 'tilting', 'tilted'] },
      { base: 'dolly', variations: ['dollies', 'dollying'] },
      { base: 'truck', variations: ['trucks', 'trucking', 'trucked'] },
      { base: 'roll', variations: ['rolls', 'rolling', 'rolled'] },
      { base: 'zoom', variations: ['zooms', 'zooming', 'zoomed'] },
      { base: 'crane', variations: ['cranes', 'craning', 'craned'] },
    ];
    
    verbPatterns.forEach(({ base, variations }) => {
      [...variations, base].forEach(variant => {
        const regex = new RegExp(`\\b${escapeRegExp(variant)}\\b`, 'gi');
        let match;
        
        while ((match = regex.exec(text)) !== null) {
          const matchedText = match[0];
          const start = match.index;
          const end = start + matchedText.length;
          
          // Check if this span already exists
          const alreadyExists = spans.some(s => 
            s.start === start && s.end === end && s.role === 'camera.movement'
          );
          
          if (!alreadyExists && shouldIncludeMatch(text, matchedText, start, end, 'camera.movement')) {
            spans.push({
              text: matchedText,
              role: 'camera.movement',
              confidence: 1.0,
              start,
              end
            });
          }
        }
      });
    });
  }
  
  // Sort by start position and remove duplicates/overlaps
  return deduplicateAndResolveOverlaps(spans);
}

/**
 * Disambiguation rules to prevent false positives
 * 
 * @param {string} text - Full text
 * @param {string} matchedText - The matched term
 * @param {number} start - Start position
 * @param {number} end - End position
 * @param {string} taxonomyId - Taxonomy category ID
 * @returns {boolean} True if the match should be included
 */
function shouldIncludeMatch(text, matchedText, start, end, taxonomyId) {
  const matchLower = matchedText.toLowerCase();
  
  // Get context around the match (20 chars before and after)
  const contextStart = Math.max(0, start - 20);
  const contextEnd = Math.min(text.length, end + 20);
  const context = text.substring(contextStart, contextEnd).toLowerCase();
  
  // Rule 1: Camera movement disambiguation
  if (taxonomyId === 'camera.movement') {
    // "pan" can be camera movement or cooking
    if (matchLower === 'pan' || matchLower === 'pans' || matchLower === 'panning') {
      // Include if explicitly mentions "camera"
      if (context.includes('camera')) {
        return true;
      }
      // Exclude if cooking context
      if (context.includes('frying') || 
          context.includes('sauce') || 
          context.includes('cook') ||
          context.includes('kitchen') ||
          context.includes('skillet')) {
        return false;
      }
      // Include by default (most video prompts won't have cooking context)
      return true;
    }
    
    // "truck" can be camera movement or vehicle
    if (matchLower === 'truck' || matchLower === 'trucking') {
      // Include if explicitly mentions "camera"
      if (context.includes('camera')) {
        return true;
      }
      // Exclude if vehicle context
      if (context.includes('delivery') || 
          context.includes('vehicle') || 
          context.includes('driving') ||
          context.includes('road')) {
        return false;
      }
      return true;
    }
    
    // "roll" can be camera movement, bread, or action
    if (matchLower === 'roll' || matchLower === 'rolling') {
      // Include if explicitly mentions "camera"
      if (context.includes('camera')) {
        return true;
      }
      // Exclude if bread/food context
      if (context.includes('bread') || 
          context.includes('butter') ||
          context.includes('bake')) {
        return false;
      }
      // Exclude if body movement (e.g., "person rolling")
      if (context.includes('person') || 
          context.includes('character') ||
          context.includes('subject')) {
        return false;
      }
      return true;
    }
  }
  
  // Rule 2: Lens focal length disambiguation
  if (taxonomyId === 'camera.lens') {
    // e.g., "35mm" - ensure it's in camera/lens context
    // Could be confused with film stock "35mm Film"
    // If "film" appears right after, it's likely film stock, not lens
    if (matchLower.includes('mm')) {
      const afterMatch = text.substring(end, Math.min(text.length, end + 10)).toLowerCase();
      if (afterMatch.trim().startsWith('film')) {
        return false; // Let film stock matcher catch it
      }
    }
  }
  
  // Rule 3: Film stock specificity
  if (taxonomyId === 'style.filmStock') {
    // Film stock terms are usually highly specific, so keep them
    return true;
  }
  
  // Rule 4: Aspect ratio patterns
  if (taxonomyId === 'technical.aspectRatio') {
    // Aspect ratios are highly specific, keep them
    return true;
  }
  
  // Default: include the match
  return true;
}

/**
 * Remove duplicate and overlapping spans
 * Priority: Longer spans > Higher specificity > Earlier position
 * 
 * @param {Array} spans - Raw spans
 * @returns {Array} Deduplicated spans
 */
function deduplicateAndResolveOverlaps(spans) {
  if (spans.length === 0) return [];
  
  // Sort by start position, then by length (longer first)
  spans.sort((a, b) => {
    if (a.start !== b.start) {
      return a.start - b.start;
    }
    return (b.end - b.start) - (a.end - a.start);
  });
  
  const result = [];
  
  for (const span of spans) {
    // Check if this span overlaps with any already selected span
    const hasOverlap = result.some(existing => {
      return (
        (span.start >= existing.start && span.start < existing.end) ||
        (span.end > existing.start && span.end <= existing.end) ||
        (span.start <= existing.start && span.end >= existing.end)
      );
    });
    
    if (!hasOverlap) {
      result.push(span);
    } else {
      // If there's an overlap, prefer the longer or more specific span
      const overlappingIndex = result.findIndex(existing => {
        return (
          (span.start >= existing.start && span.start < existing.end) ||
          (span.end > existing.start && span.end <= existing.end) ||
          (span.start <= existing.start && span.end >= existing.end)
        );
      });
      
      if (overlappingIndex !== -1) {
        const existing = result[overlappingIndex];
        const spanLength = span.end - span.start;
        const existingLength = existing.end - existing.start;
        
        // Prefer longer spans (more specific)
        if (spanLength > existingLength) {
          result[overlappingIndex] = span;
        }
      }
    }
  }
  
  // Final sort by position
  result.sort((a, b) => a.start - b.start);
  
  return result;
}

/**
 * Get statistics about vocabulary coverage
 * Useful for monitoring and debugging
 */
export function getVocabStats() {
  const stats = {};
  
  Object.entries(VOCAB).forEach(([taxonomyId, terms]) => {
    stats[taxonomyId] = {
      termCount: terms.length,
      sampleTerms: terms.slice(0, 5)
    };
  });
  
  return {
    totalCategories: Object.keys(VOCAB).length,
    totalTerms: Array.from(TERM_TO_TAXONOMY.keys()).length,
    categories: stats
  };
}

/**
 * Check if NLP service can handle a given text
 * Returns estimated coverage percentage
 */
export function estimateCoverage(text) {
  if (!text) return 0;
  
  const spans = extractKnownSpans(text);
  const words = text.split(/\s+/).length;
  const coveredWords = spans.reduce((sum, span) => {
    return sum + span.text.split(/\s+/).length;
  }, 0);
  
  return Math.min(100, Math.round((coveredWords / words) * 100));
}

/**
 * Extract spans using full symbolic NLP pipeline
 * 
 * This is the complete Phase 1 implementation that combines:
 * - Phase 0: Dictionary matching (existing)
 * - Phase 1: POS Tagging
 * - Phase 2: Chunking
 * - Phase 3: Frame Matching
 * - Phase 4: Semantic Role Labeling
 * - Phase 5: Taxonomy Mapping
 * 
 * @param {string} text - Input text to analyze
 * @param {Object} options - Options for processing
 * @returns {Object} Enhanced spans with semantic metadata
 */
export async function extractSemanticSpans(text, options = {}) {
  if (!text || typeof text !== 'string') {
    return {
      spans: [],
      semantic: null,
      stats: { phase: 'none', error: 'Invalid input' },
    };
  }
  
  try {
    // Dynamic imports to avoid circular dependencies and reduce initial load time
    const { PosTagger } = await import('../../../nlp/pos-tagging/PosTagger.js');
    const { BrillTransformer } = await import('../../../nlp/pos-tagging/BrillTransformer.js');
    const { ChunkParser } = await import('../../../nlp/chunking/ChunkParser.js');
    const { ChunkMerger } = await import('../../../nlp/chunking/ChunkMerger.js');
    const { FrameMatcher } = await import('../../../nlp/frames/FrameMatcher.js');
    const { SimplifiedSRL } = await import('../../../nlp/srl/SimplifiedSRL.js');
    const { RoleMapper } = await import('../../../nlp/srl/RoleMapper.js');
    
    const startTime = Date.now();
    
    // Phase 0: Dictionary matching (EXISTING - for known technical terms)
    const dictionarySpans = extractKnownSpans(text);
    
    // Phase 1: POS Tagging with Brill transformation
    const tokens = PosTagger.tagPOS(text);
    console.log(`[DEBUG] POS Tagged ${tokens.length} tokens from text: "${text.substring(0, 50)}..."`);
    
    const brillTransformer = new BrillTransformer();
    const transformedTokens = brillTransformer.applyRules(tokens, text);
    console.log(`[DEBUG] Brill transformed ${transformedTokens.length} tokens`);
    
    // Phase 2: Chunking (NP/VP/PP extraction)
    const chunks = ChunkParser.extractChunks(transformedTokens);
    console.log(`[DEBUG] Extracted ${chunks.length} chunks:`, chunks.map(c => `${c.type}:"${c.text}"`).join(', '));
    
    const mergedChunks = ChunkMerger.mergeCascading(chunks, text);
    console.log(`[DEBUG] Merged to ${mergedChunks.length} chunks:`, mergedChunks.map(c => `${c.type}:"${c.text}"`).join(', '));
    
    // Phase 3: Frame Matching (detect Motion, Cinematography, Lighting frames)
    const frameMatcher = new FrameMatcher();
    const frames = frameMatcher.matchFrames(mergedChunks, text);
    console.log(`[DEBUG] Matched ${frames.length} frames`);
    
    // Phase 4: Semantic Role Labeling (Arg0, Arg1, ArgM)
    const srlStructures = SimplifiedSRL.labelRoles(mergedChunks, frames);
    
    // Phase 5: Map to Taxonomy (convert semantic roles to taxonomy categories)
    const mappingResult = RoleMapper.mapToTaxonomy(srlStructures, frames, dictionarySpans);
    
    const endTime = Date.now();
    
    return {
      spans: mappingResult.spans,
      relationships: mappingResult.relationships,
      semantic: {
        tokens: transformedTokens,
        chunks: mergedChunks,
        frames,
        srlStructures,
      },
      stats: {
        latency: endTime - startTime,
        totalSpans: mappingResult.spans.length,
        dictionarySpans: dictionarySpans.length,
        semanticSpans: mappingResult.spans.length - dictionarySpans.length,
        chunks: mergedChunks.length,
        frames: frames.length,
        predicates: srlStructures.length,
        relationships: mappingResult.relationships.length,
        phase: 'semantic',
      },
    };
  } catch (error) {
    console.error('Error in extractSemanticSpans:', error);
    
    // Fallback to dictionary-only spans on error
    const dictionarySpans = extractKnownSpans(text);
    return {
      spans: dictionarySpans,
      semantic: null,
      stats: {
        phase: 'fallback-dictionary',
        error: error.message,
        totalSpans: dictionarySpans.length,
      },
    };
  }
}

