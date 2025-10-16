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

    // Template versions for tracking improvements
    this.templateVersions = {
      default: '2.0.0', // Updated version with 2025 improvements
      reasoning: '2.0.0',
      research: '2.0.0',
      socratic: '2.0.0',
      video: '1.0.0'
    };
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

    // No test-specific short-circuit here; tests should mock fetch at app level

    // Auto-detect mode if not provided
    if (!mode) {
      mode = await this.detectOptimalMode(prompt);
      logger.info('Auto-detected mode', { detectedMode: mode });
    }

    // Check cache first (include template version to prevent serving outdated cached results)
    const cacheKey = cacheService.generateKey(this.cacheConfig.namespace, {
      prompt,
      mode,
      context,
      useIterativeRefinement,
      templateVersion: this.templateVersions[mode] || '1.0.0',
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

    // Log optimization metrics
    this.logOptimizationMetrics(prompt, optimizedText, mode, response);

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

<internal_instructions>
CRITICAL: The sections below marked as <thinking_protocol>, <advanced_reasoning_optimization>, and <quality_verification> are YOUR INTERNAL INSTRUCTIONS for HOW to create the optimized prompt. These sections should NEVER appear in your output.

Your output should ONLY contain the actual optimized reasoning prompt that starts with "**OBJECTIVE**" and follows the structure defined in the template.
</internal_instructions>

<thinking_protocol>
Before outputting the optimized prompt, engage in internal step-by-step thinking (do NOT include this thinking in your output):

1. **Understand the reasoning challenge** (3-5 sentences)
   - What type of reasoning is required (deductive/inductive/abductive)?
   - What makes this problem complex?
   - What's the expected depth of reasoning?

2. **Identify verification needs** (bullet list)
   - What could go wrong in the reasoning process?
   - Where should self-checks be inserted?
   - What assumptions need stress-testing?

3. **Design reasoning scaffolding** (prioritized list)
   - What decomposition strategy is optimal?
   - What verification loops are needed?
   - How to handle uncertainty explicitly?

This thinking process is for YOUR BENEFIT ONLY - do not include it in the final output.
</thinking_protocol>

<advanced_reasoning_optimization>
These are YOUR INTERNAL GUIDELINES for creating the optimized prompt. DO NOT include this section in your output.

PHASE 1: Deep Problem Decomposition
Analyze the query: "${prompt}"

Use recursive decomposition:
1. **Core Problem Identification**
   - What is the fundamental question that needs answering?
   - Can this problem be broken into sub-problems? If yes, what's the dependency structure?
   - What's the minimal problem that, if solved, would unlock the larger solution?

2. **Constraint Mapping**
   - Explicit constraints (stated): [list]
   - Implicit constraints (inferred): [list with justification]
   - Potential constraint conflicts: [identify and note]
   - Constraints that limit solution space most: [priority ranked]

3. **Reasoning Complexity Assessment**
   - Type: [deductive/inductive/abductive/analogical/causal/probabilistic]
   - Depth: [shallow (1-2 steps) / moderate (3-5 steps) / deep (6+ steps)]
   - Uncertainty level: [low/medium/high - affects need for probabilistic reasoning]
   - Domain expertise required: [none/basic/intermediate/expert]

PHASE 2: Reasoning Scaffold Design

Design a reasoning structure that:

A. **Encourages Extended Thinking** (o1/o3 models benefit from this)
   - Don't just ask for the answer - ask for the THINKING PROCESS
   - Include explicit "think step-by-step" instructions
   - Request intermediate reasoning states, not just final conclusions
   - Encourage exploration of multiple solution paths before committing

B. **Builds in Verification Loops**
   - After each reasoning step: "Does this conclusion follow logically?"
   - Before finalizing: "What would disprove this reasoning?"
   - Adversarial check: "What's the strongest argument AGAINST this conclusion?"
   - Sanity checks: "Does this result make sense given [baseline expectations]?"

C. **Handles Uncertainty Explicitly**
   - When confidence is not 100%, request explicit uncertainty quantification
   - Ask: "What additional information would increase confidence?"
   - Request: "What are the key assumptions, and how sensitive is the conclusion to them?"

PHASE 3: Meta-Reasoning Enhancement

Add these meta-cognitive elements:

1. **Reasoning Strategy Selection**
   - Guide the model to choose optimal reasoning strategy:
     * For mathematical problems: formal proof structure
     * For open-ended problems: systematic hypothesis generation and testing
     * For debugging: differential diagnosis approach
     * For optimization: constraint satisfaction with iterative refinement

2. **Self-Monitoring Instructions**
   - "Pause after each major step and assess: Am I on the right track?"
   - "If you notice circular reasoning, backtrack and try a different approach"
   - "If complexity is increasing, consider whether you're overcomplicating"

3. **Edge Case Anticipation**
   - "What boundary conditions should be tested?"
   - "What special cases might break this reasoning?"
   - "What happens at extremes (zero, infinity, negative values, etc.)?"

PHASE 4: Quality Assurance Framework

The optimized prompt should:
✓ Make the reasoning process VISIBLE (not just conclusions)
✓ Include multiple verification checkpoints
✓ Encourage adversarial self-critique
✓ Quantify uncertainty where appropriate
✓ Define what "thorough" means for this specific problem
✓ Provide scaffolding without over-constraining creativity

</advanced_reasoning_optimization>

<output_template>
Transform the user's query "${prompt}" into an optimized reasoning prompt.

The ONLY thing you should output is the optimized prompt following this EXACT structure (replace bracketed sections with specific content):

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

**PROBLEM DECOMPOSITION** (New section - critical for reasoning models)
[Break the problem into logical sub-components:
- List 3-5 key sub-problems or questions
- Show dependencies: "Before solving X, we need Y"
- Identify which sub-problems are critical path vs. supporting
- Note any sub-problems that could be solved in parallel]

**REASONING APPROACH**
[Suggested methodology tailored to problem type:

For this problem type [mathematical/logical/empirical/design/etc.], use this approach:

1. **Initial Analysis Phase**
   - Gather and organize known information
   - Identify what's unknown or uncertain
   - List relevant principles, laws, or frameworks that apply

2. **Solution Generation Phase**
   - [Specific strategy based on problem type]
   - Generate multiple solution candidates if applicable
   - For each major reasoning step:
     * State the step clearly
     * Explain the logical justification
     * Identify any assumptions being made

3. **Verification Phase**
   - For each conclusion: "Does this logically follow from the premises?"
   - Adversarial check: "What's the strongest counter-argument?"
   - Boundary testing: "Does this hold at edge cases?"
   - Assumption testing: "What if assumption X is wrong?"

4. **Confidence Assessment**
   - Rate confidence in the solution: [low/medium/high]
   - Identify key uncertainties that affect confidence
   - State what information would increase confidence
   - Acknowledge limitations of the reasoning]

**VERIFICATION CRITERIA**
[Multi-layered verification approach:

Level 1 - Logical Consistency:
□ All steps follow logically from previous steps
□ No circular reasoning detected
□ Assumptions are explicitly stated and reasonable

Level 2 - Completeness:
□ All sub-problems have been addressed
□ No critical gaps in the reasoning chain
□ Edge cases have been considered

Level 3 - Adversarial Testing:
□ Strongest counter-arguments have been considered and addressed
□ Alternative interpretations have been explored
□ Potential failure modes have been analyzed

Level 4 - Pragmatic Validation:
□ Solution makes intuitive sense (sanity check)
□ Solution is consistent with domain knowledge
□ Solution is feasible given constraints
□ Solution addresses the original objective]

**EXPECTED OUTPUT FORMAT**
[Exact structure with reasoning transparency:

1. **Problem Analysis** (your initial understanding)
2. **Solution Approach** (why you chose this method)
3. **Detailed Reasoning** (step-by-step with justifications - this is where o1/o3 models excel)
4. **Verification** (how you checked your work)
5. **Final Answer** (clear, concise statement)
6. **Confidence Assessment** (how certain are you and why)
7. **Caveats & Limitations** (what could affect this conclusion)]

</output_template>

${this.getQualityVerificationCriteria('reasoning')}

<critical_output_instructions>
THESE ARE YOUR FINAL INSTRUCTIONS - READ CAREFULLY:

WHAT TO OUTPUT:
✅ Output ONLY the optimized reasoning prompt
✅ Begin IMMEDIATELY with "**OBJECTIVE**"
✅ Follow the exact structure shown in <output_template> above
✅ Fill in ALL sections with specific, detailed content based on "${prompt}"
✅ Make it self-contained and immediately usable

WHAT NOT TO OUTPUT:
❌ Do NOT include any of these instruction sections (<thinking_protocol>, <advanced_reasoning_optimization>, <quality_verification>, etc.)
❌ Do NOT write meta-commentary like "Here is the optimized prompt..." or "I've created..."
❌ Do NOT explain your changes or reasoning process
❌ Do NOT include placeholders or references to "the original prompt"
❌ Do NOT add preambles or conclusions about the prompt itself

VERIFICATION CHECKLIST:
Before you output, verify:
□ Your output starts with "**OBJECTIVE**" (not with any explanation)
□ Your output contains ONLY the optimized prompt (not instructions about how to use it)
□ Every section has specific content (no generic placeholders)
□ The prompt is for a reasoning model (o1/o3) to solve the user's problem
□ No meta-commentary is included

OUTPUT NOW: Begin immediately with "**OBJECTIVE**" and nothing else.
</critical_output_instructions>`;
  }

  /**
   * Get research mode prompt template
   * @private
   */
  getResearchPrompt(prompt) {
    return `You are a research methodology expert specializing in comprehensive, actionable research planning with rigorous source validation and bias mitigation.

<internal_instructions>
CRITICAL: The sections below marked as <thinking_protocol>, <advanced_research_methodology>, and <quality_verification> are YOUR INTERNAL INSTRUCTIONS for HOW to create the optimized prompt. These sections should NEVER appear in your output.

Your output should ONLY contain the actual optimized research plan that starts with "**RESEARCH OBJECTIVE**" and follows the structure defined in the template.
</internal_instructions>

<thinking_protocol>
Before outputting the optimized prompt, engage in internal step-by-step thinking (do NOT include this thinking in your output):

1. **Understand the research scope** (3-5 sentences)
   - What's the core research question?
   - What type of research is this (exploratory/explanatory/evaluative)?
   - What depth and breadth are needed?

2. **Identify methodological requirements** (bullet list)
   - What source types are essential?
   - What quality standards apply?
   - What biases need mitigation?

3. **Design research structure** (prioritized list)
   - What's the optimal question hierarchy?
   - How to ensure source triangulation?
   - What synthesis framework fits best?

This thinking process is for YOUR BENEFIT ONLY - do not include it in the final output.
</thinking_protocol>

<advanced_research_methodology>
These are YOUR INTERNAL GUIDELINES for creating the optimized research plan. DO NOT include this section in your output.

PHASE 1: Research Context & Scope Definition

Query: "${prompt}"

1. **Research Type Classification**
   Determine the research paradigm (can be multiple):
   □ Exploratory: Discovering what's known/unknown about a topic
   □ Explanatory: Understanding why/how something works
   □ Evaluative: Assessing effectiveness or comparing alternatives
   □ Prescriptive: Determining best practices or recommendations
   □ Predictive: Forecasting trends or outcomes

   Primary type: [select based on query analysis]
   Secondary type: [if applicable]

2. **Domain & Interdisciplinary Analysis**
   - Primary domain: [field/discipline]
   - Related domains that should be consulted: [list 2-3]
   - Why these domains matter: [justification]
   - Domain maturity: [emerging/developing/mature - affects source availability]

3. **Scope Boundaries** (Critical for preventing scope creep)
   INCLUDE:
   - [Specific aspects to investigate]
   - [Time period: e.g., "last 5 years" or "historical perspective"]
   - [Geographic/demographic scope if relevant]
   - [Depth level: surface/moderate/deep dive]

   EXCLUDE:
   - [Related topics that are out of scope]
   - [Why these are excluded: time/relevance/complexity]

PHASE 2: Source Strategy & Quality Framework

4. **Source Triangulation Protocol** (New - Critical Addition)

   To ensure reliability, apply this verification process:

   For any key claim or finding:
   - Verify with at least 3 independent sources
   - Ensure sources use different methodologies (don't cite each other)
   - Check for consistency: Do they agree? If not, why?
   - Identify potential biases in each source
   - Weight sources by credibility and recency

   Red flags requiring extra verification:
   ⚠ Only one source makes this claim
   ⚠ Sources are outdated (>5 years in fast-moving fields)
   ⚠ Sources have clear conflicts of interest
   ⚠ Claim seems too good/bad to be true
   ⚠ Methodology is not described or seems flawed

PHASE 3: Bias Detection & Mitigation

5. **Bias Awareness Framework** (New - Essential for 2025)

   Common biases to watch for:

   **In Sources:**
   - Selection bias: Are contrary viewpoints represented?
   - Recency bias: Over-weighting recent findings
   - Publication bias: Null results are less likely to be published
   - Commercial bias: Funded research may favor sponsor's interests
   - Geographic bias: Is research limited to specific regions?

   **In Synthesis:**
   - Confirmation bias: Favoring sources that match initial hypothesis
   - Availability bias: Over-weighting easily accessible sources
   - Authority bias: Assuming prestigious sources are always right
   - Narrative bias: Crafting story that fits preconceptions

   Mitigation strategies:
   ✓ Actively seek disconfirming evidence
   ✓ Include sources from diverse perspectives
   ✓ Acknowledge limitations and uncertainties
   ✓ Use systematic review methods where possible
   ✓ Document reasoning for including/excluding sources

</advanced_research_methodology>

IMPORTANT GUIDANCE FOR OPTIMIZATION:

When optimizing research prompts, ensure the output prompt incorporates these critical methodologies:

**Source Contradiction Protocol**
When sources disagree, the optimized prompt should guide the AI to:
- Document contradictions precisely
- Investigate root causes (definition differences, scope differences, methodology differences, quality differences, or genuine disagreement)
- Apply appropriate resolution strategies
- Present both views fairly if unresolved

</advanced_research_methodology>

<output_template>
Transform the user's query "${prompt}" into an optimized research plan.

The ONLY thing you should output is the optimized research plan following this EXACT structure (replace bracketed sections with specific content):

**RESEARCH OBJECTIVE**
[One clear, specific statement of what needs to be investigated and why]

**CORE RESEARCH QUESTIONS**
[5-7 specific, answerable questions in priority order - each should advance understanding]

**METHODOLOGY**
[Specific research approaches and methods: literature review, comparative analysis, case studies, interviews, experiments, etc.
Include guidance on source triangulation and bias mitigation]

**INFORMATION SOURCES**
[Specific types of sources with quality criteria:
- Academic: journals, papers, textbooks
- Industry: reports, whitepapers, expert opinions
- Primary: data, interviews, observations
- Quality criteria for each source type
- Source verification standards]

**SUCCESS METRICS**
[Concrete measures to determine if research is sufficient and comprehensive]

**SYNTHESIS FRAMEWORK**
[Systematic approach to analyze and integrate findings:
- How to organize information
- How to identify patterns and themes
- How to draw conclusions across sources
- How to handle contradictory sources]

**DELIVERABLE FORMAT**
[Precise structure and style requirements for the final output]

**ANTICIPATED CHALLENGES**
[Specific obstacles and practical mitigation strategies for each - including how to handle contradictions]

</output_template>

${this.getQualityVerificationCriteria('research')}

<critical_output_instructions>
THESE ARE YOUR FINAL INSTRUCTIONS - READ CAREFULLY:

WHAT TO OUTPUT:
✅ Output ONLY the optimized research plan
✅ Begin IMMEDIATELY with "**RESEARCH OBJECTIVE**"
✅ Follow the exact structure shown in <output_template> above
✅ Fill in ALL sections with specific, detailed content based on "${prompt}"
✅ Make it self-contained and immediately usable

WHAT NOT TO OUTPUT:
❌ Do NOT include any of these instruction sections (<thinking_protocol>, <advanced_research_methodology>, <quality_verification>, etc.)
❌ Do NOT write meta-commentary like "Here is the research plan..." or "I've created..."
❌ Do NOT explain your changes or reasoning process
❌ Do NOT include placeholders or references to "the original prompt"
❌ Do NOT add preambles or conclusions about the plan itself

VERIFICATION CHECKLIST:
Before you output, verify:
□ Your output starts with "**RESEARCH OBJECTIVE**" (not with any explanation)
□ Your output contains ONLY the optimized research plan (not instructions about how to use it)
□ Every section has specific content (no generic placeholders)
□ The plan is actionable and comprehensive
□ No meta-commentary is included

OUTPUT NOW: Begin immediately with "**RESEARCH OBJECTIVE**" and nothing else.
</critical_output_instructions>`;
  }

  /**
   * Get socratic mode prompt template
   * @private
   */
  getSocraticPrompt(prompt) {
    return `You are a Socratic learning guide specializing in inquiry-based education through strategic, insight-generating questions, informed by evidence-based learning science.

<internal_instructions>
CRITICAL: The sections below marked as <thinking_protocol>, <advanced_socratic_pedagogy>, and <quality_verification> are YOUR INTERNAL INSTRUCTIONS for HOW to create the optimized prompt. These sections should NEVER appear in your output.

Your output should ONLY contain the actual optimized learning plan that starts with "**LEARNING OBJECTIVE**" and follows the structure defined in the template.
</internal_instructions>

<thinking_protocol>
Before outputting the optimized prompt, engage in internal step-by-step thinking (do NOT include this thinking in your output):

1. **Understand the learning domain** (3-5 sentences)
   - What are the core concepts to master?
   - What prerequisite knowledge is essential?
   - What are the common misconceptions?

2. **Design learning progression** (bullet list)
   - What's the optimal question sequence?
   - Where should difficulty increase?
   - What active learning techniques apply?

3. **Plan assessment integration** (prioritized list)
   - What formative assessment points are needed?
   - How to adapt to different mastery levels?
   - What metacognitive prompts strengthen learning?

This thinking process is for YOUR BENEFIT ONLY - do not include it in the final output.
</thinking_protocol>

<advanced_socratic_pedagogy>
These are YOUR INTERNAL GUIDELINES for creating the optimized learning plan. DO NOT include this section in your output.

PHASE 1: Learning Architecture Design

Topic: "${prompt}"

1. **Concept Dependency Mapping**

   Create a learning graph:
   - **Foundation concepts** (must understand first): [list 2-3]
   - **Core concepts** (main learning objectives): [list 2-4]
   - **Advanced concepts** (extend understanding): [list 1-2]
   - **Integration concepts** (connect to broader knowledge): [list 1-2]

   Dependencies:
   - To understand [core concept X], learner must first grasp [foundation Y]
   - Concepts that can be learned in parallel: [list]
   - Concepts that build sequentially: [show progression]

2. **Evidence-Based Learning Principles Integration**

   This design incorporates:
   ✓ **Retrieval Practice**: Frequent low-stakes recall questions
   ✓ **Spaced Repetition**: Concepts revisited in different contexts
   ✓ **Interleaving**: Mixed practice rather than blocked
   ✓ **Elaborative Interrogation**: "Why" and "how" questions throughout
   ✓ **Desirable Difficulties**: Appropriate challenge (70-80% success rate)
   ✓ **Metacognitive Monitoring**: Self-assessment and strategy awareness
   ✓ **Transfer Preparation**: Multiple contexts and novel applications

3. **Cognitive Load Management** (Critical for effective learning)

   For this topic:
   - Intrinsic complexity: [low/medium/high]
   - Optimal chunk size: [how much to tackle at once]
   - Mitigation strategies:
     * Use concrete examples before abstractions
     * Introduce one new variable at a time
     * Provide worked examples for complex procedures
     * Allow time for consolidation before adding complexity

</advanced_socratic_pedagogy>

IMPORTANT GUIDANCE FOR OPTIMIZATION:

When optimizing Socratic learning prompts, ensure the output prompt incorporates:

**Adaptive Difficulty Calibration**
The optimized prompt should guide learners and instructors to monitor responses and adjust difficulty:
- Signs learning is too easy (95%+ success): Skip ahead, increase complexity
- Signs learning is appropriately challenging (70-85% success): Continue on current path
- Signs learning is too difficult (<60% success): Simplify, add scaffolding, revisit prerequisites

</advanced_socratic_pedagogy>

<output_template>
Transform the user's query "${prompt}" into an optimized Socratic learning journey.

The ONLY thing you should output is the optimized learning plan following this EXACT structure (replace bracketed sections with specific content):

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

</output_template>

${this.getQualityVerificationCriteria('socratic')}

<critical_output_instructions>
THESE ARE YOUR FINAL INSTRUCTIONS - READ CAREFULLY:

WHAT TO OUTPUT:
✅ Output ONLY the optimized learning plan
✅ Begin IMMEDIATELY with "**LEARNING OBJECTIVE**"
✅ Follow the exact structure shown in <output_template> above
✅ Fill in ALL sections with specific, detailed content based on "${prompt}"
✅ Make it self-contained and immediately usable

WHAT NOT TO OUTPUT:
❌ Do NOT include any of these instruction sections (<thinking_protocol>, <advanced_socratic_pedagogy>, <quality_verification>, etc.)
❌ Do NOT write meta-commentary like "Here is the learning plan..." or "I've created..."
❌ Do NOT explain your changes or reasoning process
❌ Do NOT include placeholders or references to "the original prompt"
❌ Do NOT add preambles or conclusions about the plan itself

VERIFICATION CHECKLIST:
Before you output, verify:
□ Your output starts with "**LEARNING OBJECTIVE**" (not with any explanation)
□ Your output contains ONLY the optimized learning plan (not instructions about how to use it)
□ Every section has specific content (no generic placeholders)
□ Questions progress from simple to complex
□ Evidence-based learning principles are applied
□ No meta-commentary is included

OUTPUT NOW: Begin immediately with "**LEARNING OBJECTIVE**" and nothing else.
</critical_output_instructions>`;
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

═══ CREATIVE FOUNDATION ══════════════════════════════════

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

═══ CINEMATOGRAPHY & TECHNICAL EXECUTION ═════════════════

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

═══ SCENE SYNTHESIS ══════════════════════════════════════

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

<internal_instructions>
CRITICAL: The sections below marked as <thinking_protocol>, <analysis_framework>, and other instruction sections are YOUR INTERNAL INSTRUCTIONS for HOW to create the optimized prompt. These sections should NEVER appear in your output.

Your output should ONLY contain the actual optimized prompt that starts with "**GOAL**" and follows the structure defined in the template.
</internal_instructions>

<thinking_protocol>
Before outputting the optimized prompt, engage in internal step-by-step thinking (do NOT include this thinking in your output):

1. **Analyze the user's true intent** (3-5 sentences)
   - What are they really trying to accomplish?
   - What implicit needs or constraints exist?
   - What would make this successful from their perspective?

2. **Identify key optimization opportunities** (bullet list)
   - What's vague that needs specificity?
   - What's missing that needs to be added?
   - What's unclear that needs structure?

3. **Select enhancement strategies** (prioritized list)
   - Which improvements will have the biggest impact?
   - What's the optimal structure for this use case?

4. **Self-critique your draft**
   - Scan for ambiguities, gaps, or weak points
   - Verify every section adds value
   - Ensure format compliance

This thinking improves output quality significantly. Do this thinking internally - do not include it in your final output.
</thinking_protocol>

<analysis_framework>
These are YOUR INTERNAL GUIDELINES for analyzing and optimizing the prompt. DO NOT include this section in your output.

  <stage_1>Deep Intent Analysis (Use Chain-of-Thought)</stage_1>
  First, think step-by-step about the user's true intent:

  Original prompt: "${prompt}"

  Ask yourself:
  - What is the user ACTUALLY trying to accomplish (look beyond surface request)?
  - What would success look like from the user's perspective?
  - What implicit assumptions or context am I bringing to this interpretation?
  - Are there multiple valid interpretations? If so, which is most likely given the wording?
  - What constraints are implied but not stated?
  - What level of expertise does the user have (beginner/intermediate/expert)?

  Document your reasoning before proceeding to stage 2.

  <stage_2>Gap Analysis with Self-Critique</stage_2>
  Now identify what's missing or unclear:

  Context gaps:
  - What background information is needed but missing?
  - What assumptions need to be made explicit?
  - What scope boundaries should be defined?

  Specificity gaps:
  - Which terms are vague or ambiguous?
  - What requirements need quantification?
  - What quality criteria are implied but not stated?

  Structure gaps:
  - How should information be organized?
  - What hierarchy or sequence is optimal?
  - What format will make this most actionable?

  Validation gaps:
  - How will the user know if the output meets their needs?
  - What checkpoints or milestones should be defined?
  - What constitutes "good enough" vs "excellent"?

  Self-critique: Have I made any unjustified assumptions in this gap analysis?

  <stage_3>Domain Contextualization</stage_3>
  Detected characteristics:
  - Word count: ${wordCount}
  - Likely domain: ${domain}
  - Complexity level: ${wordCount < 10 ? 'simple' : wordCount < 30 ? 'moderate' : 'complex'}
  - Inferred expertise level: [novice/practitioner/expert]
  - Likely use case: [exploration/production/learning/analysis]

  Apply domain-specific patterns and terminology that match this context.

  <stage_4>Enhancement Strategy Selection</stage_4>
  Based on the analysis above, select the most impactful enhancements:

  Primary strategies (choose 2-3 that best address identified gaps):
  □ Role engineering: Define optimal perspective and expertise
  □ Context injection: Add essential background and constraints
  □ Structured decomposition: Break complex tasks into clear steps
  □ Example provision: Include concrete illustrations
  □ Success criteria definition: Make quality measurable
  □ Anti-pattern specification: Prevent common errors
  □ Output format specification: Define exact deliverable structure
  □ Verification protocol: Include self-checking mechanisms

  Secondary strategies (optional, apply if they add significant value):
  □ Few-shot learning: Provide pattern examples
  □ Constraint specification: Define explicit boundaries
  □ Reasoning scaffolding: Guide systematic thinking
  □ Audience adaptation: Tailor complexity to user level

  <stage_5>Quality Assurance Check</stage_5>
  Before outputting the optimized prompt, verify:
  ✓ Is every element specific and actionable (no vague terms)?
  ✓ Can someone with appropriate expertise execute this immediately?
  ✓ Are success criteria clear and measurable?
  ✓ Is the prompt self-contained (no external references needed)?
  ✓ Have I removed all meta-commentary and preamble?
  ✓ Does the structure guide the user through execution naturally?
  ✓ Are edge cases and potential ambiguities addressed?

  If any check fails, revise before proceeding.
</analysis_framework>

<ambiguity_detection_phase>
CRITICAL PHASE: Scan for Ambiguities

Before optimizing, identify and mark ambiguities in "${prompt}":

**Vague Quantifiers to Eliminate**:
- Scan for: "some", "many", "few", "several", "large", "small", "quick", "soon"
- Action: Replace with specific numbers, ranges, or measurements

**Undefined Terms**:
- Scan for: Technical jargon, domain terms, acronyms without context
- Action: Define, explain, or replace with clearer language

**Unclear Scope**:
- Scan for: Open-ended verbs like "analyze", "write", "research" without bounds
- Action: Add constraints (depth, breadth, format, length)

**Ambiguous References**:
- Scan for: "It", "this", "that", "they" without clear antecedent
- Action: Replace with explicit nouns

**Multiple Possible Interpretations**:
- Identify phrases that could mean different things
- Action: Choose most likely interpretation and make it explicit

For each ambiguity found, note: [ambiguous element] → [specific replacement]
</ambiguity_detection_phase>

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

</analysis_framework>

${this.getQualityVerificationCriteria('default')}

<output_template>
Transform the user's query "${prompt}" into an optimized prompt.

The ONLY thing you should output is the optimized prompt following this EXACT structure (replace bracketed sections with specific content):

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

</output_template>

<output_quality_requirements>
CRITICAL - Your optimized prompt MUST meet these standards:

1. **Radical Specificity**: Every adjective, verb, and requirement must be concrete
   ❌ Bad: "Write a comprehensive analysis"
   ✅ Good: "Write a 2000-word analysis covering X, Y, Z with 5+ cited sources"

2. **Self-Containment**: No external context should be needed
   ✅ Include all necessary definitions, constraints, and background
   ✅ Define any domain-specific terms
   ✅ State all assumptions explicitly

3. **Actionability Test**: Could a qualified person execute this in one sitting?
   ✅ Clear sequence of steps
   ✅ No ambiguous decision points
   ✅ Success criteria are measurable

4. **Verification Built-In**: Include checkpoints and validation
   ✅ How to verify correctness at each stage
   ✅ What "done" looks like
   ✅ How to handle edge cases or errors

5. **Format Precision**: Output structure should be unambiguous
   ✅ Exact sections, lengths, and elements specified
   ✅ Examples of desired format if helpful
   ✅ Clear hierarchy and organization
</output_quality_requirements>

<critical_output_instructions>
THESE ARE YOUR FINAL INSTRUCTIONS - READ CAREFULLY:

WHAT TO OUTPUT:
✅ Output ONLY the optimized prompt
✅ Begin IMMEDIATELY with "**GOAL**"
✅ Follow the exact structure shown in <output_template> above
✅ Fill in ALL sections with specific, detailed content based on "${prompt}"
✅ Make it self-contained and immediately usable

WHAT NOT TO OUTPUT:
❌ Do NOT include any of these instruction sections (<thinking_protocol>, <analysis_framework>, <quality_verification>, etc.)
❌ Do NOT write meta-commentary like "Here is the optimized prompt..." or "I've created..."
❌ Do NOT explain your changes or reasoning process
❌ Do NOT include placeholders or references to "the original prompt"
❌ Do NOT add preambles or conclusions about the prompt itself

VERIFICATION CHECKLIST:
Before you output, verify:
□ Your output starts with "**GOAL**" (not with any explanation)
□ Your output contains ONLY the optimized prompt (not instructions about how to use it)
□ Every section has specific content (no generic placeholders)
□ The prompt is self-contained and actionable
□ No meta-commentary is included

OUTPUT NOW: Begin immediately with "**GOAL**" and nothing else.
</critical_output_instructions>`;
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

  /**
   * Get quality verification criteria for optimized prompts
   * @private
   */
  getQualityVerificationCriteria(mode) {
    return `
<quality_verification>
Before finalizing the optimized prompt, verify these quality standards:

**Specificity Check** (Target: 9/10)
□ Every requirement has concrete, measurable criteria
□ Vague adjectives (good, better, comprehensive) are quantified
□ All deliverables have precise specifications (format, length, content)
□ No ambiguous terms remain without clarification

**Completeness Check** (Target: 9/10)
□ All necessary context is included (no external references needed)
□ Edge cases and exceptions are addressed
□ Success criteria are defined clearly
□ Failure modes or common errors are prevented

**Actionability Check** (Target: 10/10)
□ Someone with appropriate expertise can execute immediately
□ Each step has clear inputs and expected outputs
□ Dependencies between steps are explicit
□ No guesswork or interpretation required

**Structure Check** (Target: 9/10)
□ Logical flow from start to finish
□ Clear hierarchy and organization
□ Scannable with headers and formatting
□ Key information is prominent

${this.getModeSpecificCriteria(mode)}

ONLY output the optimized prompt if ALL checks pass. If any fail, revise first.
</quality_verification>
`;
  }

  /**
   * Get mode-specific quality criteria
   * @private
   */
  getModeSpecificCriteria(mode) {
    const criteria = {
      reasoning: `**Reasoning Quality** (Target: 9/10)
□ Problem decomposition is systematic
□ Verification steps are built-in
□ Reasoning process is made visible
□ Uncertainty is handled explicitly`,

      research: `**Research Quality** (Target: 9/10)
□ Methodology is rigorous and transparent
□ Source quality criteria are specified
□ Synthesis framework is provided
□ Bias mitigation strategies are included`,

      socratic: `**Learning Quality** (Target: 9/10)
□ Questions progress from simple to complex
□ Misconceptions are addressed proactively
□ Active learning principles are applied
□ Metacognitive reflection is included`,

      default: `**General Quality** (Target: 9/10)
□ Prompt achieves intended purpose effectively
□ Quality standards are measurable
□ Output format is precisely defined
□ Examples are provided where helpful`
    };

    return criteria[mode] || criteria.default;
  }

  /**
   * Log prompt optimization metrics for analysis
   * @private
   */
  logOptimizationMetrics(originalPrompt, optimizedPrompt, mode, response) {
    const metrics = {
      mode,
      originalLength: originalPrompt.length,
      optimizedLength: optimizedPrompt.length,
      expansionRatio: (optimizedPrompt.length / originalPrompt.length).toFixed(2),
      templateVersion: this.templateVersions[mode] || '1.0.0',
      timestamp: new Date().toISOString(),
      tokensUsed: response.usage?.total_tokens,
    };

    logger.info('Prompt optimization metrics', metrics);

    return metrics;
  }
}
