import AhoCorasick from 'ahocorasick';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { TAXONOMY } from '#shared/taxonomy.js';

// GLiNER is loaded dynamically due to ONNX runtime compatibility issues
let GlinerClass = null;

/**
 * NLP Span Service - NEURO-SYMBOLIC ARCHITECTURE
 * 
 * 3-Tier extraction pipeline:
 * 1. Aho-Corasick (Tier 1): Closed vocabulary - O(N) single pass, 100% precision
 * 2. GLiNER (Tier 2): Open vocabulary - Semantic understanding, ~80-90% precision
 * 3. LLM Fallback (Tier 3): Complex reasoning - handled by SpanLabelingService
 * 
 * This replaces the broken Compromise-based approach that:
 * - Misclassified gerunds as actions ("glowing sunset" → action.movement)
 * - Had O(M×N) performance from iterating vocab categories
 */

// --- SETUP: Load Vocab ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const vocabPath = join(__dirname, 'vocab.json');
let VOCAB = {};
try {
  VOCAB = JSON.parse(readFileSync(vocabPath, 'utf-8'));
} catch (e) {
  console.warn("⚠️ NLP Service: Could not load vocab.json. Technical tagging will fail.");
}

// ============================================================================
// TIER 1: AHO-CORASICK - Closed Vocabulary (100% precision, O(N) time)
// ============================================================================

/**
 * Build Aho-Corasick automaton from vocabulary
 * This is done ONCE at module load for O(N) extraction
 */
function buildAhoCorasickAutomaton() {
  const patterns = [];
  const patternToTaxonomy = new Map();
  
  Object.entries(VOCAB).forEach(([taxonomyId, terms]) => {
    terms.forEach(term => {
      const lowerTerm = term.toLowerCase();
      patterns.push(lowerTerm);
      patternToTaxonomy.set(lowerTerm, {
        taxonomyId,
        originalTerm: term
      });
    });
  });
  
  const ac = new AhoCorasick(patterns);
  return { ac, patternToTaxonomy };
}

// Build automaton at module load
const { ac: ahoCorasick, patternToTaxonomy } = buildAhoCorasickAutomaton();

/**
 * Ambiguous camera terms that require context disambiguation
 */
const AMBIGUOUS_CAMERA_TERMS = new Set(['pan', 'roll', 'tilt', 'zoom', 'drone', 'crane', 'boom', 'truck']);

/**
 * Check if ambiguous term has camera context nearby
 */
function hasCameraContext(text, start, end) {
  const contextRadius = 50;
  const contextStart = Math.max(0, start - contextRadius);
  const contextEnd = Math.min(text.length, end + contextRadius);
  const context = text.substring(contextStart, contextEnd).toLowerCase();
  return /(camera|shot|lens|frame|cinematography|cinematic|filming|video|footage)/.test(context);
}

/**
 * Extract spans using Aho-Corasick automaton - O(N) single pass
 * @param {string} text - Input text
 * @returns {Array} Spans with 100% confidence
 */
function extractClosedVocabulary(text) {
  if (!text || typeof text !== 'string') return [];
  
  const lowerText = text.toLowerCase();
  const results = ahoCorasick.search(lowerText);
  const spans = [];
  
  // Results format: [[endIndex, [pattern1, pattern2, ...]], ...]
  for (const [endIndex, patterns] of results) {
    for (const pattern of patterns) {
      const info = patternToTaxonomy.get(pattern);
      if (!info) continue;
      
      const start = endIndex - pattern.length + 1;
      const end = endIndex + 1;
      const matchedText = text.substring(start, end);
      
      // Apply disambiguation for ambiguous camera terms
      if (info.taxonomyId === 'camera.movement' && AMBIGUOUS_CAMERA_TERMS.has(pattern)) {
        // Check for false positive contexts
        const beforeContext = text.substring(Math.max(0, start - 20), start).toLowerCase();
        if (/(frying|sauté|sauce|iron|bread|dinner|hair)\s*$/.test(beforeContext)) {
          continue; // Skip "frying pan", "bread roll", etc.
        }
        
        // Require camera context for ambiguous terms
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

// ============================================================================
// TIER 2: GLINER - Open Vocabulary (Semantic understanding)
// ============================================================================

/**
 * GLiNER model instance (lazy loaded)
 */
let glinerModel = null;
let glinerInitPromise = null;
let glinerInitFailed = false;
let glinerImportFailed = false;

/**
 * Generate labels from taxonomy for GLiNER
 * Maps taxonomy categories to human-readable labels
 */
function generateGlinerLabels() {
  const labels = [];
  const labelToTaxonomyId = new Map();
  
  // Add parent categories
  Object.values(TAXONOMY).forEach(category => {
    labels.push(category.label);
    labelToTaxonomyId.set(category.label.toLowerCase(), category.id);
    
    // Add attribute-specific labels
    if (category.attributes) {
      Object.entries(category.attributes).forEach(([attrName, attrId]) => {
        // Create readable label from attribute name
        const label = attrName.replace(/_/g, ' ').toLowerCase();
        labels.push(label);
        labelToTaxonomyId.set(label, attrId);
      });
    }
  });
  
  // Add domain-specific labels that map to taxonomy
  const domainLabels = {
    'person': 'subject.identity',
    'character': 'subject.identity',
    'animal': 'subject.identity',
    'object': 'subject.identity',
    'place': 'environment.location',
    'location': 'environment.location',
    'setting': 'environment.location',
    'time': 'lighting.timeOfDay',
    'weather': 'environment.weather',
    'emotion': 'subject.emotion',
    'clothing': 'subject.wardrobe',
    'color': 'style.aesthetic',
    'texture': 'style.aesthetic',
    'mood': 'style.aesthetic',
    'movement': 'action.movement',
    'pose': 'action.state',
    'gesture': 'action.gesture',
  };
  
  Object.entries(domainLabels).forEach(([label, taxonomyId]) => {
    if (!labels.includes(label)) {
      labels.push(label);
    }
    labelToTaxonomyId.set(label, taxonomyId);
  });
  
  return { labels, labelToTaxonomyId };
}

const { labels: GLINER_LABELS, labelToTaxonomyId: LABEL_TO_TAXONOMY } = generateGlinerLabels();

/**
 * Dynamically import GLiNER (handles ONNX runtime compatibility issues)
 */
async function importGliner() {
  if (GlinerClass) return GlinerClass;
  if (glinerImportFailed) return null;
  
  try {
    const glinerModule = await import('gliner');
    GlinerClass = glinerModule.Gliner;
    return GlinerClass;
  } catch (error) {
    console.warn('[GLiNER] Failed to import gliner package:', error.message);
    console.warn('[GLiNER] Open vocabulary extraction will be disabled. Closed vocabulary (Aho-Corasick) still works.');
    glinerImportFailed = true;
    return null;
  }
}

/**
 * Initialize GLiNER model (lazy loading)
 */
async function initGliner() {
  if (glinerModel) return glinerModel;
  if (glinerInitFailed || glinerImportFailed) return null;
  if (glinerInitPromise) return glinerInitPromise;
  
  glinerInitPromise = (async () => {
    try {
      const Gliner = await importGliner();
      if (!Gliner) {
        glinerInitFailed = true;
        return null;
      }
      
      console.log('[GLiNER] Initializing model...');
      const startTime = Date.now();
      
      glinerModel = new Gliner({
        tokenizerPath: 'onnx-community/gliner_small-v2.1',
        modelPath: 'onnx-community/gliner_small-v2.1',
        maxWidth: 12,
      });
      
      await glinerModel.initialize();
      
      const loadTime = Date.now() - startTime;
      console.log(`[GLiNER] Model initialized in ${loadTime}ms`);
      
      return glinerModel;
    } catch (error) {
      console.warn('[GLiNER] Failed to initialize:', error.message);
      glinerInitFailed = true;
      glinerModel = null;
      return null;
    }
  })();
  
  return glinerInitPromise;
}

/**
 * Extract spans using GLiNER - semantic understanding
 * @param {string} text - Input text
 * @returns {Promise<Array>} Spans with confidence scores
 */
async function extractOpenVocabulary(text) {
  if (!text || typeof text !== 'string') return [];
  
  try {
    const model = await initGliner();
    if (!model) return [];
    
    // Use a subset of labels for better performance
    const activeLabels = [
      'person', 'character', 'animal', 'object',
      'place', 'location', 'setting',
      'movement', 'pose', 'gesture',
      'emotion', 'mood',
      'weather', 'time',
      'clothing', 'color'
    ];
    
    const entities = await model.inference({
      texts: [text],
      labels: activeLabels,
      threshold: 0.3, // Lower threshold to catch more entities
      flatNer: true,
    });
    
    if (!entities || !entities[0]) return [];
    
    return entities[0].map(entity => {
      const taxonomyId = LABEL_TO_TAXONOMY.get(entity.label.toLowerCase()) || 'subject.identity';
      
      return {
        text: entity.text,
        role: taxonomyId,
        confidence: Math.round(entity.score * 100) / 100,
        start: entity.start,
        end: entity.end,
        source: 'gliner'
      };
    });
  } catch (error) {
    console.warn('[GLiNER] Extraction error:', error.message);
    return [];
  }
}

// ============================================================================
// PHASE 4: MERGE STRATEGY
// ============================================================================

/**
 * Merge spans from closed and open vocabulary extractors
 * Closed vocabulary takes precedence (100% precision)
 * 
 * @param {Array} closedSpans - Aho-Corasick spans (high priority)
 * @param {Array} openSpans - GLiNER spans (fill gaps)
 * @returns {Array} Merged and deduplicated spans
 */
function mergeSpans(closedSpans, openSpans) {
  const allSpans = [...closedSpans];
  
  // Build occupied positions map from closed spans
  const occupied = new Set();
  for (const span of closedSpans) {
    for (let i = span.start; i < span.end; i++) {
      occupied.add(i);
    }
  }
  
  // Add open spans that don't overlap with closed spans
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
      // Mark these positions as occupied
      for (let i = span.start; i < span.end; i++) {
        occupied.add(i);
      }
    }
  }
  
  return allSpans;
}

/**
 * Deduplicate spans using longest-match strategy
 * When spans overlap, keep the longer one (or higher confidence if same length)
 */
function deduplicateSpans(spans) {
  if (spans.length === 0) return [];
  
  // Sort by: confidence (desc), length (desc), start (asc)
  const sorted = [...spans].sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    const lenDiff = (b.end - b.start) - (a.end - a.start);
    if (lenDiff !== 0) return lenDiff;
    return a.start - b.start;
  });
  
  const accepted = [];
  const occupied = new Set();
  
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
  
  // Sort by position for output
  return accepted.sort((a, b) => a.start - b.start);
}

// ============================================================================
// MAIN API
// ============================================================================

/**
 * Extract semantic spans using neuro-symbolic pipeline
 * 
 * @param {string} text - Input text to analyze
 * @param {Object} options - Extraction options
 * @param {boolean} options.useGliner - Enable GLiNER for open vocabulary (default: true)
 * @returns {Promise<{spans: Array, stats: Object}>}
 */
export async function extractSemanticSpans(text, options = {}) {
  if (!text || typeof text !== 'string') return { spans: [], stats: { phase: 'empty-input' } };
  
  const { useGliner = true } = options;
  const startTime = Date.now();
  
  // Tier 1: Closed vocabulary (Aho-Corasick) - always runs
  const closedSpans = extractClosedVocabulary(text);
  const tier1Time = Date.now() - startTime;
  
  // Tier 2: Open vocabulary (GLiNER) - optional
  let openSpans = [];
  let tier2Time = 0;
  
  if (useGliner) {
    const tier2Start = Date.now();
    openSpans = await extractOpenVocabulary(text);
    tier2Time = Date.now() - tier2Start;
  }
  
  // Merge with closed vocabulary priority
  const mergedSpans = mergeSpans(closedSpans, openSpans);
  
  // Deduplicate using longest-match strategy
  const uniqueSpans = deduplicateSpans(mergedSpans);
  
  // Remove source field from output (internal use only)
  const outputSpans = uniqueSpans.map(({ source, ...span }) => span);
  
  const totalTime = Date.now() - startTime;
  
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
}

/**
 * Synchronous extraction using only closed vocabulary (Aho-Corasick)
 * For backward compatibility and fast-path scenarios
 * 
 * @param {string} text - Input text
 * @returns {Array} Spans array
 */
export function extractKnownSpans(text) {
  if (!text || typeof text !== 'string') return [];
  
  const closedSpans = extractClosedVocabulary(text);
  return deduplicateSpans(closedSpans).map(({ source, ...span }) => span);
}

/**
 * Get vocabulary statistics
 */
export function getVocabStats() {
  const stats = {};
  let totalTerms = 0;
  
  Object.entries(VOCAB).forEach(([taxonomyId, terms]) => {
    totalTerms += terms.length;
    stats[taxonomyId] = {
      termCount: terms.length,
      sampleTerms: terms.slice(0, 5)
    };
  });
  
  return {
    totalCategories: Object.keys(VOCAB).length,
    totalTerms: totalTerms,
    categories: stats,
    glinerLabels: GLINER_LABELS.length,
    glinerReady: glinerModel !== null && !glinerInitFailed,
  };
}

/**
 * Estimate coverage percentage
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
 * Pre-warm GLiNER model (call on server startup)
 */
export async function warmupGliner() {
  try {
    await initGliner();
    return { success: true, message: 'GLiNER model initialized' };
  } catch (error) {
    return { success: false, message: error.message };
  }
}
