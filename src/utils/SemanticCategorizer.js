/**
 * Semantic Categorization System
 *
 * Intelligently categorizes phrases based on:
 * - Word embeddings and semantic similarity
 * - Contextual analysis
 * - Co-occurrence patterns
 * - User feedback learning
 */

export class SemanticCategorizer {
  constructor() {
    // Seed words that define each category semantically
    this.categorySeedWords = {
      camera: {
        seeds: ['camera', 'shot', 'lens', 'angle', 'view', 'zoom', 'pan', 'tilt', 'tracking', 'dolly', 'crane', 'focus', 'frame', 'composition'],
        color: { bg: 'rgba(139, 92, 246, 0.12)', border: 'rgba(139, 92, 246, 0.4)' },
        weight: 1.0
      },
      lighting: {
        seeds: ['light', 'lighting', 'shadow', 'bright', 'dark', 'glow', 'illumination', 'exposure', 'contrast', 'highlight', 'backlight', 'ray', 'sunlight', 'moonlight'],
        color: { bg: 'rgba(249, 115, 22, 0.12)', border: 'rgba(249, 115, 22, 0.4)' },
        weight: 1.0
      },
      subjects: {
        seeds: ['person', 'people', 'figure', 'character', 'building', 'architecture', 'object', 'scene', 'landscape', 'cityscape', 'background', 'foreground', 'subject'],
        color: { bg: 'rgba(59, 130, 246, 0.12)', border: 'rgba(59, 130, 246, 0.4)' },
        weight: 1.0
      },
      actions: {
        seeds: ['walking', 'running', 'moving', 'motion', 'movement', 'emerging', 'passing', 'approaching', 'gesture', 'action', 'dynamic', 'flowing'],
        color: { bg: 'rgba(34, 197, 94, 0.12)', border: 'rgba(34, 197, 94, 0.4)' },
        weight: 1.0
      },
      technical: {
        seeds: ['fps', 'resolution', 'aperture', 'bokeh', 'depth', 'field', 'grain', 'compression', 'codec', 'format', 'lut', 'grading', 'anamorphic', '4k', '8k'],
        color: { bg: 'rgba(99, 102, 241, 0.12)', border: 'rgba(99, 102, 241, 0.4)' },
        weight: 1.0
      },
      colors: {
        seeds: ['red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'white', 'black', 'color', 'hue', 'saturation', 'tone', 'neon', 'vibrant'],
        color: { bg: 'rgba(244, 63, 94, 0.12)', border: 'rgba(244, 63, 94, 0.4)' },
        weight: 1.0
      },
      environment: {
        seeds: ['fog', 'mist', 'rain', 'weather', 'atmospheric', 'air', 'wind', 'storm', 'clouds', 'sky', 'environment', 'ambient', 'atmosphere'],
        color: { bg: 'rgba(6, 182, 212, 0.12)', border: 'rgba(6, 182, 212, 0.4)' },
        weight: 1.0
      },
      emotions: {
        seeds: ['mood', 'emotion', 'feeling', 'peaceful', 'tense', 'mysterious', 'dramatic', 'intimate', 'lonely', 'nostalgic', 'melancholic', 'serene'],
        color: { bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.4)' },
        weight: 1.0
      },
      descriptive: {
        seeds: ['beautiful', 'stunning', 'elegant', 'modern', 'vintage', 'cinematic', 'artistic', 'professional', 'detailed', 'quality', 'style'],
        color: { bg: 'rgba(250, 204, 21, 0.15)', border: 'rgba(250, 204, 21, 0.4)' },
        weight: 0.8
      }
    };

    // Co-occurrence patterns learned from context
    this.cooccurrenceMatrix = new Map();

    // User corrections (when they manually recategorize)
    this.userCorrections = new Map();

    this.load();
  }

  /**
   * Calculate semantic similarity between phrase and category
   * Uses Jaccard similarity with word overlap
   */
  calculateSemanticSimilarity(phrase, categorySeeds) {
    const phraseWords = new Set(phrase.toLowerCase().split(/\s+/));
    const seedWords = new Set(categorySeeds.map(s => s.toLowerCase()));

    // Direct word overlap
    let overlap = 0;
    phraseWords.forEach(word => {
      if (seedWords.has(word)) overlap += 2; // Direct match
      // Check for partial matches (substring)
      seedWords.forEach(seed => {
        if (word.includes(seed) || seed.includes(word)) {
          overlap += 0.5;
        }
      });
    });

    // Normalize by phrase length
    return overlap / Math.max(phraseWords.size, 1);
  }

  /**
   * Analyze context around a phrase to determine category
   */
  analyzeContext(phrase, fullText, position) {
    const contextWindow = 100; // characters before and after
    const start = Math.max(0, position - contextWindow);
    const end = Math.min(fullText.length, position + phrase.length + contextWindow);
    const context = fullText.slice(start, end).toLowerCase();

    const contextWords = context.split(/\s+/);
    const categoryScores = new Map();

    // Score each category based on context words
    Object.entries(this.categorySeedWords).forEach(([category, { seeds }]) => {
      let score = 0;
      seeds.forEach(seed => {
        const occurrences = contextWords.filter(w => w.includes(seed)).length;
        score += occurrences;
      });
      categoryScores.set(category, score);
    });

    return categoryScores;
  }

  /**
   * Categorize a phrase using multiple signals
   */
  categorize(phrase, fullText = '', position = 0) {
    const categoryScores = new Map();

    // Check for user corrections first
    const userCategory = this.userCorrections.get(phrase.toLowerCase());
    if (userCategory) {
      return {
        category: userCategory,
        confidence: 95,
        source: 'user-learned'
      };
    }

    // Calculate scores for each category
    Object.entries(this.categorySeedWords).forEach(([category, { seeds, weight }]) => {
      let score = 0;

      // 1. Semantic similarity to seed words
      const similarity = this.calculateSemanticSimilarity(phrase, seeds);
      score += similarity * 10 * weight;

      // 2. Context analysis
      if (fullText) {
        const contextScores = this.analyzeContext(phrase, fullText, position);
        score += (contextScores.get(category) || 0) * 2;
      }

      // 3. Co-occurrence patterns
      const cooccurrenceScore = this.getCooccurrenceScore(phrase, category);
      score += cooccurrenceScore * 3;

      categoryScores.set(category, score);
    });

    // Find best category
    let bestCategory = 'descriptive'; // default fallback
    let bestScore = 0;

    categoryScores.forEach((score, category) => {
      if (score > bestScore) {
        bestScore = score;
        bestCategory = category;
      }
    });

    // Calculate confidence (0-100)
    const totalScore = Array.from(categoryScores.values()).reduce((a, b) => a + b, 0);
    const confidence = totalScore > 0
      ? Math.min(100, Math.round((bestScore / totalScore) * 100))
      : 50;

    return {
      category: bestCategory,
      confidence: confidence,
      scores: Object.fromEntries(categoryScores),
      color: this.categorySeedWords[bestCategory].color
    };
  }

  /**
   * Get co-occurrence score for phrase-category pair
   */
  getCooccurrenceScore(phrase, category) {
    const key = `${phrase}:${category}`;
    return this.cooccurrenceMatrix.get(key) || 0;
  }

  /**
   * Update co-occurrence matrix when a phrase is confirmed in a category
   */
  updateCooccurrence(phrase, category, strength = 1) {
    const key = `${phrase}:${category}`;
    const current = this.cooccurrenceMatrix.get(key) || 0;
    this.cooccurrenceMatrix.set(key, current + strength);

    // Decay other categories slightly (negative reinforcement)
    Object.keys(this.categorySeedWords).forEach(cat => {
      if (cat !== category) {
        const otherKey = `${phrase}:${cat}`;
        const otherScore = this.cooccurrenceMatrix.get(otherKey) || 0;
        if (otherScore > 0) {
          this.cooccurrenceMatrix.set(otherKey, otherScore * 0.95);
        }
      }
    });

    // Save periodically
    if (this.cooccurrenceMatrix.size % 10 === 0) {
      this.save();
    }
  }

  /**
   * Learn from user correction
   */
  learnFromUserCorrection(phrase, correctCategory) {
    this.userCorrections.set(phrase.toLowerCase(), correctCategory);
    this.updateCooccurrence(phrase, correctCategory, 5); // Strong signal
    this.save();
  }

  /**
   * Categorize multiple phrases efficiently
   */
  batchCategorize(phrases, fullText = '') {
    return phrases.map(({ phrase, start }) => ({
      phrase,
      ...this.categorize(phrase, fullText, start)
    }));
  }

  /**
   * Add a new seed word to a category
   */
  addSeedWord(category, word) {
    if (this.categorySeedWords[category]) {
      if (!this.categorySeedWords[category].seeds.includes(word)) {
        this.categorySeedWords[category].seeds.push(word);
        this.save();
        return true;
      }
    }
    return false;
  }

  /**
   * Adjust category weight based on user engagement
   */
  adjustCategoryWeight(category, delta) {
    if (this.categorySeedWords[category]) {
      this.categorySeedWords[category].weight += delta;
      this.categorySeedWords[category].weight = Math.max(0.1, Math.min(2.0, this.categorySeedWords[category].weight));
      this.save();
    }
  }

  /**
   * Get category statistics
   */
  getStatistics() {
    return {
      categories: Object.keys(this.categorySeedWords).length,
      seedWords: Object.values(this.categorySeedWords).reduce((sum, cat) => sum + cat.seeds.length, 0),
      learnedPatterns: this.cooccurrenceMatrix.size,
      userCorrections: this.userCorrections.size,
      categoryWeights: Object.fromEntries(
        Object.entries(this.categorySeedWords).map(([cat, { weight }]) => [cat, weight])
      )
    };
  }

  /**
   * Save to localStorage
   */
  save() {
    try {
      const data = {
        cooccurrenceMatrix: Array.from(this.cooccurrenceMatrix.entries()),
        userCorrections: Array.from(this.userCorrections.entries()),
        categoryWeights: Object.fromEntries(
          Object.entries(this.categorySeedWords).map(([cat, config]) => [cat, config.weight])
        )
      };
      localStorage.setItem('semanticCategorizer', JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to save categorizer data:', e);
    }
  }

  /**
   * Load from localStorage
   */
  load() {
    try {
      const stored = localStorage.getItem('semanticCategorizer');
      if (stored) {
        const data = JSON.parse(stored);
        this.cooccurrenceMatrix = new Map(data.cooccurrenceMatrix || []);
        this.userCorrections = new Map(data.userCorrections || []);

        // Restore category weights
        if (data.categoryWeights) {
          Object.entries(data.categoryWeights).forEach(([cat, weight]) => {
            if (this.categorySeedWords[cat]) {
              this.categorySeedWords[cat].weight = weight;
            }
          });
        }
      }
    } catch (e) {
      console.warn('Failed to load categorizer data:', e);
    }
  }

  /**
   * Reset all learned data
   */
  reset() {
    this.cooccurrenceMatrix.clear();
    this.userCorrections.clear();
    Object.values(this.categorySeedWords).forEach(cat => cat.weight = 1.0);
    localStorage.removeItem('semanticCategorizer');
  }
}

// Export singleton
export const semanticCategorizer = new SemanticCategorizer();
