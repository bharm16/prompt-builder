import { logger } from '../infrastructure/Logger.js';
import { cacheService } from './CacheService.js';
import { StructuredOutputEnforcer } from '../utils/StructuredOutputEnforcer.js';
import { TemperatureOptimizer } from '../utils/TemperatureOptimizer.js';
import { generateVideoPrompt } from './VideoPromptTemplates.js';

/**
 * Service for generating creative suggestions for video elements
 * Provides context-aware suggestions with semantic compatibility and preference learning
 */
export class CreativeSuggestionService {
  constructor(claudeClient) {
    this.claudeClient = claudeClient;
    this.cacheConfig = cacheService.getConfig('creative');
    this.userPreferences = new Map(); // In-memory preference storage
    this.semanticCache = new Map(); // Cache for semantic scores
    this.templateUsage = new Map(); // Template usage tracking
  }

  /**
   * Generate creative suggestions for a video element
   * @param {Object} params - Suggestion parameters
   * @returns {Promise<Object>} Creative suggestions
   */
  async getCreativeSuggestions({
    elementType,
    currentValue,
    context,
    concept,
  }) {
    logger.info('Generating creative suggestions', { elementType });

    // Check cache
    const cacheKey = cacheService.generateKey(this.cacheConfig.namespace, {
      elementType,
      currentValue,
      context,
      concept: concept?.substring(0, 200),
    });

    const cached = await cacheService.get(cacheKey, 'creative-suggestions');
    if (cached) {
      logger.debug('Cache hit for creative suggestions');
      return cached;
    }

    // Build system prompt
    const systemPrompt = this.buildSystemPrompt({
      elementType,
      currentValue,
      context,
      concept,
    });

    // Define schema for validation
    const schema = {
      type: 'array',
      items: {
        required: ['text', 'explanation'],
      },
    };

    // Get optimal temperature for creative suggestions
    const temperature = TemperatureOptimizer.getOptimalTemperature('creative-suggestion', {
      diversity: 'high',
      precision: 'low',
    });

    // Call Claude API with structured output enforcement
    const suggestions = await StructuredOutputEnforcer.enforceJSON(
      this.claudeClient,
      systemPrompt,
      {
        schema,
        isArray: true, // Expecting array of suggestions
        maxTokens: 2048,
        maxRetries: 2,
        temperature,
      }
    );

    // Apply semantic compatibility filtering if context exists
    let filteredSuggestions = suggestions;
    if (context && Object.keys(context).length > 0) {
      filteredSuggestions = await this.filterBySemanticCompatibility(
        suggestions,
        { elementType, context, concept }
      );
    }

    // Apply user preference ranking
    const rankedSuggestions = await this.rankByUserPreferences(
      filteredSuggestions,
      elementType
    );

    const result = { suggestions: rankedSuggestions };

    // Cache the result
    await cacheService.set(cacheKey, result, {
      ttl: this.cacheConfig.ttl,
    });

    logger.info('Creative suggestions generated', {
      elementType,
      count: rankedSuggestions.length,
      filtered: suggestions.length - filteredSuggestions.length,
    });

    return result;
  }

  /**
   * Score semantic compatibility between suggestion and existing elements
   * @private
   */
  async scoreSemanticCompatibility(suggestion, existingElements) {
    const cacheKey = `${suggestion.text}_${JSON.stringify(existingElements)}`;

    // Check cache first
    if (this.semanticCache.has(cacheKey)) {
      return this.semanticCache.get(cacheKey);
    }

    const compatibilityPrompt = `Analyze the semantic and thematic compatibility between this suggestion and the existing creative elements.

Suggestion: "${suggestion.text}"
Explanation: "${suggestion.explanation}"

Existing Elements:
${JSON.stringify(existingElements, null, 2)}

Consider:
1. Thematic coherence - Do these elements work together narratively?
2. Visual harmony - Would these create a cohesive visual scene?
3. Logical consistency - Do these make sense together?
4. Creative synergy - Do they enhance each other?

Respond with ONLY a decimal number between 0 and 1, where:
- 0.9-1.0: Perfect harmony, enhances the concept
- 0.7-0.89: Strong compatibility, works well together
- 0.5-0.69: Moderate compatibility, could work with adjustments
- 0.3-0.49: Weak compatibility, conflicts present
- 0-0.29: Poor compatibility, contradictory elements

Score:`;

    try {
      const response = await this.claudeClient.complete(compatibilityPrompt, {
        maxTokens: 10,
        temperature: 0.1,
      });

      const score = parseFloat(response.content[0].text.trim());

      // Cache the score
      this.semanticCache.set(cacheKey, score);

      return isNaN(score) ? 0.5 : Math.min(1, Math.max(0, score));
    } catch (error) {
      logger.warn('Failed to score semantic compatibility', { error });
      return 0.5; // Default neutral score on error
    }
  }

  /**
   * Filter suggestions by semantic compatibility threshold
   * @private
   */
  async filterBySemanticCompatibility(suggestions, { elementType, context, concept }) {
    // Build existing elements object
    const existingElements = {
      elementType,
      context: context || {},
      concept: concept || '',
    };

    // Score all suggestions
    const scoredSuggestions = await Promise.all(
      suggestions.map(async (suggestion) => ({
        ...suggestion,
        compatibilityScore: await this.scoreSemanticCompatibility(
          suggestion,
          existingElements
        ),
      }))
    );

    // Filter by threshold and sort by score
    const threshold = 0.6; // Minimum compatibility score
    const filtered = scoredSuggestions
      .filter(s => s.compatibilityScore >= threshold)
      .sort((a, b) => b.compatibilityScore - a.compatibilityScore);

    // Ensure we return at least 4 suggestions
    if (filtered.length < 4) {
      return scoredSuggestions
        .sort((a, b) => b.compatibilityScore - a.compatibilityScore)
        .slice(0, 8);
    }

    return filtered;
  }

  /**
   * Rank suggestions based on user preferences
   * @private
   */
  async rankByUserPreferences(suggestions, elementType) {
    const preferences = this.getUserPreferences(elementType);

    if (!preferences || preferences.chosen.length === 0) {
      return suggestions; // No preferences yet, return as-is
    }

    // Calculate preference scores
    const scoredSuggestions = suggestions.map(suggestion => ({
      ...suggestion,
      preferenceScore: this.calculatePreferenceScore(suggestion, preferences),
    }));

    // Sort by preference score, then by original order
    return scoredSuggestions.sort((a, b) => {
      const scoreDiff = b.preferenceScore - a.preferenceScore;
      if (Math.abs(scoreDiff) > 0.1) return scoreDiff;
      return 0; // Maintain original order for similar scores
    });
  }

  /**
   * Calculate preference score based on historical choices
   * @private
   */
  calculatePreferenceScore(suggestion, preferences) {
    let score = 0;
    const text = suggestion.text.toLowerCase();

    // Positive signals from chosen items
    preferences.chosen.forEach(choice => {
      const choiceText = choice.toLowerCase();
      // Exact match
      if (text === choiceText) score += 2;
      // Partial match
      else if (text.includes(choiceText) || choiceText.includes(text)) score += 1;
      // Similar keywords
      const commonWords = this.getCommonKeywords(text, choiceText);
      score += commonWords.length * 0.5;
    });

    // Negative signals from rejected items
    preferences.rejected.forEach(rejected => {
      const rejectedText = rejected.toLowerCase();
      if (text === rejectedText) score -= 2;
      else if (text.includes(rejectedText) || rejectedText.includes(text)) score -= 1;
    });

    return Math.max(0, score);
  }

  /**
   * Get common keywords between two texts
   * @private
   */
  getCommonKeywords(text1, text2) {
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for']);
    const words1 = text1.split(/\s+/).filter(w => !stopWords.has(w));
    const words2 = text2.split(/\s+/).filter(w => !stopWords.has(w));
    return words1.filter(w => words2.includes(w));
  }

  /**
   * Record user choice for preference learning
   * Enhanced version supporting userId parameter
   * @param {string} elementType - Type of element
   * @param {string} chosen - Selected suggestion
   * @param {Array<string>} rejected - Other suggestions that were not chosen
   * @param {string} userId - Optional user identifier for personalized learning
   */
  async recordUserChoice(elementType, chosen, rejected, userId = 'default') {
    // If using userId, store preferences per user
    if (userId && userId !== 'default') {
      if (!this.userPreferences.has(userId)) {
        this.userPreferences.set(userId, new Map());
      }

      const userPrefs = this.userPreferences.get(userId);
      if (!userPrefs.has(elementType)) {
        userPrefs.set(elementType, { chosen: [], rejected: [] });
      }

      const prefs = userPrefs.get(elementType);
      prefs.chosen.push(chosen);
      prefs.rejected.push(...rejected);

      // Limit history
      if (prefs.chosen.length > 20) prefs.chosen.shift();
      if (prefs.rejected.length > 50) {
        prefs.rejected = prefs.rejected.slice(-50);
      }

      logger.info('Recorded user preference with userId', {
        elementType,
        chosen,
        rejectedCount: rejected.length,
        userId,
      });

      return { success: true };
    }

    // Legacy behavior for backward compatibility
    if (!this.userPreferences.has(elementType)) {
      this.userPreferences.set(elementType, {
        chosen: [],
        rejected: [],
      });
    }

    const preferences = this.userPreferences.get(elementType);

    // Add to chosen (limit history to last 20 choices)
    preferences.chosen.push(chosen);
    if (preferences.chosen.length > 20) {
      preferences.chosen.shift();
    }

    // Add to rejected (limit history)
    preferences.rejected.push(...rejected);
    if (preferences.rejected.length > 50) {
      preferences.rejected = preferences.rejected.slice(-50);
    }

    logger.info('Recorded user preference', {
      elementType,
      rejectedCount: rejected.length,
    });

    return { success: true };
  }

  /**
   * Check compatibility between element value and existing elements
   */
  async checkCompatibility({ elementType, value, existingElements }) {
    logger.info('Checking element compatibility', { elementType });

    if (!value || Object.keys(existingElements).length === 0) {
      return { score: 1, feedback: 'No conflicts detected' };
    }

    const prompt = `Analyze the compatibility of this element with existing elements.

New Element: ${elementType} = "${value}"

Existing Elements:
${Object.entries(existingElements)
  .filter(([k, v]) => v && k !== elementType)
  .map(([k, v]) => `${k}: ${v}`)
  .join('\n')}

Consider:
1. Logical consistency (do these make sense together?)
2. Visual harmony (would these create a cohesive scene?)
3. Thematic coherence (do they support the same narrative?)
4. Physical possibility (are there impossible combinations?)

Respond with ONLY a JSON object:
{
  "score": 0.0-1.0 (compatibility score),
  "feedback": "brief explanation",
  "conflicts": ["any specific conflicts"],
  "suggestions": ["how to improve compatibility"]
}`;

    try {
      const response = await this.claudeClient.complete(prompt, {
        maxTokens: 256,
        temperature: 0.3,
      });

      return JSON.parse(response.content[0].text);
    } catch (error) {
      logger.error('Failed to check compatibility', { error });
      return { score: 0.5, feedback: 'Unable to determine compatibility' };
    }
  }

  /**
   * Complete scene by suggesting all empty elements
   */
  async completeScene({ existingElements, concept }) {
    logger.info('Completing scene with AI suggestions');

    const emptyElements = Object.entries(existingElements)
      .filter(([_, value]) => !value)
      .map(([key]) => key);

    if (emptyElements.length === 0) {
      return { suggestions: existingElements };
    }

    const prompt = `Complete this video scene by filling in the missing elements.

Concept: ${concept || 'Not specified'}

Existing Elements:
${Object.entries(existingElements)
  .filter(([_, v]) => v)
  .map(([k, v]) => `${k}: ${v}`)
  .join('\n')}

Missing Elements to Fill:
${emptyElements.join(', ')}

Requirements:
1. Ensure all suggestions work harmoniously with existing elements
2. Maintain thematic consistency
3. Create a cohesive, compelling scene
4. Be specific and visual

Return ONLY a JSON object with the missing elements:
{
  "${emptyElements[0]}": "specific suggestion",
  ...
}`;

    try {
      const response = await this.claudeClient.complete(prompt, {
        maxTokens: 512,
        temperature: 0.7,
      });

      const suggestions = JSON.parse(response.content[0].text);
      return { suggestions: { ...existingElements, ...suggestions } };
    } catch (error) {
      logger.error('Failed to complete scene', { error });
      return { suggestions: existingElements };
    }
  }

  /**
   * Generate variations of current element setup
   */
  async generateVariations({ elements, concept }) {
    logger.info('Generating scene variations');

    const prompt = `Generate 3 creative variations of this video concept.

Original Concept: ${concept || 'Not specified'}

Original Elements:
${Object.entries(elements)
  .filter(([_, v]) => v)
  .map(([k, v]) => `${k}: ${v}`)
  .join('\n')}

Create 3 variations that:
1. Maintain the core theme but explore different approaches
2. Vary in mood, style, or perspective
3. Each offers a unique creative direction

Return ONLY a JSON array of 3 variations:
[
  {
    "name": "Variation Name",
    "description": "What makes this different",
    "elements": {
      "subject": "...",
      "action": "...",
      // ... all elements
    },
    "changes": ["key changes from original"]
  },
  // ... 2 more variations
]`;

    try {
      const response = await this.claudeClient.complete(prompt, {
        maxTokens: 2048,
        temperature: 0.8,
      });

      const variations = JSON.parse(response.content[0].text);
      return { variations };
    } catch (error) {
      logger.error('Failed to generate variations', { error });
      return { variations: [] };
    }
  }

  /**
   * Parse a concept description into individual elements
   */
  async parseConcept({ concept }) {
    logger.info('Parsing concept into elements');

    const prompt = `Break down this video concept into structured elements.

Concept: "${concept}"

Extract and infer the following elements from the description:
- subject: The main focus (person, object, animal, etc.)
- action: What's happening (movement, activity, transformation)
- location: Where it takes place (setting, environment)
- time: When/time period (time of day, era, season)
- mood: The emotional atmosphere
- style: Visual treatment (cinematic, documentary, etc.)
- event: The context or occasion

If an element is not explicitly mentioned, make a reasonable inference based on the concept.

Return ONLY a JSON object with ALL elements:
{
  "subject": "specific subject",
  "action": "specific action",
  "location": "specific location",
  "time": "specific time",
  "mood": "specific mood",
  "style": "specific style",
  "event": "specific event"
}`;

    try {
      const response = await this.claudeClient.complete(prompt, {
        maxTokens: 512,
        temperature: 0.5,
      });

      const elements = JSON.parse(response.content[0].text);
      return { elements };
    } catch (error) {
      logger.error('Failed to parse concept', { error });
      return {
        elements: {
          subject: '',
          action: '',
          location: '',
          time: '',
          mood: '',
          style: '',
          event: '',
        },
      };
    }
  }

  /**
   * Get refined suggestions based on progressive context
   */
  async getRefinementSuggestions({ elements }) {
    logger.info('Getting refinement suggestions');

    const filledElements = Object.entries(elements).filter(([_, v]) => v);

    if (filledElements.length < 2) {
      return { refinements: {} };
    }

    const prompt = `Suggest refinements for these video elements to improve coherence.

Current Elements:
${filledElements.map(([k, v]) => `${k}: ${v}`).join('\n')}

For each element, suggest 2-3 refined versions that:
1. Better align with the other elements
2. Add more specificity
3. Enhance the overall creative vision

Return ONLY a JSON object:
{
  "${filledElements[0][0]}": ["refinement 1", "refinement 2"],
  ...
}`;

    try {
      const response = await this.claudeClient.complete(prompt, {
        maxTokens: 512,
        temperature: 0.6,
      });

      const refinements = JSON.parse(response.content[0].text);
      return { refinements };
    } catch (error) {
      logger.error('Failed to get refinements', { error });
      return { refinements: {} };
    }
  }

  /**
   * Detect conflicts between elements
   */
  async detectConflicts({ elements }) {
    logger.info('Detecting element conflicts');

    const filledElements = Object.entries(elements).filter(([_, v]) => v);

    if (filledElements.length < 2) {
      return { conflicts: [] };
    }

    const prompt = `Analyze these video elements for logical conflicts or inconsistencies.

Elements:
${filledElements.map(([k, v]) => `${k}: ${v}`).join('\n')}

Identify any:
1. Logical impossibilities (e.g., underwater + flying)
2. Stylistic clashes (e.g., vintage style + futuristic setting)
3. Thematic inconsistencies
4. Physical contradictions

Return ONLY a JSON array of conflicts (empty array if none):
[
  {
    "elements": ["element1", "element2"],
    "severity": "high|medium|low",
    "message": "Description of conflict",
    "resolution": "Suggested fix"
  }
]`;

    try {
      const response = await this.claudeClient.complete(prompt, {
        maxTokens: 512,
        temperature: 0.3,
      });

      const conflicts = JSON.parse(response.content[0].text);
      return { conflicts };
    } catch (error) {
      logger.error('Failed to detect conflicts', { error });
      return { conflicts: [] };
    }
  }

  /**
   * Generate technical parameters based on elements
   */
  async generateTechnicalParams({ elements }) {
    logger.info('Generating technical parameters');

    const prompt = `Generate technical video parameters based on these creative elements.

Elements:
${Object.entries(elements)
  .filter(([_, v]) => v)
  .map(([k, v]) => `${k}: ${v}`)
  .join('\n')}

Suggest appropriate:
1. Camera settings (angles, movement, lenses)
2. Lighting setup
3. Color grading
4. Frame rate and aspect ratio
5. Audio considerations
6. Post-production effects

Return ONLY a JSON object:
{
  "camera": {
    "angle": "...",
    "movement": "...",
    "lens": "..."
  },
  "lighting": {
    "type": "...",
    "direction": "...",
    "quality": "..."
  },
  "color": {
    "grading": "...",
    "palette": "..."
  },
  "format": {
    "frameRate": "...",
    "aspectRatio": "...",
    "resolution": "..."
  },
  "audio": {
    "style": "...",
    "mood": "..."
  },
  "postProduction": {
    "effects": ["..."],
    "transitions": "..."
  }
}`;

    try {
      const response = await this.claudeClient.complete(prompt, {
        maxTokens: 768,
        temperature: 0.5,
      });

      const params = JSON.parse(response.content[0].text);
      return { technicalParams: params };
    } catch (error) {
      logger.error('Failed to generate technical params', { error });
      return { technicalParams: {} };
    }
  }

  /**
   * Validate prompt quality and completeness
   */
  async validatePrompt({ elements, concept }) {
    logger.info('Validating prompt quality');

    const prompt = `Evaluate the quality and completeness of this video prompt.

Concept: ${concept || 'Not specified'}

Elements:
${Object.entries(elements)
  .map(([k, v]) => `${k}: ${v || '(empty)'}`)
  .join('\n')}

Evaluate:
1. Completeness (0-30 points): How many elements are filled?
2. Specificity (0-25 points): How detailed and specific are the elements?
3. Coherence (0-25 points): How well do elements work together?
4. Visual Potential (0-20 points): How visually compelling is this concept?

Return ONLY a JSON object:
{
  "score": total score 0-100,
  "breakdown": {
    "completeness": 0-30,
    "specificity": 0-25,
    "coherence": 0-25,
    "visualPotential": 0-20
  },
  "feedback": ["specific improvement suggestions"],
  "strengths": ["what works well"],
  "weaknesses": ["what needs work"]
}`;

    try {
      const response = await this.claudeClient.complete(prompt, {
        maxTokens: 512,
        temperature: 0.3,
      });

      const validation = JSON.parse(response.content[0].text);
      return validation;
    } catch (error) {
      logger.error('Failed to validate prompt', { error });
      return {
        score: 50,
        breakdown: {},
        feedback: ['Unable to validate'],
        strengths: [],
        weaknesses: [],
      };
    }
  }

  /**
   * Get smart defaults for dependent elements
   */
  async getSmartDefaults({ elementType, existingElements }) {
    logger.info('Getting smart defaults', { elementType });

    const dependencies = Object.entries(existingElements)
      .filter(([_, v]) => v)
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');

    if (!dependencies) {
      return { defaults: [] };
    }

    const prompt = `Suggest smart default values for ${elementType} based on existing elements.

Existing Elements:
${dependencies}

Suggest 3 logical default values for ${elementType} that:
1. Naturally complement the existing elements
2. Maintain consistency
3. Enhance the overall concept

Return ONLY a JSON array:
["default 1", "default 2", "default 3"]`;

    try {
      const response = await this.claudeClient.complete(prompt, {
        maxTokens: 256,
        temperature: 0.6,
      });

      const defaults = JSON.parse(response.content[0].text);
      return { defaults };
    } catch (error) {
      logger.error('Failed to get smart defaults', { error });
      return { defaults: [] };
    }
  }

  /**
   * Save template for reuse
   */
  async saveTemplate({ name, elements, concept, userId }) {
    logger.info('Saving template', { name });

    // In a real implementation, this would save to a database
    const template = {
      id: Date.now().toString(),
      name,
      elements,
      concept,
      userId,
      createdAt: new Date().toISOString(),
      usageCount: 0,
    };

    // Track template usage for recommendations
    if (!this.templateUsage) {
      this.templateUsage = new Map();
    }
    this.templateUsage.set(template.id, template);

    return { template, success: true };
  }

  /**
   * Get template recommendations based on usage
   */
  async getTemplateRecommendations({ userId, currentElements }) {
    logger.info('Getting template recommendations');

    // Initialize templateUsage if not exists
    if (!this.templateUsage) {
      this.templateUsage = new Map();
    }

    // In a real implementation, this would query a database
    const templates = Array.from(this.templateUsage.values())
      .filter(t => t.usageCount > 0)
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 5);

    return { recommendations: templates };
  }

  /**
   * Get alternative phrasings for an element
   */
  async getAlternativePhrasings({ elementType, value }) {
    logger.info('Getting alternative phrasings', { elementType, value });

    const prompt = `Provide 5 alternative ways to phrase this ${elementType}.

Original: "${value}"

Generate alternatives that:
1. Maintain the same core meaning
2. Vary in tone (some more/less formal)
3. Vary in specificity (some more/less detailed)
4. Offer different stylistic approaches

Return ONLY a JSON array:
[
  {"text": "alternative 1", "tone": "formal|casual|poetic|technical"},
  {"text": "alternative 2", "tone": "..."},
  // ... 3 more
]`;

    try {
      const response = await this.claudeClient.complete(prompt, {
        maxTokens: 512,
        temperature: 0.7,
      });

      const alternatives = JSON.parse(response.content[0].text);
      return { alternatives };
    } catch (error) {
      logger.error('Failed to get alternatives', { error });
      return { alternatives: [] };
    }
  }

  /**
   * Get user preferences for an element type
   * @private
   */
  getUserPreferences(elementType) {
    return this.userPreferences.get(elementType) || { chosen: [], rejected: [] };
  }

  /**
   * Analyze immediate context for better suggestions
   * @private
   */
  analyzeImmediateContext(context) {
    if (!context) return {};

    return {
      hasSubject: !!context.subject,
      hasLocation: !!context.location,
      hasAction: !!context.action,
      hasMood: !!context.mood,
      elementCount: Object.keys(context).length,
      elements: context,
    };
  }

  /**
   * Extract thematic elements from concept
   * @private
   */
  extractThematicElements(concept) {
    if (!concept) return { themes: [], tone: 'neutral' };

    const themes = [];
    const conceptLower = concept.toLowerCase();

    // Detect common themes
    if (conceptLower.includes('tech') || conceptLower.includes('digital') || conceptLower.includes('cyber')) {
      themes.push('technology');
    }
    if (conceptLower.includes('nature') || conceptLower.includes('forest') || conceptLower.includes('ocean')) {
      themes.push('nature');
    }
    if (conceptLower.includes('urban') || conceptLower.includes('city') || conceptLower.includes('street')) {
      themes.push('urban');
    }
    if (conceptLower.includes('fantasy') || conceptLower.includes('magic') || conceptLower.includes('mystical')) {
      themes.push('fantasy');
    }

    // Detect tone
    let tone = 'neutral';
    if (conceptLower.includes('dark') || conceptLower.includes('mysterious') || conceptLower.includes('ominous')) {
      tone = 'dark';
    } else if (conceptLower.includes('bright') || conceptLower.includes('cheerful') || conceptLower.includes('happy')) {
      tone = 'bright';
    } else if (conceptLower.includes('calm') || conceptLower.includes('peaceful') || conceptLower.includes('serene')) {
      tone = 'calm';
    }

    return { themes, tone };
  }

  /**
   * Identify style patterns from context
   * @private
   */
  identifyStylePatterns(context) {
    if (!context || !context.style) return { style: 'default' };

    const styleLower = context.style.toLowerCase();
    const patterns = {
      cinematic: styleLower.includes('cinematic') || styleLower.includes('film'),
      artistic: styleLower.includes('artistic') || styleLower.includes('abstract'),
      realistic: styleLower.includes('realistic') || styleLower.includes('documentary'),
      animated: styleLower.includes('animated') || styleLower.includes('cartoon'),
      vintage: styleLower.includes('vintage') || styleLower.includes('retro'),
    };

    return patterns;
  }

  /**
   * Detect narrative structure from concept
   * @private
   */
  detectNarrativeStructure(concept) {
    if (!concept) return { hasNarrative: false };

    const narrativeKeywords = ['story', 'journey', 'transformation', 'discovery', 'conflict', 'resolution'];
    const hasNarrative = narrativeKeywords.some(keyword =>
      concept.toLowerCase().includes(keyword)
    );

    return {
      hasNarrative,
      isTransformative: concept.includes('transform') || concept.includes('change'),
      isJourney: concept.includes('journey') || concept.includes('travel'),
      hasConflict: concept.includes('conflict') || concept.includes('versus'),
    };
  }

  /**
   * Build system prompt for creative suggestions with multi-level context analysis
   * @private
   */
  buildSystemPrompt({ elementType, currentValue, context, concept }) {
    // Perform multi-level context analysis
    const contextAnalysis = {
      immediate: this.analyzeImmediateContext(context),
      thematic: this.extractThematicElements(concept),
      stylistic: this.identifyStylePatterns(context),
      narrative: this.detectNarrativeStructure(concept),
    };

    const analysisProcess = `<analysis_process>
Step 1: Understand the element type and creative requirements
- Element: ${elementType}
- Current value: ${currentValue || 'Not set - starting fresh'}
- What makes this element type visually compelling?

Step 2: Analyze existing context at multiple levels
- Context: ${context || 'No constraints - full creative freedom'}
- Concept: ${concept || 'Building from scratch'}
- Immediate context: ${JSON.stringify(contextAnalysis.immediate)}
- Thematic elements: ${JSON.stringify(contextAnalysis.thematic)}
- Style patterns: ${JSON.stringify(contextAnalysis.stylistic)}
- Narrative structure: ${JSON.stringify(contextAnalysis.narrative)}

Step 3: Ensure contextual harmony
- Do suggestions complement existing elements?
- Is there thematic consistency with detected themes: ${contextAnalysis.thematic.themes.join(', ') || 'none'}?
- Do suggestions match the tone: ${contextAnalysis.thematic.tone}?
- Do suggestions avoid contradicting established context?

Step 4: Maximize creative diversity
- Generate 8 distinct, specific options
- Vary tone, style, intensity, and approach
- Each should offer a meaningfully different creative direction
- Ensure all are immediately usable and visually evocative
- Consider narrative elements: ${contextAnalysis.narrative.hasNarrative ? 'narrative flow important' : 'standalone elements'}
</analysis_process>`;

    const elementPrompts = {
      subject: `Generate creative suggestions for the SUBJECT/CHARACTER of a video.

Context: ${context || 'No other elements defined yet'}
Full concept: ${concept || 'User is building from scratch'}
Current value: ${currentValue || 'Not set'}

Provide 8 diverse, creative subjects that would make compelling video content. Consider:
- People (with 2-3 distinctive visual details: "elderly street musician with weathered hands and silver harmonica")
- Products (specific make/model with visual characteristics: "matte black DJI drone with amber LED lights")
- Animals (species + behavior/appearance: "bengal cat with spotted coat stalking prey")
- Objects (with texture/material details: "antique brass compass with worn patina")
- Abstract concepts (visualized with specific metaphors: "time visualized as golden sand particles")

Apply VIDEO PROMPT PRINCIPLES:
✓ SPECIFIC not generic: "weathered leather journal" not "old book"
✓ 2-3 distinctive visual details
✓ Describe what camera can SEE
✓ Use professional terminology where appropriate

Each suggestion should be SHORT (2-8 words) and visually evocative.`,

      action: `Generate creative suggestions for the ACTION/ACTIVITY in a video.

Context: ${context || 'No other elements defined yet'}
Full concept: ${concept || 'User is building from scratch'}
Current value: ${currentValue || 'Not set'}

Provide 8 dynamic, visual actions that work well in video. Consider:
- Physical movement (with specific manner: "sprinting through rain-slicked alley")
- Transformation (with visible process: "ink dissolving into clear water")
- Interaction (with object details: "catching spinning basketball mid-air")
- Performance (with technique: "playing cello with aggressive bow strokes")
- Natural phenomena (with visual progression: "ice crystallizing across window pane")

CRITICAL - Apply ONE MAIN ACTION RULE:
✓ ONE clear, specific action only (not "running, jumping, and spinning")
✓ "leaping over concrete barriers" not "parkour routine with flips and spins"
✓ Optimal for 4-8 second clips
✓ Physically plausible and visually clear

Use CINEMATIC terminology: "slow dolly in", "rack focus", "tracking shot".
Each action should be SHORT (2-8 words) and immediately visualizable.`,

      location: `Generate creative suggestions for the LOCATION/SETTING of a video.

Context: ${context || 'No other elements defined yet'}
Full concept: ${concept || 'User is building from scratch'}
Current value: ${currentValue || 'Not set'}

Provide 8 visually interesting locations. Consider:
- Urban environments (specific types of streets, buildings, infrastructure)
- Natural settings (specific landscapes, weather conditions, times of day)
- Interior spaces (architectural styles, purposes, atmospheres)
- Unusual/creative settings (underwater, in space, abstract void, miniature world)
- Cultural/historical settings (specific eras, cultures, styles)

Each location should be SPECIFIC and EVOCATIVE. Not "a building" but "abandoned Victorian warehouse with shattered skylights".`,

      time: `Generate creative suggestions for the TIME/PERIOD of a video.

Context: ${context || 'No other elements defined yet'}
Full concept: ${concept || 'User is building from scratch'}
Current value: ${currentValue || 'Not set'}

Provide 8 specific time/lighting conditions that create visual interest:
- Time of day (golden hour, blue hour, high noon, midnight, dawn, dusk)
- Historical period (specific eras with visual characteristics)
- Season (spring bloom, autumn colors, winter frost, summer haze)
- Weather timing (during storm, after rain, before sunset)
- Future/past (specific sci-fi or period aesthetics)

Each suggestion should specify LIGHTING and MOOD implications. Not just "morning" but "early morning mist with low golden sun".`,

      mood: `Generate creative suggestions for the MOOD/ATMOSPHERE of a video.

Context: ${context || 'No other elements defined yet'}
Full concept: ${concept || 'User is building from scratch'}
Current value: ${currentValue || 'Not set'}

Provide 8 distinct moods/atmospheres. Consider:
- Emotional tones (melancholic, joyful, tense, peaceful, mysterious)
- Energy levels (frenetic, languid, pulsing, static, building)
- Sensory qualities (warm, cold, harsh, soft, textured)
- Narrative feelings (nostalgic, foreboding, hopeful, triumphant)
- Abstract atmospheres (dreamlike, surreal, hyperreal, gritty)

Each mood should be SPECIFIC and suggest visual/color implications. Not "happy" but "warm, golden nostalgia like a faded photograph".`,

      style: `Generate creative suggestions for the VISUAL STYLE of a video.

Context: ${context || 'No other elements defined yet'}
Full concept: ${concept || 'User is building from scratch'}
Current value: ${currentValue || 'Not set'}

Provide 8 distinct visual styles using SPECIFIC references (NOT generic):
- Film stock/format: "shot on 35mm film", "Super 8 footage with light leaks", "16mm Kodak Vision3"
- Genre aesthetics: "film noir with high-contrast shadows", "documentary verité style", "French New Wave aesthetic"
- Director/cinematographer style: "in the style of Wes Anderson", "Roger Deakins naturalism", "Christopher Doyle neon-lit"
- Art movements: "German Expressionist angles", "Italian Neorealism rawness"
- Technical processes: "anamorphic lens flares", "tilt-shift miniature effect", "infrared color spectrum"

CRITICAL - Avoid generic terms:
✗ "cinematic" → ✓ "shot on 35mm film with shallow depth of field"
✗ "artistic" → ✓ "impressionist soft focus with pastel color palette"
✗ "moody" → ✓ "film noir aesthetic with Rembrandt lighting"

Each suggestion should include TECHNICAL implications (film stock, lens type, color grading, etc.).`,

      event: `Generate creative suggestions for the EVENT/CONTEXT of a video.

Context: ${context || 'No other elements defined yet'}
Full concept: ${concept || 'User is building from scratch'}
Current value: ${currentValue || 'Not set'}

Provide 8 specific events or contexts. Consider:
- Commercial contexts (product launch, demonstration, unboxing, reveal)
- Narrative events (discovery, transformation, conflict, resolution)
- Celebrations (specific types of parties, ceremonies, milestones)
- Processes (creation, destruction, assembly, metamorphosis)
- Abstract contexts (dream sequence, memory, vision, imagination)

Each event should provide NARRATIVE PURPOSE. Not "something happening" but "product reveal with dramatic build-up and payoff".`,
    };

    const basePrompt =
      elementPrompts[elementType] || elementPrompts.subject;

    // Extract key principles from video prompt template
    const videoPromptPrinciples = `
**VIDEO PROMPT TEMPLATE PRINCIPLES (Use these as your baseline):**
These principles are from our production-ready video prompt template and should guide all suggestions:

1. **Specificity Over Generic**: "a weathered oak desk" is superior to "a nice desk"
   - Use concrete, visual details
   - Include 2-3 distinctive characteristics
   - Avoid vague adjectives

2. **Cinematic Language**: Use professional film terminology
   - Camera: dolly, crane, rack focus, shallow DOF, f/1.8
   - Lighting: Rembrandt lighting, 3:1 contrast, soft window light
   - Style: shot on 35mm film, film noir aesthetic, in the style of [director]

3. **One Main Action Rule**: Multiple actions severely degrade quality
   - Focus on ONE clear, specific, physically plausible action
   - "leaping over obstacles in slow motion" not "running, jumping, and spinning"

4. **Visual Precedence**: Describe only what the camera can SEE
   - Translate emotions into visible actions/environmental details
   - "elderly historian with trembling hands" not "a sad old person"

5. **Element Order = Priority**: First elements get processed first by AI
   - Most important visual element should come first
   - Shot type establishes composition
   - Subject defines focus
   - Action creates movement

6. **Duration Context**: Optimal clips are 4-8 seconds
   - Keep actions simple and clear
   - Avoid complex narratives (use multiple clips instead)

7. **Style References**: Avoid generic terms like "cinematic"
   - Use film stock: "shot on 35mm film", "Super 8 footage"
   - Use genre: "film noir aesthetic", "documentary realism"
   - Use director references: "in the style of Wes Anderson"
`;

    return `You are a creative video consultant specializing in contextually-aware, visually compelling suggestions.

${videoPromptPrinciples}

${analysisProcess}

${basePrompt}

**Your Task:**
Generate 8 creative, specific suggestions for this element, following the VIDEO PROMPT TEMPLATE PRINCIPLES above.

**Contextual Harmony Requirements:**
✓ If existing context provided, ensure suggestions COMPLEMENT those elements
✓ Maintain thematic consistency across all suggestions
✓ Avoid contradictions (e.g., "underwater" location → don't suggest "race car" subject)
✓ Consider implied tone and style from existing elements

**Examples of Good Contextual Fit:**
- Subject "athlete" → Actions like "parkour vaulting" not "sleeping"
- Location "underwater" → Subjects like "scuba diver" not "race car"
- Mood "tense" → Styles like "high-contrast noir" not "bright cheerful animation"

**Quality Criteria:**
✓ Each suggestion is SHORT and SPECIFIC (2-8 words)
✓ All 8 suggestions are meaningfully different
✓ Explanations clearly show contextual reasoning
✓ Visually evocative and immediately usable

**Output Format:**
Return ONLY a JSON array (no markdown, no code blocks):

[
  {"text": "specific suggestion 1", "explanation": "why this works with the context"},
  {"text": "specific suggestion 2", "explanation": "why this works with the context"},
  {"text": "specific suggestion 3", "explanation": "why this works with the context"},
  {"text": "specific suggestion 4", "explanation": "why this works with the context"},
  {"text": "specific suggestion 5", "explanation": "why this works with the context"},
  {"text": "specific suggestion 6", "explanation": "why this works with the context"},
  {"text": "specific suggestion 7", "explanation": "why this works with the context"},
  {"text": "specific suggestion 8", "explanation": "why this works with the context"}
]`;
  }
}
