import { logger } from '../infrastructure/Logger.js';
import { cacheService } from './CacheService.js';
import { StructuredOutputEnforcer } from '../utils/StructuredOutputEnforcer.js';
import { TemperatureOptimizer } from '../utils/TemperatureOptimizer.js';

/**
 * Service for generating context-specific questions
 * Helps users provide better context for their prompts
 */
export class QuestionGenerationService {
  constructor(claudeClient) {
    this.claudeClient = claudeClient;
    this.cacheConfig = cacheService.getConfig('questionGeneration');
  }

  /**
   * Generate context questions for a prompt
   * @param {string} prompt - User's prompt
   * @returns {Promise<Object>} Questions object
   */
  async generateQuestions(prompt) {
    logger.info('Generating questions', { promptLength: prompt?.length });

    if (!prompt) {
      throw new Error('Prompt is required');
    }

    // Check cache first
    const cacheKey = cacheService.generateKey(this.cacheConfig.namespace, {
      prompt,
    });

    const cached = await cacheService.get(cacheKey, 'question-generation');
    if (cached) {
      logger.debug('Cache hit for question generation');
      return cached;
    }

    // Build system prompt
    const systemPrompt = this.buildSystemPrompt(prompt);

    // Define expected schema for validation
    const schema = {
      type: 'object',
      required: ['questions'],
      properties: {
        questions: {
          type: 'array',
          items: {
            required: ['id', 'title', 'description', 'field', 'examples'],
          },
        },
      },
    };

    // Get optimal temperature for question generation
    const temperature = TemperatureOptimizer.getOptimalTemperature('question-generation', {
      diversity: 'high',
      precision: 'medium',
    });

    // Call Claude API with structured output enforcement
    const questionsData = await StructuredOutputEnforcer.enforceJSON(
      this.claudeClient,
      systemPrompt,
      {
        schema,
        isArray: false, // Expecting object with 'questions' property
        maxTokens: 2048,
        maxRetries: 2,
        temperature,
      }
    );

    // Cache the result
    await cacheService.set(cacheKey, questionsData, {
      ttl: this.cacheConfig.ttl,
    });

    logger.info('Questions generated successfully', {
      questionCount: questionsData.questions?.length,
    });

    return questionsData;
  }

  /**
   * Build system prompt for question generation
   * @private
   */
  buildSystemPrompt(prompt) {
    return `You are an expert conversational AI specializing in eliciting high-quality context through strategic questioning. Your goal is to generate questions that dramatically improve prompt clarity and effectiveness.

<analysis_process>
First, deeply analyze the user's prompt:
1. **Domain & Topic**: What field or subject area is this about?
2. **Intent Classification**: Is this creative, analytical, technical, educational, or something else?
3. **Ambiguity Detection**: What key details are missing or unclear?
4. **Scope Assessment**: Is this broad or specific? Simple or complex?
5. **Implicit Assumptions**: What is the user assuming we know?
6. **Context Gaps**: What critical information would most improve output quality?

Then, craft questions that:
- Target the most impactful missing information
- Are tailored to the specific domain and intent
- Use natural, conversational language
- Provide diverse, realistic example answers
- Prioritize questions by information value (highest impact first)
</analysis_process>

User's initial prompt: "${prompt}"

Generate exactly 3 strategically chosen questions following this priority framework:

**Question 1 (Highest Impact)**: Target the single most critical missing detail, constraint, or specification that would most improve the output. This should be hyper-specific to the user's actual request, not generic.

**Question 2 (Audience Calibration)**: Understand who will consume this output and what their expertise level, background, or needs are. Tailor to the domain.

**Question 3 (Purpose & Context)**: Clarify the intended use case, desired outcome, or situational context that shapes how the output should be structured.

QUALITY CRITERIA FOR QUESTIONS:
✓ Directly address the specific content of the user's prompt (not generic)
✓ Cannot be answered with "yes/no" - require substantive answers
✓ Examples demonstrate the range and type of expected answers
✓ Natural phrasing (avoid jargon unless domain-appropriate)
✓ Each question unlocks meaningfully different information
✓ Descriptions clearly explain the value of asking

CRITICAL: Return ONLY valid JSON. No markdown code blocks, no explanations, no preamble. Start directly with the opening brace.

Required JSON schema:
{
  "questions": [
    {
      "id": 1,
      "title": "[Specific, contextual question tailored to the user's exact prompt]",
      "description": "[Concise explanation of why this specific question matters for THIS prompt]",
      "field": "specificAspects",
      "examples": [
        "[Realistic example answer 1]",
        "[Realistic example answer 2]",
        "[Realistic example answer 3]",
        "[Realistic example answer 4]"
      ]
    },
    {
      "id": 2,
      "title": "[Question about audience, expertise, or background, contextualized to this domain]",
      "description": "[Why knowing this helps tailor the output]",
      "field": "backgroundLevel",
      "examples": [
        "[Realistic level/audience 1]",
        "[Realistic level/audience 2]",
        "[Realistic level/audience 3]",
        "[Realistic level/audience 4]"
      ]
    },
    {
      "id": 3,
      "title": "[Question about purpose, use case, or outcome specific to this context]",
      "description": "[How understanding this shapes the response]",
      "field": "intendedUse",
      "examples": [
        "[Realistic use case 1]",
        "[Realistic use case 2]",
        "[Realistic use case 3]",
        "[Realistic use case 4]"
      ]
    }
  ]
}

Remember: Output ONLY the JSON object. Begin immediately with the opening brace.`;
  }
}
