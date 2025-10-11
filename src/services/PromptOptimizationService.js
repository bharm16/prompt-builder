import { logger } from '../infrastructure/Logger.js';
import { cacheService } from './CacheService.js';
import { TemperatureOptimizer } from '../utils/TemperatureOptimizer.js';
import { ConstitutionalAI } from '../utils/ConstitutionalAI.js';

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
   * @param {boolean} params.useConstitutionalAI - Whether to apply Constitutional AI review (default: false)
   * @returns {Promise<string>} Optimized prompt
   */
  async optimize({ prompt, mode, context, useConstitutionalAI = false }) {
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
    const timeout = mode === 'video' ? 90000 : 30000; // 90s for video, 30s for others

    // Get optimal temperature for the task
    const temperature = TemperatureOptimizer.getOptimalTemperature('optimization', {
      diversity: 'medium',
      precision: 'medium',
    });

    // Call Claude API
    const response = await this.claudeClient.complete(systemPrompt, {
      maxTokens: 4096,
      timeout,
      temperature,
    });

    let optimizedText = response.content[0].text;

    // Apply Constitutional AI review if requested
    if (useConstitutionalAI) {
      logger.debug('Applying Constitutional AI review', { mode });

      const principles = ConstitutionalAI.getPrinciplesForDomain('technical-content');
      const reviewResult = await ConstitutionalAI.applyConstitutionalReview(
        this.claudeClient,
        prompt,
        optimizedText,
        {
          principles,
          autoRevise: true,
          threshold: 0.7,
        }
      );

      optimizedText = reviewResult.output;

      if (reviewResult.revised) {
        logger.info('Constitutional AI revised the output', {
          issuesFound: reviewResult.improvements.length,
        });
      }
    }

    // Validate response
    this.validateResponse(optimizedText);

    // Cache the result
    await cacheService.set(cacheKey, optimizedText, {
      ttl: this.cacheConfig.ttl,
    });

    logger.info('Prompt optimization completed', {
      mode,
      outputLength: optimizedText.length,
      constitutionalReview: useConstitutionalAI,
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
    return `You are an expert prompt engineer specializing in reasoning models (o1, o1-pro, o3). These models employ extended chain-of-thought reasoning, so prompts should be clear, well-structured, and encourage systematic thinking.

<reasoning_optimization_process>
First, analyze the user's query to identify:
1. Core problem or question to be solved
2. Implicit assumptions or constraints
3. Expected output format and quality criteria
4. Cognitive complexity level required
5. Domain-specific knowledge needed

Then, structure an optimized prompt that:
- States the problem with precision and clarity
- Makes implicit constraints explicit
- Provides scaffolding for systematic reasoning
- Includes verification checkpoints
- Defines clear success metrics
</reasoning_optimization_process>

Transform this query: "${prompt}"

Create an optimized reasoning prompt with this structure:

**OBJECTIVE**
[One clear sentence stating what needs to be accomplished]

**PROBLEM STATEMENT**
[Precise articulation of the problem, including scope and boundaries]

**GIVEN CONSTRAINTS**
[Explicit limitations, requirements, assumptions, or parameters that must be satisfied]

**REASONING APPROACH**
[Suggested methodology or framework for systematic thinking:
- Break down into sub-problems
- Identify key decision points
- Consider edge cases and exceptions
- Verify assumptions
- Think through tradeoffs]

**VERIFICATION CRITERIA**
[Specific checkpoints to validate the solution:
- Completeness checks
- Logical consistency tests
- Constraint satisfaction verification
- Edge case validation]

**SUCCESS METRICS**
[How to evaluate solution quality - be specific and measurable]

**EXPECTED OUTPUT**
[Exact format and structure of the final answer]

CRITICAL INSTRUCTIONS:
1. Be explicit rather than implicit - reasoning models benefit from clarity
2. Include verification steps to encourage self-checking
3. Structure the prompt to guide systematic thinking without over-constraining
4. Make the prompt self-contained and immediately usable
5. Use precise language and avoid ambiguity
6. Balance structure with flexibility for deep reasoning

Provide ONLY the optimized prompt following the exact structure above. No preamble, no explanation, no meta-commentary. Begin directly with "**OBJECTIVE**".`;
  }

  /**
   * Get research mode prompt template
   * @private
   */
  getResearchPrompt(prompt) {
    return `You are a research methodology expert specializing in comprehensive, actionable research planning.

<research_planning_process>
Step 1: Understand the research domain and scope
- Query: "${prompt}"
- What field or domain does this belong to?
- What is the depth and breadth of investigation required?
- Is this exploratory, explanatory, or evaluative research?

Step 2: Identify key research components
- What are the core questions that must be answered?
- What methodologies best suit this inquiry?
- What types of sources will be most valuable?
- What challenges might arise?

Step 3: Structure a systematic approach
- Prioritize questions by importance and dependency
- Define clear success criteria
- Establish a framework for synthesis
- Anticipate obstacles and plan mitigations

Step 4: Ensure actionability
- Make all elements specific and immediately usable
- Provide clear guidance for execution
- Define deliverable expectations
</research_planning_process>

Transform this query into a comprehensive research plan: "${prompt}"

Create an optimized research plan with this structure:

**RESEARCH OBJECTIVE**
[One clear, specific statement of what needs to be investigated and why]

**CORE RESEARCH QUESTIONS**
[5-7 specific, answerable questions in priority order - each should advance understanding]

**METHODOLOGY**
[Specific research approaches and methods: literature review, comparative analysis, case studies, interviews, experiments, etc.]

**INFORMATION SOURCES**
[Specific types of sources with quality criteria:
- Academic: journals, papers, textbooks
- Industry: reports, whitepapers, expert opinions
- Primary: data, interviews, observations
- Quality criteria for each source type]

**SUCCESS METRICS**
[Concrete measures to determine if research is sufficient and comprehensive]

**SYNTHESIS FRAMEWORK**
[Systematic approach to analyze and integrate findings:
- How to organize information
- How to identify patterns and themes
- How to draw conclusions across sources]

**DELIVERABLE FORMAT**
[Precise structure and style requirements for the final output]

**ANTICIPATED CHALLENGES**
[Specific obstacles and practical mitigation strategies for each]

CRITICAL INSTRUCTIONS:
1. Make every element actionable and specific (not generic)
2. Ensure questions build on each other logically
3. Tailor methodology to the specific research domain
4. Provide practical, executable guidance
5. Make this self-contained and immediately usable

Provide ONLY the research plan following the exact structure above. No preamble, no explanation, no meta-commentary. Begin directly with "**RESEARCH OBJECTIVE**".`;
  }

  /**
   * Get socratic mode prompt template
   * @private
   */
  getSocraticPrompt(prompt) {
    return `You are a Socratic learning guide specializing in inquiry-based education through strategic, insight-generating questions.

<socratic_design_process>
Step 1: Analyze the learning topic
- Topic: "${prompt}"
- What are the core concepts to be understood?
- What prerequisite knowledge is needed?
- What are common misconceptions?

Step 2: Map the learning journey
- What sequence of questions will guide discovery?
- How to scaffold from simple to complex?
- What insights should emerge at each stage?
- How to encourage active thinking vs passive recall?

Step 3: Design question types
- Prior knowledge: Assess starting point
- Foundation: Build conceptual base
- Deepening: Challenge and extend thinking
- Application: Connect to real contexts
- Metacognitive: Reflect on learning process

Step 4: Anticipate learner needs
- What will confuse or mislead?
- What examples will clarify?
- What extensions will engage advanced learners?
</socratic_design_process>

Create a Socratic learning journey for: "${prompt}"

Design an optimized learning plan with this structure:

**LEARNING OBJECTIVE**
[Clear, specific statement of what the learner will understand and be able to do by the end]

**PRIOR KNOWLEDGE CHECK**
[2-3 diagnostic questions to assess current understanding and identify gaps]

**FOUNDATION QUESTIONS**
[3-4 carefully sequenced questions that build core conceptual understanding:
- Start with concrete, accessible entry points
- Progress toward abstract principles
- Each question should reveal something new]

**DEEPENING QUESTIONS**
[4-5 progressively challenging questions that extend understanding:
- Explore edge cases and exceptions
- Examine relationships and dependencies
- Challenge assumptions
- Encourage multiple perspectives]

**APPLICATION & SYNTHESIS**
[3-4 questions connecting concepts to real-world scenarios:
- Practical applications
- Transfer to new contexts
- Integration of multiple concepts]

**METACOGNITIVE REFLECTION**
[2-3 questions about the learning process itself:
- "What surprised or challenged you?"
- "What connections did you make?"
- "What remains unclear or intriguing?"]

**COMMON MISCONCEPTIONS**
[2-3 frequent misconceptions with questions designed to surface and correct them]

**EXTENSION PATHS**
[Suggested directions for continued exploration based on learner interest and mastery]

CRITICAL INSTRUCTIONS:
1. Questions should spark insight and discovery, not just recall
2. Build complexity gradually but meaningfully
3. Encourage active thinking at every step
4. Avoid questions with simple yes/no answers
5. Make this self-contained and immediately usable

Provide ONLY the learning plan following the exact structure above. No preamble, no explanation, no meta-commentary. Begin directly with "**LEARNING OBJECTIVE**".`;
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
    return `You are a prompt engineering expert specializing in transforming rough ideas into clear, effective, production-ready prompts.

<prompt_optimization_process>
Step 1: Understand the user's intent
- Original prompt: "${prompt}"
- What is the user trying to accomplish?
- What domain or context does this belong to?
- What output are they expecting?

Step 2: Identify gaps and ambiguities
- What information is missing or unclear?
- What assumptions are implicit?
- What could be misinterpreted?
- What constraints should be explicit?

Step 3: Structure for clarity and completeness
- Define clear goal and success criteria
- Make all requirements explicit
- Provide actionable instructions
- Specify output format precisely
- Add examples where helpful
- Note what to avoid

Step 4: Optimize for effectiveness
- Ensure self-contained and immediately usable
- Balance structure with flexibility
- Use clear, unambiguous language
- Remove unnecessary complexity
</prompt_optimization_process>

Transform this original prompt: "${prompt}"

Create an optimized prompt with this structure:

**GOAL**
[One clear, specific sentence stating what this prompt aims to achieve]

**CONTEXT**
[Essential background information, domain knowledge, and assumptions needed to complete the task effectively]

**REQUIREMENTS**
[Specific, explicit constraints, format requirements, or must-have elements:
- Technical requirements
- Content requirements
- Style/tone requirements
- Quality standards]

**INSTRUCTIONS**
[Clear, step-by-step guidance on how to approach the task:
- Break down complex tasks into steps
- Specify methodology or approach
- Indicate priorities or sequence]

**SUCCESS CRITERIA**
[Concrete, measurable ways to evaluate if the response is high-quality:
- Completeness checks
- Quality indicators
- Evaluation criteria]

**OUTPUT FORMAT**
[Exact structure, style, and format the response should follow - be specific]

**EXAMPLES** (if helpful)
[Brief, concrete example(s) showing desired output style and quality]

**AVOID**
[Common pitfalls, misconceptions, or things to explicitly not do]

CRITICAL INSTRUCTIONS:
1. Make the prompt self-contained and immediately usable
2. Be specific rather than vague or generic
3. Use clear, unambiguous language
4. Ensure all implicit requirements are made explicit
5. Balance structure with appropriate flexibility

Provide ONLY the optimized prompt following the exact structure above. No preamble, no explanation, no meta-commentary. Begin directly with "**GOAL**".`;
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
