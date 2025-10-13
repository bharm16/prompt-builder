import { logger } from '../infrastructure/Logger.js';
import { cacheService } from './CacheService.js';
import { StructuredOutputEnforcer } from '../utils/StructuredOutputEnforcer.js';
import { TemperatureOptimizer } from '../utils/TemperatureOptimizer.js';

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
   * @param {string} elementType - Type of element
   * @param {string} chosen - Selected suggestion
   * @param {Array<string>} rejected - Other suggestions that were not chosen
   */
  async recordUserChoice(elementType, chosen, rejected) {
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
      chosen,
      rejectedCount: rejected.length,
    });
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
- People (specific types, ages, professions, activities)
- Products (tech, fashion, food, vehicles, etc.)
- Animals (specific species with interesting behaviors)
- Objects (with narrative potential)
- Abstract concepts (visualized creatively)

Each suggestion should be SPECIFIC and VISUAL. Not "a person" but "elderly street musician" or "parkour athlete in motion".`,

      action: `Generate creative suggestions for the ACTION/ACTIVITY in a video.

Context: ${context || 'No other elements defined yet'}
Full concept: ${concept || 'User is building from scratch'}
Current value: ${currentValue || 'Not set'}

Provide 8 dynamic, visual actions that work well in video. Consider:
- Physical movement (running, jumping, dancing, floating, falling)
- Transformation (morphing, dissolving, assembling, exploding)
- Interaction (holding, throwing, catching, touching)
- Performance (playing instrument, cooking, creating art)
- Natural phenomena (growing, flowing, burning, freezing)

Each action should be SPECIFIC and CINEMATIC. Not "moving" but "leaping over obstacles in slow motion".`,

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

Provide 8 distinct visual styles. Consider:
- Film genres (cinematic blockbuster, documentary, film noir, etc.)
- Animation styles (anime, claymation, CGI, rotoscope)
- Art movements (impressionist, cubist, minimalist, maximalist)
- Photographic styles (vintage film, digital clean, lomography)
- Technical approaches (slow-motion, time-lapse, hyper-lapse, macro)

Each style should be SPECIFIC with technical implications. Not "artistic" but "1970s Super 8 film with warm grain and light leaks".`,

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

    return `You are a creative video consultant specializing in contextually-aware, visually compelling suggestions.

${analysisProcess}

${basePrompt}

**Your Task:**
Generate 8 creative, specific suggestions for this element.

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
