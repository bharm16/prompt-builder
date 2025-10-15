/**
 * Intelligent Phrase Extraction System
 *
 * Uses statistical NLP techniques to automatically identify important phrases:
 * - TF-IDF for term importance
 * - N-gram extraction for multi-word phrases
 * - Collocation detection for meaningful combinations
 * - Part-of-speech awareness for technical terms
 */

export class IntelligentPhraseExtractor {
  constructor() {
    // Document frequency tracking (for TF-IDF)
    this.documentFrequency = new Map();
    this.totalDocuments = 0;

    // N-gram statistics
    this.ngramFrequency = new Map();

    // Regex cache for performance (compiled regexes)
    this.regexCache = new Map();

    // Stopwords to filter out
    this.stopwords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
      'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'should', 'could', 'may', 'might', 'must', 'can', 'this', 'that',
      'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they'
    ]);

    // Technical domain indicators (cinematography/creative)
    this.technicalIndicators = new Set([
      'shot', 'camera', 'lens', 'focus', 'light', 'lighting', 'shadow',
      'frame', 'angle', 'motion', 'depth', 'field', 'exposure', 'fps',
      'zoom', 'pan', 'tilt', 'dolly', 'crane', 'aerial', 'bokeh',
      'color', 'grade', 'grading', 'lut', 'grain', 'contrast', 'saturation'
    ]);
  }

  /**
   * Get or create cached regex for a phrase
   */
  getCachedRegex(phrase, flags = 'gi') {
    const cacheKey = `${phrase}::${flags}`;

    if (!this.regexCache.has(cacheKey)) {
      const escapedPhrase = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedPhrase}\\b`, flags);
      this.regexCache.set(cacheKey, regex);

      // Limit cache size to prevent memory leaks
      if (this.regexCache.size > 500) {
        const firstKey = this.regexCache.keys().next().value;
        this.regexCache.delete(firstKey);
      }
    }

    return this.regexCache.get(cacheKey);
  }

  /**
   * Simple stemmer for common word variations
   */
  stem(word) {
    // Common suffixes removal (basic Porter stemmer approach)
    const suffixes = [
      { pattern: /ing$/, replacement: '' },
      { pattern: /ed$/, replacement: '' },
      { pattern: /s$/, replacement: '' },
      { pattern: /es$/, replacement: '' },
      { pattern: /ies$/, replacement: 'y' },
      { pattern: /er$/, replacement: '' },
      { pattern: /est$/, replacement: '' },
      { pattern: /ly$/, replacement: '' },
    ];

    let stemmed = word.toLowerCase();

    // Only stem if word is long enough
    if (stemmed.length > 4) {
      for (const { pattern, replacement } of suffixes) {
        if (pattern.test(stemmed)) {
          stemmed = stemmed.replace(pattern, replacement);
          break;
        }
      }
    }

    return stemmed;
  }

  /**
   * Tokenize text into words with optional stemming
   */
  tokenize(text, applyStemming = false) {
    const tokens = text
      .toLowerCase()
      .replace(/[^\w\s'-]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 0);

    return applyStemming ? tokens.map(t => this.stem(t)) : tokens;
  }

  /**
   * Extract n-grams (phrases) from tokens - OPTIMIZED O(n)
   */
  extractNgrams(tokens, n) {
    const ngrams = [];

    // Pre-filter: mark stopword positions
    const isStopword = tokens.map(t => this.stopwords.has(t));

    for (let i = 0; i <= tokens.length - n; i++) {
      // Skip if starts with stopword (for n > 1)
      // We allow ending with stopwords since phrases like "depth of field" are valid
      if (n > 1 && isStopword[i]) {
        continue;
      }

      const ngram = tokens.slice(i, i + n).join(' ');
      ngrams.push(ngram);
    }
    return ngrams;
  }

  /**
   * Calculate term frequency in document - FIXED with caching
   */
  calculateTF(term, tokens) {
    const text = tokens.join(' ');
    const regex = this.getCachedRegex(term, 'g');
    const matches = text.match(regex);
    const termCount = matches ? matches.length : 0;
    return termCount / Math.max(1, tokens.length);
  }

  /**
   * Calculate inverse document frequency
   */
  calculateIDF(term) {
    const docFreq = this.documentFrequency.get(term) || 0;
    if (docFreq === 0) return 0;
    return Math.log(this.totalDocuments / docFreq);
  }

  /**
   * Calculate TF-IDF score for a term
   */
  calculateTFIDF(term, tokens) {
    const tf = this.calculateTF(term, tokens);
    const idf = this.calculateIDF(term);
    return tf * idf;
  }

  /**
   * Update document frequency statistics
   */
  updateStatistics(text) {
    const tokens = this.tokenize(text);
    const uniqueTerms = new Set();

    // Update for unigrams
    tokens.forEach(token => uniqueTerms.add(token));

    // Update for bigrams and trigrams
    [2, 3, 4].forEach(n => {
      const ngrams = this.extractNgrams(tokens, n);
      ngrams.forEach(ngram => uniqueTerms.add(ngram));
    });

    // Update document frequencies
    uniqueTerms.forEach(term => {
      this.documentFrequency.set(term, (this.documentFrequency.get(term) || 0) + 1);
    });

    this.totalDocuments++;
  }

  /**
   * Calculate collocation score (likelihood of words appearing together)
   * Using Pointwise Mutual Information (PMI)
   */
  calculatePMI(ngram) {
    const words = ngram.split(' ');
    if (words.length < 2) return 0;

    const ngramFreq = this.ngramFrequency.get(ngram) || 0;
    if (ngramFreq === 0) return 0;

    // P(x,y) / (P(x) * P(y))
    const pNgram = ngramFreq / this.totalDocuments;
    const pIndividual = words.map(w =>
      (this.documentFrequency.get(w) || 0) / this.totalDocuments
    );

    const pProduct = pIndividual.reduce((a, b) => a * b, 1);
    if (pProduct === 0) return 0;

    return Math.log2(pNgram / pProduct);
  }

  /**
   * Check if phrase is likely technical/domain-specific
   */
  isTechnicalPhrase(phrase) {
    const words = phrase.toLowerCase().split(' ');
    return words.some(word => this.technicalIndicators.has(word));
  }

  /**
   * Extract important phrases from text using statistical methods
   * Returns: Array of {phrase, score, type, context}
   */
  extractImportantPhrases(text, minScore = 0.1) {
    const tokens = this.tokenize(text);
    const phrases = [];

    // Extract candidate phrases (1-4 grams)
    const candidates = new Map();

    // Unigrams
    tokens.forEach(token => {
      if (!this.stopwords.has(token) && token.length > 2) {
        candidates.set(token, { length: 1 });
      }
    });

    // Multi-word phrases (2-4 grams)
    [2, 3, 4].forEach(n => {
      const ngrams = this.extractNgrams(tokens, n);
      ngrams.forEach(ngram => {
        candidates.set(ngram, { length: n });
      });
    });

    // Score each candidate
    candidates.forEach((meta, phrase) => {
      let score = 0;

      // TF-IDF score
      const tfidf = this.calculateTFIDF(phrase, tokens);
      score += tfidf * 10;

      // Length bonus (prefer meaningful phrases over single words)
      score += meta.length * 2;

      // Technical domain bonus
      if (this.isTechnicalPhrase(phrase)) {
        score += 5;
      }

      // Collocation score for multi-word phrases
      if (meta.length > 1) {
        const pmi = this.calculatePMI(phrase);
        if (pmi > 0) {
          score += pmi * 3;
        }
      }

      // Capitalization bonus (proper nouns/technical terms)
      const originalMatches = text.match(new RegExp(`\\b${phrase}\\b`, 'gi')) || [];
      const capitalizedMatches = originalMatches.filter(m => /[A-Z]/.test(m));
      if (capitalizedMatches.length > originalMatches.length * 0.3) {
        score += 2;
      }

      if (score >= minScore) {
        phrases.push({
          phrase,
          score,
          length: meta.length,
          frequency: this.documentFrequency.get(phrase) || 0,
          isTechnical: this.isTechnicalPhrase(phrase)
        });
      }
    });

    // Sort by score (highest first)
    return phrases.sort((a, b) => b.score - a.score);
  }

  /**
   * Find all occurrences of phrases in text with positions - with caching
   */
  findPhraseOccurrences(text, phrases) {
    const matches = [];

    phrases.forEach(({ phrase, score, isTechnical }) => {
      const regex = this.getCachedRegex(phrase, 'gi');
      // Reset regex lastIndex to avoid issues with cached regexes
      regex.lastIndex = 0;
      let match;

      while ((match = regex.exec(text)) !== null) {
        matches.push({
          text: match[0],
          phrase: phrase,
          start: match.index,
          end: match.index + match[0].length,
          score: score,
          length: phrase.split(' ').length,
          isTechnical: isTechnical
        });
      }
    });

    return matches;
  }

  /**
   * Get statistics about learned patterns
   */
  getStatistics() {
    return {
      totalDocuments: this.totalDocuments,
      uniqueTerms: this.documentFrequency.size,
      topTerms: Array.from(this.documentFrequency.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([term, freq]) => ({ term, freq }))
    };
  }

  /**
   * Save learned statistics to localStorage
   */
  save() {
    try {
      const data = {
        documentFrequency: Array.from(this.documentFrequency.entries()),
        ngramFrequency: Array.from(this.ngramFrequency.entries()),
        totalDocuments: this.totalDocuments
      };
      localStorage.setItem('intelligentPhraseExtractor', JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to save phrase extractor data:', e);
    }
  }

  /**
   * Load learned statistics from localStorage
   */
  load() {
    try {
      const stored = localStorage.getItem('intelligentPhraseExtractor');
      if (stored) {
        const data = JSON.parse(stored);
        this.documentFrequency = new Map(data.documentFrequency);
        this.ngramFrequency = new Map(data.ngramFrequency);
        this.totalDocuments = data.totalDocuments;
        return true;
      }
    } catch (e) {
      console.warn('Failed to load phrase extractor data:', e);
    }
    return false;
  }

  /**
   * Reset all learned data
   */
  reset() {
    this.documentFrequency.clear();
    this.ngramFrequency.clear();
    this.totalDocuments = 0;
    localStorage.removeItem('intelligentPhraseExtractor');
  }
}

// Export singleton
export const intelligentExtractor = new IntelligentPhraseExtractor();
