import { logger } from '../infrastructure/Logger.js';
import { cacheService } from './CacheService.js';

/**
 * Service for providing enhancement suggestions for highlighted text
 * Handles both placeholder value suggestions and general rewrites
 */
export class EnhancementService {
  constructor(claudeClient) {
    this.claudeClient = claudeClient;
    this.cacheConfig = cacheService.getConfig('enhancement');
  }

  /**
   * Get enhancement suggestions for highlighted text
   * @param {Object} params - Enhancement parameters
   * @returns {Promise<Object>} Suggestions with metadata
   */
  async getEnhancementSuggestions({
    highlightedText,
    contextBefore,
    contextAfter,
    fullPrompt,
    originalUserPrompt,
  }) {
    logger.info('Getting enhancement suggestions', {
      highlightedLength: highlightedText?.length,
    });

    // Check cache first
    const cacheKey = cacheService.generateKey(this.cacheConfig.namespace, {
      highlightedText,
      contextBefore,
      contextAfter,
      fullPrompt: fullPrompt.substring(0, 500), // Partial for cache key
    });

    const cached = await cacheService.get(cacheKey, 'enhancement');
    if (cached) {
      logger.debug('Cache hit for enhancement suggestions');
      return cached;
    }

    // Detect if this is a video prompt
    const isVideoPrompt = this.isVideoPrompt(fullPrompt);

    // Check if highlighted text is a placeholder/parameter
    const isPlaceholder = this.detectPlaceholder(
      highlightedText,
      contextBefore,
      contextAfter,
      fullPrompt
    );

    // Build appropriate prompt
    const systemPrompt = isPlaceholder
      ? this.buildPlaceholderPrompt({
          highlightedText,
          contextBefore,
          contextAfter,
          fullPrompt,
          originalUserPrompt,
          isVideoPrompt,
        })
      : this.buildRewritePrompt({
          highlightedText,
          contextBefore,
          contextAfter,
          fullPrompt,
          originalUserPrompt,
          isVideoPrompt,
        });

    // Call Claude API
    const response = await this.claudeClient.complete(systemPrompt, {
      maxTokens: 2048,
    });

    // Parse response
    let suggestionsText = response.content[0].text;

    // Clean up response
    suggestionsText = suggestionsText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const suggestions = JSON.parse(suggestionsText);

    const result = {
      suggestions,
      isPlaceholder,
    };

    // Cache the result
    await cacheService.set(cacheKey, result, {
      ttl: this.cacheConfig.ttl,
    });

    logger.info('Enhancement suggestions generated', {
      count: suggestions.length,
      type: isPlaceholder ? 'placeholder' : 'rewrite',
    });

    return result;
  }

  /**
   * Get custom suggestions based on user request
   * @param {Object} params - Custom suggestion parameters
   * @returns {Promise<Object>} Custom suggestions
   */
  async getCustomSuggestions({
    highlightedText,
    customRequest,
    fullPrompt,
  }) {
    logger.info('Getting custom suggestions', {
      request: customRequest,
      highlightedLength: highlightedText?.length,
    });

    // Check cache
    const cacheKey = cacheService.generateKey(this.cacheConfig.namespace, {
      highlightedText,
      customRequest,
      fullPrompt: fullPrompt.substring(0, 500),
    });

    const cached = await cacheService.get(cacheKey, 'enhancement');
    if (cached) {
      logger.debug('Cache hit for custom suggestions');
      return cached;
    }

    const isVideoPrompt = this.isVideoPrompt(fullPrompt);

    const systemPrompt = this.buildCustomPrompt({
      highlightedText,
      customRequest,
      fullPrompt,
      isVideoPrompt,
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

    logger.info('Custom suggestions generated', { count: suggestions.length });

    return result;
  }

  /**
   * Detect if highlighted text is a placeholder
   * @private
   */
  detectPlaceholder(highlightedText, contextBefore, contextAfter, fullPrompt) {
    const text = highlightedText.toLowerCase().trim();

    // Pattern 1: Single word that's commonly a placeholder
    const placeholderKeywords = [
      'location',
      'place',
      'venue',
      'setting',
      'where',
      'person',
      'character',
      'who',
      'speaker',
      'audience',
      'time',
      'when',
      'date',
      'period',
      'era',
      'occasion',
      'style',
      'tone',
      'mood',
      'atmosphere',
      'event',
      'action',
      'activity',
      'scene',
      'color',
      'texture',
      'material',
      'angle',
      'perspective',
      'viewpoint',
    ];

    if (text.split(/\s+/).length <= 2 && placeholderKeywords.includes(text)) {
      return true;
    }

    // Pattern 2: Text in parentheses or brackets
    if (
      contextBefore.includes('(') ||
      contextAfter.startsWith(')') ||
      contextBefore.includes('[') ||
      contextAfter.startsWith(']')
    ) {
      return true;
    }

    // Pattern 3: Preceded by phrases like "such as", "like", "e.g."
    const precedingPhrases = [
      'such as',
      'like',
      'e.g.',
      'for example',
      'including',
      'specify',
    ];
    if (
      precedingPhrases.some((phrase) =>
        contextBefore.toLowerCase().includes(phrase)
      )
    ) {
      return true;
    }

    // Pattern 4: In a list or comma-separated context
    if (
      (contextBefore.includes(':') || contextBefore.includes('-')) &&
      text.split(/\s+/).length <= 3
    ) {
      return true;
    }

    // Pattern 5: Part of "include [word]" or "set [word]" pattern
    const includePattern =
      /\b(include|set|choose|specify|add|provide|give)\s+[^,\n]{0,20}$/i;
    if (includePattern.test(contextBefore)) {
      return true;
    }

    return false;
  }

  /**
   * Check if this is a video prompt
   * @private
   */
  isVideoPrompt(fullPrompt) {
    return (
      fullPrompt.includes('**Main Prompt:**') ||
      fullPrompt.includes('**Technical Parameters:**') ||
      fullPrompt.includes('Camera Movement:')
    );
  }

  /**
   * Build prompt for placeholder value suggestions
   * @private
   */
  buildPlaceholderPrompt({
    highlightedText,
    contextBefore,
    contextAfter,
    fullPrompt,
    originalUserPrompt,
    isVideoPrompt,
  }) {
    return `You are an expert prompt engineer analyzing a placeholder value in a prompt.

**Context Analysis:**
Full prompt context: ${fullPrompt.substring(0, 1500)}

Context before: "${contextBefore}"
HIGHLIGHTED PLACEHOLDER: "${highlightedText}"
Context after: "${contextAfter}"

Original user request: "${originalUserPrompt}"

**Your Task:**
The user has highlighted "${highlightedText}" which appears to be a placeholder or parameter that needs a specific value. Analyze the full context and generate 5-8 concrete, specific suggestions for what should replace this placeholder.

**Analysis Guidelines:**
1. Understand what TYPE of value is needed (location, person, time, event, audience, style, etc.)
2. Consider the broader context and requirements in the prompt
3. Provide SPECIFIC, CONCRETE values - not rewrites or explanations
4. Each suggestion should be a direct drop-in replacement
5. Suggestions should be meaningfully different from each other
6. Consider historical accuracy, realism, or creative appropriateness based on context
${isVideoPrompt ? '7. For video prompts: consider cinematic/visual implications of each option' : '7. Consider how each option affects the overall prompt goal'}

**Example Output Patterns:**
- If placeholder is about LOCATION: provide specific place names
- If placeholder is about PERSON: provide specific names or roles
- If placeholder is about TIME: provide specific times, dates, or periods
- If placeholder is about STYLE: provide specific style descriptors
- If placeholder is about AUDIENCE: provide specific audience types
- If placeholder is about ACTION/EVENT: provide specific actions or events

Return ONLY a JSON array in this exact format (no markdown, no code blocks):

[
  {"text": "first specific value option", "explanation": "brief 1-sentence rationale"},
  {"text": "second specific value option", "explanation": "brief 1-sentence rationale"},
  {"text": "third specific value option", "explanation": "brief 1-sentence rationale"},
  {"text": "fourth specific value option", "explanation": "brief 1-sentence rationale"},
  {"text": "fifth specific value option", "explanation": "brief 1-sentence rationale"},
  {"text": "sixth specific value option", "explanation": "brief 1-sentence rationale"},
  {"text": "seventh specific value option", "explanation": "brief 1-sentence rationale"},
  {"text": "eighth specific value option", "explanation": "brief 1-sentence rationale"}
]

Each "text" should be a SHORT, SPECIFIC value (1-10 words max) that can directly replace the highlighted placeholder.`;
  }

  /**
   * Build prompt for rewrite suggestions
   * @private
   */
  buildRewritePrompt({
    highlightedText,
    contextBefore,
    contextAfter,
    fullPrompt,
    originalUserPrompt,
    isVideoPrompt,
  }) {
    if (isVideoPrompt) {
      return `You are a video prompt expert for AI video generation (Sora, Veo3, RunwayML). Analyze this highlighted section from a video generation prompt and generate 3-5 enhanced alternatives.

**HIGHLIGHTED SECTION:**
"${highlightedText}"

**CONTEXT BEFORE:**
"${contextBefore}"

**CONTEXT AFTER:**
"${contextAfter}"

**FULL PROMPT:**
${fullPrompt}

**ORIGINAL USER REQUEST:**
"${originalUserPrompt}"

Generate 3-5 complete rewrites of the highlighted section. Each rewrite should:
1. Be a drop-in replacement for the highlighted text
2. Add more cinematic detail, camera work specifics, lighting descriptions, or motion details
3. Flow naturally with the surrounding context
4. Be meaningfully different from the other suggestions
5. Maintain compatibility with AI video generation models

Focus on enhancing visual storytelling. Consider:
- More specific camera angles and movements (crane shot, Dutch angle, tracking shot, etc.)
- Detailed lighting descriptions (golden hour, rim lighting, volumetric fog, etc.)
- Motion and pacing details (slow-motion, time-lapse, dynamic action, etc.)
- Color grading and mood (warm tones, desaturated, high contrast, etc.)
- Composition and framing (rule of thirds, close-up, wide shot, etc.)
- Environmental details (weather, atmosphere, background elements)

Return ONLY a JSON array in this exact format (no markdown, no code blocks, no explanations):

[
  {"text": "first enhanced rewrite with more cinematic detail..."},
  {"text": "second enhanced rewrite with different visual approach..."},
  {"text": "third enhanced rewrite with alternative camera work..."},
  {"text": "fourth enhanced rewrite with different lighting/mood..."},
  {"text": "fifth enhanced rewrite with unique perspective..."}
]

Each "text" value should be a complete, self-contained replacement for the highlighted section that can be directly inserted into the video prompt.`;
    }

    return `You are a prompt engineering expert. Analyze this highlighted section and generate 3-5 concrete improvements.

**HIGHLIGHTED SECTION:**
"${highlightedText}"

**CONTEXT BEFORE:**
"${contextBefore}"

**CONTEXT AFTER:**
"${contextAfter}"

**FULL PROMPT:**
${fullPrompt}

**ORIGINAL USER REQUEST:**
"${originalUserPrompt}"

Generate 3-5 complete rewrites of the highlighted section. Each rewrite should:
1. Be a drop-in replacement for the highlighted text
2. Make the prompt more effective, specific, and actionable
3. Flow naturally with the surrounding context
4. Be meaningfully different from the other suggestions
5. Address potential ambiguities or add helpful structure

Focus on improving clarity, specificity, and actionability. Consider:
- Adding concrete examples or criteria
- Breaking down vague instructions into specific steps
- Specifying formats or structures more clearly
- Adding constraints or success criteria
- Making implicit requirements explicit

Return ONLY a JSON array in this exact format (no markdown, no code blocks, no explanations):

[
  {"text": "first complete rewrite of the highlighted section..."},
  {"text": "second complete rewrite of the highlighted section..."},
  {"text": "third complete rewrite of the highlighted section..."},
  {"text": "fourth complete rewrite of the highlighted section..."},
  {"text": "fifth complete rewrite of the highlighted section..."}
]

Each "text" value should be a complete, self-contained replacement for the highlighted section that can be directly inserted into the prompt.`;
  }

  /**
   * Build prompt for custom suggestions
   * @private
   */
  buildCustomPrompt({
    highlightedText,
    customRequest,
    fullPrompt,
    isVideoPrompt,
  }) {
    return `You are a ${isVideoPrompt ? 'video prompt expert for AI video generation (Sora, Veo3, RunwayML)' : 'prompt engineering expert'}.

The user has selected this text:
"${highlightedText}"

They want you to modify it with this specific request:
"${customRequest}"

Context from full prompt:
${fullPrompt.substring(0, 1000)}

Generate 3-5 alternative rewrites that specifically address the user's request. Each rewrite should:
1. Be a complete drop-in replacement for the selected text
2. Directly implement what the user asked for
3. Flow naturally with the surrounding context
4. Be meaningfully different from each other
${isVideoPrompt ? '5. Maintain compatibility with AI video generation models and include appropriate cinematic details' : '5. Maintain the overall tone and purpose of the prompt'}

Return ONLY a JSON array in this exact format (no markdown, no code blocks, no explanations):

[
  {"text": "first rewrite implementing the user's request..."},
  {"text": "second rewrite with different approach..."},
  {"text": "third rewrite with alternative interpretation..."},
  {"text": "fourth rewrite with unique variation..."},
  {"text": "fifth rewrite with creative take..."}
]`;
  }
}
