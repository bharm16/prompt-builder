import { logger } from '../infrastructure/Logger.js';
import { cacheService } from './CacheService.js';
import { StructuredOutputEnforcer } from '../utils/StructuredOutputEnforcer.js';
import { TemperatureOptimizer } from '../utils/TemperatureOptimizer.js';

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

    // Define schema for validation
    const schema = {
      type: 'array',
      items: {
        required: ['text', 'explanation'],
      },
    };

    // Get optimal temperature for enhancement
    const temperature = TemperatureOptimizer.getOptimalTemperature('enhancement', {
      diversity: 'high',
      precision: 'medium',
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

    // Define schema for validation
    const schema = {
      type: 'array',
      items: {
        required: ['text'],
      },
    };

    // Get optimal temperature for custom suggestions
    const temperature = TemperatureOptimizer.getOptimalTemperature('enhancement', {
      diversity: 'high',
      precision: 'medium',
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
    return `You are an expert prompt engineer specializing in placeholder value suggestion with deep contextual understanding.

<analysis_process>
Step 1: Identify the placeholder type
- Analyze: "${highlightedText}"
- Classify: Is this a location, person, time, event, style, audience, action, attribute, or other parameter type?
- Context clues: What do the surrounding words suggest about expected value type?

Step 2: Understand contextual constraints
- Examine full prompt context for compatibility requirements
- Identify domain (creative, technical, business, educational, etc.)
- Note any explicit or implicit constraints
- Consider the original user's intent: "${originalUserPrompt}"

Step 3: Evaluate specificity requirements
- Should suggestions be concrete/specific or conceptual/abstract?
- What level of detail is appropriate given the context?
- Are there style, tone, or domain-specific considerations?

Step 4: Generate diverse, high-quality options
- Create 5-8 meaningfully different suggestions
- Ensure each is a direct drop-in replacement
- Vary the suggestions to cover different possibilities within the constraint space
- Prioritize contextual fit and practical usability
</analysis_process>

**Context Analysis:**
Full prompt: ${fullPrompt.substring(0, 1500)}

Surrounding context:
- Before: "${contextBefore}"
- **PLACEHOLDER**: "${highlightedText}"
- After: "${contextAfter}"

Original user request: "${originalUserPrompt}"

**Your Task:**
Generate 5-8 concrete, specific suggestions to replace "${highlightedText}".

**Quality Criteria:**
✓ Each suggestion is a SHORT, SPECIFIC value (1-10 words max)
✓ Direct drop-in replacement - no rewriting needed
✓ Meaningfully different from each other
✓ Contextually appropriate and compatible
✓ Specific enough to be immediately useful
${isVideoPrompt ? '✓ For video: consider cinematic/visual implications' : '✓ Aligns with overall prompt objectives'}

**Output Format:**
Return ONLY a JSON array (no markdown, no code blocks, no preamble):

[
  {"text": "specific value 1", "explanation": "why this fits the context"},
  {"text": "specific value 2", "explanation": "why this fits the context"},
  {"text": "specific value 3", "explanation": "why this fits the context"},
  {"text": "specific value 4", "explanation": "why this fits the context"},
  {"text": "specific value 5", "explanation": "why this fits the context"},
  {"text": "specific value 6", "explanation": "why this fits the context"},
  {"text": "specific value 7", "explanation": "why this fits the context"},
  {"text": "specific value 8", "explanation": "why this fits the context"}
]`;
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
      return `You are a video prompt expert for AI video generation (Sora, Veo3, RunwayML) with expertise in cinematic storytelling.

<analysis_process>
Step 1: Understand the highlighted section
- Content: "${highlightedText}"
- What aspect of the video does this describe? (subject, action, camera, lighting, environment, etc.)
- Current level of detail and specificity

Step 2: Analyze context and constraints
- How does this fit with surrounding elements?
- What's the overall creative vision from: "${originalUserPrompt}"
- What cinematic elements could be enhanced?

Step 3: Identify enhancement opportunities
- Camera work: Could we add specific angles, movements, or lens choices?
- Lighting: Could we specify quality, direction, or color?
- Motion: Could we detail speed, rhythm, or choreography?
- Atmosphere: Could we add environmental or mood details?
- Composition: Could we specify framing or visual hierarchy?

Step 4: Generate diverse alternatives
- Create 3-5 variations with different creative approaches
- Each should be complete drop-in replacement
- Vary the enhancement focus (some camera-heavy, some lighting-heavy, etc.)
- Ensure compatibility with AI video generation models
</analysis_process>

**HIGHLIGHTED SECTION:**
"${highlightedText}"

**CONTEXT:**
Before: "${contextBefore}"
After: "${contextAfter}"

**FULL PROMPT:**
${fullPrompt}

**ORIGINAL REQUEST:**
"${originalUserPrompt}"

**Your Task:**
Generate 3-5 enhanced rewrites focusing on cinematic detail.

**Enhancement Focus Areas:**
- Camera angles/movements (crane, dolly, handheld, Dutch angle, POV)
- Lighting specifics (golden hour, rim lighting, volumetric rays, shadows)
- Motion details (slow-mo, speed ramping, choreography, pacing)
- Color/mood (warm tones, desaturation, contrast, grading)
- Composition (rule of thirds, depth layers, framing)
- Environment (weather, atmosphere, particles, background)

**Quality Criteria:**
✓ Complete drop-in replacement
✓ Flows naturally with surrounding context
✓ Adds meaningful cinematic detail
✓ Each variant takes a different creative approach
✓ Compatible with AI video generation platforms

Return ONLY a JSON array (no markdown, no code blocks):

[
  {"text": "enhanced rewrite with cinematic detail...", "explanation": "why this approach works"},
  {"text": "alternative approach with different focus...", "explanation": "why this approach works"},
  {"text": "third variation with unique perspective...", "explanation": "why this approach works"},
  {"text": "fourth option with different mood...", "explanation": "why this approach works"},
  {"text": "fifth creative take with distinctive style...", "explanation": "why this approach works"}
]`;
    }

    return `You are a prompt engineering expert specializing in clarity, specificity, and actionability.

<analysis_process>
Step 1: Analyze the highlighted section
- Content: "${highlightedText}"
- What is it trying to accomplish?
- Current clarity and specificity level

Step 2: Identify improvement opportunities
- Is it vague or ambiguous?
- Could it be more specific or concrete?
- Are there implicit requirements to make explicit?
- Would structure or examples help?

Step 3: Consider context
- Original intent: "${originalUserPrompt}"
- How does this fit in the full prompt?
- What constraints or requirements exist?

Step 4: Generate enhanced alternatives
- Create 3-5 variants with different improvement focuses
- Some add structure, some add examples, some add clarity
- Each should be a complete, self-contained replacement
- Maintain natural flow with surrounding context
</analysis_process>

**HIGHLIGHTED SECTION:**
"${highlightedText}"

**CONTEXT:**
Before: "${contextBefore}"
After: "${contextAfter}"

**FULL PROMPT:**
${fullPrompt}

**ORIGINAL REQUEST:**
"${originalUserPrompt}"

**Your Task:**
Generate 3-5 improved rewrites focusing on clarity and effectiveness.

**Improvement Strategies:**
- Add concrete examples or criteria
- Break down vague instructions into specific steps
- Specify formats or structures explicitly
- Add constraints or success criteria
- Make implicit requirements explicit
- Increase actionability and reduce ambiguity

**Quality Criteria:**
✓ Complete drop-in replacement
✓ Flows naturally with context
✓ More effective and specific than original
✓ Each variant takes different improvement approach
✓ Maintains original intent and tone

Return ONLY a JSON array (no markdown, no code blocks):

[
  {"text": "improved rewrite 1...", "explanation": "why this improvement works"},
  {"text": "alternative improvement 2...", "explanation": "why this improvement works"},
  {"text": "third approach 3...", "explanation": "why this improvement works"},
  {"text": "fourth variation 4...", "explanation": "why this improvement works"},
  {"text": "fifth option 5...", "explanation": "why this improvement works"}
]`;
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
    return `You are a ${isVideoPrompt ? 'video prompt expert for AI video generation (Sora, Veo3, RunwayML)' : 'prompt engineering expert'} specializing in custom modifications.

<analysis_process>
Step 1: Understand the selected text
- Current content: "${highlightedText}"
- Role in overall prompt context

Step 2: Parse the user's modification request
- Request: "${customRequest}"
- Identify specific changes requested
- Determine intent: style change, detail addition, tone shift, restructuring, etc.

Step 3: Analyze contextual constraints
- How does this fit with surrounding prompt elements?
- ${isVideoPrompt ? 'What cinematic considerations apply?' : 'What tone and purpose must be maintained?'}

Step 4: Generate custom alternatives
- Create 3-5 variants that fulfill the user's request
- Each should interpret or implement the request differently
- Ensure drop-in compatibility with surrounding context
- Vary approaches to provide options
</analysis_process>

**Selected Text:**
"${highlightedText}"

**User's Modification Request:**
"${customRequest}"

**Full Prompt Context:**
${fullPrompt.substring(0, 1000)}

**Your Task:**
Generate 3-5 alternative rewrites that specifically implement the user's request.

**Requirements:**
✓ Complete drop-in replacement for selected text
✓ Directly addresses what the user asked for
✓ Flows naturally with surrounding context
✓ Each variant offers a meaningfully different approach
${isVideoPrompt ? '✓ Maintains compatibility with AI video platforms and includes cinematic detail' : '✓ Maintains overall prompt tone and purpose'}

**Output Format:**
Return ONLY a JSON array (no markdown, no code blocks):

[
  {"text": "first implementation of user's request..."},
  {"text": "second approach with different interpretation..."},
  {"text": "third variation with alternative take..."},
  {"text": "fourth option with unique spin..."},
  {"text": "fifth creative implementation..."}
]`;
  }
}
