/**
 * AI Wizard Service
 *
 * Bridge to the VideoConceptApi for wizard-specific AI operations.
 * Handles suggestion fetching, caching, and rate limiting for the wizard interface.
 */

import { videoConceptApi } from './VideoConceptApi';

export class AIWizardService {
  constructor(api = videoConceptApi) {
    this.api = api;
    this.cache = new Map();
    this.lastCallTime = 0;
    this.minCallInterval = 500; // Minimum 500ms between API calls
    this.pendingRequests = new Map(); // Deduplication
  }

  /**
   * Get suggestions for a specific field
   * @param {string} fieldName - Name of the field (subject, action, location, etc.)
   * @param {string} currentValue - Current value in the field
   * @param {Object} context - Context from other fields
   * @returns {Promise<Array>} Array of suggestions
   */
  async getSuggestions(fieldName, currentValue = '', context = {}) {
    try {
      // Generate cache key
      const cacheKey = this._generateCacheKey(fieldName, currentValue, context);

      // Check cache first
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        if (Date.now() - cached.timestamp < 300000) { // 5 minutes TTL
          return cached.data;
        }
        this.cache.delete(cacheKey);
      }

      // Check for pending identical request (deduplication)
      if (this.pendingRequests.has(cacheKey)) {
        return await this.pendingRequests.get(cacheKey);
      }

      // Rate limiting
      await this._enforceRateLimit();

      // Create the request promise
      const requestPromise = this._fetchSuggestions(fieldName, currentValue, context);
      this.pendingRequests.set(cacheKey, requestPromise);

      try {
        const suggestions = await requestPromise;

        // Cache the result
        this.cache.set(cacheKey, {
          data: suggestions,
          timestamp: Date.now()
        });

        return suggestions;
      } finally {
        this.pendingRequests.delete(cacheKey);
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      return []; // Return empty array on error
    }
  }

  /**
   * Fetch suggestions from the API
   * @private
   */
  async _fetchSuggestions(fieldName, currentValue, context) {
    const elementTypeMap = {
      subject: 'subject',
      action: 'action',
      location: 'location',
      time: 'time',
      mood: 'mood',
      style: 'style',
      event: 'event'
    };

    const elementType = elementTypeMap[fieldName] || fieldName;

    const data = await this.api.getSuggestions({
      elementType,
      currentValue,
      context: this._sanitizeContext(context),
      concept: context.concept || ''
    });

    // Extract suggestions from response
    const suggestions = data.suggestions || [];

    // Return up to 9 suggestions for keyboard shortcuts
    return suggestions.slice(0, 9).map(s => ({
      text: s.text,
      explanation: s.explanation || ''
    }));
  }

  /**
   * Sanitize context to avoid circular references
   * @private
   */
  _sanitizeContext(context) {
    const sanitized = {};
    const allowedFields = ['subject', 'action', 'location', 'time', 'mood', 'style', 'event'];

    for (const field of allowedFields) {
      if (context[field] && typeof context[field] === 'string') {
        sanitized[field] = context[field];
      }
    }

    return sanitized;
  }

  /**
   * Generate cache key from parameters
   * @private
   */
  _generateCacheKey(fieldName, currentValue, context) {
    const contextStr = JSON.stringify(this._sanitizeContext(context));
    return `${fieldName}:${currentValue}:${contextStr}`;
  }

  /**
   * Enforce rate limiting between API calls
   * @private
   */
  async _enforceRateLimit() {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastCallTime;

    if (timeSinceLastCall < this.minCallInterval) {
      const waitTime = this.minCallInterval - timeSinceLastCall;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastCallTime = Date.now();
  }

  /**
   * Clear the cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  getCacheSize() {
    return this.cache.size;
  }

  /**
   * Preload suggestions for a field (optional optimization)
   */
  async preloadSuggestions(fieldName, context = {}) {
    return this.getSuggestions(fieldName, '', context);
  }

  /**
   * Validate prompt completeness
   */
  async validatePrompt(formData) {
    try {
      return await this.api.validatePrompt({
        elements: formData,
        concept: formData.concept || ''
      });
    } catch (error) {
      console.error('Error validating prompt:', error);
      return {
        score: 50,
        feedback: ['Unable to validate prompt'],
        strengths: [],
        weaknesses: []
      };
    }
  }

  /**
   * Generate final prompt from form data
   */
  generatePrompt(formData) {
    const parts = [];

    // Core concept (required fields)
    if (formData.subject) {
      parts.push(formData.subject);
    }
    if (formData.action) {
      parts.push(formData.action);
    }
    if (formData.location) {
      parts.push(`at ${formData.location}`);
    }

    // Atmosphere (optional fields)
    const atmosphereParts = [];
    if (formData.time) atmosphereParts.push(formData.time);
    if (formData.mood) atmosphereParts.push(formData.mood);
    if (formData.style) atmosphereParts.push(`${formData.style} style`);
    if (formData.event) atmosphereParts.push(`during ${formData.event}`);

    if (atmosphereParts.length > 0) {
      parts.push(atmosphereParts.join(', '));
    }

    // Technical parameters (if any)
    if (formData.camera && Object.keys(formData.camera).length > 0) {
      const cameraParts = [];
      if (formData.camera.angle) cameraParts.push(formData.camera.angle);
      if (formData.camera.movement) cameraParts.push(formData.camera.movement);
      if (formData.camera.distance) cameraParts.push(formData.camera.distance);
      if (cameraParts.length > 0) {
        parts.push(`Camera: ${cameraParts.join(', ')}`);
      }
    }

    if (formData.lighting && Object.keys(formData.lighting).length > 0) {
      const lightingParts = [];
      if (formData.lighting.quality) lightingParts.push(formData.lighting.quality);
      if (formData.lighting.direction) lightingParts.push(formData.lighting.direction);
      if (lightingParts.length > 0) {
        parts.push(`Lighting: ${lightingParts.join(', ')}`);
      }
    }

    return parts.join(', ');
  }

  /**
   * Calculate completion percentage
   */
  getCompletionPercentage(formData) {
    const requiredFields = ['subject', 'action', 'location'];
    const optionalFields = ['time', 'mood', 'style', 'event'];

    let completedRequired = 0;
    let completedOptional = 0;

    requiredFields.forEach(field => {
      if (formData[field] && formData[field].trim().length > 0) {
        completedRequired++;
      }
    });

    optionalFields.forEach(field => {
      if (formData[field] && formData[field].trim().length > 0) {
        completedOptional++;
      }
    });

    // Required fields count for 70%, optional for 30%
    const requiredPercentage = (completedRequired / requiredFields.length) * 70;
    const optionalPercentage = (completedOptional / optionalFields.length) * 30;

    return Math.round(requiredPercentage + optionalPercentage);
  }
}

// Create and export a singleton instance
export const aiWizardService = new AIWizardService();
