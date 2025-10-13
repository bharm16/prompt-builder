import { logger } from '../infrastructure/Logger.js';
import { cacheService } from './CacheService.js';
import { TemperatureOptimizer } from '../utils/TemperatureOptimizer.js';
import { ConstitutionalAI } from '../utils/ConstitutionalAI.js';

/**
 * Service for optimizing prompts across different modes
 * Handles business logic for prompt optimization with intelligent mode detection and iterative refinement
 */
export class PromptOptimizationService {
  constructor(claudeClient) {
    this.claudeClient = claudeClient;
    this.cacheConfig = cacheService.getConfig('promptOptimization');
    this.exampleBank = this.initializeExampleBank();
  }

  /**
   * Optimize a prompt based on mode and context
   * @param {Object} params - Optimization parameters
   * @param {string} params.prompt - Original prompt
   * @param {string} params.mode - Optimization mode (optional - will auto-detect if not provided)
   * @param {Object} params.context - Additional context
   * @param {boolean} params.useConstitutionalAI - Whether to apply Constitutional AI review (default: false)
   * @param {boolean} params.useIterativeRefinement - Whether to use iterative refinement (default: false)
   * @returns {Promise<string|Object>} Optimized prompt (or object with prompt and metadata if iterative)
   */
  async optimize({ prompt, mode, context, useConstitutionalAI = false, useIterativeRefinement = false }) {
    logger.info('Optimizing prompt', { mode, promptLength: prompt?.length });

    // Auto-detect mode if not provided
    if (!mode) {
      mode = await this.detectOptimalMode(prompt);
      logger.info('Auto-detected mode', { detectedMode: mode });
    }

    // Check cache first
    const cacheKey = cacheService.generateKey(this.cacheConfig.namespace, {
      prompt,
      mode,
      context,
      useIterativeRefinement,
    });

    const cached = await cacheService.get(cacheKey, 'prompt-optimization');
    if (cached) {
      logger.debug('Cache hit for prompt optimization');
      return cached;
    }

    // Use iterative refinement if requested
    if (useIterativeRefinement) {
      const result = await this.optimizeIteratively(prompt, mode, context, useConstitutionalAI);
      await cacheService.set(cacheKey, result, { ttl: this.cacheConfig.ttl });
      return result;
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
    const domain = this.detectDomainFromPrompt(prompt);
    const wordCount = prompt.split(/\s+/).length;

    return `<role>
You are an elite prompt engineering specialist with expertise in cognitive science, linguistics, and AI optimization. You understand precisely what makes AI systems perform at their peak potential.
</role>

<task>
Transform this rough prompt into a masterfully crafted, production-ready prompt that will generate exceptional results.
</task>

<analysis_framework>
  <stage_1>Deep Intent Analysis</stage_1>
  Examine: "${prompt}"
  - What is the TRUE underlying goal?
  - What implicit assumptions need to be explicit?
  - What output would genuinely solve the user's problem?
  - What expertise or perspective is needed?

  <stage_2>Domain Detection</stage_2>
  Detected characteristics:
  - Word count: ${wordCount}
  - Likely domain: ${domain}
  - Complexity level: ${wordCount < 10 ? 'simple' : wordCount < 30 ? 'moderate' : 'complex'}

  <stage_3>Gap Identification</stage_3>
  Missing elements to identify:
  - Context gaps (background, constraints, scope)
  - Specificity gaps (vague terms, ambiguous requirements)
  - Structure gaps (organization, flow, hierarchy)
  - Output gaps (format, style, deliverables)

  <stage_4>Enhancement Strategies</stage_4>
  Apply these proven techniques:
  - Role definition for optimal perspective
  - Context injection for better understanding
  - Constraint specification for focused output
  - Success criteria for quality assurance
  - Example provision for clarity
  - Anti-pattern identification to prevent common errors
</analysis_framework>

<few_shot_examples>
  <example_1>
    <weak>"Write about climate change"</weak>
    <strong>
**GOAL**
Create a comprehensive yet accessible 1500-word article explaining climate change causes, impacts, and solutions for a general audience.

**CONTEXT**
Target audience: Educated adults without scientific background who want to understand climate change beyond headlines. Article will be published in a mainstream online magazine focused on current affairs and environmental topics.

**REQUIREMENTS**
- Length: 1500 words (±10%)
- Tone: Informative but engaging, avoiding both alarmism and minimization
- Structure: Clear sections with subheadings
- Evidence: Include 5-7 credible statistics or research findings
- Balance: Present scientific consensus while acknowledging uncertainties
- Accessibility: Explain technical terms when first used

**INSTRUCTIONS**
1. Open with a relatable hook connecting climate change to daily life
2. Explain the greenhouse effect using clear analogies
3. Detail primary human causes with specific examples
4. Describe current and projected impacts across different regions
5. Present both mitigation and adaptation solutions
6. Conclude with actionable steps readers can take

**SUCCESS CRITERIA**
- Scientifically accurate without being overly technical
- Engaging narrative that maintains reader interest
- Balanced presentation that builds understanding
- Clear action items that empower rather than overwhelm
- Smooth flow between sections with logical transitions

**OUTPUT FORMAT**
Article structure:
- Compelling title
- Brief introductory hook (2-3 sentences)
- Main sections with descriptive subheadings
- Conclusion with call-to-action
- 3-5 bullet points of key takeaways

**AVOID**
- Political rhetoric or partisan framing
- Catastrophizing or fear-mongering
- Oversimplification of complex systems
- Technical jargon without explanation
- Prescriptive tone that alienates readers
    </strong>
    <improvement>Added specificity across all dimensions: audience, purpose, length, structure, tone, evidence requirements, and clear success metrics</improvement>
  </example_1>

  <example_2>
    <weak>"Help me with Python code"</weak>
    <strong>
**GOAL**
Debug and optimize a Python function that processes large CSV files, addressing memory efficiency and execution speed issues.

**CONTEXT**
Working with financial transaction data (10GB+ CSV files) that needs daily processing. Current implementation causes memory errors and takes 4+ hours. Running Python 3.11 on a server with 16GB RAM. Need production-ready solution.

**REQUIREMENTS**
- Compatibility: Python 3.11, pandas/numpy ecosystem
- Memory limit: Peak usage under 8GB
- Performance: Process 10GB file in under 30 minutes
- Reliability: Handle malformed data gracefully
- Maintainability: Clear code with docstrings
- Testing: Include unit tests for edge cases

**INSTRUCTIONS**
1. Analyze the current implementation for bottlenecks
2. Implement chunked reading strategy for memory efficiency
3. Optimize data type usage (downcast where appropriate)
4. Add parallel processing where beneficial
5. Implement comprehensive error handling
6. Add progress tracking for long-running operations
7. Create performance benchmarks

**SUCCESS CRITERIA**
- Memory usage stays under 8GB for 10GB+ files
- Processing time reduced by at least 70%
- Zero data loss or corruption
- Graceful handling of edge cases
- Clear logging of operations and errors

**OUTPUT FORMAT**
Provide:
1. Refactored function with inline comments
2. Explanation of each optimization
3. Performance comparison (before/after)
4. Unit test examples
5. Usage documentation

**AVOID**
- Loading entire file into memory
- Premature optimization without profiling
- Complex solutions when simple ones suffice
- Breaking changes to function interface
- Dependencies outside standard data science stack
    </strong>
    <improvement>Transformed vague request into specific technical requirements with clear constraints, performance targets, and deliverables</improvement>
  </example_2>
</few_shot_examples>

<domain_specific_enhancements>
${this.getDomainEnhancements(domain)}
</domain_specific_enhancements>

<transformation_rules>
1. **Specificity Over Generality**: Replace every vague term with precise, measurable language
2. **Context Injection**: Add sufficient background for standalone execution
3. **Structure for Scannability**: Use clear hierarchy and formatting
4. **Constraints as Guardrails**: Define boundaries to focus creativity
5. **Examples as Clarifiers**: Include when complexity demands it
6. **Success Metrics**: Make quality measurable and objective
7. **Anti-patterns**: Explicitly state what to avoid
</transformation_rules>

<original_prompt>
"${prompt}"
</original_prompt>

<output_instructions>
Create an optimized prompt following this EXACT structure:

**GOAL**
[One powerful, specific sentence capturing the exact objective]

**CONTEXT**
[Essential background: domain, audience, purpose, constraints, and critical assumptions]

**REQUIREMENTS**
[Bullet-pointed specific requirements:
- Technical specifications
- Content requirements
- Quality standards
- Constraints and limitations]

**INSTRUCTIONS**
[Numbered, actionable steps:
1. First concrete action
2. Next logical step
3. Continue through completion]

**SUCCESS CRITERIA**
[Measurable indicators of excellence:
- Specific quality metrics
- Completeness checks
- Validation methods]

**OUTPUT FORMAT**
[Precise structure and formatting requirements]

**EXAMPLES** (include only if adds clarity)
[Concrete examples showing desired pattern]

**AVOID**
[Common mistakes and anti-patterns to prevent]

CRITICAL:
- Make EVERY element specific and actionable
- Ensure the prompt is self-contained
- Use precise, unambiguous language
- Transform implicit assumptions into explicit requirements
- Focus on what will actually improve output quality

Provide ONLY the optimized prompt. No preamble, no explanation, no meta-commentary. Begin directly with "**GOAL**".
</output_instructions>`;
  }

  /**
   * Detect domain from prompt content
   * @private
   */
  detectDomainFromPrompt(prompt) {
    const promptLower = prompt.toLowerCase();

    // Domain indicators with keywords
    const domains = {
      'technical': ['code', 'program', 'function', 'debug', 'api', 'database', 'algorithm', 'software', 'deploy'],
      'creative': ['write', 'story', 'poem', 'creative', 'narrative', 'character', 'plot', 'dialogue'],
      'analytical': ['analyze', 'data', 'statistics', 'research', 'evaluate', 'compare', 'study', 'investigate'],
      'educational': ['teach', 'learn', 'explain', 'understand', 'course', 'lesson', 'tutorial', 'guide'],
      'business': ['market', 'strategy', 'revenue', 'customer', 'sales', 'product', 'company', 'roi'],
      'scientific': ['hypothesis', 'experiment', 'research', 'theory', 'scientific', 'study', 'analysis'],
      'visual': ['design', 'image', 'video', 'visual', 'graphic', 'ui', 'ux', 'interface', 'layout']
    };

    let detectedDomain = 'general';
    let maxScore = 0;

    for (const [domain, keywords] of Object.entries(domains)) {
      let score = 0;
      for (const keyword of keywords) {
        if (promptLower.includes(keyword)) {
          score++;
        }
      }
      if (score > maxScore) {
        maxScore = score;
        detectedDomain = domain;
      }
    }

    return detectedDomain;
  }

  /**
   * Get domain-specific enhancements
   * @private
   */
  getDomainEnhancements(domain) {
    const enhancements = {
      'technical': `
<technical_enhancements>
- Include specific technologies, versions, and environments
- Define input/output data structures precisely
- Specify error handling and edge cases
- Add performance requirements if relevant
- Include code style and documentation standards
</technical_enhancements>`,

      'creative': `
<creative_enhancements>
- Define tone, style, and voice explicitly
- Specify narrative structure or format
- Include character/setting details if relevant
- Define emotional impact or themes
- Specify length and pacing requirements
</creative_enhancements>`,

      'analytical': `
<analytical_enhancements>
- Define data sources and quality criteria
- Specify analytical methodology
- Include statistical significance requirements
- Define visualization or presentation format
- Specify confidence levels and limitations
</analytical_enhancements>`,

      'educational': `
<educational_enhancements>
- Define learning objectives clearly
- Specify prerequisite knowledge
- Include assessment criteria
- Define explanation depth and examples
- Specify engagement strategies
</educational_enhancements>`,

      'business': `
<business_enhancements>
- Define business context and constraints
- Specify ROI or success metrics
- Include stakeholder considerations
- Define risk factors and mitigation
- Specify deliverable format for executives
</business_enhancements>`,

      'scientific': `
<scientific_enhancements>
- Define hypothesis and methodology
- Specify data collection requirements
- Include statistical analysis needs
- Define peer review standards
- Specify citation and evidence requirements
</scientific_enhancements>`,

      'visual': `
<visual_enhancements>
- Define visual style and aesthetic
- Specify color palette and typography
- Include accessibility requirements
- Define responsive design needs
- Specify file formats and resolutions
</visual_enhancements>`,

      'general': `
<general_enhancements>
- Focus on clarity and completeness
- Define success criteria explicitly
- Include relevant examples
- Specify output format clearly
- Add quality checkpoints
</general_enhancements>`
    };

    return enhancements[domain] || enhancements['general'];
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

  /**
   * Detect optimal mode based on prompt content
   * @param {string} prompt - The prompt to analyze
   * @returns {Promise<string>} Detected mode
   */
  async detectOptimalMode(prompt) {
    const promptLower = prompt.toLowerCase();

    // Define domain indicators
    const domainIndicators = {
      reasoning: {
        keywords: ['analyze', 'solve', 'calculate', 'prove', 'deduce', 'logic', 'explain why', 'determine', 'evaluate', 'assess'],
        weight: 1.5,
      },
      research: {
        keywords: ['investigate', 'study', 'explore', 'survey', 'examine', 'research', 'find information', 'compile', 'gather'],
        weight: 1.3,
      },
      socratic: {
        keywords: ['teach', 'learn', 'understand', 'explain', 'guide', 'education', 'help me understand', 'walk through', 'tutorial'],
        weight: 1.2,
      },
      video: {
        keywords: ['video', 'scene', 'camera', 'visual', 'cinematic', 'footage', 'animation', 'motion', 'shot', 'frame'],
        weight: 2.0, // Higher weight for video as it's very specific
      },
    };

    // Calculate scores for each mode
    const scores = {};
    for (const [mode, config] of Object.entries(domainIndicators)) {
      scores[mode] = this.calculateModeScore(promptLower, config.keywords, config.weight);
    }

    // Find the highest scoring mode
    const maxScore = Math.max(...Object.values(scores));

    // If no clear winner (low scores), use Claude for intelligent detection
    if (maxScore < 0.3) {
      return await this.claudeAnalyzeIntent(prompt);
    }

    // Return the mode with highest score
    return Object.entries(scores).reduce((a, b) => (b[1] > a[1] ? b : a))[0];
  }

  /**
   * Calculate mode score based on keyword presence
   * @private
   */
  calculateModeScore(text, keywords, weight = 1.0) {
    let score = 0;
    const words = text.split(/\s+/);

    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        // Full phrase match gets higher score
        score += keyword.split(' ').length > 1 ? 0.15 : 0.1;
      }
    }

    return score * weight;
  }

  /**
   * Use Claude to intelligently analyze prompt intent
   * @private
   */
  async claudeAnalyzeIntent(prompt) {
    const analysisPrompt = `Analyze this prompt and determine the most appropriate optimization mode.

Prompt: "${prompt}"

Available modes:
- reasoning: For analytical, problem-solving, logical deduction tasks
- research: For information gathering, investigation, exploration tasks
- socratic: For educational, learning, teaching, understanding tasks
- video: For video generation, visual content, cinematic descriptions
- default: For general prompt optimization when no specific mode fits

Consider the primary intent and expected output type.

Respond with ONLY the mode name (one word):`;

    try {
      const response = await this.claudeClient.complete(analysisPrompt, {
        maxTokens: 10,
        temperature: 0.1,
      });

      const mode = response.content[0].text.trim().toLowerCase();

      // Validate the mode
      if (['reasoning', 'research', 'socratic', 'video', 'default'].includes(mode)) {
        return mode;
      }
    } catch (error) {
      logger.warn('Failed to detect mode with Claude', { error });
    }

    return 'default'; // Fallback to default mode
  }

  /**
   * Iteratively refine a prompt through multiple optimization passes
   * @param {string} prompt - Original prompt
   * @param {string} mode - Optimization mode
   * @param {Object} context - Additional context
   * @param {boolean} useConstitutionalAI - Whether to use Constitutional AI
   * @returns {Promise<Object>} Refined prompt with quality metrics
   */
  async optimizeIteratively(prompt, mode, context, useConstitutionalAI) {
    let currentPrompt = prompt;
    let bestPrompt = prompt;
    let bestScore = 0;
    const maxIterations = 3;
    const improvements = [];

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      logger.info('Iterative refinement', { iteration, mode });

      // Optimize the current prompt
      const systemPrompt = this.buildSystemPrompt(currentPrompt, mode, context);

      // Include previous improvements in context
      const iterativeSystemPrompt = iteration > 0
        ? `${systemPrompt}\n\nPrevious improvements applied:\n${improvements.join('\n')}\n\nFocus on addressing remaining weaknesses.`
        : systemPrompt;

      const temperature = TemperatureOptimizer.getOptimalTemperature('optimization', {
        diversity: 'medium',
        precision: 'high',
      });

      const response = await this.claudeClient.complete(iterativeSystemPrompt, {
        maxTokens: 4096,
        temperature,
      });

      let optimizedPrompt = response.content[0].text;

      // Apply Constitutional AI if requested
      if (useConstitutionalAI) {
        const principles = ConstitutionalAI.getPrinciplesForDomain('technical-content');
        const reviewResult = await ConstitutionalAI.applyConstitutionalReview(
          this.claudeClient,
          currentPrompt,
          optimizedPrompt,
          {
            principles,
            autoRevise: true,
            threshold: 0.7,
          }
        );
        optimizedPrompt = reviewResult.output;
      }

      // Assess quality of this iteration
      const assessment = await this.assessPromptQuality(optimizedPrompt, mode);

      if (assessment.score > bestScore) {
        bestPrompt = optimizedPrompt;
        bestScore = assessment.score;
      }

      // Check if we've reached sufficient quality
      if (assessment.score > 0.9) {
        logger.info('Reached target quality', { iteration, score: assessment.score });
        break;
      }

      // Identify weaknesses for next iteration
      const weaknesses = await this.identifyWeaknesses(optimizedPrompt, assessment);
      if (weaknesses.length === 0) break;

      // Prepare for next iteration
      improvements.push(...weaknesses.map(w => `Fix: ${w}`));
      currentPrompt = optimizedPrompt;
    }

    return {
      prompt: bestPrompt,
      quality: bestScore,
      iterations: improvements.length,
      improvements,
    };
  }

  /**
   * Assess the quality of an optimized prompt
   * @private
   */
  async assessPromptQuality(prompt, mode) {
    const assessmentPrompt = `Assess the quality of this ${mode} prompt on multiple dimensions.

Prompt to assess:
"${prompt}"

Evaluate on these criteria (0-1 scale for each):
1. Clarity: Is the objective crystal clear?
2. Specificity: Are requirements explicit and detailed?
3. Structure: Is it well-organized and easy to follow?
4. Completeness: Does it cover all necessary aspects?
5. Actionability: Can someone immediately execute this?
6. Mode Fit: Is it optimized for ${mode} tasks?

For each criterion, provide a score and brief reason.

Respond in this exact JSON format:
{
  "clarity": 0.X,
  "specificity": 0.X,
  "structure": 0.X,
  "completeness": 0.X,
  "actionability": 0.X,
  "modeFit": 0.X,
  "overallScore": 0.X,
  "weaknesses": ["weakness 1", "weakness 2"]
}`;

    try {
      const response = await this.claudeClient.complete(assessmentPrompt, {
        maxTokens: 500,
        temperature: 0.1,
      });

      const assessment = JSON.parse(response.content[0].text);
      return {
        score: assessment.overallScore || 0.5,
        details: assessment,
        weaknesses: assessment.weaknesses || [],
      };
    } catch (error) {
      logger.warn('Failed to assess prompt quality', { error });
      return { score: 0.5, details: {}, weaknesses: [] };
    }
  }

  /**
   * Identify specific weaknesses in a prompt
   * @private
   */
  async identifyWeaknesses(prompt, assessment) {
    const weaknesses = [];

    if (assessment.details.clarity < 0.7) {
      weaknesses.push('Clarify the main objective and expected outcome');
    }
    if (assessment.details.specificity < 0.7) {
      weaknesses.push('Add more specific requirements and constraints');
    }
    if (assessment.details.structure < 0.7) {
      weaknesses.push('Improve organization with clear sections and hierarchy');
    }
    if (assessment.details.completeness < 0.7) {
      weaknesses.push('Include missing context or requirements');
    }
    if (assessment.details.actionability < 0.7) {
      weaknesses.push('Make instructions more concrete and executable');
    }

    return weaknesses;
  }

  /**
   * Initialize example bank for different modes
   * @private
   */
  initializeExampleBank() {
    return {
      reasoning: [
        {
          input: 'analyze market trends',
          output: `**OBJECTIVE**
Systematically analyze current market trends to identify emerging opportunities and risks.

**PROBLEM STATEMENT**
Evaluate market dynamics across key sectors, identifying patterns, drivers, and potential inflection points that could impact investment or business decisions.

**GIVEN CONSTRAINTS**
- Focus on data from last 6 months
- Consider both quantitative metrics and qualitative signals
- Account for macroeconomic factors
- Prioritize actionable insights

**REASONING APPROACH**
1. Segment analysis by sector/industry
2. Identify leading vs lagging indicators
3. Correlate trends with external factors
4. Evaluate trend strength and sustainability
5. Project likely future scenarios

**VERIFICATION CRITERIA**
- Data sources are credible and recent
- Patterns are statistically significant
- Conclusions follow from evidence
- Biases are acknowledged

**SUCCESS METRICS**
- Clear trend identification with supporting data
- Actionable insights with confidence levels
- Risk factors explicitly stated

**EXPECTED OUTPUT**
Structured analysis with executive summary, detailed findings by sector, trend visualizations, and prioritized recommendations.`,
          explanation: 'Transforms vague request into systematic analytical framework',
        },
      ],
      research: [
        {
          input: 'research AI safety',
          output: `**RESEARCH OBJECTIVE**
Investigate current state of AI safety research, identifying key challenges, proposed solutions, and gaps in existing approaches.

**CORE RESEARCH QUESTIONS**
1. What are the primary AI safety concerns identified by leading researchers?
2. Which technical approaches show most promise for alignment and control?
3. How are different organizations approaching AI safety differently?
4. What are the main points of disagreement in the field?
5. Which safety measures are being implemented in current systems?
6. What regulatory frameworks are emerging globally?

**METHODOLOGY**
- Literature review of peer-reviewed papers (2020-2024)
- Analysis of technical proposals from major AI labs
- Synthesis of policy documents and governance frameworks
- Expert opinion compilation from recognized authorities

**INFORMATION SOURCES**
- Academic: arXiv, Nature, Science, specialized AI conferences
- Industry: OpenAI, Anthropic, DeepMind safety teams
- Policy: Government AI strategies, think tank reports
- Quality criteria: Peer-reviewed, cited >10 times, from recognized institutions

**SUCCESS METRICS**
- Coverage of all major safety paradigms
- Balance of technical and policy perspectives
- Clear synthesis of consensus vs contested areas

**SYNTHESIS FRAMEWORK**
- Categorize by threat model (misalignment, misuse, accidents)
- Map solutions to specific problems
- Identify dependencies and prerequisites
- Highlight gaps and open problems

**DELIVERABLE FORMAT**
Comprehensive report with executive summary, detailed analysis by safety area, comparison of approaches, and research roadmap.

**ANTICIPATED CHALLENGES**
- Rapidly evolving field with daily developments
- Technical complexity requiring deep expertise
- Polarized opinions requiring balanced presentation`,
          explanation: 'Structures vague topic into comprehensive research plan',
        },
      ],
      socratic: [
        {
          input: 'teach me about recursion',
          output: `**LEARNING OBJECTIVE**
Understand recursion as a problem-solving technique, recognize recursive patterns, and apply recursion to solve programming problems effectively.

**PRIOR KNOWLEDGE CHECK**
1. Can you write a simple function that calls another function?
2. What happens when a function calls itself - any initial thoughts?
3. Have you encountered problems that seem to contain smaller versions of themselves?

**FOUNDATION QUESTIONS**
1. "If you had to count from 1 to 10, but could only count one number and then ask someone else to count the rest, how would that work?"
2. "What's similar between Russian nesting dolls and a function that calls itself?"
3. "Why might breaking a big problem into a smaller version of the same problem be useful?"
4. "What would happen if a function kept calling itself forever with no way to stop?"

**DEEPENING QUESTIONS**
1. "How is the call stack like a pile of plates - what happens when you add too many?"
2. "Why do recursive solutions often look cleaner than loops, but sometimes run slower?"
3. "Can every loop be written as recursion? Can every recursion be written as a loop?"
4. "What's the relationship between mathematical induction and recursive programming?"
5. "How does tail recursion optimization change our mental model?"

**APPLICATION & SYNTHESIS**
1. "How would you use recursion to explore all possible paths in a maze?"
2. "Why are tree data structures naturally suited for recursive algorithms?"
3. "When would you choose recursion over iteration in production code?"
4. "How do functional programming languages leverage recursion differently?"

**METACOGNITIVE REFLECTION**
1. "What made the concept 'click' for you - was it a specific example or visualization?"
2. "Which recursive pattern (divide-conquer, accumulate, generate) feels most intuitive?"
3. "What aspects of recursion still feel mysterious or counterintuitive?"

**COMMON MISCONCEPTIONS**
1. "Recursion is always inefficient" - Question: "What about tail recursion and memoization?"
2. "Base case isn't important" - Question: "What happens to our plate stack without one?"

**EXTENSION PATHS**
- Dynamic programming and memoization
- Mutual recursion and recursive data types
- Recursion in mathematical proofs
- Recursive thinking in system design`,
          explanation: 'Creates discovery-based learning journey from simple concept',
        },
      ],
      video: [
        {
          input: 'robot exploring alien world',
          output: `(Full video prompt template would be inserted here - truncated for brevity)`,
          explanation: 'Expands simple concept into cinematic production blueprint',
        },
      ],
    };
  }

  /**
   * Select relevant examples for prompt enhancement
   * @private
   */
  selectRelevantExamples(prompt, mode) {
    const examples = this.exampleBank[mode] || [];
    if (examples.length === 0) return [];

    // For now, return all examples for the mode
    // Could be enhanced with semantic similarity matching
    return examples.slice(0, 2); // Limit to 2 examples
  }

  /**
   * Get reasoning prompt with example injection
   * @private
   */
  getReasoningPrompt(prompt) {
    const examples = this.selectRelevantExamples(prompt, 'reasoning');
    const exampleText = this.formatExamples(examples);

    return `You are an expert prompt engineer specializing in reasoning models (o1, o1-pro, o3). These models employ extended chain-of-thought reasoning, so prompts should be clear, well-structured, and encourage systematic thinking.

${exampleText ? `Here are examples of excellent reasoning prompt transformations:\n\n${exampleText}\n` : ''}

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
   * Format examples for inclusion in prompts
   * @private
   */
  formatExamples(examples) {
    if (!examples || examples.length === 0) return '';

    return examples
      .map((ex, i) => {
        return `Example ${i + 1}:
Input: "${ex.input}"
Output:
${ex.output}

Why this works: ${ex.explanation}
${'─'.repeat(50)}`;
      })
      .join('\n\n');
  }
}
