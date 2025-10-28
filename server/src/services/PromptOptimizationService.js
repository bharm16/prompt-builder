import { logger } from '../infrastructure/Logger.js';
import { cacheService } from './CacheService.js';
import { TemperatureOptimizer } from '../utils/TemperatureOptimizer.js';
import { ConstitutionalAI } from '../utils/ConstitutionalAI.js';
import { generateVideoPrompt } from './VideoPromptTemplates.js';
import { labelSpans } from '../llm/spanLabeler.js';

/**
 * Service for optimizing prompts across different modes
 * Handles business logic for prompt optimization with intelligent mode detection and iterative refinement
 */
export class PromptOptimizationService {
  constructor(claudeClient, groqClient = null) {
    this.claudeClient = claudeClient; // Primary model (OpenAI/Claude)
    this.groqClient = groqClient;     // Fast draft model (Groq)
    this.cacheConfig = cacheService.getConfig('promptOptimization');
    this.exampleBank = this.initializeExampleBank();

    // Template versions for tracking improvements
    this.templateVersions = {
      default: '2.0.0', // Updated version with 2025 improvements
      optimize: '3.0.0', // Two-stage domain-specific content generation
      reasoning: '4.0.0', // Two-stage domain-specific content generation
      research: '3.0.0', // Two-stage domain-specific content generation
      socratic: '3.0.0', // Two-stage domain-specific content generation
      video: '1.0.0'
    };
  }

  /**
   * Two-stage optimization: Fast draft with Groq + Quality refinement with primary model
   *
   * Stage 1 (Groq): Generate concise draft in ~200-500ms
   * Stage 2 (OpenAI/Claude): Refine draft in background
   *
   * @param {Object} params - Optimization parameters
   * @param {string} params.prompt - User's original prompt
   * @param {string} params.mode - Optimization mode
   * @param {Object} params.context - Optional context
   * @param {Object} params.brainstormContext - Optional brainstorm context
   * @param {Function} params.onDraft - Callback when draft is ready
   * @returns {Promise<{draft: string, refined: string, metadata: Object}>}
   */
  async optimizeTwoStage({ prompt, mode, context = null, brainstormContext = null, onDraft = null }) {
    logger.info('Starting two-stage optimization', { mode, hasGroq: !!this.groqClient });

    // Fallback to single-stage if Groq unavailable
    if (!this.groqClient) {
      logger.warn('Groq client not available, falling back to single-stage optimization');
      const result = await this.optimize({ prompt, mode, context, brainstormContext });
      return { draft: result, refined: result, usedFallback: true };
    }

    const startTime = Date.now();

    // STAGE 1: Generate fast draft with Groq + parallel span labeling (200-500ms)
    try {
      const draftSystemPrompt = this.getDraftSystemPrompt(mode, prompt, context);

      logger.debug('Generating draft with Groq', { mode });
      const draftStartTime = Date.now();

      // Start BOTH operations in parallel (for video mode)
      // This saves ~150-200ms by not waiting for draft before span labeling
      const operations = [
        this.groqClient.complete(draftSystemPrompt, {
          userMessage: prompt,
          maxTokens: mode === 'video' ? 300 : 200, // Concise drafts
          temperature: 0.7,
          timeout: 5000,
        }),
        // Only do span labeling for video mode
        mode === 'video' ? labelSpans({
          text: prompt,
          maxSpans: 60,
          minConfidence: 0.5,
          templateVersion: 'v1',
        }).catch(err => {
          logger.warn('Parallel span labeling failed, will retry after draft', { error: err.message });
          return null; // Non-blocking failure
        }) : Promise.resolve(null)
      ];

      const [draftResponse, initialSpans] = await Promise.all(operations);

      const draft = draftResponse.content[0]?.text || '';
      const draftDuration = Date.now() - draftStartTime;

      logger.info('Draft generated successfully', {
        duration: draftDuration,
        draftLength: draft.length,
        hasSpans: !!initialSpans,
        mode
      });

      // Call onDraft callback with BOTH draft and spans if provided
      if (onDraft && typeof onDraft === 'function') {
        onDraft(draft, initialSpans);
      }

      // STAGE 2: Refine with primary model (background)
      logger.debug('Starting refinement with primary model', { mode });
      const refinementStartTime = Date.now();

      const refined = await this.optimize({
        prompt: draft, // Use draft as input for refinement
        mode,
        context,
        brainstormContext,
      });

      const refinementDuration = Date.now() - refinementStartTime;

      // Generate spans for refined text if in video mode
      let refinedSpans = null;
      if (mode === 'video') {
        try {
          refinedSpans = await labelSpans({
            text: refined,
            maxSpans: 60,
            minConfidence: 0.5,
            templateVersion: 'v1',
          });
          logger.debug('Refined span labeling complete', {
            spanCount: refinedSpans?.spans?.length || 0
          });
        } catch (err) {
          logger.warn('Refined span labeling failed', { error: err.message });
          // Fall back to initial spans if available
          refinedSpans = initialSpans;
        }
      }

      const totalDuration = Date.now() - startTime;

      logger.info('Two-stage optimization complete', {
        draftDuration,
        refinementDuration,
        totalDuration,
        mode,
        hasSpans: !!(initialSpans || refinedSpans)
      });

      return {
        draft,
        refined,
        draftSpans: initialSpans,  // Spans for draft text
        refinedSpans: refinedSpans, // Spans for refined text
        metadata: {
          draftDuration,
          refinementDuration,
          totalDuration,
          mode,
          usedTwoStage: true,
        }
      };

    } catch (error) {
      logger.error('Two-stage optimization failed, falling back to single-stage', {
        error: error.message,
        mode
      });

      // Fallback to single-stage on error
      const result = await this.optimize({ prompt, mode, context, brainstormContext });
      return {
        draft: result,
        refined: result,
        usedFallback: true,
        error: error.message
      };
    }
  }

  /**
   * Generate system prompt for Groq draft generation
   * Creates concise, focused prompts optimized for fast generation
   * @private
   */
  getDraftSystemPrompt(mode, prompt, context) {
    const baseInstructions = {
      video: `You are a video prompt draft generator. Create a concise video prompt (75-125 words).

Focus on:
- Clear subject and primary action
- Essential visual details (lighting, camera angle)
- Specific cinematographic style

Output ONLY the draft prompt, no explanations or meta-commentary.`,

      reasoning: `You are a reasoning prompt draft generator. Create a concise structured prompt (100-150 words).

Include:
- Core problem statement
- Key analytical approach
- Expected reasoning pattern

Output ONLY the draft prompt, no explanations.`,

      research: `You are a research prompt draft generator. Create a focused research prompt (100-150 words).

Include:
- Research question
- Primary sources to consult
- Key evaluation criteria

Output ONLY the draft prompt, no explanations.`,

      socratic: `You are a Socratic teaching draft generator. Create a concise learning prompt (100-150 words).

Include:
- Learning objective
- Progressive question approach
- Key concepts to explore

Output ONLY the draft prompt, no explanations.`,

      optimize: `You are a prompt optimization draft generator. Create an improved prompt (100-150 words).

Make it:
- Clear and specific
- Action-oriented
- Well-structured

Output ONLY the draft prompt, no explanations.`
    };

    return baseInstructions[mode] || baseInstructions.optimize;
  }

  /**
   * Automatically infer context from prompt using Claude
   * Generates context object compatible with existing context integration
   * @param {string} prompt - The user's original prompt
   * @returns {Promise<Object>} Context object with specificAspects, backgroundLevel, intendedUse
   * @private
   */
  async inferContextFromPrompt(prompt) {
    logger.info('Inferring context from prompt', { promptLength: prompt.length });

    try {
      const inferencePrompt = `Analyze this prompt and infer appropriate context for optimization.

<prompt_to_analyze>
${prompt}
</prompt_to_analyze>

Your task: Reason through these analytical lenses to infer the appropriate context:

**LENS 1: Domain & Specificity**
What field or discipline does this belong to? What level of technical depth is implied?

**LENS 2: Expertise Level**
Based on language complexity and terminology usage, how expert is this person?
- novice: Uses general language, asks "what is" questions, seeks basic explanations
- intermediate: Uses some domain terms, asks "how to" questions, seeks practical guidance
- expert: Uses precise terminology, discusses trade-offs, assumes domain knowledge

**LENS 3: Key Focus Areas**
What are the 2-4 most important specific aspects or focus areas in this prompt?
Be concrete - extract the actual technical concepts, tools, or constraints mentioned.

**LENS 4: Intended Use**
What is this person likely trying to do with the response?
- learning/education
- production implementation
- research/analysis
- troubleshooting/debugging
- strategic planning
- creative development

Now, output ONLY a JSON object with this exact structure (no other text):

{
  "specificAspects": "2-4 key technical/domain-specific focus areas from the prompt",
  "backgroundLevel": "novice|intermediate|expert",
  "intendedUse": "brief description of likely use case"
}

Examples of good output:

For: "analyze the current implementation behind the prompt canvas editor highlighting feature, and help me come up with a solution to reduce the amount of time it takes to parse the text and apply the highlights"
{
  "specificAspects": "DOM manipulation performance, text parsing algorithms, real-time highlighting optimization, editor rendering efficiency",
  "backgroundLevel": "expert",
  "intendedUse": "production performance optimization"
}

For: "help me understand how neural networks learn"
{
  "specificAspects": "backpropagation mechanics, gradient descent, loss functions, weight updates",
  "backgroundLevel": "novice",
  "intendedUse": "learning fundamentals"
}

For: "create a market expansion strategy for our SaaS product in Europe"
{
  "specificAspects": "market sizing, competitive analysis, regulatory compliance, go-to-market strategy",
  "backgroundLevel": "intermediate",
  "intendedUse": "strategic planning"
}

Output only the JSON, nothing else:`;

      const response = await this.claudeClient.complete(inferencePrompt, {
        maxTokens: 500,
        temperature: 0.3, // Low temperature for consistent inference
        timeout: 15000, // 15 second timeout
      });

      const rawOutput = response.content[0].text.trim();
      logger.debug('Raw inference output', { rawOutput: rawOutput.substring(0, 200) });

      // Extract JSON from response (handle markdown code blocks)
      let jsonText = rawOutput;
      const jsonMatch = rawOutput.match(/```json\s*([\s\S]*?)\s*```/) ||
        rawOutput.match(/```\s*([\s\S]*?)\s*```/) ||
        rawOutput.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        jsonText = jsonMatch[1] || jsonMatch[0];
      }

      const inferredContext = JSON.parse(jsonText);

      // Validate structure
      if (
        !inferredContext.specificAspects ||
        !inferredContext.backgroundLevel ||
        !inferredContext.intendedUse
      ) {
        throw new Error('Invalid context structure from inference');
      }

      // Validate backgroundLevel
      const validLevels = ['novice', 'intermediate', 'expert'];
      if (!validLevels.includes(inferredContext.backgroundLevel)) {
        logger.warn('Invalid background level, defaulting to intermediate', {
          level: inferredContext.backgroundLevel,
        });
        inferredContext.backgroundLevel = 'intermediate';
      }

      logger.info('Successfully inferred context', {
        hasSpecificAspects: !!inferredContext.specificAspects,
        backgroundLevel: inferredContext.backgroundLevel,
        hasIntendedUse: !!inferredContext.intendedUse,
      });

      return inferredContext;
    } catch (error) {
      logger.error('Failed to infer context from prompt', { error: error.message });

      // Return minimal context on failure - system will work without it
      return {
        specificAspects: '',
        backgroundLevel: 'intermediate',
        intendedUse: '',
      };
    }
  }

  /**
   * STAGE 1: Generate domain-specific content for reasoning prompts
   * Uses focused LLM call to create warnings, deliverables, and constraints
   * that are precisely tailored to the user's domain and expertise level
   *
   * @param {string} prompt - The user's original prompt
   * @param {Object} context - Inferred or provided context
   * @param {string} context.specificAspects - Domain focus areas
   * @param {string} context.backgroundLevel - User expertise level
   * @param {string} context.intendedUse - Use case for the prompt
   * @returns {Promise<Object>} Domain-specific content { warnings, deliverables, constraints }
   * @private
   */
  async generateDomainSpecificContent(prompt, context) {
    logger.info('Generating domain-specific content (Stage 1)', {
      promptLength: prompt.length,
      hasContext: !!context
    });

    // Extract context fields
    const domain = context?.specificAspects || '';
    const expertiseLevel = context?.backgroundLevel || 'intermediate';
    const useCase = context?.intendedUse || '';

    // Build Stage 1 prompt
    const stage1Prompt = `Generate domain-specific content for a reasoning task optimization.

<task>
User's Prompt: "${prompt}"

Context:
- Domain Focus: ${domain || 'general'}
- Expertise Level: ${expertiseLevel}
- Intended Use: ${useCase || 'not specified'}
</task>

Your job: Generate domain-specific warnings, deliverables, and constraints that will be incorporated into an optimized reasoning prompt.

<warnings_generation>
Generate 5-7 domain-specific warnings. Each warning MUST:

✓ Use precise technical terminology from the domain (${domain || 'the relevant domain'})
✓ Address sophisticated edge cases specific to this problem space
✓ Be actionable and specific (not generic advice)
✓ Include technical details appropriate for ${expertiseLevel} level
✓ Prevent subtle mistakes that require domain expertise to recognize

EXAMPLES OF GOOD WARNINGS for different domains:

For "PostgreSQL query optimization":
✓ "Avoid sequential scans on tables >1M rows - ensure WHERE clause predicates are covered by B-tree or GiST indexes"
✓ "Consider that PostgreSQL query planner may choose sequential scan over index if table statistics are stale - run ANALYZE regularly"
✓ "Account for index-only scans when covering indexes include all SELECT columns to eliminate heap lookups"

For "React hooks optimization":
✓ "Avoid re-creating functions on every render - use useCallback with proper dependency arrays to maintain referential equality"
✓ "Consider that useEffect with missing dependencies causes stale closures - include all referenced values in dependency array"
✓ "Ensure cleanup functions in useEffect properly unsubscribe/cancel to prevent memory leaks on component unmount"

For "machine learning model training":
✓ "Avoid using accuracy as sole metric for imbalanced datasets - prioritize F1 score, precision-recall curves, or Matthews correlation coefficient"
✓ "Consider that high training accuracy with low validation accuracy indicates overfitting - implement early stopping and regularization"

EXAMPLES OF BAD WARNINGS (too generic):
❌ "Think about performance"
❌ "Consider edge cases"
❌ "Make sure it works"
❌ "Check for errors"
❌ "Optimize the code"

Now generate warnings for the user's prompt above.
</warnings_generation>

<deliverables_generation>
Generate 3-5 specific deliverables. Each deliverable MUST:

✓ Specify concrete output format
✓ Include quantified requirements where applicable
✓ Match technical depth to ${expertiseLevel} level
✓ Be appropriate for "${useCase || 'general use'}"

EXAMPLES:

For ${expertiseLevel} level:
${expertiseLevel === 'expert' ? '- "Flame graph from Chrome DevTools showing parse/compile/execute breakdown with hotspot analysis"\n- "Benchmark suite comparing O(n) vs O(n log n) implementations across dataset sizes from 10³ to 10⁶ elements"' : expertiseLevel === 'intermediate' ? '- "Performance comparison table showing execution times for different approaches"\n- "Code examples demonstrating the recommended solution with inline comments"' : '- "Step-by-step explanation with visual diagrams"\n- "Working code example with detailed comments explaining each section"'}

For "${useCase || 'general'}" use case:
${useCase.includes('production') ? '- "Production-ready implementation with error handling and logging"\n- "Performance profiling data showing real-world impact"' : useCase.includes('learning') ? '- "Tutorial-style explanation with progressive examples"\n- "Practice exercises with solutions"' : '- "Clear documentation of the approach"\n- "Examples demonstrating key concepts"'}

Now generate deliverables for the user's prompt above.
</deliverables_generation>

<constraints_generation>
Generate 2-4 technical or business constraints. Each constraint MUST:

✓ Be a hard requirement (not a preference)
✓ Specify measurable parameters where applicable
✓ Be domain-specific

EXAMPLES:
✓ "Must maintain under 16ms (60fps) for UI updates during user interaction"
✓ "Cannot introduce breaking changes to public API (maintain semantic versioning)"
✓ "Must support Unicode text including RTL languages, emoji, and combining characters"
✓ "Memory footprint must not exceed 100MB for datasets up to 1M records"

Now generate constraints for the user's prompt above (or return empty array if none apply).
</constraints_generation>

<output_format>
Output ONLY valid JSON with this exact structure:

{
  "warnings": [
    "Domain-specific warning 1 with technical details",
    "Domain-specific warning 2 with technical details",
    "... 5-7 total warnings"
  ],
  "deliverables": [
    "Specific deliverable 1 with format and requirements",
    "Specific deliverable 2 with format and requirements",
    "... 3-5 total deliverables"
  ],
  "constraints": [
    "Hard constraint 1 with measurable parameters",
    "Hard constraint 2 with measurable parameters",
    "... 2-4 total constraints (or empty array if none)"
  ]
}

Do NOT include any explanation or markdown formatting. Output only the JSON.
</output_format>`;

    try {
      // Call Claude with focused Stage 1 prompt
      const response = await this.claudeClient.complete(stage1Prompt, {
        maxTokens: 1500,
        temperature: 0.3, // Low temperature for consistent, focused output
        timeout: 20000, // 20 second timeout for Stage 1
      });

      const rawOutput = response.content[0].text.trim();
      logger.debug('Stage 1 raw output', { rawOutput: rawOutput.substring(0, 200) });

      // Extract JSON from response (handle markdown code blocks)
      let jsonText = rawOutput;
      const jsonMatch = rawOutput.match(/```json\s*([\s\S]*?)\s*```/) ||
        rawOutput.match(/```\s*([\s\S]*?)\s*```/) ||
        rawOutput.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        jsonText = jsonMatch[1] || jsonMatch[0];
      }

      const domainContent = JSON.parse(jsonText);

      // Validate structure
      if (!Array.isArray(domainContent.warnings) ||
          !Array.isArray(domainContent.deliverables) ||
          !Array.isArray(domainContent.constraints)) {
        throw new Error('Invalid domain content structure from Stage 1');
      }

      logger.info('Stage 1 domain content generated successfully', {
        warningCount: domainContent.warnings.length,
        deliverableCount: domainContent.deliverables.length,
        constraintCount: domainContent.constraints.length,
      });

      return domainContent;
    } catch (error) {
      logger.error('Failed to generate domain-specific content in Stage 1', {
        error: error.message
      });

      // Return minimal generic content as fallback
      return {
        warnings: [],
        deliverables: [],
        constraints: [],
      };
    }
  }

  /**
   * STAGE 1: Generate domain-specific content for RESEARCH mode
   * Focuses on research-specific elements: sources, methodologies, quality criteria, biases
   *
   * @param {string} prompt - The user's original prompt
   * @param {Object} context - Inferred or provided context
   * @returns {Promise<Object>} Domain-specific research content
   * @private
   */
  async generateResearchDomainContent(prompt, context) {
    logger.info('Generating research domain content (Stage 1)', {
      promptLength: prompt.length,
      hasContext: !!context
    });

    const domain = context?.specificAspects || '';
    const expertiseLevel = context?.backgroundLevel || 'intermediate';
    const useCase = context?.intendedUse || '';

    const stage1Prompt = `Generate domain-specific research content for a research planning task.

<task>
User's Research Query: "${prompt}"

Context:
- Research Domain: ${domain || 'general'}
- Researcher Level: ${expertiseLevel}
- Intended Use: ${useCase || 'not specified'}
</task>

Your job: Generate domain-specific research elements that will be incorporated into an optimized research plan.

<source_recommendations>
Generate 3-5 specific source type recommendations. Each MUST:

✓ Specify the exact type of source (journals, databases, datasets, reports)
✓ Name specific resources when applicable (e.g., "IEEE Xplore", "PubMed", "Papers With Code")
✓ Explain WHY this source type is essential for this research domain
✓ Match the ${expertiseLevel} level (experts need cutting-edge sources, beginners need accessible ones)

EXAMPLES for different domains:

For "machine learning model evaluation":
✓ "Peer-reviewed ML conferences (NeurIPS, ICML, ICLR) for state-of-the-art methodologies"
✓ "MLPerf benchmarks for standardized performance comparisons across models"
✓ "Papers With Code for reproducible experiments and code implementations"

For "clinical trial analysis":
✓ "PubMed and Cochrane Library for peer-reviewed medical research"
✓ "ClinicalTrials.gov for trial protocols and results"
✓ "FDA approval documents for regulatory compliance data"

BAD (too generic):
❌ "Academic papers"
❌ "Reliable sources"
❌ "Internet research"

Generate source recommendations for the user's query above.
</source_recommendations>

<methodology_recommendations>
Generate 2-4 research methodology recommendations. Each MUST:

✓ Name the specific methodology (systematic review, grounded theory, A/B testing, etc.)
✓ Explain when and why to use it for THIS domain
✓ Include domain-specific best practices or standards
✓ Match ${expertiseLevel} level complexity

EXAMPLES:

For "software performance comparison":
✓ "Controlled A/B testing with identical hardware to isolate software variables"
✓ "Statistical significance testing (p < 0.05) across minimum 30 runs to account for variance"

For "user experience research":
✓ "Mixed methods: quantitative analytics data + qualitative user interviews for triangulation"
✓ "Think-aloud protocol during usability testing to capture real-time decision-making"

Generate methodologies for the user's query above.
</methodology_recommendations>

<quality_criteria>
Generate 2-3 quality criteria/standards. Each MUST:

✓ Be measurable or verifiable
✓ Be specific to this research domain
✓ Help ensure research rigor and validity

EXAMPLES:

For "AI model research":
✓ "Studies must report train/validation/test split to ensure no data leakage"
✓ "Benchmarks must use standardized datasets (ImageNet, COCO) for reproducibility"

For "medical research":
✓ "Studies must be peer-reviewed and published in journals with impact factor > 2.0"
✓ "Clinical trials must be registered and report all outcomes (not just positive results)"

Generate quality criteria for the user's query above.
</quality_criteria>

<common_biases>
Generate 2-4 common biases or pitfalls specific to this research domain. Each MUST:

✓ Name the specific bias type
✓ Explain how it manifests in THIS domain
✓ Suggest mitigation strategies

EXAMPLES:

For "technology adoption research":
✓ "Publication bias: Successful implementations are over-reported; seek out failure case studies"
✓ "Recency bias: Latest tools aren't always better; compare against established baselines"

For "social science research":
✓ "Sampling bias: Online surveys over-represent tech-savvy demographics; use stratified sampling"
✓ "Confirmation bias: Researchers may interpret ambiguous data to support hypothesis; use blind analysis"

Generate biases for the user's query above.
</common_biases>

<output_format>
Output ONLY valid JSON:

{
  "sourceTypes": [
    "Specific source recommendation 1 with justification",
    "Specific source recommendation 2 with justification",
    "... 3-5 total"
  ],
  "methodologies": [
    "Specific methodology 1 with when/why to use it",
    "Specific methodology 2 with when/why to use it",
    "... 2-4 total"
  ],
  "qualityCriteria": [
    "Measurable quality criterion 1",
    "Measurable quality criterion 2",
    "... 2-3 total"
  ],
  "commonBiases": [
    "Specific bias 1 with mitigation strategy",
    "Specific bias 2 with mitigation strategy",
    "... 2-4 total"
  ]
}

Do NOT include any explanation or markdown formatting. Output only the JSON.
</output_format>`;

    try {
      const response = await this.claudeClient.complete(stage1Prompt, {
        maxTokens: 1500,
        temperature: 0.3,
        timeout: 20000,
      });

      const rawOutput = response.content[0].text.trim();
      let jsonText = rawOutput;
      const jsonMatch = rawOutput.match(/```json\s*([\s\S]*?)\s*```/) ||
        rawOutput.match(/```\s*([\s\S]*?)\s*```/) ||
        rawOutput.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        jsonText = jsonMatch[1] || jsonMatch[0];
      }

      const domainContent = JSON.parse(jsonText);

      if (!Array.isArray(domainContent.sourceTypes) ||
          !Array.isArray(domainContent.methodologies) ||
          !Array.isArray(domainContent.qualityCriteria) ||
          !Array.isArray(domainContent.commonBiases)) {
        throw new Error('Invalid research domain content structure from Stage 1');
      }

      logger.info('Stage 1 research domain content generated successfully', {
        sourceTypeCount: domainContent.sourceTypes.length,
        methodologyCount: domainContent.methodologies.length,
        qualityCriteriaCount: domainContent.qualityCriteria.length,
        biasCount: domainContent.commonBiases.length,
      });

      return domainContent;
    } catch (error) {
      logger.error('Failed to generate research domain content in Stage 1', {
        error: error.message
      });

      return {
        sourceTypes: [],
        methodologies: [],
        qualityCriteria: [],
        commonBiases: [],
      };
    }
  }

  /**
   * STAGE 1: Generate domain-specific content for SOCRATIC mode
   * Focuses on learning-specific elements: prerequisites, misconceptions, analogies, milestones
   *
   * @param {string} prompt - The user's original prompt
   * @param {Object} context - Inferred or provided context
   * @returns {Promise<Object>} Domain-specific learning content
   * @private
   */
  async generateSocraticDomainContent(prompt, context) {
    logger.info('Generating socratic domain content (Stage 1)', {
      promptLength: prompt.length,
      hasContext: !!context
    });

    const domain = context?.specificAspects || '';
    const expertiseLevel = context?.backgroundLevel || 'intermediate';
    const useCase = context?.intendedUse || '';

    const stage1Prompt = `Generate domain-specific learning content for a Socratic learning journey.

<task>
User's Learning Query: "${prompt}"

Context:
- Subject Domain: ${domain || 'general'}
- Learner Level: ${expertiseLevel}
- Learning Goal: ${useCase || 'not specified'}
</task>

Your job: Generate domain-specific learning scaffolds that will be incorporated into a Socratic learning plan.

<prerequisites>
Generate 2-4 prerequisite concepts. Each MUST:

✓ Be a specific concept or skill (not vague like "basic knowledge")
✓ Be truly necessary to understand the main topic
✓ Match the ${expertiseLevel} level (don't assume experts need basics, don't overwhelm beginners)
✓ Include WHY it's a prerequisite

EXAMPLES:

For "neural networks" (intermediate level):
✓ "Understanding of gradient descent and backpropagation - needed to comprehend how networks learn"
✓ "Linear algebra fundamentals (matrix multiplication, dot products) - neural network operations are matrix math"
✓ "Basic Python with NumPy - required to implement and experiment with networks"

For "React hooks" (beginner level):
✓ "JavaScript ES6 syntax (arrow functions, destructuring) - hooks use modern JS features"
✓ "Understanding of component lifecycle - hooks replace lifecycle methods"

BAD (too vague):
❌ "Basic programming knowledge"
❌ "Some math background"

Generate prerequisites for the user's query above.
</prerequisites>

<misconceptions>
Generate 3-5 common misconceptions specific to this topic. Each MUST:

✓ State the misconception clearly
✓ Explain why it's wrong
✓ Provide the correct understanding
✓ Be genuinely common in this domain (not obscure edge cases)

EXAMPLES:

For "machine learning":
✓ "Misconception: 'More training data always improves model performance.' Reality: After a point, more data yields diminishing returns; data quality and diversity matter more than quantity."
✓ "Misconception: 'Neural networks actually understand content like humans do.' Reality: They identify statistical patterns in training data; they don't have semantic understanding."

For "async programming in JavaScript":
✓ "Misconception: 'Async functions run in parallel.' Reality: JavaScript is single-threaded; async allows non-blocking I/O, not true parallelism."

Generate misconceptions for the user's query above.
</misconceptions>

<analogies>
Generate 2-3 domain-appropriate analogies. Each MUST:

✓ Map complex concept to familiar experience
✓ Be accurate (not misleading)
✓ Use references appropriate for ${expertiseLevel} level
✓ Highlight key similarities and where analogy breaks down

EXAMPLES:

For "database indexing":
✓ "Database index is like a book's index - lets you jump to specific content without reading everything. Unlike a book, maintaining database indexes slows down writes (adding new content)."

For "React component state":
✓ "Component state is like a form's input values - each component remembers its own data. When state changes, the component re-renders just like refreshing a form shows new values."

Generate analogies for the user's query above.
</analogies>

<learning_milestones>
Generate 3-4 learning milestones that show progression. Each MUST:

✓ Be a concrete, measurable achievement
✓ Show increasing sophistication from basic → advanced
✓ Be appropriate for ${expertiseLevel} level
✓ Help learner self-assess progress

EXAMPLES:

For "SQL" (beginner → intermediate):
✓ "Can write SELECT queries with WHERE, ORDER BY, and LIMIT clauses"
✓ "Can use JOINs to combine data from multiple tables"
✓ "Can write subqueries and understand when to use them vs JOINs"
✓ "Can optimize queries using indexes and EXPLAIN plans"

For "React" (intermediate → advanced):
✓ "Can implement custom hooks for reusable logic"
✓ "Understands when to use useCallback and useMemo for optimization"
✓ "Can debug performance issues using React DevTools Profiler"

Generate milestones for the user's query above.
</learning_milestones>

<output_format>
Output ONLY valid JSON:

{
  "prerequisites": [
    "Prerequisite concept 1 with justification",
    "Prerequisite concept 2 with justification",
    "... 2-4 total"
  ],
  "misconceptions": [
    "Misconception 1: 'Wrong belief.' Reality: Correct understanding.",
    "Misconception 2: 'Wrong belief.' Reality: Correct understanding.",
    "... 3-5 total"
  ],
  "analogies": [
    "Analogy 1 mapping concept to familiar experience",
    "Analogy 2 mapping concept to familiar experience",
    "... 2-3 total"
  ],
  "milestones": [
    "Concrete milestone 1",
    "Concrete milestone 2",
    "... 3-4 total"
  ]
}

Do NOT include any explanation or markdown formatting. Output only the JSON.
</output_format>`;

    try {
      const response = await this.claudeClient.complete(stage1Prompt, {
        maxTokens: 1500,
        temperature: 0.3,
        timeout: 20000,
      });

      const rawOutput = response.content[0].text.trim();
      let jsonText = rawOutput;
      const jsonMatch = rawOutput.match(/```json\s*([\s\S]*?)\s*```/) ||
        rawOutput.match(/```\s*([\s\S]*?)\s*```/) ||
        rawOutput.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        jsonText = jsonMatch[1] || jsonMatch[0];
      }

      const domainContent = JSON.parse(jsonText);

      if (!Array.isArray(domainContent.prerequisites) ||
          !Array.isArray(domainContent.misconceptions) ||
          !Array.isArray(domainContent.analogies) ||
          !Array.isArray(domainContent.milestones)) {
        throw new Error('Invalid socratic domain content structure from Stage 1');
      }

      logger.info('Stage 1 socratic domain content generated successfully', {
        prerequisiteCount: domainContent.prerequisites.length,
        misconceptionCount: domainContent.misconceptions.length,
        analogyCount: domainContent.analogies.length,
        milestoneCount: domainContent.milestones.length,
      });

      return domainContent;
    } catch (error) {
      logger.error('Failed to generate socratic domain content in Stage 1', {
        error: error.message
      });

      return {
        prerequisites: [],
        misconceptions: [],
        analogies: [],
        milestones: [],
      };
    }
  }

  /**
   * STAGE 1: Generate domain-specific content for DEFAULT/OPTIMIZE mode
   * Focuses on general optimization elements: technical specs, anti-patterns, success metrics
   *
   * @param {string} prompt - The user's original prompt
   * @param {Object} context - Inferred or provided context
   * @returns {Promise<Object>} Domain-specific optimization content
   * @private
   */
  async generateDefaultDomainContent(prompt, context) {
    logger.info('Generating default domain content (Stage 1)', {
      promptLength: prompt.length,
      hasContext: !!context
    });

    const domain = context?.specificAspects || '';
    const expertiseLevel = context?.backgroundLevel || 'intermediate';
    const useCase = context?.intendedUse || '';

    const stage1Prompt = `Generate domain-specific optimization content for a general task.

<task>
User's Task: "${prompt}"

Context:
- Domain/Technology: ${domain || 'general'}
- User Level: ${expertiseLevel}
- Intended Use: ${useCase || 'not specified'}
</task>

Your job: Generate domain-specific optimization elements for this task.

<technical_specifications>
Generate 3-5 technical specifications or requirements. Each MUST:

✓ Be specific to this domain/technology
✓ Include concrete values, standards, or best practices
✓ Be appropriate for ${expertiseLevel} level
✓ Help ensure quality output

EXAMPLES:

For "Python API development":
✓ "Use type hints (PEP 484) for all function signatures to enable static analysis"
✓ "Implement request validation with Pydantic for automatic data parsing and validation"
✓ "Follow RESTful conventions: GET for retrieval, POST for creation, PUT for updates, DELETE for removal"

For "React component development":
✓ "Use TypeScript with strict mode enabled for type safety"
✓ "Implement prop validation with PropTypes or TypeScript interfaces"
✓ "Follow React Hooks rules: only call hooks at top level, only call from React functions"

BAD (too vague):
❌ "Follow best practices"
❌ "Write clean code"

Generate technical specifications for the user's task above.
</technical_specifications>

<anti_patterns>
Generate 3-5 domain-specific anti-patterns to avoid. Each MUST:

✓ Name the specific anti-pattern
✓ Explain why it's problematic in THIS domain
✓ Suggest what to do instead
✓ Be truly common in this domain

EXAMPLES:

For "database design":
✓ "Avoid storing JSON blobs in relational databases when data has predictable structure - use normalized tables instead for better query performance and data integrity"
✓ "Avoid using SELECT * in production queries - explicitly list columns to prevent breaking changes when schema evolves"

For "React state management":
✓ "Avoid storing derived state - calculate it on render instead to prevent synchronization bugs (e.g., don't store both 'firstName' and 'fullName' in state)"
✓ "Avoid mutating state directly (state.items.push(x)) - use immutable updates (setState([...state.items, x])) to trigger re-renders"

Generate anti-patterns for the user's task above.
</anti_patterns>

<success_metrics>
Generate 2-3 success metrics or quality indicators. Each MUST:

✓ Be measurable or verifiable
✓ Be relevant to ${useCase || 'general use'}
✓ Help determine if the task is done well

EXAMPLES:

For "API development" (production use):
✓ "Response time < 200ms for 95th percentile of requests under expected load"
✓ "Test coverage ≥ 80% for critical paths (authentication, data validation, error handling)"

For "UI component" (reusable library):
✓ "Component renders correctly in all major browsers (Chrome, Firefox, Safari, Edge)"
✓ "Passes WCAG 2.1 AA accessibility standards (keyboard navigation, screen reader compatibility)"

Generate success metrics for the user's task above.
</success_metrics>

<constraints>
Generate 1-3 important constraints or limitations. Each MUST:

✓ Be a hard requirement or boundary
✓ Be specific to this domain or use case
✓ Include rationale

EXAMPLES:

For "production deployment":
✓ "Must maintain backward compatibility with API v1 clients for 6-month deprecation period"
✓ "Database migrations must be reversible to enable safe rollbacks"

For "browser-based app":
✓ "Bundle size must not exceed 250KB gzipped to maintain sub-3s load time on 3G networks"

Generate constraints for the user's task above (or empty array if none apply).
</constraints>

<output_format>
Output ONLY valid JSON:

{
  "technicalSpecs": [
    "Specific technical specification 1",
    "Specific technical specification 2",
    "... 3-5 total"
  ],
  "antiPatterns": [
    "Anti-pattern 1 with what to do instead",
    "Anti-pattern 2 with what to do instead",
    "... 3-5 total"
  ],
  "successMetrics": [
    "Measurable success metric 1",
    "Measurable success metric 2",
    "... 2-3 total"
  ],
  "constraints": [
    "Hard constraint 1 with rationale",
    "Hard constraint 2 with rationale",
    "... 1-3 total (or empty array)"
  ]
}

Do NOT include any explanation or markdown formatting. Output only the JSON.
</output_format>`;

    try {
      const response = await this.claudeClient.complete(stage1Prompt, {
        maxTokens: 1500,
        temperature: 0.3,
        timeout: 20000,
      });

      const rawOutput = response.content[0].text.trim();
      let jsonText = rawOutput;
      const jsonMatch = rawOutput.match(/```json\s*([\s\S]*?)\s*```/) ||
        rawOutput.match(/```\s*([\s\S]*?)\s*```/) ||
        rawOutput.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        jsonText = jsonMatch[1] || jsonMatch[0];
      }

      const domainContent = JSON.parse(jsonText);

      if (!Array.isArray(domainContent.technicalSpecs) ||
          !Array.isArray(domainContent.antiPatterns) ||
          !Array.isArray(domainContent.successMetrics) ||
          !Array.isArray(domainContent.constraints)) {
        throw new Error('Invalid default domain content structure from Stage 1');
      }

      logger.info('Stage 1 default domain content generated successfully', {
        technicalSpecCount: domainContent.technicalSpecs.length,
        antiPatternCount: domainContent.antiPatterns.length,
        successMetricCount: domainContent.successMetrics.length,
        constraintCount: domainContent.constraints.length,
      });

      return domainContent;
    } catch (error) {
      logger.error('Failed to generate default domain content in Stage 1', {
        error: error.message
      });

      return {
        technicalSpecs: [],
        antiPatterns: [],
        successMetrics: [],
        constraints: [],
      };
    }
  }

  /**
   * Optimize a prompt based on mode and context
   * @param {Object} params - Optimization parameters
   * @param {string} params.prompt - Original prompt
   * @param {string} params.mode - Optimization mode (optional - will auto-detect if not provided)
   * @param {Object} params.context - Additional context (optional - will auto-infer for reasoning mode if not provided)
   * @param {Object} params.brainstormContext - Context from Creative Brainstorm workflow
   * @param {boolean} params.useConstitutionalAI - Whether to apply Constitutional AI review (default: false)
   * @param {boolean} params.useIterativeRefinement - Whether to use iterative refinement (default: false)
   * @returns {Promise<string|Object>} Optimized prompt (or object with prompt and metadata if iterative)
   */
  async optimize({ prompt, mode, context, brainstormContext, useConstitutionalAI = false, useIterativeRefinement = false }) {
    logger.info('Optimizing prompt', { mode, promptLength: prompt?.length });

    // No test-specific short-circuit here; tests should mock fetch at app level

    // Auto-detect mode if not provided
    if (!mode) {
      mode = await this.detectOptimalMode(prompt);
      logger.info('Auto-detected mode', { detectedMode: mode });
    }

    // Auto-infer context if not provided and mode is reasoning
    if (mode === 'reasoning' && !context) {
      logger.info('Auto-inferring context for reasoning mode');
      context = await this.inferContextFromPrompt(prompt);
      logger.debug('Inferred context', { context });
    }

    // STAGE 1: Generate domain-specific content for modes that support it
    // Runs for reasoning, research, socratic, and default modes when context is available
    let domainContent = null;
    const modesWithStage1 = ['reasoning', 'research', 'socratic', 'optimize'];

    if (modesWithStage1.includes(mode) && context && Object.keys(context).some(k => context[k])) {
      logger.info('Executing Stage 1: Domain-specific content generation', { mode });

      // Check domain content cache first (separate from final prompt cache)
      const domainCacheKey = cacheService.generateKey('domain-content', {
        mode,
        prompt: prompt.substring(0, 100), // Use first 100 chars of prompt for cache key
        context,
      });

      domainContent = await cacheService.get(domainCacheKey, 'domain-content');

      if (!domainContent) {
        try {
          // Call appropriate Stage 1 function based on mode
          switch (mode) {
            case 'reasoning':
              domainContent = await this.generateDomainSpecificContent(prompt, context);
              logger.debug('Stage 1 complete - reasoning domain content generated', {
                warningCount: domainContent.warnings?.length || 0,
                deliverableCount: domainContent.deliverables?.length || 0,
                constraintCount: domainContent.constraints?.length || 0,
              });
              break;

            case 'research':
              domainContent = await this.generateResearchDomainContent(prompt, context);
              logger.debug('Stage 1 complete - research domain content generated', {
                sourceTypeCount: domainContent.sourceTypes?.length || 0,
                methodologyCount: domainContent.methodologies?.length || 0,
                qualityCriteriaCount: domainContent.qualityCriteria?.length || 0,
                biasCount: domainContent.commonBiases?.length || 0,
              });
              break;

            case 'socratic':
              domainContent = await this.generateSocraticDomainContent(prompt, context);
              logger.debug('Stage 1 complete - socratic domain content generated', {
                prerequisiteCount: domainContent.prerequisites?.length || 0,
                misconceptionCount: domainContent.misconceptions?.length || 0,
                analogyCount: domainContent.analogies?.length || 0,
                milestoneCount: domainContent.milestones?.length || 0,
              });
              break;

            case 'optimize':
              domainContent = await this.generateDefaultDomainContent(prompt, context);
              logger.debug('Stage 1 complete - default domain content generated', {
                technicalSpecCount: domainContent.technicalSpecs?.length || 0,
                antiPatternCount: domainContent.antiPatterns?.length || 0,
                successMetricCount: domainContent.successMetrics?.length || 0,
                constraintCount: domainContent.constraints?.length || 0,
              });
              break;
          }

          // Cache domain content separately (1 hour TTL, reusable across similar prompts)
          await cacheService.set(domainCacheKey, domainContent, { ttl: 3600 });
        } catch (error) {
          logger.warn('Stage 1 failed, falling back to standard optimization', {
            mode,
            error: error.message
          });
          domainContent = null; // Fallback to original single-stage approach
        }
      } else {
        logger.debug('Stage 1 domain content cache hit', { mode });
      }
    }

    // Check cache first (include template version to prevent serving outdated cached results)
    const cacheKey = cacheService.generateKey(this.cacheConfig.namespace, {
      prompt,
      mode,
      context,
      useIterativeRefinement,
      hasDomainContent: !!domainContent, // Include in cache key to differentiate
      templateVersion: this.templateVersions[mode] || '1.0.0',
    });

    const cached = await cacheService.get(cacheKey, 'prompt-optimization');
    if (cached) {
      logger.debug('Cache hit for prompt optimization');
      return cached;
    }

    // Use iterative refinement if requested
    if (useIterativeRefinement) {
      const result = await this.optimizeIteratively(prompt, mode, context, brainstormContext, useConstitutionalAI);
      await cacheService.set(cacheKey, result, { ttl: this.cacheConfig.ttl });
      return result;
    }

    // STAGE 2: Build system prompt (with domain content if available)
    const systemPrompt = this.buildSystemPrompt(prompt, mode, context, brainstormContext, domainContent);

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
   * @param {string} prompt - User's prompt
   * @param {string} mode - Optimization mode
   * @param {Object} context - User context
   * @param {Object} brainstormContext - Brainstorm context
   * @param {Object} domainContent - Pre-generated domain-specific content from Stage 1
   * @private
   */
  buildSystemPrompt(prompt, mode, context, brainstormContext, domainContent = null) {
    let systemPrompt = '';

    switch (mode) {
      case 'reasoning':
        systemPrompt = this.getReasoningPrompt(prompt, context, brainstormContext, domainContent);
        break;
      case 'research':
        systemPrompt = this.getResearchPrompt(prompt, context, brainstormContext, domainContent);
        break;
      case 'socratic':
        systemPrompt = this.getSocraticPrompt(prompt, context, brainstormContext, domainContent);
        break;
      case 'video':
        systemPrompt = this.getVideoPrompt(prompt, brainstormContext);
        break;
      default:
        systemPrompt = this.getDefaultPrompt(prompt, context, brainstormContext, domainContent);
    }

    // Add context enhancement if provided
    // Skip for modes with two-stage implementation since context is already integrated
    const modesWithIntegratedContext = ['reasoning', 'research', 'socratic', 'optimize'];
    if (context && Object.keys(context).some((k) => context[k]) && !modesWithIntegratedContext.includes(mode)) {
      systemPrompt += this.buildContextAddition(context);
    }

    // Note: brainstormContext is now injected directly into each mode's template
    // via the transformation_process section, not appended afterward

    return systemPrompt;
  }

  /**
   * IMPROVED REASONING TEMPLATE v4.0.0 with Two-Stage Domain-Specific Content
   * Generates high-quality reasoning prompts by focusing on OUTPUT rather than PROCESS
   * NOW SUPPORTS: Stage 1 pre-generated domain-specific warnings and deliverables
   *
   * @param {string} prompt - User's prompt to optimize
   * @param {Object} context - Optional user context (specificAspects, backgroundLevel, intendedUse)
   * @param {Object} brainstormContext - Optional brainstorm context from Creative Brainstorm
   * @param {Object} domainContent - Pre-generated domain-specific content from Stage 1
   * @private
   */
  getReasoningPrompt(prompt, context = null, brainstormContext = null, domainContent = null) {
    // Log context usage for debugging
    if (context) {
      logger.info('Context provided for reasoning mode', {
        hasSpecificAspects: Boolean(context.specificAspects),
        hasBackgroundLevel: Boolean(context.backgroundLevel),
        hasIntendedUse: Boolean(context.intendedUse),
      });
    }

    // Log domain content usage
    if (domainContent) {
      logger.info('Stage 1 domain content available for reasoning template', {
        warningCount: domainContent.warnings?.length || 0,
        deliverableCount: domainContent.deliverables?.length || 0,
        constraintCount: domainContent.constraints?.length || 0,
      });
    }

    // Build domain content section if available (replaces generic context section)
    let domainContentSection = '';
    if (domainContent && (domainContent.warnings?.length > 0 || domainContent.deliverables?.length > 0)) {
      domainContentSection = '\n\n**PRE-GENERATED DOMAIN-SPECIFIC CONTENT:**';
      domainContentSection += '\nThe following domain-specific elements have been generated for this prompt.';
      domainContentSection += '\nYou MUST incorporate these verbatim into the appropriate sections of your optimized prompt:\n';

      // Add warnings section
      if (domainContent.warnings?.length > 0) {
        domainContentSection += '\n**WARNINGS (include these in your Warnings section):**\n';
        domainContent.warnings.forEach((warning, i) => {
          domainContentSection += `${i + 1}. ${warning}\n`;
        });
      }

      // Add deliverables section
      if (domainContent.deliverables?.length > 0) {
        domainContentSection += '\n**DELIVERABLES (include these in your Return Format section):**\n';
        domainContent.deliverables.forEach((deliverable, i) => {
          domainContentSection += `${i + 1}. ${deliverable}\n`;
        });
      }

      // Add constraints section if available
      if (domainContent.constraints?.length > 0) {
        domainContentSection += '\n**CONSTRAINTS (add a Constraints section with these):**\n';
        domainContent.constraints.forEach((constraint, i) => {
          domainContentSection += `${i + 1}. ${constraint}\n`;
        });
      }

      domainContentSection += '\nIMPORTANT: These elements are already domain-specific and technically precise.';
      domainContentSection += ' Use them as provided - do not make them more generic or vague.';
      domainContentSection += ' Your job is to assemble them into a well-structured reasoning prompt.\n';
    } else if (context && Object.keys(context).some((k) => context[k])) {
      // Fallback to old context section if no domain content (backward compatibility)
      domainContentSection = '\n\n**USER-PROVIDED CONTEXT:**';
      domainContentSection += '\nThe user has specified these requirements that MUST be integrated into the optimized prompt:';

      if (context.specificAspects) {
        domainContentSection += `\n- **Focus Areas:** ${context.specificAspects}`;
      }
      if (context.backgroundLevel) {
        domainContentSection += `\n- **Target Audience Level:** ${context.backgroundLevel}`;
      }
      if (context.intendedUse) {
        domainContentSection += `\n- **Intended Use Case:** ${context.intendedUse}`;
      }

      domainContentSection += '\n\nEnsure these requirements are woven naturally into your optimized prompt.';
    }

    // Build brainstorm context section if provided
    const brainstormSection = brainstormContext?.elements
      ? this.buildBrainstormContextForTemplate(brainstormContext)
      : '';

    // Build transformation steps - SIMPLIFIED when domain content is available
    const hasContext = context && Object.keys(context).some((k) => context[k]);
    const hasDomainContent = domainContent && (domainContent.warnings?.length > 0 || domainContent.deliverables?.length > 0);

    const transformationSteps = hasDomainContent
      ? `
1. **Extract the core objective** - What are they really trying to accomplish?
2. **Integrate pre-generated domain content** - Warnings, deliverables, and constraints have been pre-generated above. Include them in the appropriate sections of your optimized prompt.
   - Copy the WARNINGS into your **Warnings** section (you may add 1-2 more if critically important, but the pre-generated ones are already domain-specific)
   - Copy the DELIVERABLES into your **Return Format** section
   - Copy the CONSTRAINTS into a **Constraints** section (if provided)
3. **Identify essential context** - What background information shapes the solution space?
4. **Add quantification** - Where else can you make requirements measurable?
5. **Remove all meta-instructions** - Trust the model to reason well without process guidance

IMPORTANT: The pre-generated warnings and deliverables are already domain-specific and technically precise. Do NOT make them more generic.`
      : hasContext || brainstormSection
      ? `
1. **Extract the core objective** - What are they really trying to accomplish?
${hasContext ? `2. **Integrate user-provided requirements** - The user specified these context requirements above. Ensure they are naturally reflected in the Goal, Context, Warnings, and Return Format sections.` : ''}
${brainstormSection ? `${hasContext ? '3' : '2'}. **Integrate brainstorm elements** - The user specified these creative elements:
${brainstormSection}
Weave these naturally into the optimized prompt's relevant sections.` : ''}
${hasContext || brainstormSection ? `${hasContext && brainstormSection ? '4' : '3'}` : '2'}. **Determine specific deliverables** - What concrete outputs would best serve this goal?
${hasContext || brainstormSection ? `${hasContext && brainstormSection ? '5' : '4'}` : '3'}. **Generate domain-specific warnings** - What sophisticated mistakes could occur in this domain?
${hasContext || brainstormSection ? `${hasContext && brainstormSection ? '6' : '5'}` : '4'}. **Identify essential context** - What background information shapes the solution space?
${hasContext || brainstormSection ? `${hasContext && brainstormSection ? '7' : '6'}` : '5'}. **Add quantification** - Where can you make requirements measurable? (e.g., "3-5 options", "ranked by impact")
${hasContext || brainstormSection ? `${hasContext && brainstormSection ? '8' : '7'}` : '6'}. **Remove all meta-instructions** - Trust the model to reason well without process guidance`
      : `
1. **Extract the core objective** - What are they really trying to accomplish?
2. **Determine specific deliverables** - What concrete outputs would best serve this goal?
3. **Generate domain-specific warnings** - What sophisticated mistakes could occur in this domain?
4. **Identify essential context** - What background information shapes the solution space?
5. **Add quantification** - Where can you make requirements measurable? (e.g., "3-5 options", "ranked by impact")
6. **Remove all meta-instructions** - Trust the model to reason well without process guidance`;

    return `You are an expert prompt engineer specializing in reasoning models (o1, o1-pro, o3, Claude Sonnet). These models employ extended chain-of-thought reasoning, so prompts should be clear, well-structured, and guide toward high-quality outputs through strategic constraints rather than process micromanagement.

Transform the user's rough prompt into a structured reasoning prompt that will produce exceptional results.

<core_principles>
- Focus on WHAT to deliver, not HOW to think
- Use warnings to prevent sophisticated mistakes
- Specify concrete deliverables with quantifiable criteria
- Trust the model's reasoning capabilities
- Keep it concise (300-500 words for most prompts)
</core_principles>

<output_structure>
Your optimized prompt should follow this structure:

**Goal**
[Single sentence stating the objective + quantifiable success metric if applicable]

**Return Format**
[Bulleted list of specific deliverables with structure requirements]
- [Deliverable type]: [what it must contain, how it should be structured]
- [Expected format]: [length, organization, prioritization requirements]
- Include concrete specifications (e.g., "3-5 ranked strategies", "quantified where possible")

**Warnings**
[4-6 sophisticated pitfalls that are specific to this problem domain]
- Avoid [anti-pattern]: [why it's problematic and what to do instead]
- Consider [edge case/constraint]: [specific concern to account for]
- Ensure [quality requirement]: [what mustn't be sacrificed]
- Account for [scale/complexity consideration]: [how different scenarios might differ]

**Context**
[2-4 sentences of technical background that informs solution space]
[Include only essential details that affect the approach or solution quality]

**[Optional: Constraints]**
[Only include if there are hard technical/business constraints not covered by Warnings]
- [Hard constraint with specific parameters]
</output_structure>

<warning_generation_guide>
Generate warnings that demonstrate domain expertise. Good warnings are:

✓ Specific to the problem domain (not generic)
✓ Prevent sophisticated mistakes (not obvious errors)
✓ Show understanding of trade-offs and nuances
✓ Address scale, complexity, or context-dependent concerns

Examples of GOOD warnings:
- "Avoid solutions that shift the problem rather than solving it (e.g., moving slow synchronous work to slow asynchronous work without addressing the root cause)"
- "Consider that optimization strategies may perform differently at different scales (small datasets vs. millions of records)"
- "Account for memory implications of caching strategies, especially in systems handling many concurrent operations"

Examples of BAD warnings (too generic):
- "Consider edge cases" → Too vague
- "Make sure it works" → Obvious
- "Think about performance" → Not actionable
</warning_generation_guide>

<anti_patterns_to_avoid>
DO NOT include any of these in your output:
❌ Step-by-step reasoning instructions ("break down into sub-problems...")
❌ Verification checklists with checkboxes (□)
❌ Meta-commentary about confidence, assumptions, or reasoning process
❌ Phrases like "state your assumptions", "verify your reasoning", "check for logical consistency"
❌ Generic process templates (Initial Analysis Phase, Solution Generation Phase, etc.)
❌ Redundant sections that repeat the same concept differently
❌ Excessive length (>600 words unless truly complex)
</anti_patterns_to_avoid>

<original_prompt>
"${prompt}"${domainContentSection}
</original_prompt>

<examples>
Example transformation (different domain):
Input: "analyze the performance of this sorting algorithm"

Output:
**Goal**
Identify performance bottlenecks in the sorting algorithm implementation and determine if it meets O(n log n) complexity requirements for production use with 100K+ element arrays.

**Return Format**
- Time complexity analysis: Big-O notation for best, average, and worst cases with justification
- Space complexity breakdown: Memory allocation patterns and auxiliary space usage
- 3-5 concrete optimization opportunities ranked by impact, each with:
  - Current bottleneck identified
  - Proposed improvement with code-level specifics
  - Expected performance gain (quantified with complexity analysis)
  - Implementation trade-offs
- Benchmark comparison: Position relative to standard library sort for common data distributions

**Warnings**
- Avoid theoretical analysis that ignores cache behavior and memory access patterns in real hardware
- Consider that worst-case complexity may matter more than average-case for user-facing features where latency spikes are unacceptable
- Account for different data distributions (sorted, reverse-sorted, random, partially sorted) as they can dramatically affect real-world performance
- Ensure optimization recommendations don't sacrifice stability or introduce subtle correctness bugs
- Be cautious of micro-optimizations that improve benchmarks but hurt maintainability without meaningful user impact

**Context**
The algorithm is used in a web application's data processing pipeline where sort operations occur on every user interaction. The current implementation handles arrays of varying sizes (10-100K elements) with mixed data types. Performance profiling shows sorting consumes 15-20% of total request time, making it a primary optimization target.

**Constraints**
- Must maintain stable sort property (equal elements preserve original order)
- Cannot introduce external dependencies or libraries
- Must remain comprehensible to junior developers on the team
</examples>

<transformation_process>
When transforming the user's prompt:
${transformationSteps}

Keep the final prompt focused, actionable, and sophisticated. Every word should serve the goal of producing excellent output.
</transformation_process>

Now transform the user's rough prompt: "${prompt}"

Output ONLY the optimized reasoning prompt in the structure shown above. Do not include any meta-commentary, explanations, or wrapper text.`;
  }

  /**
   * Get research mode prompt template
   * @param {string} prompt - User's prompt to optimize
   * @param {Object} brainstormContext - Optional brainstorm context from Creative Brainstorm
   * @private
   */
  getResearchPrompt(prompt, context = null, brainstormContext = null, domainContent = null) {
    // Log domain content usage
    if (domainContent) {
      logger.info('Stage 1 domain content available for research template', {
        sourceTypeCount: domainContent.sourceTypes?.length || 0,
        methodologyCount: domainContent.methodologies?.length || 0,
        qualityCriteriaCount: domainContent.qualityCriteria?.length || 0,
        biasCount: domainContent.commonBiases?.length || 0,
      });
    }

    // Build domain content section if available
    let domainContentSection = '';
    if (domainContent && (domainContent.sourceTypes?.length > 0 || domainContent.methodologies?.length > 0)) {
      domainContentSection = '\n\n**PRE-GENERATED DOMAIN-SPECIFIC RESEARCH CONTENT:**';
      domainContentSection += '\nThe following domain-specific research elements have been generated for this prompt.';
      domainContentSection += '\nYou MUST incorporate these verbatim into the appropriate sections of your research plan:\n';

      // Add source types section
      if (domainContent.sourceTypes?.length > 0) {
        domainContentSection += '\n**SOURCE TYPES (include these in your Information Sources section):**\n';
        domainContent.sourceTypes.forEach((sourceType, i) => {
          domainContentSection += `${i + 1}. ${sourceType}\n`;
        });
      }

      // Add methodologies section
      if (domainContent.methodologies?.length > 0) {
        domainContentSection += '\n**METHODOLOGIES (include these in your Methodology section):**\n';
        domainContent.methodologies.forEach((methodology, i) => {
          domainContentSection += `${i + 1}. ${methodology}\n`;
        });
      }

      // Add quality criteria section
      if (domainContent.qualityCriteria?.length > 0) {
        domainContentSection += '\n**QUALITY CRITERIA (add these to Success Metrics or Information Sources):**\n';
        domainContent.qualityCriteria.forEach((criteria, i) => {
          domainContentSection += `${i + 1}. ${criteria}\n`;
        });
      }

      // Add common biases section
      if (domainContent.commonBiases?.length > 0) {
        domainContentSection += '\n**COMMON BIASES (include these in Anticipated Challenges):**\n';
        domainContent.commonBiases.forEach((bias, i) => {
          domainContentSection += `${i + 1}. ${bias}\n`;
        });
      }

      domainContentSection += '\nIMPORTANT: These elements are already domain-specific and technically precise.';
      domainContentSection += ' Use them as provided - do not make them more generic.';
      domainContentSection += ' Your job is to assemble them into a well-structured research plan.\n';
    } else if (context && Object.keys(context).some((k) => context[k])) {
      // Fallback to old context section if no domain content
      domainContentSection = '\n\n**USER-PROVIDED CONTEXT:**';
      domainContentSection += '\nThe user has specified these requirements that MUST be integrated into the research plan:';

      if (context.specificAspects) {
        domainContentSection += `\n- **Research Focus:** ${context.specificAspects}`;
      }
      if (context.backgroundLevel) {
        domainContentSection += `\n- **Researcher Level:** ${context.backgroundLevel}`;
      }
      if (context.intendedUse) {
        domainContentSection += `\n- **Research Purpose:** ${context.intendedUse}`;
      }

      domainContentSection += '\n\nEnsure these requirements are woven naturally into your research plan.';
    }

    // Build brainstorm context section if provided
    const brainstormSection = brainstormContext?.elements
      ? this.buildBrainstormContextForTemplate(brainstormContext)
      : '';

    // Build thinking protocol steps - SIMPLIFIED when domain content is available
    const hasDomainContent = domainContent && (domainContent.sourceTypes?.length > 0 || domainContent.methodologies?.length > 0);

    const thinkingSteps = hasDomainContent
      ? `
1. **Understand the research scope** (3-5 sentences)
   - What's the core research question?
   - What type of research is this (exploratory/explanatory/evaluative)?
   - What depth and breadth are needed?

2. **Integrate pre-generated domain content** - Source types, methodologies, quality criteria, and biases have been pre-generated above. Include them in the appropriate sections of your research plan.
   - Copy the SOURCE TYPES into your **Information Sources** section
   - Copy the METHODOLOGIES into your **Methodology** section
   - Copy the QUALITY CRITERIA into your **Success Metrics** or **Information Sources** section
   - Copy the COMMON BIASES into your **Anticipated Challenges** section

3. **Design research structure** (prioritized list)
   - What's the optimal question hierarchy?
   - How to ensure source triangulation?
   - What synthesis framework fits best?

IMPORTANT: The pre-generated research elements are already domain-specific. Do NOT make them more generic.`
      : brainstormSection
      ? `
1. **Understand the research scope** (3-5 sentences)
   - What's the core research question?
   - What type of research is this (exploratory/explanatory/evaluative)?
   - What depth and breadth are needed?

2. **Integrate user-provided context** - The user specified these key elements:
${brainstormSection}
Ensure these elements inform the research objective, scope, and methodology.
   - How do these elements shape the research focus?
   - What aspects need deeper investigation?

3. **Identify methodological requirements** (bullet list)
   - What source types are essential?
   - What quality standards apply?
   - What biases need mitigation?

4. **Design research structure** (prioritized list)
   - What's the optimal question hierarchy?
   - How to ensure source triangulation?
   - What synthesis framework fits best?`
      : `
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
   - What synthesis framework fits best?`;

    return `You are a research methodology expert specializing in comprehensive, actionable research planning with rigorous source validation and bias mitigation.

<internal_instructions>
CRITICAL: The sections below marked as <thinking_protocol>, <advanced_research_methodology>, and <quality_verification> are YOUR INTERNAL INSTRUCTIONS for HOW to create the optimized prompt. These sections should NEVER appear in your output.

Your output should ONLY contain the actual optimized research plan that starts with "**RESEARCH OBJECTIVE**" and follows the structure defined in the template.
</internal_instructions>

<thinking_protocol>
Before outputting the optimized prompt, engage in internal step-by-step thinking (do NOT include this thinking in your output):
${thinkingSteps}

This thinking process is for YOUR BENEFIT ONLY - do not include it in the final output.
</thinking_protocol>
${domainContentSection}
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
   * @param {string} prompt - User's prompt to optimize
   * @param {Object} brainstormContext - Optional brainstorm context from Creative Brainstorm
   * @private
   */
  getSocraticPrompt(prompt, context = null, brainstormContext = null, domainContent = null) {
    // Log domain content usage
    if (domainContent) {
      logger.info('Stage 1 domain content available for socratic template', {
        prerequisiteCount: domainContent.prerequisites?.length || 0,
        misconceptionCount: domainContent.misconceptions?.length || 0,
        analogyCount: domainContent.analogies?.length || 0,
        milestoneCount: domainContent.milestones?.length || 0,
      });
    }

    // Build domain content section if available
    let domainContentSection = '';
    if (domainContent && (domainContent.prerequisites?.length > 0 || domainContent.misconceptions?.length > 0)) {
      domainContentSection = '\n\n**PRE-GENERATED DOMAIN-SPECIFIC LEARNING CONTENT:**';
      domainContentSection += '\nThe following domain-specific learning elements have been generated for this prompt.';
      domainContentSection += '\nYou MUST incorporate these verbatim into the appropriate sections of your learning plan:\n';

      // Add prerequisites section
      if (domainContent.prerequisites?.length > 0) {
        domainContentSection += '\n**PREREQUISITES (include these in your Prerequisites section):**\n';
        domainContent.prerequisites.forEach((prereq, i) => {
          domainContentSection += `${i + 1}. ${prereq}\n`;
        });
      }

      // Add misconceptions section
      if (domainContent.misconceptions?.length > 0) {
        domainContentSection += '\n**COMMON MISCONCEPTIONS (include these in your Common Misconceptions section):**\n';
        domainContent.misconceptions.forEach((misconception, i) => {
          domainContentSection += `${i + 1}. ${misconception}\n`;
        });
      }

      // Add analogies section
      if (domainContent.analogies?.length > 0) {
        domainContentSection += '\n**TEACHING ANALOGIES (incorporate these into your Guiding Questions or Concept Connections):**\n';
        domainContent.analogies.forEach((analogy, i) => {
          domainContentSection += `${i + 1}. ${analogy}\n`;
        });
      }

      // Add milestones section
      if (domainContent.milestones?.length > 0) {
        domainContentSection += '\n**LEARNING MILESTONES (include these in your Mastery Indicators):**\n';
        domainContent.milestones.forEach((milestone, i) => {
          domainContentSection += `${i + 1}. ${milestone}\n`;
        });
      }

      domainContentSection += '\nIMPORTANT: These elements are already domain-specific and pedagogically sound.';
      domainContentSection += ' Use them as provided - do not make them more generic.';
      domainContentSection += ' Your job is to assemble them into a well-structured learning plan.\n';
    } else if (context && Object.keys(context).some((k) => context[k])) {
      // Fallback to old context section if no domain content
      domainContentSection = '\n\n**USER-PROVIDED CONTEXT:**';
      domainContentSection += '\nThe user has specified these requirements that MUST be integrated into the learning plan:';

      if (context.specificAspects) {
        domainContentSection += `\n- **Learning Focus:** ${context.specificAspects}`;
      }
      if (context.backgroundLevel) {
        domainContentSection += `\n- **Learner Level:** ${context.backgroundLevel}`;
      }
      if (context.intendedUse) {
        domainContentSection += `\n- **Learning Purpose:** ${context.intendedUse}`;
      }

      domainContentSection += '\n\nEnsure these requirements are woven naturally into your learning plan.';
    }

    // Build brainstorm context section if provided
    const brainstormSection = brainstormContext?.elements
      ? this.buildBrainstormContextForTemplate(brainstormContext)
      : '';

    // Build thinking protocol steps - SIMPLIFIED when domain content is available
    const hasDomainContent = domainContent && (domainContent.prerequisites?.length > 0 || domainContent.misconceptions?.length > 0);

    const thinkingSteps = hasDomainContent
      ? `
1. **Understand the learning domain** (3-5 sentences)
   - What are the core concepts to master?
   - What's the optimal question sequence?

2. **Integrate pre-generated domain content** - Prerequisites, misconceptions, analogies, and milestones have been pre-generated above. Include them in the appropriate sections of your learning plan.
   - Copy the PREREQUISITES into your **Prerequisites** section
   - Copy the MISCONCEPTIONS into your **Common Misconceptions** section
   - Weave the ANALOGIES into your **Guiding Questions** or **Concept Connections**
   - Copy the MILESTONES into your **Mastery Indicators** section

3. **Design learning progression** (bullet list)
   - Where should difficulty increase?
   - What active learning techniques apply?
   - What formative assessment points are needed?

IMPORTANT: The pre-generated learning elements are already domain-specific. Do NOT make them more generic.`
      : brainstormSection
      ? `
1. **Understand the learning domain** (3-5 sentences)
   - What are the core concepts to master?
   - What prerequisite knowledge is essential?
   - What are the common misconceptions?

2. **Integrate user-provided context** - The user specified these key elements:
${brainstormSection}
Ensure these elements shape the learning objectives, question design, and pedagogical approach.
   - How do these elements inform the learning journey?
   - What teaching approach best suits this context?

3. **Design learning progression** (bullet list)
   - What's the optimal question sequence?
   - Where should difficulty increase?
   - What active learning techniques apply?

4. **Plan assessment integration** (prioritized list)
   - What formative assessment points are needed?
   - How to adapt to different mastery levels?
   - What metacognitive prompts strengthen learning?`
      : `
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
   - What metacognitive prompts strengthen learning?`;

    return `You are a Socratic learning guide specializing in inquiry-based education through strategic, insight-generating questions, informed by evidence-based learning science.

<internal_instructions>
CRITICAL: The sections below marked as <thinking_protocol>, <advanced_socratic_pedagogy>, and <quality_verification> are YOUR INTERNAL INSTRUCTIONS for HOW to create the optimized prompt. These sections should NEVER appear in your output.

Your output should ONLY contain the actual optimized learning plan that starts with "**LEARNING OBJECTIVE**" and follows the structure defined in the template.
</internal_instructions>

<thinking_protocol>
Before outputting the optimized prompt, engage in internal step-by-step thinking (do NOT include this thinking in your output):
${thinkingSteps}

This thinking process is for YOUR BENEFIT ONLY - do not include it in the final output.
</thinking_protocol>
${domainContentSection}
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
   * Get video prompt template
   * Uses research-based template optimized for 100-150 word outputs
   * @param {string} prompt - User's video concept
   * @returns {string} Formatted video prompt template
   * @private
   */
  getVideoPrompt(prompt) {
    return generateVideoPrompt(prompt);
  }

  /**
   * Get default optimization prompt template
   * @param {string} prompt - User's prompt to optimize
   * @param {Object} brainstormContext - Optional brainstorm context from Creative Brainstorm
   * @private
   */
  getDefaultPrompt(prompt, context = null, brainstormContext = null, domainContent = null) {
    const domain = this.detectDomainFromPrompt(prompt);
    const wordCount = prompt.split(/\s+/).length;

    // Log domain content usage
    if (domainContent) {
      logger.info('Stage 1 domain content available for default template', {
        technicalSpecCount: domainContent.technicalSpecs?.length || 0,
        antiPatternCount: domainContent.antiPatterns?.length || 0,
        successMetricCount: domainContent.successMetrics?.length || 0,
        constraintCount: domainContent.constraints?.length || 0,
      });
    }

    // Build domain content section if available
    let domainContentSection = '';
    if (domainContent && (domainContent.technicalSpecs?.length > 0 || domainContent.antiPatterns?.length > 0)) {
      domainContentSection = '\n\n**PRE-GENERATED DOMAIN-SPECIFIC OPTIMIZATION CONTENT:**';
      domainContentSection += '\nThe following domain-specific optimization elements have been generated for this prompt.';
      domainContentSection += '\nYou MUST incorporate these verbatim into the appropriate sections of your optimized prompt:\n';

      // Add technical specifications section
      if (domainContent.technicalSpecs?.length > 0) {
        domainContentSection += '\n**TECHNICAL SPECIFICATIONS (include these in your Requirements section):**\n';
        domainContent.technicalSpecs.forEach((spec, i) => {
          domainContentSection += `${i + 1}. ${spec}\n`;
        });
      }

      // Add anti-patterns section
      if (domainContent.antiPatterns?.length > 0) {
        domainContentSection += '\n**ANTI-PATTERNS TO AVOID (add an Anti-Patterns section with these):**\n';
        domainContent.antiPatterns.forEach((pattern, i) => {
          domainContentSection += `${i + 1}. ${pattern}\n`;
        });
      }

      // Add success metrics section
      if (domainContent.successMetrics?.length > 0) {
        domainContentSection += '\n**SUCCESS METRICS (include these in your Success Criteria section):**\n';
        domainContent.successMetrics.forEach((metric, i) => {
          domainContentSection += `${i + 1}. ${metric}\n`;
        });
      }

      // Add constraints section
      if (domainContent.constraints?.length > 0) {
        domainContentSection += '\n**CONSTRAINTS (add a Constraints section with these):**\n';
        domainContent.constraints.forEach((constraint, i) => {
          domainContentSection += `${i + 1}. ${constraint}\n`;
        });
      }

      domainContentSection += '\nIMPORTANT: These elements are already domain-specific and technically precise.';
      domainContentSection += ' Use them as provided - do not make them more generic.';
      domainContentSection += ' Your job is to assemble them into a well-structured optimized prompt.\n';
    } else if (context && Object.keys(context).some((k) => context[k])) {
      // Fallback to old context section if no domain content
      domainContentSection = '\n\n**USER-PROVIDED CONTEXT:**';
      domainContentSection += '\nThe user has specified these requirements that MUST be integrated into the optimized prompt:';

      if (context.specificAspects) {
        domainContentSection += `\n- **Focus Areas:** ${context.specificAspects}`;
      }
      if (context.backgroundLevel) {
        domainContentSection += `\n- **Target Audience Level:** ${context.backgroundLevel}`;
      }
      if (context.intendedUse) {
        domainContentSection += `\n- **Intended Use Case:** ${context.intendedUse}`;
      }

      domainContentSection += '\n\nEnsure these requirements are woven naturally into your optimized prompt.';
    }

    // Build brainstorm context section if provided
    const brainstormSection = brainstormContext?.elements
      ? this.buildBrainstormContextForTemplate(brainstormContext)
      : '';

    // Build transformation rules - SIMPLIFIED when domain content is available
    const hasDomainContent = domainContent && (domainContent.technicalSpecs?.length > 0 || domainContent.antiPatterns?.length > 0);

    const transformationRules = hasDomainContent
      ? `
1. **Extract the core objective** - What are they really trying to accomplish?
2. **Integrate pre-generated domain content** - Technical specs, anti-patterns, success metrics, and constraints have been pre-generated above. Include them in the appropriate sections of your optimized prompt.
   - Copy the TECHNICAL SPECIFICATIONS into your **Requirements** section
   - Copy the ANTI-PATTERNS into an **Anti-Patterns** or **What to Avoid** section
   - Copy the SUCCESS METRICS into your **Success Criteria** section
   - Copy the CONSTRAINTS into a **Constraints** section (if provided)
3. **Specificity Over Generality** - Replace any remaining vague terms with precise, measurable language
4. **Structure for Scannability** - Use clear hierarchy and formatting

IMPORTANT: The pre-generated optimization elements are already domain-specific. Do NOT make them more generic.`
      : brainstormSection
      ? `
1. **Extract the core objective** - What are they really trying to accomplish?
2. **Integrate user-provided context** - The user specified these key elements:
${brainstormSection}
Ensure these elements are naturally woven into the optimized prompt's GOAL, CONTEXT, and REQUIREMENTS sections.
3. **Specificity Over Generality** - Replace every vague term with precise, measurable language
4. **Structure for Scannability** - Use clear hierarchy and formatting
5. **Constraints as Guardrails** - Define boundaries to focus creativity
6. **Success Metrics** - Make quality measurable and objective
7. **Anti-patterns** - Explicitly state what to avoid`
      : `
1. **Extract the core objective** - What are they really trying to accomplish?
2. **Add sufficient background** - Provide context for standalone execution
3. **Specificity Over Generality** - Replace every vague term with precise, measurable language
4. **Structure for Scannability** - Use clear hierarchy and formatting
5. **Constraints as Guardrails** - Define boundaries to focus creativity
6. **Success Metrics** - Make quality measurable and objective
7. **Anti-patterns** - Explicitly state what to avoid`;

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
${domainContentSection}
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
When transforming the user's prompt:
${transformationRules}

Keep the final prompt focused, actionable, and production-ready. Every word should serve the goal of exceptional output.
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
   * Build brainstorm context for inline template injection
   * Creates a compact representation for transformation_process sections
   * @param {Object} brainstormContext - Context from Creative Brainstorm
   * @returns {string} Formatted context string for template injection
   * @private
   */
  buildBrainstormContextForTemplate(brainstormContext) {
    const { elements } = brainstormContext;

    const definedElements = Object.entries(elements).filter(([, value]) => {
      return typeof value === 'string' && value.trim().length > 0;
    });

    if (definedElements.length === 0) {
      return '';
    }

    const lines = definedElements.map(([key, value]) => {
      const label = this.formatBrainstormKey(key);
      return `   - ${label}: "${value}"`;
    });

    return lines.join('\n');
  }

  /**
   * Build brainstorm context addition for system prompt (DEPRECATED - use buildBrainstormContextForTemplate)
   * Incorporates user's Creative Brainstorm selections into optimization
   * @param {Object} brainstormContext - Context from Creative Brainstorm
   * @param {string} mode - Optimization mode (video, reasoning, research, etc.)
   * @private
   */
  buildBrainstormContextAddition(brainstormContext, mode = 'default') {
    const { elements } = brainstormContext;

    // Check if there are any defined elements
    const definedElements = Object.entries(elements).filter(([, value]) => {
      return typeof value === 'string' && value.trim().length > 0;
    });

    if (definedElements.length === 0) {
      return '';
    }

    const isVideoMode = mode === 'video';

    let addition = '\n\n**CRITICAL - User has provided these key elements from Creative Brainstorm:**\n';
    addition += 'You MUST incorporate these specific elements into your optimized prompt. ';
    addition += 'Use the exact wording where possible, or integrate them naturally:\n\n';

    // Map elements to generic labels for non-video modes
    const elementLabels = {
      subject: isVideoMode ? 'Subject/Character' : 'Main Subject/Focus',
      action: isVideoMode ? 'Action/Movement' : 'Key Action/Process',
      location: isVideoMode ? 'Location/Setting' : 'Context/Environment',
      time: isVideoMode ? 'Time/Lighting' : 'Timeframe/Period',
      mood: isVideoMode ? 'Mood/Tone' : 'Tone/Atmosphere',
      style: isVideoMode ? 'Visual Style' : 'Style/Approach',
      event: isVideoMode ? 'Key Event' : 'Key Event/Milestone'
    };

    const elementGuidance = {
      subject: isVideoMode 
        ? '→ This should be the central focus of your video description.' 
        : '→ This should be the central focus of the prompt.',
      action: isVideoMode 
        ? '→ Describe how the subject moves or what they are doing.' 
        : '→ Emphasize this action or process in the prompt.',
      location: isVideoMode 
        ? '→ Set the scene with this specific environment.' 
        : '→ Establish this context or setting in the prompt.',
      time: isVideoMode 
        ? '→ Incorporate this lighting quality and atmosphere.' 
        : '→ Consider this temporal aspect in the prompt.',
      mood: isVideoMode 
        ? '→ Convey this emotional quality throughout.' 
        : '→ Maintain this tone throughout the prompt.',
      style: isVideoMode 
        ? '→ Apply this aesthetic approach to the entire description.' 
        : '→ Apply this stylistic approach to the prompt.',
      event: isVideoMode 
        ? '→ Include this specific narrative moment.' 
        : '→ Include this key point or milestone.'
    };

    definedElements.forEach(([key, value]) => {
      const label = elementLabels[key] || this.formatBrainstormKey(key);
      const guidance = elementGuidance[key] || `→ Incorporate this into the prompt.`;
      
      addition += `**${label}:** ${value}\n`;
      addition += `${guidance}\n\n`;
    });

    addition += '**IMPORTANT:** These are the user\'s core creative choices. ';
    addition += 'Prioritize incorporating them over generic elements. ';
    addition += 'The optimized prompt should feel like a natural expansion of these user-defined elements.\n';

    return addition;
  }

  /**
   * Format brainstorm keys into human-readable labels
   * @private
   */
  formatBrainstormKey(key) {
    if (!key) {
      return '';
    }

    return key
      .toString()
      .replace(/([A-Z])/g, ' $1')
      .replace(/[_-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase());
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
   * @param {Object} brainstormContext - Context from Creative Brainstorm
   * @param {boolean} useConstitutionalAI - Whether to use Constitutional AI
   * @returns {Promise<Object>} Refined prompt with quality metrics
   */
  async optimizeIteratively(prompt, mode, context, brainstormContext, useConstitutionalAI) {
    let currentPrompt = prompt;
    let bestPrompt = prompt;
    let bestScore = 0;
    const maxIterations = 3;
    const improvements = [];

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      logger.info('Iterative refinement', { iteration, mode });

      // Optimize the current prompt
      const systemPrompt = this.buildSystemPrompt(currentPrompt, mode, context, brainstormContext);

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
