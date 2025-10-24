import { logger } from '../infrastructure/Logger.js';
import { cacheService } from './CacheService.js';
import { StructuredOutputEnforcer } from '../utils/StructuredOutputEnforcer.js';
import { TemperatureOptimizer } from '../utils/TemperatureOptimizer.js';
import {
  buildAnalysisProcessTemplate,
  getElementPromptTemplate,
  VIDEO_PROMPT_PRINCIPLES,
} from '../config/videoPromptTemplates.js';
import {
  compatibilityOutputSchema,
  completeSceneOutputSchema,
  variationsOutputSchema,
  parseConceptOutputSchema,
  refinementsOutputSchema,
  conflictsOutputSchema,
  technicalParamsOutputSchema,
  validatePromptOutputSchema,
  smartDefaultsOutputSchema,
  alternativePhrasingsOutputSchema,
} from '../utils/validation.js';
import {
  detectDescriptorCategory,
  getCategoryInstruction,
  getCategoryForbidden,
  getAllCategories,
} from './DescriptorCategories.js';

const SUBJECT_DESCRIPTOR_KEYS = ['subjectDescriptor1', 'subjectDescriptor2', 'subjectDescriptor3'];

/**
 * Unified service for the video concept builder workflow.
 * Handles element suggestions, compatibility checks, scene completion, refinements, etc.
 */
export class VideoConceptService {
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
    const normalizedElementType = SUBJECT_DESCRIPTOR_KEYS.includes(elementType)
      ? 'subjectDescriptor'
      : elementType;

    logger.info('Generating creative suggestions', { elementType, normalizedElementType });

    // Check cache
    const cacheKey = cacheService.generateKey(this.cacheConfig.namespace, {
      elementType,
      normalizedElementType,
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
      elementType: normalizedElementType,
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
        { elementType: normalizedElementType, context, concept }
      );
    }

    // Apply user preference ranking
    const rankedSuggestions = await this.rankByUserPreferences(
      filteredSuggestions,
      normalizedElementType
    );

    const result = { suggestions: rankedSuggestions };

    // Cache the result
    await cacheService.set(cacheKey, result, {
      ttl: this.cacheConfig.ttl,
    });

    logger.info('Creative suggestions generated', {
      elementType: normalizedElementType,
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
      return await StructuredOutputEnforcer.enforceJSON(
        this.claudeClient,
        prompt,
        {
          schema: compatibilityOutputSchema,
          maxTokens: 256,
          temperature: 0.3,
        }
      );
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
      const suggestions = await StructuredOutputEnforcer.enforceJSON(
        this.claudeClient,
        prompt,
        {
          schema: completeSceneOutputSchema,
          maxTokens: 512,
          temperature: 0.7,
        }
      );
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
      const variations = await StructuredOutputEnforcer.enforceJSON(
        this.claudeClient,
        prompt,
        {
          schema: variationsOutputSchema,
          isArray: true,
          maxTokens: 2048,
          temperature: 0.8,
        }
      );
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
      const elements = await StructuredOutputEnforcer.enforceJSON(
        this.claudeClient,
        prompt,
        {
          schema: parseConceptOutputSchema,
          maxTokens: 512,
          temperature: 0.5,
        }
      );
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
      const refinements = await StructuredOutputEnforcer.enforceJSON(
        this.claudeClient,
        prompt,
        {
          schema: refinementsOutputSchema,
          maxTokens: 512,
          temperature: 0.6,
        }
      );
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

    // Detect descriptor categories for enhanced conflict detection
    const descriptors = SUBJECT_DESCRIPTOR_KEYS
      .map(key => ({ key, value: elements[key] }))
      .filter(d => d.value);

    const descriptorCategories = descriptors.map(desc => ({
      ...desc,
      detection: detectDescriptorCategory(desc.value)
    }));

    // Build enhanced element list with descriptor categories
    const elementsList = filledElements.map(([k, v]) => {
      const descriptorInfo = descriptorCategories.find(d => d.key === k);
      if (descriptorInfo && descriptorInfo.detection.category) {
        return `${k} (${descriptorInfo.detection.category} category): ${v}`;
      }
      return `${k}: ${v}`;
    }).join('\n');

    const prompt = `Analyze these video elements for logical conflicts or inconsistencies.

Elements:
${elementsList}

Identify any:
1. Logical impossibilities (e.g., underwater + flying)
2. Stylistic clashes (e.g., vintage style + futuristic setting)
3. Thematic inconsistencies
4. Physical contradictions
5. Descriptor category conflicts (e.g., wardrobe + props that don't match era)

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
      const conflicts = await StructuredOutputEnforcer.enforceJSON(
        this.claudeClient,
        prompt,
        {
          schema: conflictsOutputSchema,
          isArray: true,
          maxTokens: 512,
          temperature: 0.3,
        }
      );

      // Check for descriptor-specific conflicts
      const descriptorConflicts = this.checkDescriptorCategoryConflicts(descriptorCategories);
      
      // Combine all conflicts
      const allConflicts = [...conflicts, ...descriptorConflicts];
      
      return { conflicts: allConflicts };
    } catch (error) {
      logger.error('Failed to detect conflicts', { error });
      return { conflicts: [] };
    }
  }

  /**
   * Check for conflicts between descriptor categories
   * @private
   */
  checkDescriptorCategoryConflicts(descriptorCategories) {
    const conflicts = [];
    
    // Check for conflicting categories in descriptors
    for (let i = 0; i < descriptorCategories.length; i++) {
      for (let j = i + 1; j < descriptorCategories.length; j++) {
        const desc1 = descriptorCategories[i];
        const desc2 = descriptorCategories[j];
        
        if (!desc1.detection.category || !desc2.detection.category) continue;
        
        // Check for contradictions (e.g., "wearing formal tuxedo" + "barefoot")
        const value1Lower = desc1.value.toLowerCase();
        const value2Lower = desc2.value.toLowerCase();
        
        // Wardrobe conflicts
        if (desc1.detection.category === 'wardrobe' && desc2.detection.category === 'wardrobe') {
          if ((value1Lower.includes('formal') || value1Lower.includes('tuxedo') || value1Lower.includes('suit')) &&
              (value2Lower.includes('casual') || value2Lower.includes('torn') || value2Lower.includes('ragged'))) {
            conflicts.push({
              elements: [desc1.key, desc2.key],
              severity: 'medium',
              message: `Wardrobe style mismatch: formal clothing with casual/worn elements`,
              resolution: `Choose a consistent wardrobe style (all formal or all casual)`
            });
          }
        }
        
        // Era conflicts
        const hasModernTerms1 = value1Lower.includes('modern') || value1Lower.includes('contemporary') || value1Lower.includes('digital');
        const hasModernTerms2 = value2Lower.includes('modern') || value2Lower.includes('contemporary') || value2Lower.includes('digital');
        const hasVintageTerms1 = value1Lower.includes('vintage') || value1Lower.includes('antique') || value1Lower.includes('old-fashioned');
        const hasVintageTerms2 = value2Lower.includes('vintage') || value2Lower.includes('antique') || value2Lower.includes('old-fashioned');
        
        if ((hasModernTerms1 && hasVintageTerms2) || (hasVintageTerms1 && hasModernTerms2)) {
          conflicts.push({
            elements: [desc1.key, desc2.key],
            severity: 'low',
            message: `Era mismatch: mixing modern and vintage elements`,
            resolution: `Consider if the era mix is intentional (e.g., steampunk) or should be unified`
          });
        }
      }
    }
    
    return conflicts;
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
      const params = await StructuredOutputEnforcer.enforceJSON(
        this.claudeClient,
        prompt,
        {
          schema: technicalParamsOutputSchema,
          maxTokens: 768,
          temperature: 0.5,
        }
      );
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
      const validation = await StructuredOutputEnforcer.enforceJSON(
        this.claudeClient,
        prompt,
        {
          schema: validatePromptOutputSchema,
          maxTokens: 512,
          temperature: 0.3,
        }
      );
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
      const defaults = await StructuredOutputEnforcer.enforceJSON(
        this.claudeClient,
        prompt,
        {
          schema: smartDefaultsOutputSchema,
          isArray: true,
          maxTokens: 256,
          temperature: 0.6,
        }
      );
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
      const alternatives = await StructuredOutputEnforcer.enforceJSON(
        this.claudeClient,
        prompt,
        {
          schema: alternativePhrasingsOutputSchema,
          isArray: true,
          maxTokens: 512,
          temperature: 0.7,
        }
      );
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
   * Build specialized prompt for subject descriptors with category awareness
   * @private
   */
  buildDescriptorPrompt({ currentValue, context, concept }) {
    const isCompletion = currentValue && currentValue.trim().length > 0;
    
    // Detect category from current value or context
    const detection = currentValue ? detectDescriptorCategory(currentValue) : null;
    const categoryHint = detection?.confidence > 0.5 ? detection.category : null;
    
    // Check if subject exists in context to provide better guidance
    const hasSubject = context?.subject;
    const subjectContext = context?.subject || 'the subject';
    
    // Build category-aware guidance
    let categoryGuidance = '';
    if (categoryHint) {
      const instruction = getCategoryInstruction(categoryHint);
      const forbidden = getCategoryForbidden(categoryHint);
      categoryGuidance = `\n**🎯 Detected Category: ${categoryHint}** (confidence: ${Math.round(detection.confidence * 100)}%)
${instruction}
${forbidden ? `\n⚠️ ${forbidden}` : ''}
\nFocus suggestions within this category for consistency.\n`;
    } else if (hasSubject) {
      const allCategories = getAllCategories();
      categoryGuidance = `\n**Descriptor Categories Available:**
${allCategories.map(cat => {
  const instruction = getCategoryInstruction(cat);
  return `• **${cat}**: ${instruction}`;
}).join('\n')}

💡 Choose ONE category focus per descriptor for maximum specificity and clarity.\n`;
    }

    return `You are a video prompt expert specializing in rich, specific subject descriptions for AI video generation.

${VIDEO_PROMPT_PRINCIPLES}

${categoryGuidance}

**Context:**
Subject: "${subjectContext}"
${context?.action ? `Action: "${context.action}"` : ''}
${context?.location ? `Location: "${context.location}"` : ''}
${context?.mood ? `Mood: "${context.mood}"` : ''}
${concept ? `\nOverall Concept: "${concept}"` : ''}

**Current Descriptor Value:** ${currentValue ? `"${currentValue}"` : '(empty - fresh suggestions needed)'}

**Your Task:**
Generate 8 ${isCompletion ? 'completions' : 'suggestions'} for this subject descriptor${categoryHint ? ` (${categoryHint} category)` : ''}.

**CRITICAL Requirements:**
✓ 3-8 words per suggestion (concise yet specific)
✓ Directly observable visual details ONLY (what the camera sees)
✓ Each suggestion explores a DIFFERENT approach within ${categoryHint || 'descriptor categories'}
✓ Complement the main subject without redundancy
✓ Film-language specificity (avoid generic descriptions)
✓ Descriptive phrases, not complete sentences
${isCompletion ? `✓ ALL 8 suggestions MUST include "${currentValue}" as the base` : ''}
${categoryHint === 'physical' ? '✓ Focus on observable traits: facial features, body type, distinctive marks' : ''}
${categoryHint === 'wardrobe' ? '✓ Include garment type, material, condition, era markers' : ''}
${categoryHint === 'props' ? '✓ Specify object, material, condition, what they\'re doing with it' : ''}
${categoryHint === 'emotional' ? '✓ Show emotion through visible cues: expression, gaze, body language' : ''}
${categoryHint === 'action' ? '✓ Describe pose, position, or ongoing physical action' : ''}
${categoryHint === 'lighting' ? '✓ Describe light direction, quality, color on the subject specifically' : ''}

**Quality Criteria:**
✓ Specific over generic ("weathered oak walking stick" not "stick")
✓ Visual storytelling (reveals character history through details)
✓ Cinematic language (describes what camera captures)
✓ Avoids redundancy with main subject or other context elements
✓ Each suggestion offers meaningfully different direction
${isCompletion ? `✓ Builds upon "${currentValue}" rather than replacing it` : ''}

**Examples of Strong Descriptors by Category:**
- Physical: "with weathered hands and sun-worn face", "athletic build with broad shoulders"
- Wardrobe: "wearing sun-faded denim jacket", "dressed in vintage 1940s attire"
- Props: "holding worn leather journal", "clutching silver harmonica"
- Emotional: "with weary expression and distant gaze", "eyes reflecting quiet determination"
- Action: "leaning against brick wall", "sitting cross-legged on floor"
- Lighting: "bathed in warm golden light", "face half-shadowed in chiaroscuro"

**Output Format:**
Return ONLY a JSON array (no markdown, no code blocks):

[
  {"text": "descriptor 1", "explanation": "why this adds visual depth to the subject"},
  {"text": "descriptor 2", "explanation": "what this reveals about character/story"},
  {"text": "descriptor 3", "explanation": "how this enhances the scene visually"},
  {"text": "descriptor 4", "explanation": "why this detail matters cinematically"},
  {"text": "descriptor 5", "explanation": "what this contributes to the overall concept"},
  {"text": "descriptor 6", "explanation": "how this complements existing elements"},
  {"text": "descriptor 7", "explanation": "why this specific detail works"},
  {"text": "descriptor 8", "explanation": "what makes this visually compelling"}
]`;
  }

  /**
   * Build system prompt for creative suggestions with multi-level context analysis
   * @private
   */
  buildSystemPrompt({ elementType, currentValue, context, concept }) {
    // Check if this is a subject descriptor
    const isDescriptor = elementType === 'subjectDescriptor';
    
    // If it's a descriptor, use specialized descriptor prompt
    if (isDescriptor) {
      return this.buildDescriptorPrompt({ currentValue, context, concept });
    }

    const elementLabel =
      elementType === 'subjectDescriptor' ? 'subject descriptor' : elementType;
    const contextDisplay = context ? JSON.stringify(context, null, 2) : 'No other elements defined yet';
    // Perform multi-level context analysis
    const contextAnalysis = {
      immediate: this.analyzeImmediateContext(context),
      thematic: this.extractThematicElements(concept),
      stylistic: this.identifyStylePatterns(context),
      narrative: this.detectNarrativeStructure(concept),
    };

    // Determine if we're completing an existing value or generating fresh suggestions
    const isCompletion = currentValue && currentValue.trim().length > 0;
    const completionMode = isCompletion ? 'COMPLETION' : 'GENERATION';

    const analysisProcess = buildAnalysisProcessTemplate({
      elementLabel,
      currentValue,
      completionMode,
      isCompletion,
      contextDisplay,
      concept,
      contextAnalysis,
    });

    const basePrompt = getElementPromptTemplate({
      elementType,
      isCompletion,
      currentValue,
      contextDisplay,
      concept,
    });



    return `You are a creative video consultant specializing in contextually-aware, visually compelling suggestions.

${VIDEO_PROMPT_PRINCIPLES}

${analysisProcess}

${basePrompt}

**Your Task:**
${isCompletion ?
`🎯 COMPLETION MODE ACTIVE 🎯

The user has already started typing "${currentValue}".
Your ONLY job is to help them COMPLETE this element by adding relevant details.

**CRITICAL COMPLETION RULES:**
✓ ALL 8 suggestions MUST include "${currentValue}"
✓ Build upon what the user typed - don't change the subject/action/location/etc.
✓ Add 2-3 specific, relevant visual details following video prompt guidelines
✓ Each completion should offer a different way to finish the element
✓ Follow all VIDEO PROMPT TEMPLATE PRINCIPLES (specificity, visual details, technical language)

**WRONG (changing the user's input):**
User typed: "abraham lincoln"
❌ "george washington in colonial attire" - WRONG! Different subject!
❌ "thomas jefferson with quill pen" - WRONG! Different subject!
❌ "historical figure from 1800s" - WRONG! Too generic and loses the specific subject!

**RIGHT (completing the user's input):**
User typed: "abraham lincoln"
✓ "abraham lincoln with weathered face and tall stovepipe hat"
✓ "abraham lincoln in period wool coat with weary expression"
✓ "abraham lincoln with distinctive beard holding leather document case"
✓ "abraham lincoln in dimly-lit study with candlelight"

Generate 8 completions following the element-specific guidelines above.`
:
`Generate 8 creative, specific suggestions for this element, following the VIDEO PROMPT TEMPLATE PRINCIPLES above.`}

**Contextual Harmony Requirements:**
✓ If existing context provided, ensure suggestions COMPLEMENT those elements
✓ Maintain thematic consistency across all suggestions
✓ Avoid contradictions (e.g., "underwater" location → don't suggest "race car" subject)
✓ Consider implied tone and style from existing elements
${isCompletion ? `✓ MOST IMPORTANT: Build upon "${currentValue}" - don't suggest completely different options` : ''}

**Examples of Good Contextual Fit:**
- Subject "athlete" → Actions like "parkour vaulting" not "sleeping"
- Location "underwater" → Subjects like "scuba diver" not "race car"
- Mood "tense" → Styles like "high-contrast noir" not "bright cheerful animation"

**Quality Criteria:**
✓ Each suggestion is SHORT and SPECIFIC (2-8 words)
✓ All 8 suggestions are meaningfully different
✓ Explanations clearly show ${isCompletion ? 'how the completion enhances the original input' : 'contextual reasoning'}
✓ Visually evocative and immediately usable
${isCompletion ? `✓ ALL suggestions include "${currentValue}" as the core element` : ''}

**Output Format:**
Return ONLY a JSON array (no markdown, no code blocks):

[
  {"text": "specific suggestion 1", "explanation": "${isCompletion ? 'how this completes the user input while following video prompt principles' : 'why this works with the context'}"},
  {"text": "specific suggestion 2", "explanation": "${isCompletion ? 'how this completes the user input while following video prompt principles' : 'why this works with the context'}"},
  {"text": "specific suggestion 3", "explanation": "${isCompletion ? 'how this completes the user input while following video prompt principles' : 'why this works with the context'}"},
  {"text": "specific suggestion 4", "explanation": "${isCompletion ? 'how this completes the user input while following video prompt principles' : 'why this works with the context'}"},
  {"text": "specific suggestion 5", "explanation": "${isCompletion ? 'how this completes the user input while following video prompt principles' : 'why this works with the context'}"},
  {"text": "specific suggestion 6", "explanation": "${isCompletion ? 'how this completes the user input while following video prompt principles' : 'why this works with the context'}"},
  {"text": "specific suggestion 7", "explanation": "${isCompletion ? 'how this completes the user input while following video prompt principles' : 'why this works with the context'}"},
  {"text": "specific suggestion 8", "explanation": "${isCompletion ? 'how this completes the user input while following video prompt principles' : 'why this works with the context'}"}
]`;
  }
}
