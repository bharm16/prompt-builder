import { logger } from '../infrastructure/Logger.js';

/**
 * Shared context manager for cross-service intelligence
 * Manages session context, user history, and cross-service insights
 */
export class PromptContextManager {
  constructor() {
    this.sessionContext = new Map();
    this.userHistory = new Map();
    this.patternCache = new Map();
    this.insightsCache = new Map();
  }

  /**
   * Enrich a prompt with contextual information
   * @param {string} prompt - The prompt to enrich
   * @param {string} userId - User identifier
   * @param {string} service - Service requesting enrichment
   * @returns {Promise<Object>} Enriched prompt with context
   */
  async enrichWithContext(prompt, userId, service) {
    logger.info('Enriching prompt with context', { userId, service });

    // Gather all context sources
    const history = this.getUserHistory(userId);
    const session = this.getSessionContext(userId);
    const insights = await this.gatherCrossServiceInsights(prompt, userId);
    const patterns = this.detectPatterns(history);

    const enrichedContext = {
      prompt,
      userId,
      service,
      context: {
        history: {
          recentPrompts: history.slice(-5),
          promptCount: history.length,
          averageLength: this.calculateAverageLength(history),
          commonTopics: this.extractCommonTopics(history),
        },
        session: {
          duration: session.duration || 0,
          interactions: session.interactions || 0,
          lastService: session.lastService,
          currentMode: session.mode,
        },
        insights: {
          domain: insights.domain,
          complexity: insights.complexity,
          userExpertise: insights.expertise,
          suggestedEnhancements: insights.enhancements,
        },
        patterns: {
          preferredStyle: patterns.style,
          commonRequests: patterns.requests,
          improvementAreas: patterns.improvements,
        },
      },
    };

    logger.debug('Context enrichment complete', {
      historyItems: history.length,
      insightsFound: Object.keys(insights).length,
    });

    return enrichedContext;
  }

  /**
   * Record a user interaction for learning
   * @param {string} userId - User identifier
   * @param {Object} interaction - Interaction details
   */
  recordInteraction(userId, interaction) {
    if (!this.userHistory.has(userId)) {
      this.userHistory.set(userId, []);
    }

    const history = this.userHistory.get(userId);
    history.push({
      ...interaction,
      timestamp: Date.now(),
    });

    // Limit history size
    if (history.length > 100) {
      history.shift();
    }

    // Update session context
    this.updateSessionContext(userId, interaction);

    logger.debug('Recorded interaction', { userId, type: interaction.type });
  }

  /**
   * Update session context
   * @private
   */
  updateSessionContext(userId, interaction) {
    if (!this.sessionContext.has(userId)) {
      this.sessionContext.set(userId, {
        startTime: Date.now(),
        interactions: 0,
      });
    }

    const session = this.sessionContext.get(userId);
    session.interactions++;
    session.lastService = interaction.service;
    session.mode = interaction.mode || session.mode;
    session.duration = Date.now() - session.startTime;
  }

  /**
   * Get user history
   * @private
   */
  getUserHistory(userId) {
    return this.userHistory.get(userId) || [];
  }

  /**
   * Get session context
   * @private
   */
  getSessionContext(userId) {
    return this.sessionContext.get(userId) || {};
  }

  /**
   * Gather cross-service insights
   * @private
   */
  async gatherCrossServiceInsights(prompt, userId) {
    const cacheKey = `${userId}_${prompt.substring(0, 50)}`;

    // Check cache
    if (this.insightsCache.has(cacheKey)) {
      return this.insightsCache.get(cacheKey);
    }

    const insights = {
      domain: this.detectDomain(prompt),
      complexity: this.assessComplexity(prompt),
      expertise: this.inferUserExpertise(userId),
      enhancements: this.suggestEnhancements(prompt),
    };

    // Cache insights
    this.insightsCache.set(cacheKey, insights);

    // Clean old cache entries
    if (this.insightsCache.size > 100) {
      const firstKey = this.insightsCache.keys().next().value;
      this.insightsCache.delete(firstKey);
    }

    return insights;
  }

  /**
   * Detect domain from prompt
   * @private
   */
  detectDomain(prompt) {
    const promptLower = prompt.toLowerCase();
    const domains = {
      technical: ['code', 'api', 'debug', 'function', 'algorithm'],
      creative: ['write', 'story', 'create', 'design', 'imagine'],
      analytical: ['analyze', 'data', 'statistics', 'compare', 'evaluate'],
      educational: ['teach', 'learn', 'explain', 'understand', 'how'],
    };

    for (const [domain, keywords] of Object.entries(domains)) {
      if (keywords.some(keyword => promptLower.includes(keyword))) {
        return domain;
      }
    }

    return 'general';
  }

  /**
   * Assess prompt complexity
   * @private
   */
  assessComplexity(prompt) {
    const factors = {
      length: prompt.length / 500,
      sentences: (prompt.match(/[.!?]/g) || []).length / 5,
      technicalTerms: (prompt.match(/\b[A-Z]{2,}\b/g) || []).length / 3,
      nestedClauses: (prompt.match(/\(.*?\)/g) || []).length / 2,
    };

    const complexity = Object.values(factors).reduce((a, b) => a + b, 0) / 4;
    return Math.min(complexity, 1);
  }

  /**
   * Infer user expertise level
   * @private
   */
  inferUserExpertise(userId) {
    const history = this.getUserHistory(userId);
    if (history.length < 5) return 'beginner';

    // Analyze prompt sophistication over time
    const recentPrompts = history.slice(-10);
    const avgComplexity = recentPrompts.reduce((sum, item) => {
      return sum + this.assessComplexity(item.prompt || '');
    }, 0) / recentPrompts.length;

    if (avgComplexity > 0.7) return 'expert';
    if (avgComplexity > 0.4) return 'intermediate';
    return 'beginner';
  }

  /**
   * Suggest enhancements based on context
   * @private
   */
  suggestEnhancements(prompt) {
    const enhancements = [];

    // Check for common improvement opportunities
    if (prompt.length < 50) {
      enhancements.push('Add more context for better results');
    }

    if (!prompt.includes('?') && this.detectDomain(prompt) === 'educational') {
      enhancements.push('Frame as a question for clearer learning objectives');
    }

    if (prompt.split(/[.!?]/).length === 1) {
      enhancements.push('Break into multiple clear requirements');
    }

    return enhancements;
  }

  /**
   * Detect patterns in user history
   * @private
   */
  detectPatterns(history) {
    if (history.length < 3) {
      return { style: 'unknown', requests: [], improvements: [] };
    }

    const cacheKey = history.map(h => h.id).join('_');
    if (this.patternCache.has(cacheKey)) {
      return this.patternCache.get(cacheKey);
    }

    // Analyze patterns
    const patterns = {
      style: this.detectPreferredStyle(history),
      requests: this.findCommonRequests(history),
      improvements: this.identifyImprovementAreas(history),
    };

    // Cache patterns
    this.patternCache.set(cacheKey, patterns);

    return patterns;
  }

  /**
   * Detect preferred style from history
   * @private
   */
  detectPreferredStyle(history) {
    const styles = { technical: 0, creative: 0, analytical: 0, educational: 0 };

    history.forEach(item => {
      const domain = this.detectDomain(item.prompt || '');
      if (styles[domain] !== undefined) {
        styles[domain]++;
      }
    });

    // Find most common style
    return Object.entries(styles).reduce((a, b) => (b[1] > a[1] ? b : a))[0];
  }

  /**
   * Find common request patterns
   * @private
   */
  findCommonRequests(history) {
    const requestTypes = {};

    history.forEach(item => {
      const prompt = (item.prompt || '').toLowerCase();

      // Categorize request types
      if (prompt.includes('create') || prompt.includes('build')) {
        requestTypes.creation = (requestTypes.creation || 0) + 1;
      }
      if (prompt.includes('fix') || prompt.includes('debug')) {
        requestTypes.debugging = (requestTypes.debugging || 0) + 1;
      }
      if (prompt.includes('explain') || prompt.includes('understand')) {
        requestTypes.explanation = (requestTypes.explanation || 0) + 1;
      }
      if (prompt.includes('optimize') || prompt.includes('improve')) {
        requestTypes.optimization = (requestTypes.optimization || 0) + 1;
      }
    });

    // Return top request types
    return Object.entries(requestTypes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([type]) => type);
  }

  /**
   * Identify areas for improvement
   * @private
   */
  identifyImprovementAreas(history) {
    const improvements = [];
    const recentPrompts = history.slice(-5).map(h => h.prompt || '');

    // Check for repeated vague prompts
    const avgLength = recentPrompts.reduce((sum, p) => sum + p.length, 0) / recentPrompts.length;
    if (avgLength < 100) {
      improvements.push('Provide more detailed context in prompts');
    }

    // Check for lack of examples
    const hasExamples = recentPrompts.some(p =>
      p.includes('example') || p.includes('e.g.') || p.includes('such as')
    );
    if (!hasExamples) {
      improvements.push('Include examples for clearer requirements');
    }

    // Check for missing success criteria
    const hasCriteria = recentPrompts.some(p =>
      p.includes('should') || p.includes('must') || p.includes('need')
    );
    if (!hasCriteria) {
      improvements.push('Define clear success criteria');
    }

    return improvements;
  }

  /**
   * Calculate average prompt length
   * @private
   */
  calculateAverageLength(history) {
    if (history.length === 0) return 0;
    const totalLength = history.reduce((sum, item) =>
      sum + (item.prompt || '').length, 0
    );
    return Math.round(totalLength / history.length);
  }

  /**
   * Extract common topics from history
   * @private
   */
  extractCommonTopics(history) {
    const topicWords = {};
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
      'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might',
      'can', 'must', 'shall', 'need', 'it', 'this', 'that', 'these', 'those',
    ]);

    history.forEach(item => {
      const words = (item.prompt || '').toLowerCase().split(/\s+/);
      words.forEach(word => {
        // Clean and filter words
        const cleaned = word.replace(/[^a-z]/g, '');
        if (cleaned.length > 3 && !stopWords.has(cleaned)) {
          topicWords[cleaned] = (topicWords[cleaned] || 0) + 1;
        }
      });
    });

    // Return top topics
    return Object.entries(topicWords)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
  }

  /**
   * Clear session for a user
   * @param {string} userId - User identifier
   */
  clearSession(userId) {
    this.sessionContext.delete(userId);
    logger.info('Cleared session', { userId });
  }

  /**
   * Get analytics for a user
   * @param {string} userId - User identifier
   * @returns {Object} User analytics
   */
  getUserAnalytics(userId) {
    const history = this.getUserHistory(userId);
    const session = this.getSessionContext(userId);
    const patterns = this.detectPatterns(history);

    return {
      totalInteractions: history.length,
      sessionDuration: session.duration || 0,
      preferredStyle: patterns.style,
      commonRequests: patterns.requests,
      averagePromptLength: this.calculateAverageLength(history),
      expertiseLevel: this.inferUserExpertise(userId),
      improvementSuggestions: patterns.improvements,
    };
  }
}

// Export singleton instance
export const promptContextManager = new PromptContextManager();