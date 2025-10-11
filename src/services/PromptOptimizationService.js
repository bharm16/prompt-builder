import { logger } from '../infrastructure/Logger.js';
import { cacheService } from './CacheService.js';

/**
 * Service for optimizing prompts across different modes
 * Handles business logic for prompt optimization
 */
export class PromptOptimizationService {
  constructor(claudeClient) {
    this.claudeClient = claudeClient;
    this.cacheConfig = cacheService.getConfig('promptOptimization');
  }

  /**
   * Optimize a prompt based on mode and context
   * @param {Object} params - Optimization parameters
   * @param {string} params.prompt - Original prompt
   * @param {string} params.mode - Optimization mode
   * @param {Object} params.context - Additional context
   * @returns {Promise<string>} Optimized prompt
   */
  async optimize({ prompt, mode, context }) {
    logger.info('Optimizing prompt', { mode, promptLength: prompt?.length });

    // Check cache first
    const cacheKey = cacheService.generateKey(this.cacheConfig.namespace, {
      prompt,
      mode,
      context,
    });

    const cached = await cacheService.get(cacheKey, 'prompt-optimization');
    if (cached) {
      logger.debug('Cache hit for prompt optimization');
      return cached;
    }

    // Build system prompt based on mode
    const systemPrompt = this.buildSystemPrompt(prompt, mode, context);

    // Determine timeout based on mode (video prompts are much larger and need more time)
    const timeout = mode === 'video' ? 60000 : 30000; // 60s for video, 30s for others

    // Call Claude API
    const response = await this.claudeClient.complete(systemPrompt, {
      maxTokens: 4096,
      timeout,
    });

    const optimizedText = response.content[0].text;

    // Validate response
    this.validateResponse(optimizedText);

    // Cache the result
    await cacheService.set(cacheKey, optimizedText, {
      ttl: this.cacheConfig.ttl,
    });

    logger.info('Prompt optimization completed', {
      mode,
      outputLength: optimizedText.length,
    });

    return optimizedText;
  }

  /**
   * Build system prompt based on mode
   * @private
   */
  buildSystemPrompt(prompt, mode, context) {
    let systemPrompt = '';

    switch (mode) {
      case 'reasoning':
        systemPrompt = this.getReasoningPrompt(prompt);
        break;
      case 'research':
        systemPrompt = this.getResearchPrompt(prompt);
        break;
      case 'socratic':
        systemPrompt = this.getSocraticPrompt(prompt);
        break;
      case 'video':
        systemPrompt = this.getVideoPrompt(prompt);
        break;
      default:
        systemPrompt = this.getDefaultPrompt(prompt);
    }

    // Add context enhancement if provided
    if (context && Object.keys(context).some((k) => context[k])) {
      systemPrompt += this.buildContextAddition(context);
    }

    return systemPrompt;
  }

  /**
   * Get reasoning mode prompt template
   * @private
   */
  getReasoningPrompt(prompt) {
    return `You are optimizing prompts for reasoning models. These models think deeply before responding, so the prompt should be clear and direct without over-structuring their reasoning process.

Transform this query into an optimized reasoning prompt:

**Task**
[Clear, concise problem statement - what needs to be solved or understood]

**Key Constraints**
[Important limitations, requirements, or parameters]

**Success Criteria**
[How to evaluate if the solution/answer is good]

**Reasoning Guidance** (optional)
[Only if needed: "Consider edge cases", "Think about tradeoffs", "Verify assumptions"]

Query: "${prompt}"

IMPORTANT: Keep it minimal. Trust the reasoning model to think deeply. Only add structure where it clarifies the problem. Ensure the optimized prompt is self-contained and can be used directly without further editing.

Provide ONLY the optimized prompt in the specified format. No preamble, no explanation, no meta-commentary about what you're doing.`;
  }

  /**
   * Get research mode prompt template
   * @private
   */
  getResearchPrompt(prompt) {
    return `You are a research methodology expert. Transform this into a comprehensive research plan:

**Research Objective**
[Clear statement of what needs to be investigated]

**Core Research Questions**
[5-7 specific, answerable questions in priority order]

**Methodology**
[Research approach and methods to be used]

**Information Sources**
[Specific types of sources with quality criteria]

**Success Metrics**
[How to determine if research is sufficient]

**Synthesis Framework**
[How to analyze and integrate findings across sources]

**Deliverable Format**
[Structure and style of the final output]

**Anticipated Challenges**
[Potential obstacles and mitigation strategies]

Query: "${prompt}"

Make this actionable and specific. Ensure the research plan is self-contained and can be used directly without further editing.

Provide ONLY the research plan in the specified format. No preamble, no explanation, no meta-commentary about what you're doing.`;
  }

  /**
   * Get socratic mode prompt template
   * @private
   */
  getSocraticPrompt(prompt) {
    return `You are a Socratic learning guide. Create a learning journey through strategic questioning:

**Learning Objective**
[What the learner should understand by the end]

**Prior Knowledge Check**
[2-3 questions to assess current understanding]

**Foundation Questions**
[3-4 questions building core concepts]

**Deepening Questions**
[4-5 questions that progressively challenge understanding]

**Application & Synthesis**
[3-4 questions connecting concepts to real scenarios]

**Metacognitive Reflection**
[2-3 questions about the learning process itself: "What surprised you?", "What's still unclear?"]

**Common Misconceptions**
[2-3 misconceptions to address through questioning]

**Extension Paths**
[Suggested directions for continued exploration]

Topic: "${prompt}"

Focus on questions that spark insight, not just recall. Ensure the learning plan is self-contained and can be used directly without further editing.

Provide ONLY the learning plan in the specified format. No preamble, no explanation, no meta-commentary about what you're doing.`;
  }

  /**
   * Get video mode prompt template (ultra-detailed)
   * @private
   */
  getVideoPrompt(prompt) {
    // Note: This is the full video prompt template from server.js lines 214-367
    // Truncated here for brevity, but keeping the full template
    return `You are an expert cinematographer and creative director specializing in AI video generation (Sora, Veo3, RunwayML, Kling, Luma, etc.). Transform this video concept into an ultra-detailed, production-ready video generation prompt with ultimate creative control.

User's video concept: "${prompt}"

Create a comprehensive video prompt with the following structure:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎬 CREATIVE FOUNDATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**WHO - SUBJECT/CHARACTER** [Define the focal point]
- Physical Description: [Age, appearance, clothing, distinctive features]
- Character State: [Emotion, energy level, physical condition]
- Positioning: [Where in frame, relationship to camera]
- Scale: [Close-up details vs full body vs environment dominance]
- Identity/Role: [Professional, archetype, or narrative function]
- Expression: [Facial expression, body language, mood indicators]
- Interaction: [Engaging with environment, objects, or other subjects]

**WHAT - ACTION/ACTIVITY** [Define the movement and narrative]
- Primary Action: [Main activity happening in frame]
- Motion Type: [Dynamic/static, fluid/jerky, fast/slow]
- Action Arc: [Beginning state → transformation → end state]
- Intensity: [Subtle gesture vs dramatic movement]
- Rhythm: [Pacing, beats, moments of stillness vs activity]
- Secondary Actions: [Background movement, environmental dynamics]
- Cause & Effect: [Actions triggering reactions or changes]

**WHERE - LOCATION/SETTING** [Define the environment]
- Environment Type: [Interior/exterior, natural/built, real/abstract]
- Architectural Details: [Structures, surfaces, spatial layout]
- Environmental Scale: [Intimate space vs vast landscape]
- Atmospheric Conditions: [Weather, air quality, particles, fog, haze]
- Background Elements: [What fills negative space, depth layers]
- Foreground Elements: [Objects between camera and subject]
- Spatial Depth: [How far can we see, layers of depth]
- Environmental Storytelling: [What the location reveals about context]

**WHEN - TIME/PERIOD/LIGHTING** [Define temporal and light context]
- Time of Day: [Dawn, morning, noon, golden hour, dusk, night, etc.]
- Lighting Quality: [Hard/soft, warm/cool, natural/artificial]
- Light Direction: [Front-lit, back-lit, side-lit, top-lit, under-lit]
- Light Color: [Specific color temperatures, tints, color casts]
- Shadow Character: [Long/short, sharp/diffused, presence/absence]
- Temporal Period: [Historical era, futuristic, timeless, anachronistic]
- Time Progression: [Static moment vs visible time passing]
- Seasonal Markers: [Visual indicators of season if relevant]

**WHY - EVENT/CONTEXT/PURPOSE** [Define narrative and intent]
- Narrative Context: [What story moment is this]
- Emotional Purpose: [What should viewer feel]
- Visual Objective: [What should draw attention]
- Conceptual Theme: [Abstract idea being expressed]
- Commercial Intent: [If product/brand video - key message]
- Audience Consideration: [Who is this for, what do they expect]
- Symbolic Elements: [Metaphors, visual poetry, subtext]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎥 CINEMATOGRAPHY & TECHNICAL EXECUTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**CAMERA - SETUP & PERSPECTIVE**
- Lens Choice: [Wide/normal/telephoto, focal length implications]
- Depth of Field: [Shallow/deep, what's in/out of focus]
- Focal Point: [Exact point of sharpest focus]
- Camera Height: [Ground level/eye level/high angle/overhead]
- Camera Angle: [Straight-on/Dutch tilt/canted angle]
- Perspective: [First-person POV/third-person/aerial/macro/etc.]
- Frame Composition: [Rule of thirds, centered, off-balance, etc.]

**CAMERA - MOVEMENT & DYNAMICS**
- Movement Type: [Static/locked-off, handheld, Steadicam, drone]
- Camera Motion: [Pan, tilt, dolly, track, crane, orbit, zoom]
- Movement Speed: [Slow creep, steady glide, rapid whip]
- Movement Motivation: [Motivated by action, reveal, or aesthetic]
- Stabilization: [Smooth/fluid vs intentional shake/energy]
- Complex Moves: [Combination movements, transitions mid-shot]
- Movement Start/End: [How movement begins and concludes]

**LIGHTING - DESIGN & MOOD**
- Primary Light Source: [Sun, window, practical, artificial, etc.]
- Fill Light: [Presence, intensity, direction, color]
- Accent/Rim Lighting: [Edge definition, separation from background]
- Practical Lights: [Visible light sources in scene]
- Light Intensity: [Bright/exposed vs dark/moody vs balanced]
- Light Contrast: [High contrast vs low contrast vs flat]
- Shadows: [Quality, length, direction, storytelling role]
- Light Behavior: [Static, flickering, moving, pulsing, changing]

**COLOR - GRADING & PALETTE**
- Overall Color Grade: [Warm/cool, saturated/desaturated, etc.]
- Primary Color Palette: [2-3 dominant colors in frame]
- Color Contrast: [Complementary, analogous, monochrome]
- Color Temperature: [Specific Kelvin values or relative warmth]
- Color Mood: [Emotional associations of color choices]
- Color Symbolism: [Intentional color meaning]
- Skin Tones: [Natural, stylized, specific rendering]
- Color Transitions: [How colors shift through duration]

**MOTION - DYNAMICS & TEMPORAL EFFECTS**
- Subject Speed: [Real-time, slow-motion, time-lapse, speed ramping]
- Frame Rate Intent: [Cinematic 24fps, smooth 60fps, etc.]
- Motion Blur: [Natural, enhanced, frozen/sharp]
- Temporal Effects: [Freeze frames, stutter effects, reverse]
- Rhythm & Pacing: [Beat, tempo, breathing room vs intensity]
- Action Choreography: [Specific blocking and movement patterns]
- Momentum: [Building energy vs winding down vs constant]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ SCENE SYNTHESIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**PRIMARY PROMPT** [150-300 words]
[Synthesize all above elements into ONE cohesive, vivid, flowing description that reads naturally while incorporating specific technical and creative details. This should feel like a cinematographer describing their vision, not a checklist. Prioritize the most important creative and technical aspects.]

**TECHNICAL PARAMETERS**
- Duration: [Recommended clip length, e.g., 5s, 10s, 15s]
- Aspect Ratio: [16:9, 9:16, 1:1, 2.39:1, etc.]
- Visual Style: [Cinematic, documentary, commercial, anime, etc.]
- Reference Aesthetic: [Film stock, era, or visual movement if relevant]

**ALTERNATIVE DIRECTIONS** [3 distinct creative variations]

Version A - [One sentence describing creative pivot]
[75-150 word alternative that changes key creative elements while maintaining concept]

Version B - [One sentence describing creative pivot]
[75-150 word alternative that explores different mood/style/approach]

Version C - [One sentence describing creative pivot]
[75-150 word alternative with bold creative departure]

**PLATFORM OPTIMIZATION**
- Best For: [Which AI video platforms suit this prompt - Sora/Veo3/RunwayML/etc.]
- Platform-Specific Tips: [Any syntax, token limits, or optimization notes]
- Compatibility Notes: [Elements that may need adjustment per platform]

**REFINEMENT GUIDANCE** [What user might want to adjust]
- Tone Adjustments: [Suggestions for shifting mood/atmosphere]
- Technical Tweaks: [Camera, lighting, or movement refinements]
- Narrative Variations: [Story/concept pivots to explore]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**IMPORTANT CREATIVE PRINCIPLES:**
1. Be hyper-specific about visual details while maintaining narrative flow
2. Balance technical precision with creative emotion
3. Consider how every element supports the central vision
4. Provide enough detail for consistency without over-constraining AI creativity
5. Ensure primary prompt feels cinematic and inspired, not mechanical
6. Make alternatives meaningfully different, not just minor tweaks
7. Think like a director AND a cinematographer

Provide ONLY the video prompt package in this format. No preamble, no explanation, no meta-commentary. Go directly into the structured template.`;
  }

  /**
   * Get default optimization prompt template
   * @private
   */
  getDefaultPrompt(prompt) {
    return `You are a prompt engineering expert. Transform this rough prompt into a clear, effective prompt:

**Goal**
[Single sentence stating what the prompt aims to achieve]

**Context**
[Essential background information and assumptions about the task/user]

**Requirements**
[Specific constraints, format requirements, or must-have elements]

**Instructions**
[Step-by-step guidance on how to approach the task, if applicable]

**Success Criteria**
[How to evaluate if the response is good]

**Output Format**
[Exact structure the response should follow]

**Examples** (if helpful)
[Brief example showing desired output style]

**Avoid**
[Common pitfalls or things to explicitly not do]

Original prompt: "${prompt}"

Create a prompt that's self-contained and immediately usable. Ensure the optimized prompt can be used directly without further editing.

Provide ONLY the optimized prompt in the specified format. No preamble, no explanation, no meta-commentary about what you're doing.`;
  }

  /**
   * Build context addition for system prompt
   * @private
   */
  buildContextAddition(context) {
    let addition =
      '\n\n**IMPORTANT - User has provided additional context:**\n';
    addition +=
      'The user has provided additional context. Incorporate this into the optimized prompt:\n\n';

    if (context.specificAspects) {
      addition += `**Specific Focus Areas:** ${context.specificAspects}\n`;
      addition +=
        'Make sure the optimized prompt explicitly addresses these aspects.\n\n';
    }

    if (context.backgroundLevel) {
      addition += `**Target Audience Level:** ${context.backgroundLevel}\n`;
      addition +=
        'Adjust the complexity and terminology to match this level.\n\n';
    }

    if (context.intendedUse) {
      addition += `**Intended Use Case:** ${context.intendedUse}\n`;
      addition += 'Format the prompt to suit this specific use case.\n\n';
    }

    return addition;
  }

  /**
   * Validate Claude response for common issues
   * @private
   */
  validateResponse(optimizedText) {
    const lowerText = optimizedText.toLowerCase();
    if (
      lowerText.includes('here is') ||
      lowerText.includes("i've created") ||
      lowerText.startsWith('sure')
    ) {
      logger.warn('Response contains meta-commentary, may need refinement');
    }
  }
}
