import nlp from 'compromise';
import { GRAMMATICAL_CONFIG } from '../config/grammaticalAnalysis.js';

/**
 * GrammaticalAnalysisService
 * 
 * Analyzes text spans for grammatical structure and complexity using NLP.
 * Provides algorithmic (no-hardcoded-lists) detection of linguistic patterns
 * and mathematical complexity scoring via sigmoid normalization.
 * 
 * Single Responsibility: Grammatical analysis and complexity calculation
 */
export class GrammaticalAnalysisService {
  constructor(config = GRAMMATICAL_CONFIG) {
    this.weights = config.weights;
    this.sigmoid = config.sigmoid;
  }

  /**
   * Analyze a text span for grammatical structure and complexity
   * @param {string} text - The text to analyze
   * @param {Object} context - Context information (contextBefore, contextAfter)
   * @returns {Object} Analysis result with structure, complexity, tense, isPlural, doc
   */
  analyzeSpan(text, context = {}) {
    if (!text || typeof text !== 'string') {
      return this._getDefaultAnalysis();
    }

    const doc = nlp(text);
    const firstTerm = doc.terms().first();

    return {
      structure: this._detectStructure(doc, firstTerm),
      complexity: this._calculateComplexity(doc),
      tense: this._detectTense(doc),
      isPlural: doc.nouns().isPlural().found,
      doc: doc, // Pass doc reference for downstream transformations
    };
  }

  /**
   * Detect the grammatical structure of the text
   * Uses compromise's NLP tags for robust detection
   * @param {Object} doc - Compromise document object
   * @param {Object} firstTerm - First term in the document
   * @returns {string} Structure type
   * @private
   */
  _detectStructure(doc, firstTerm) {
    if (!firstTerm.found) {
      return 'unknown';
    }

    // 1. Check for gerund in the text (not just first term)
    // Gerunds often appear at the start but compromise may parse differently
    const hasGerund = doc.verbs().has('#Gerund');
    const startsWithGerund = firstTerm.has('#Gerund') || firstTerm.has('#Verb');
    
    if (hasGerund && startsWithGerund) {
      return 'gerund_phrase';
    }

    // 2. Check for prepositional phrase
    if (firstTerm.has('#Preposition')) {
      return 'prepositional_phrase';
    }

    // 3. Algorithmic Composition Detection
    const verbCount = doc.verbs().length;
    const nouns = doc.nouns();
    
    // Detect embedding: "The man [who saw me] ran"
    // Look for subordination patterns with pronouns or prepositions
    const hasSubordination =
      doc.match('#Noun #Pronoun #Verb').found ||
      doc.match('#Preposition #Det? #Noun #Verb').found ||
      doc.match('#Conjunction').found;

    // Complex clause: Multiple verbs with subordination
    if (verbCount > 1 || (verbCount > 0 && hasSubordination)) {
      return 'complex_clause';
    }

    // Simple clause: Has verb and noun
    if (verbCount > 0 && nouns.found) {
      return 'simple_clause';
    }

    // Default: Noun phrase
    return 'noun_phrase';
  }

  /**
   * Calculate complexity score using weighted features and sigmoid normalization
   * Returns a value between 0.0 (simple) and 1.0 (complex)
   * @param {Object} doc - Compromise document object
   * @returns {number} Complexity score (0.0 to 1.0)
   * @private
   */
  _calculateComplexity(doc) {
    const termCount = doc.terms().length || 1;

    // Feature Extraction
    const features = {
      verbDensity: doc.verbs().length / termCount,
      clauseDepth: doc.clauses().length,
      modifierDensity: (doc.adjectives().length + doc.adverbs().length) / termCount,
      structuralDepth: doc.prepositions().length,
    };

    // Weighted Linear Sum
    let rawScore = 0;
    for (const [key, val] of Object.entries(features)) {
      const weight = this.weights[key] || 1;
      rawScore += val * weight;
    }

    // Sigmoid Normalization (0.0 to 1.0)
    // Formula: 1 / (1 + e^(-k * (x - x0)))
    const k = this.sigmoid.k;
    const x0 = this.sigmoid.x0;
    const complexity = 1 / (1 + Math.exp(-k * (rawScore - x0)));

    return complexity;
  }

  /**
   * Detect the tense of verbs in the text
   * @param {Object} doc - Compromise document object
   * @returns {string} Tense: 'past', 'present', 'future', or 'neutral'
   * @private
   */
  _detectTense(doc) {
    const verbs = doc.verbs();

    if (!verbs.found) {
      return 'neutral';
    }

    // Gerunds are tenseless - return neutral
    if (verbs.has('#Gerund')) {
      return 'neutral';
    }

    // Check for specific tenses
    if (verbs.has('#PastTense')) {
      return 'past';
    }

    if (verbs.has('#FutureTense')) {
      return 'future';
    }

    // Default to present for verbs without clear tense marking
    return 'present';
  }

  /**
   * Get default analysis for invalid input
   * @returns {Object} Default analysis object
   * @private
   */
  _getDefaultAnalysis() {
    return {
      structure: 'unknown',
      complexity: 0,
      tense: 'neutral',
      isPlural: false,
      doc: null,
    };
  }
}

export default GrammaticalAnalysisService;

