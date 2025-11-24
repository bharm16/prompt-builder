import AhoCorasick from 'ahocorasick';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { TAXONOMY } from '#shared/taxonomy.js';
import { NEURO_SYMBOLIC } from '../../llm/span-labeling/config/SpanLabelingConfig.js';

/**
 * NLP Span Service - NEURO-SYMBOLIC ARCHITECTURE (v2)
 * 
 * 3-Tier extraction pipeline:
 * 1. Aho-Corasick (Tier 1): Closed vocabulary - O(N) single pass, 100% precision
 * 2. RobustGLiNER (Tier 2): Open vocabulary - ONNX native, semantic understanding
 * 3. LLM Fallback (Tier 3): Complex reasoning - handled by SpanLabelingService
 * 
 * This implementation uses onnxruntime-node directly instead of the unstable
 * gliner wrapper package, providing production-grade reliability.
 */

// --- SETUP: Load Vocab ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const vocabPath = join(__dirname, 'vocab.json');
const modelDir = join(__dirname, 'models');

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
// TIER 2: ROBUST GLINER - Open Vocabulary (ONNX Native)
// ============================================================================

/**
 * RobustGLiNER - Zero-shot NER using ONNX Runtime directly
 * Full implementation with span enumeration for GLiNER model
 */
class RobustGLiNER {
  constructor() {
    this.session = null;
    this.tokenizer = null;
    this.initialized = false;
    this.initFailed = false;
    this.initPromise = null;
    this.maxWidth = 12; // Max span width in tokens
  }
  
  async initialize() {
    if (this.initialized) return true;
    if (this.initFailed) return false;
    if (this.initPromise) return this.initPromise;
    
    this.initPromise = this._doInitialize();
    return this.initPromise;
  }
  
  async _doInitialize() {
    try {
      const [onnxModule, transformersModule] = await Promise.all([
        import('onnxruntime-node'),
        import('@huggingface/transformers')
      ]);
      
      const { InferenceSession } = onnxModule;
      const { AutoTokenizer, env } = transformersModule;
      
      env.allowLocalModels = true;
      env.useBrowserCache = false;
      
      const modelPath = join(modelDir, 'model.onnx');
      
      if (!existsSync(modelPath)) {
        console.warn('[RobustGLiNER] Model file not found at:', modelPath);
        this.initFailed = true;
        return false;
      }
      
      console.log('[RobustGLiNER] Loading tokenizer...');
      this.tokenizer = await AutoTokenizer.from_pretrained('onnx-community/gliner_small-v2.1');
      
      console.log('[RobustGLiNER] Loading ONNX model...');
      this.session = await InferenceSession.create(modelPath, {
        executionProviders: ['cpu'],
        graphOptimizationLevel: 'all'
      });
      
      this.Tensor = onnxModule.Tensor;
      this.initialized = true;
      console.log('[RobustGLiNER] ✅ Initialized successfully');
      return true;
    } catch (error) {
      console.warn('[RobustGLiNER] Failed to initialize:', error.message);
      this.initFailed = true;
      return false;
    }
  }
  
  /**
   * Prepare GLiNER input with labels embedded in the prompt
   * Format: <<ENT>>label1<<ENT>>label2<<SEP>> text
   */
  _preparePrompt(text, labels) {
    // GLiNER uses special tokens: <<ENT>> for entity markers, <<SEP>> as separator
    const ENT_TOKEN = '<<ENT>>';
    const SEP_TOKEN = '<<SEP>>';
    const labelParts = labels.map(l => `${ENT_TOKEN}${l}`).join('');
    return `${labelParts}${SEP_TOKEN} ${text}`;
  }
  
  /**
   * Create word boundaries mapping tokens to original words
   */
  _getWordBoundaries(text, tokens) {
    const words = text.split(/\s+/);
    const boundaries = [];
    let tokenIdx = 0;
    
    // Skip special tokens at start ([CLS], labels, etc.)
    // Find where actual text tokens begin
    const textStart = tokens.findIndex(t => {
      const decoded = t.replace('##', '').replace('Ġ', '');
      return words.some(w => w.toLowerCase().includes(decoded.toLowerCase()));
    });
    
    if (textStart === -1) return [];
    
    let charPos = 0;
    for (let wordIdx = 0; wordIdx < words.length; wordIdx++) {
      const word = words[wordIdx];
      const wordStart = text.indexOf(word, charPos);
      const wordEnd = wordStart + word.length;
      charPos = wordEnd;
      
      boundaries.push({
        wordIdx,
        word,
        start: wordStart,
        end: wordEnd,
        tokenStart: textStart + wordIdx,
        tokenEnd: textStart + wordIdx + 1
      });
    }
    
    return boundaries;
  }
  
  /**
   * Generate span indices in GLiNER format: [(i, i+j) for i in range(numWords) for j in range(maxWidth)]
   * Matches Python: span_idx = [(i, i + j) for i in range(num_tokens) for j in range(max_width)]
   */
  _generateSpanIndices(numWords) {
    const spans = [];
    // Generate ALL spans including invalid ones (filtered by span_mask)
    for (let i = 0; i < numWords; i++) {
      for (let j = 0; j < this.maxWidth; j++) {
        spans.push([i, i + j]);  // 0-indexed, inclusive end
      }
    }
    return spans; // Total: numWords * maxWidth spans
  }
  
  /**
   * Find the character position of a word in the original text
   * Handles variable whitespace correctly
   */
  _findWordPosition(text, words, wordIdx) {
    let pos = 0;
    for (let i = 0; i < wordIdx; i++) {
      // Find this word in the text starting from current position
      const wordStart = text.indexOf(words[i], pos);
      if (wordStart === -1) return -1;
      pos = wordStart + words[i].length;
    }
    // Find the target word
    return text.indexOf(words[wordIdx], pos);
  }
  
  /**
   * Extract entities using GLiNER model
   * Uses proper subword tokenization alignment for words_mask
   */
  async extract(text, labels, threshold = 0.4) {
    if (!this.initialized || this.initFailed) return [];
    if (!text || !labels.length) return [];
    
    try {
      // Split text into words, preserving word positions
      const words = text.split(/\s+/).filter(w => w.length > 0);
      const numWords = words.length;
      if (numWords === 0) return [];
      
      // Prepare input with labels in GLiNER format
      const prompt = this._preparePrompt(text, labels);
      
      // Tokenize the full prompt
      const encoded = await this.tokenizer(prompt, {
        padding: true,
        truncation: true,
        max_length: 512,
        return_tensors: 'np'
      });
      
      const seqLen = encoded.input_ids.dims[1];
      
      // Build words_mask properly by aligning tokens to words
      const wordsMaskData = new BigInt64Array(seqLen).fill(BigInt(0));
      
      // Tokenize JUST the labels prefix to find where text starts
      const labelPrefix = this._preparePrompt('', labels).trim();
      const prefixEncoded = await this.tokenizer(labelPrefix, {
        add_special_tokens: true,
        return_tensors: 'np'
      });
      const textTokenStart = prefixEncoded.input_ids.dims[1]; // Tokens for [CLS] + labels + [SEP]
      
      // Tokenize each word individually to build proper alignment
      let currentTokenIdx = textTokenStart;
      for (let wordIdx = 0; wordIdx < numWords && currentTokenIdx < seqLen - 1; wordIdx++) {
        // Tokenize just this word
        const wordTokens = await this.tokenizer(words[wordIdx], {
          add_special_tokens: false,
          return_tensors: 'np'
        });
        const numWordTokens = wordTokens.input_ids.dims[1];
        
        // Assign all tokens of this word to the same word index (1-indexed)
        for (let t = 0; t < numWordTokens && currentTokenIdx + t < seqLen - 1; t++) {
          wordsMaskData[currentTokenIdx + t] = BigInt(wordIdx + 1); // 1-indexed for GLiNER
        }
        currentTokenIdx += numWordTokens;
      }
      
      const wordsMask = new this.Tensor('int64', wordsMaskData, [1, seqLen]);
      
      // Generate span indices (0-indexed word positions)
      const spanIndices = this._generateSpanIndices(numWords);
      const numSpans = spanIndices.length;
      
      // Create tensors
      const inputIds = new this.Tensor('int64',
        BigInt64Array.from(encoded.input_ids.data.map(x => BigInt(x))),
        [1, seqLen]
      );
      
      const attentionMask = new this.Tensor('int64',
        BigInt64Array.from(encoded.attention_mask.data.map(x => BigInt(x))),
        [1, seqLen]
      );
      
      // Text lengths [batch, 1]
      const textLengths = new this.Tensor('int64', BigInt64Array.from([BigInt(numWords)]), [1, 1]);
      
      // Span indices tensor [batch, num_spans, 2] - 0-indexed word positions
      const spanIdxData = new BigInt64Array(numSpans * 2);
      for (let i = 0; i < numSpans; i++) {
        spanIdxData[i * 2] = BigInt(spanIndices[i][0]);     // start (0-indexed)
        spanIdxData[i * 2 + 1] = BigInt(spanIndices[i][1]); // end (0-indexed, inclusive)
      }
      const spanIdx = new this.Tensor('int64', spanIdxData, [1, numSpans, 2]);
      
      // Span mask [batch, num_spans] - only valid if end < numWords
      const spanMaskData = new Uint8Array(numSpans);
      for (let i = 0; i < numSpans; i++) {
        const end = spanIndices[i][1];
        spanMaskData[i] = end < numWords ? 1 : 0;
      }
      const spanMask = new this.Tensor('bool', spanMaskData, [1, numSpans]);
      
      // Run inference
      const feeds = {
        input_ids: inputIds,
        attention_mask: attentionMask,
        words_mask: wordsMask,
        text_lengths: textLengths,
        span_idx: spanIdx,
        span_mask: spanMask
      };
      
      const results = await this.session.run(feeds);
      
      // Decode output
      const entities = this._decodeOutput(results, text, words, spanIndices, labels, threshold);
      
      // Debug logging - remove after verification
      if (entities.length > 0) {
        console.log(`[GLiNER] Found ${entities.length} entities:`, 
          entities.map(e => `"${e.text}" (${e.label}: ${e.score})`).join(', '));
      }
      
      return entities;
    } catch (error) {
      console.warn('[RobustGLiNER] Extraction error:', error.message);
      return [];
    }
  }
  
  _decodeOutput(results, text, words, spanIndices, labels, threshold) {
    const entities = [];
    const logits = results.logits;
    const numWords = words.length;
    
    if (!logits || !logits.data || logits.data.length === 0) return entities;
    
    // Logits shape: [batch, numWords, maxWidth, numLabels]
    const numLabels = labels.length;
    const maxWidth = this.maxWidth;
    
    // Apply sigmoid to get probabilities
    const sigmoid = x => 1 / (1 + Math.exp(-x));
    
    // Iterate over valid spans
    for (let wordIdx = 0; wordIdx < numWords; wordIdx++) {
      for (let width = 0; width < maxWidth; width++) {
        const endWord = wordIdx + width;
        
        // Skip invalid spans
        if (endWord >= numWords) continue;
        
        for (let labelIdx = 0; labelIdx < numLabels; labelIdx++) {
          // Index into flattened logits: [numWords, maxWidth, numLabels]
          const logitIdx = wordIdx * maxWidth * numLabels + width * numLabels + labelIdx;
          if (logitIdx >= logits.data.length) continue;
          
          const score = sigmoid(logits.data[logitIdx]);
          
          if (score >= threshold) {
            // Extract the span text (endWord is inclusive)
            const spanWords = words.slice(wordIdx, endWord + 1);
            const spanText = spanWords.join(' ');
            
            // Find actual character positions in original text using indexOf
            // This handles variable whitespace correctly
            const charStart = this._findWordPosition(text, words, wordIdx);
            const charEnd = charStart + spanText.length;
            
            // Only add if we found valid positions
            if (charStart >= 0 && charEnd <= text.length) {
              entities.push({
                text: text.substring(charStart, charEnd), // Use actual text slice
                label: labels[labelIdx],
                score: Math.round(score * 100) / 100,
                start: charStart,
                end: charEnd
              });
            }
          }
        }
      }
    }
    
    // Sort by score descending and remove overlaps
    entities.sort((a, b) => b.score - a.score);
    
    const accepted = [];
    const occupied = new Set();
    
    for (const entity of entities) {
      let hasOverlap = false;
      for (let i = entity.start; i < entity.end; i++) {
        if (occupied.has(i)) {
          hasOverlap = true;
          break;
        }
      }
      
      if (!hasOverlap) {
        accepted.push(entity);
        for (let i = entity.start; i < entity.end; i++) {
          occupied.add(i);
        }
      }
    }
    
    return accepted.sort((a, b) => a.start - b.start);
  }
}

// Singleton instance
const glinerInstance = new RobustGLiNER();

/**
 * Extract spans using GLiNER - semantic understanding
 * @param {string} text - Input text
 * @returns {Promise<Array>} Spans with confidence scores
 */
async function extractOpenVocabulary(text) {
  if (!text || typeof text !== 'string') return [];
  
  const ready = await glinerInstance.initialize();
  if (!ready) return [];
  
  // Labels for video prompt entities
  const labels = [
    'person', 'character', 'animal', 'object',
    'place', 'location', 'environment',
    'action', 'movement', 'gesture',
    'emotion', 'mood', 'atmosphere',
    'style', 'aesthetic', 'lighting'
  ];
  
  const threshold = NEURO_SYMBOLIC.GLINER?.THRESHOLD || 0.3;
  const entities = await glinerInstance.extract(text, labels, threshold);
  
  return entities.map(entity => ({
    text: entity.text,
    role: mapLabelToTaxonomy(entity.label),
    confidence: entity.score,
    start: entity.start,
    end: entity.end,
    source: 'gliner'
  }));
}

/**
 * Map GLiNER label to taxonomy ID
 */
function mapLabelToTaxonomy(label) {
  const mapping = {
    'person': 'subject.identity',
    'character': 'subject.identity',
    'animal': 'subject.identity',
    'object': 'subject.identity',
    'place': 'environment.location',
    'location': 'environment.location',
    'environment': 'environment.location',
    'action': 'action.movement',
    'movement': 'action.movement',
    'gesture': 'action.gesture',
    'emotion': 'subject.emotion',
    'mood': 'style.aesthetic',
    'atmosphere': 'lighting.quality',
    'style': 'style.aesthetic',
    'aesthetic': 'style.aesthetic',
    'lighting': 'lighting.quality'
  };
  
  return mapping[label.toLowerCase()] || 'subject.identity';
}

// ============================================================================
// PHASE 4: MERGE STRATEGY
// ============================================================================

/**
 * Merge spans from closed and open vocabulary extractors
 * Closed vocabulary takes precedence (100% precision)
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
      for (let i = span.start; i < span.end; i++) {
        occupied.add(i);
      }
    }
  }
  
  return allSpans;
}

/**
 * Deduplicate spans using longest-match strategy
 */
function deduplicateSpans(spans) {
  if (spans.length === 0) return [];
  
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
  
  return accepted.sort((a, b) => a.start - b.start);
}

// ============================================================================
// MAIN API
// ============================================================================

/**
 * Generate GLiNER labels from taxonomy
 */
function generateGlinerLabels() {
  const labels = [];
  const labelToTaxonomyId = new Map();
  
  Object.values(TAXONOMY).forEach(category => {
    labels.push(category.label);
    labelToTaxonomyId.set(category.label.toLowerCase(), category.id);
    
    if (category.attributes) {
      Object.entries(category.attributes).forEach(([attrName, attrId]) => {
        const label = attrName.replace(/_/g, ' ').toLowerCase();
        labels.push(label);
        labelToTaxonomyId.set(label, attrId);
      });
    }
  });
  
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

const { labels: GLINER_LABELS } = generateGlinerLabels();

/**
 * Extract semantic spans using neuro-symbolic pipeline
 * 
 * @param {string} text - Input text to analyze
 * @param {Object} options - Extraction options
 * @param {boolean} options.useGliner - Enable GLiNER (default: true)
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
  
  // Remove source field from output
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
    glinerReady: glinerInstance.initialized && !glinerInstance.initFailed,
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
    const ready = await glinerInstance.initialize();
    return { 
      success: ready, 
      message: ready ? 'RobustGLiNER initialized' : 'GLiNER model not available'
    };
  } catch (error) {
    return { success: false, message: error.message };
  }
}
