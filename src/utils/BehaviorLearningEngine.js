/**
 * User Behavior Learning Engine
 *
 * Learns from user interactions to improve pattern recognition:
 * - Tracks which highlights users click vs ignore
 * - Adjusts importance scores based on engagement
 * - Implements reinforcement learning
 * - Adapts to user preferences over time
 */

export class BehaviorLearningEngine {
  constructor() {
    // Phrase engagement tracking
    this.phraseEngagement = new Map(); // {phrase: {shown, clicked, ignored, score}}

    // Category engagement tracking
    this.categoryEngagement = new Map(); // {category: {shown, clicked, clickRate}}

    // Time-based decay for relevance
    this.lastInteraction = Date.now();

    // Learning rate (how quickly to adapt)
    this.learningRate = 0.1;

    // Exploration vs exploitation balance
    this.explorationRate = 0.15; // 15% chance to show uncertain patterns

    this.load();
  }

  /**
   * Record that a phrase was highlighted (shown to user)
   */
  recordShown(phrase, category, confidence) {
    // Update phrase engagement
    const phraseKey = phrase.toLowerCase();
    const phraseData = this.phraseEngagement.get(phraseKey) || {
      shown: 0,
      clicked: 0,
      ignored: 0,
      totalConfidence: 0,
      score: 0.5, // Start neutral
      firstSeen: Date.now(),
      lastSeen: Date.now()
    };

    phraseData.shown++;
    phraseData.totalConfidence += confidence;
    phraseData.lastSeen = Date.now();

    this.phraseEngagement.set(phraseKey, phraseData);

    // Update category engagement
    const categoryData = this.categoryEngagement.get(category) || {
      shown: 0,
      clicked: 0
    };

    categoryData.shown++;
    this.categoryEngagement.set(category, categoryData);

    this.lastInteraction = Date.now();
  }

  /**
   * Record that user clicked on a phrase
   */
  recordClick(phrase, category) {
    const phraseKey = phrase.toLowerCase();
    const phraseData = this.phraseEngagement.get(phraseKey);

    if (phraseData) {
      phraseData.clicked++;

      // Positive reinforcement: increase score
      phraseData.score = Math.min(1.0, phraseData.score + this.learningRate);

      this.phraseEngagement.set(phraseKey, phraseData);
    }

    // Update category engagement
    const categoryData = this.categoryEngagement.get(category);
    if (categoryData) {
      categoryData.clicked++;
      this.categoryEngagement.set(category, categoryData);
    }

    this.lastInteraction = Date.now();
    this.save();
  }

  /**
   * Record that user ignored a phrase (shown but not clicked for 5+ seconds)
   */
  recordIgnored(phrase) {
    const phraseKey = phrase.toLowerCase();
    const phraseData = this.phraseEngagement.get(phraseKey);

    if (phraseData) {
      phraseData.ignored++;

      // Negative reinforcement: decrease score slightly
      phraseData.score = Math.max(0.0, phraseData.score - (this.learningRate * 0.5));

      this.phraseEngagement.set(phraseKey, phraseData);
    }

    this.lastInteraction = Date.now();
    this.save();
  }

  /**
   * Get learned score for a phrase (0-1, where 1 is highly engaging)
   */
  getPhraseScore(phrase) {
    const phraseKey = phrase.toLowerCase();
    const data = this.phraseEngagement.get(phraseKey);

    if (!data) {
      return 0.5; // Neutral for unknown phrases
    }

    // Calculate click-through rate
    const ctr = data.shown > 0 ? data.clicked / data.shown : 0;

    // Combine learned score with empirical CTR
    const combinedScore = (data.score * 0.7) + (ctr * 0.3);

    // Apply time decay (older patterns matter less)
    const daysSinceLastSeen = (Date.now() - data.lastSeen) / (1000 * 60 * 60 * 24);
    const decayFactor = Math.exp(-daysSinceLastSeen / 30); // 30-day half-life

    return combinedScore * decayFactor;
  }

  /**
   * Get category engagement score
   */
  getCategoryScore(category) {
    const data = this.categoryEngagement.get(category);
    if (!data || data.shown === 0) {
      return 0.5; // Neutral
    }

    return data.clicked / data.shown;
  }

  /**
   * Adjust confidence score based on learned behavior
   */
  adjustConfidence(phrase, category, baseConfidence) {
    const phraseScore = this.getPhraseScore(phrase);
    const categoryScore = this.getCategoryScore(category);

    // Weighted combination
    const behaviorBoost = (phraseScore * 0.7) + (categoryScore * 0.3);

    // Apply boost/penalty to base confidence
    const adjustment = (behaviorBoost - 0.5) * 40; // -20 to +20 point adjustment

    return Math.max(0, Math.min(100, baseConfidence + adjustment));
  }

  /**
   * Decide if a phrase should be shown (exploration vs exploitation)
   */
  shouldShow(phrase, category, confidence) {
    const adjustedConfidence = this.adjustConfidence(phrase, category, confidence);

    // Exploration: occasionally show uncertain patterns
    if (Math.random() < this.explorationRate) {
      return adjustedConfidence > 30; // Lower threshold for exploration
    }

    // Exploitation: show high-confidence patterns
    return adjustedConfidence >= 50;
  }

  /**
   * Get top performing phrases
   */
  getTopPhrases(n = 20) {
    return Array.from(this.phraseEngagement.entries())
      .map(([phrase, data]) => ({
        phrase,
        score: this.getPhraseScore(phrase),
        clickRate: data.shown > 0 ? (data.clicked / data.shown * 100).toFixed(1) + '%' : '0%',
        shown: data.shown,
        clicked: data.clicked
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, n);
  }

  /**
   * Get underperforming phrases that should maybe be removed
   */
  getUnderperformingPhrases(n = 20) {
    return Array.from(this.phraseEngagement.entries())
      .filter(([, data]) => data.shown >= 5) // Need enough data
      .map(([phrase, data]) => ({
        phrase,
        score: this.getPhraseScore(phrase),
        clickRate: data.shown > 0 ? (data.clicked / data.shown * 100).toFixed(1) + '%' : '0%',
        shown: data.shown,
        clicked: data.clicked,
        ignored: data.ignored
      }))
      .sort((a, b) => a.score - b.score)
      .slice(0, n);
  }

  /**
   * Get category performance metrics
   */
  getCategoryMetrics() {
    return Array.from(this.categoryEngagement.entries())
      .map(([category, data]) => ({
        category,
        shown: data.shown,
        clicked: data.clicked,
        clickRate: data.shown > 0 ? (data.clicked / data.shown * 100).toFixed(1) + '%' : '0%',
        score: this.getCategoryScore(category)
      }))
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Get insights about user behavior
   */
  getInsights() {
    const insights = [];

    // Check for low-engagement categories
    const categoryMetrics = this.getCategoryMetrics();
    const lowEngagement = categoryMetrics.filter(c =>
      parseFloat(c.clickRate) < 10 && c.shown > 20
    );

    if (lowEngagement.length > 0) {
      insights.push({
        type: 'warning',
        category: 'engagement',
        message: `Low engagement in categories: ${lowEngagement.map(c => c.category).join(', ')}`,
        suggestion: 'Consider reducing highlight frequency for these categories'
      });
    }

    // Check for highly engaging categories
    const highEngagement = categoryMetrics.filter(c =>
      parseFloat(c.clickRate) > 30 && c.shown > 20
    );

    if (highEngagement.length > 0) {
      insights.push({
        type: 'success',
        category: 'engagement',
        message: `High engagement in categories: ${highEngagement.map(c => c.category).join(', ')}`,
        suggestion: 'These categories resonate well with users'
      });
    }

    // Check if we need more exploration
    const totalPhrases = this.phraseEngagement.size;
    const seenOnce = Array.from(this.phraseEngagement.values()).filter(d => d.shown === 1).length;

    if (totalPhrases > 0 && seenOnce / totalPhrases > 0.5) {
      insights.push({
        type: 'info',
        category: 'exploration',
        message: 'Many phrases shown only once. Need more data to learn preferences.',
        suggestion: 'System is still exploring. Patterns will improve with more usage.'
      });
    }

    return insights;
  }

  /**
   * Get statistics
   */
  getStatistics() {
    const allPhrases = Array.from(this.phraseEngagement.values());
    const totalShown = allPhrases.reduce((sum, d) => sum + d.shown, 0);
    const totalClicked = allPhrases.reduce((sum, d) => sum + d.clicked, 0);

    return {
      totalPhrases: this.phraseEngagement.size,
      totalCategories: this.categoryEngagement.size,
      totalInteractions: totalShown,
      totalClicks: totalClicked,
      overallClickRate: totalShown > 0 ? (totalClicked / totalShown * 100).toFixed(2) + '%' : '0%',
      learningRate: this.learningRate,
      explorationRate: this.explorationRate * 100 + '%'
    };
  }

  /**
   * Adjust learning rate
   */
  setLearningRate(rate) {
    this.learningRate = Math.max(0.01, Math.min(1.0, rate));
    this.save();
  }

  /**
   * Adjust exploration rate
   */
  setExplorationRate(rate) {
    this.explorationRate = Math.max(0.0, Math.min(1.0, rate));
    this.save();
  }

  /**
   * Save to localStorage
   */
  save() {
    try {
      const data = {
        phraseEngagement: Array.from(this.phraseEngagement.entries()),
        categoryEngagement: Array.from(this.categoryEngagement.entries()),
        learningRate: this.learningRate,
        explorationRate: this.explorationRate,
        lastInteraction: this.lastInteraction
      };
      localStorage.setItem('behaviorLearningEngine', JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to save behavior learning data:', e);
    }
  }

  /**
   * Load from localStorage
   */
  load() {
    try {
      const stored = localStorage.getItem('behaviorLearningEngine');
      if (stored) {
        const data = JSON.parse(stored);
        this.phraseEngagement = new Map(data.phraseEngagement || []);
        this.categoryEngagement = new Map(data.categoryEngagement || []);
        this.learningRate = data.learningRate || 0.1;
        this.explorationRate = data.explorationRate || 0.15;
        this.lastInteraction = data.lastInteraction || Date.now();
      }
    } catch (e) {
      console.warn('Failed to load behavior learning data:', e);
    }
  }

  /**
   * Reset all learned data
   */
  reset() {
    this.phraseEngagement.clear();
    this.categoryEngagement.clear();
    this.learningRate = 0.1;
    this.explorationRate = 0.15;
    this.lastInteraction = Date.now();
    localStorage.removeItem('behaviorLearningEngine');
  }

  /**
   * Export all data for analysis
   */
  exportData() {
    return {
      phrases: Array.from(this.phraseEngagement.entries()).map(([phrase, data]) => ({
        phrase,
        ...data,
        score: this.getPhraseScore(phrase)
      })),
      categories: this.getCategoryMetrics(),
      statistics: this.getStatistics(),
      insights: this.getInsights()
    };
  }
}

// Export singleton
export const behaviorLearner = new BehaviorLearningEngine();
