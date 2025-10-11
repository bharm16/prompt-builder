import { logger } from '../infrastructure/Logger.js';
import { cacheService } from './CacheService.js';

/**
 * Service for generating creative suggestions for video elements
 * Provides context-aware suggestions for subjects, actions, locations, etc.
 */
export class CreativeSuggestionService {
  constructor(claudeClient) {
    this.claudeClient = claudeClient;
    this.cacheConfig = cacheService.getConfig('creative');
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

    // Call Claude API
    const response = await this.claudeClient.complete(systemPrompt, {
      maxTokens: 2048,
    });

    // Parse response
    let suggestionsText = response.content[0].text;
    suggestionsText = suggestionsText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const suggestions = JSON.parse(suggestionsText);

    const result = { suggestions };

    // Cache the result
    await cacheService.set(cacheKey, result, {
      ttl: this.cacheConfig.ttl,
    });

    logger.info('Creative suggestions generated', {
      elementType,
      count: suggestions.length,
    });

    return result;
  }

  /**
   * Build system prompt for creative suggestions
   * @private
   */
  buildSystemPrompt({ elementType, currentValue, context, concept }) {
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

    return `${basePrompt}

Based on all context provided, generate 8 creative, specific suggestions for this element.

IMPORTANT: If there is existing context about other elements, make sure your suggestions COMPLEMENT and work well with those elements. For example:
- If subject is "athlete", suggest actions like "parkour vaulting" not "sleeping"
- If location is "underwater", suggest subjects like "scuba diver" not "race car"
- If mood is "tense", suggest styles like "high-contrast noir" not "bright cheerful animation"

Return ONLY a JSON array in this exact format (no markdown, no code blocks):

[
  {"text": "specific suggestion 1", "explanation": "why this works well with the context"},
  {"text": "specific suggestion 2", "explanation": "why this works well with the context"},
  {"text": "specific suggestion 3", "explanation": "why this works well with the context"},
  {"text": "specific suggestion 4", "explanation": "why this works well with the context"},
  {"text": "specific suggestion 5", "explanation": "why this works well with the context"},
  {"text": "specific suggestion 6", "explanation": "why this works well with the context"},
  {"text": "specific suggestion 7", "explanation": "why this works well with the context"},
  {"text": "specific suggestion 8", "explanation": "why this works well with the context"}
]

Each "text" should be SHORT and SPECIFIC (2-8 words). Each "explanation" should be a brief sentence about why it fits.`;
  }
}
