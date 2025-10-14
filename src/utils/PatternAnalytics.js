/**
 * Analytics system for tracking phrase pattern usage
 *
 * Tracks:
 * - Which phrases get highlighted most often
 * - Which highlights users click on
 * - Pattern effectiveness over time
 * - Category distribution
 */

export class PatternAnalytics {
  constructor() {
    this.storage = this.initializeStorage();
    this.sessionData = {
      highlightsShown: {},
      highlightsClicked: {},
      categoriesUsed: {},
      sessionStart: Date.now(),
    };
  }

  /**
   * Initialize local storage for persistent analytics
   */
  initializeStorage() {
    try {
      const stored = localStorage.getItem('phrasePatternAnalytics');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to load analytics from storage:', e);
    }

    return {
      totalHighlights: 0,
      totalClicks: 0,
      phraseFrequency: {},
      categoryFrequency: {},
      clickedPhrases: {},
      confidenceDistribution: { high: 0, medium: 0, low: 0 },
      lastUpdated: Date.now(),
    };
  }

  /**
   * Save analytics to local storage
   */
  saveToStorage() {
    try {
      this.storage.lastUpdated = Date.now();
      localStorage.setItem('phrasePatternAnalytics', JSON.stringify(this.storage));
    } catch (e) {
      console.warn('Failed to save analytics:', e);
    }
  }

  /**
   * Track a highlighted phrase being shown
   */
  trackHighlight(phrase, category, confidence) {
    // Session tracking
    this.sessionData.highlightsShown[phrase] =
      (this.sessionData.highlightsShown[phrase] || 0) + 1;
    this.sessionData.categoriesUsed[category] =
      (this.sessionData.categoriesUsed[category] || 0) + 1;

    // Persistent storage
    this.storage.totalHighlights++;
    this.storage.phraseFrequency[phrase] =
      (this.storage.phraseFrequency[phrase] || 0) + 1;
    this.storage.categoryFrequency[category] =
      (this.storage.categoryFrequency[category] || 0) + 1;

    // Track confidence distribution
    if (confidence >= 80) this.storage.confidenceDistribution.high++;
    else if (confidence >= 65) this.storage.confidenceDistribution.medium++;
    else this.storage.confidenceDistribution.low++;

    // Save periodically (every 10 highlights)
    if (this.storage.totalHighlights % 10 === 0) {
      this.saveToStorage();
    }
  }

  /**
   * Track when a user clicks on a highlighted phrase
   */
  trackClick(phrase, category) {
    // Session tracking
    this.sessionData.highlightsClicked[phrase] =
      (this.sessionData.highlightsClicked[phrase] || 0) + 1;

    // Persistent storage
    this.storage.totalClicks++;
    this.storage.clickedPhrases[phrase] =
      (this.storage.clickedPhrases[phrase] || 0) + 1;

    this.saveToStorage();
  }

  /**
   * Get top N most frequently highlighted phrases
   */
  getTopHighlightedPhrases(n = 10) {
    return Object.entries(this.storage.phraseFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([phrase, count]) => ({ phrase, count }));
  }

  /**
   * Get top N most clicked phrases
   */
  getTopClickedPhrases(n = 10) {
    return Object.entries(this.storage.clickedPhrases)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([phrase, count]) => ({
        phrase,
        clicks: count,
        shown: this.storage.phraseFrequency[phrase] || 0,
        clickRate: ((count / (this.storage.phraseFrequency[phrase] || 1)) * 100).toFixed(1) + '%',
      }));
  }

  /**
   * Get category usage statistics
   */
  getCategoryStats() {
    const total = Object.values(this.storage.categoryFrequency).reduce((a, b) => a + b, 0);

    return Object.entries(this.storage.categoryFrequency)
      .map(([category, count]) => ({
        category,
        count,
        percentage: ((count / total) * 100).toFixed(1) + '%',
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Get overall effectiveness metrics
   */
  getEffectivenessMetrics() {
    const clickRate = this.storage.totalHighlights > 0
      ? (this.storage.totalClicks / this.storage.totalHighlights * 100).toFixed(2)
      : 0;

    return {
      totalHighlights: this.storage.totalHighlights,
      totalClicks: this.storage.totalClicks,
      clickRate: clickRate + '%',
      uniquePhrases: Object.keys(this.storage.phraseFrequency).length,
      categoriesUsed: Object.keys(this.storage.categoryFrequency).length,
      confidenceDistribution: this.storage.confidenceDistribution,
      averageConfidence: this.calculateAverageConfidence(),
    };
  }

  /**
   * Calculate average confidence score
   */
  calculateAverageConfidence() {
    const dist = this.storage.confidenceDistribution;
    const total = dist.high + dist.medium + dist.low;

    if (total === 0) return 0;

    // Weighted average: high=90, medium=70, low=55
    const weighted = (dist.high * 90) + (dist.medium * 70) + (dist.low * 55);
    return (weighted / total).toFixed(1);
  }

  /**
   * Get session statistics
   */
  getSessionStats() {
    return {
      duration: Math.round((Date.now() - this.sessionData.sessionStart) / 1000) + 's',
      highlightsShown: Object.keys(this.sessionData.highlightsShown).length,
      highlightsClicked: Object.keys(this.sessionData.highlightsClicked).length,
      categoriesUsed: Object.keys(this.sessionData.categoriesUsed).length,
    };
  }

  /**
   * Export all analytics data
   */
  exportData() {
    return {
      storage: this.storage,
      session: this.sessionData,
      metrics: this.getEffectivenessMetrics(),
      topPhrases: this.getTopHighlightedPhrases(20),
      topClicked: this.getTopClickedPhrases(20),
      categoryStats: this.getCategoryStats(),
    };
  }

  /**
   * Clear all analytics data
   */
  clearAll() {
    this.storage = {
      totalHighlights: 0,
      totalClicks: 0,
      phraseFrequency: {},
      categoryFrequency: {},
      clickedPhrases: {},
      confidenceDistribution: { high: 0, medium: 0, low: 0 },
      lastUpdated: Date.now(),
    };

    this.sessionData = {
      highlightsShown: {},
      highlightsClicked: {},
      categoriesUsed: {},
      sessionStart: Date.now(),
    };

    this.saveToStorage();
  }

  /**
   * Get insights and recommendations
   */
  getInsights() {
    const insights = [];

    // Check if confidence is too low overall
    const avgConfidence = parseFloat(this.calculateAverageConfidence());
    if (avgConfidence < 65) {
      insights.push({
        type: 'warning',
        message: `Average confidence (${avgConfidence}) is low. Consider reviewing pattern definitions.`,
      });
    }

    // Check if click rate is low
    const clickRate = parseFloat(this.getEffectivenessMetrics().clickRate);
    if (clickRate < 5 && this.storage.totalHighlights > 50) {
      insights.push({
        type: 'info',
        message: `Low click rate (${clickRate}%). Users may not find highlights useful.`,
      });
    }

    // Find underutilized categories
    const catStats = this.getCategoryStats();
    const lowUsageCategories = catStats.filter(c => parseFloat(c.percentage) < 5);
    if (lowUsageCategories.length > 0) {
      insights.push({
        type: 'info',
        message: `Categories with low usage: ${lowUsageCategories.map(c => c.category).join(', ')}`,
      });
    }

    return insights;
  }
}

// Export singleton
export const patternAnalytics = new PatternAnalytics();
