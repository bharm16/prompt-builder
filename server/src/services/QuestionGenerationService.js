import { logger } from '../infrastructure/Logger.js';
import { cacheService } from './cache/CacheService.js';
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
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Questions object
   */
  async generateQuestions(prompt, options = {}) {
    logger.info('Generating questions', { promptLength: prompt?.length });

    if (!prompt) {
      throw new Error('Prompt is required');
    }

    // Determine optimal question count based on prompt complexity
    const questionCount = options.count || await this.determineQuestionCount(prompt);
    logger.info('Determined question count', { count: questionCount });

    // Check cache first
    const cacheKey = cacheService.generateKey(this.cacheConfig.namespace, {
      prompt,
      questionCount,
    });

    const cached = await cacheService.get(cacheKey, 'question-generation');
    if (cached) {
      logger.debug('Cache hit for question generation');
      return cached;
    }

    // Build system prompt with dynamic question count
    const systemPrompt = this.buildSystemPrompt(prompt, questionCount);

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

    // Apply relevance scoring to rank questions
    if (questionsData.questions) {
      questionsData.questions = await this.rankQuestionsByRelevance(
        questionsData.questions,
        prompt
      );
    }

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
  buildSystemPrompt(prompt, questionCount = 3) {
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

Generate exactly ${questionCount} strategically chosen questions following this priority framework:

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

  /**
   * Determine optimal question count based on prompt complexity
   * @param {string} prompt - The prompt to analyze
   * @returns {Promise<number>} Recommended number of questions
   */
  async determineQuestionCount(prompt) {
    // Calculate complexity factors
    const complexity = await this.assessComplexity(prompt);
    const ambiguity = await this.measureAmbiguity(prompt);

    logger.debug('Prompt assessment', { complexity, ambiguity });

    // More questions for complex/ambiguous prompts
    if (complexity > 0.7 || ambiguity > 0.6) return 5;
    if (complexity > 0.4 || ambiguity > 0.4) return 3;
    return 2; // Simple, clear prompts need fewer questions
  }

  /**
   * Assess complexity of a prompt
   * @private
   */
  async assessComplexity(prompt) {
    const factors = {
      length: Math.min(prompt.length / 500, 1), // Longer prompts often more complex
      technicalTerms: this.countTechnicalTerms(prompt) / 10,
      multiPart: (prompt.match(/\band\b|\bor\b|\balso\b/gi) || []).length / 5,
      questions: (prompt.match(/\?/g) || []).length / 3,
    };

    // Weight the factors
    const complexity =
      factors.length * 0.2 +
      factors.technicalTerms * 0.3 +
      factors.multiPart * 0.25 +
      factors.questions * 0.25;

    return Math.min(complexity, 1);
  }

  /**
   * Measure ambiguity in a prompt
   * @private
   */
  async measureAmbiguity(prompt) {
    const ambiguousTerms = [
      'something', 'stuff', 'things', 'some', 'various', 'certain',
      'appropriate', 'relevant', 'proper', 'good', 'best', 'optimal',
      'nice', 'cool', 'interesting', 'useful', 'helpful',
    ];

    const vaguePattern = /\b(help|create|make|do|build|write)\b(?!\s+\w+\s+\w+)/gi;
    const missingSpecifics = /\b(for|about|regarding|concerning)\s+(a|an|the|some)\s+\w+$/gi;

    let ambiguityScore = 0;

    // Check for ambiguous terms
    ambiguousTerms.forEach(term => {
      if (prompt.toLowerCase().includes(term)) ambiguityScore += 0.1;
    });

    // Check for vague patterns
    const vagueMatches = prompt.match(vaguePattern) || [];
    ambiguityScore += vagueMatches.length * 0.15;

    // Check for missing specifics
    const missingMatches = prompt.match(missingSpecifics) || [];
    ambiguityScore += missingMatches.length * 0.2;

    return Math.min(ambiguityScore, 1);
  }

  /**
   * Count technical terms in prompt
   * @private
   */
  countTechnicalTerms(prompt) {
    const technicalPatterns = [
      /\bAPI\b/gi, /\bSDK\b/gi, /\bSQL\b/gi, /\bJSON\b/gi,
      /\balgorithm/gi, /\bframework/gi, /\bdatabase/gi,
      /\barchitecture/gi, /\bimplementation/gi, /\boptimization/gi,
    ];

    let count = 0;
    technicalPatterns.forEach(pattern => {
      const matches = prompt.match(pattern) || [];
      count += matches.length;
    });

    return count;
  }

  /**
   * Generate follow-up questions based on previous answers
   * @param {string} prompt - Original prompt
   * @param {Object} previousAnswers - Answers to previous questions
   * @returns {Promise<Array>} Follow-up questions
   */
  async generateFollowUpQuestions(prompt, previousAnswers) {
    const followUpPrompt = `Based on the original prompt and the user's previous answers, generate 1-2 follow-up questions that dig deeper or clarify remaining ambiguities.

Original prompt: "${prompt}"

Previous answers provided:
${JSON.stringify(previousAnswers, null, 2)}

Generate follow-up questions that:
1. Build on the information already provided
2. Explore edge cases or exceptions
3. Clarify any remaining ambiguities
4. Connect different aspects mentioned

Return ONLY a JSON array of questions:
[
  {
    "id": 1,
    "title": "specific follow-up question",
    "description": "why this matters given previous answers",
    "field": "followUp1",
    "examples": ["example 1", "example 2", "example 3"]
  }
]`;

    try {
      const response = await this.claudeClient.complete(followUpPrompt, {
        maxTokens: 1024,
        temperature: 0.7,
      });

      const questions = JSON.parse(response.content[0].text);
      return questions;
    } catch (error) {
      logger.warn('Failed to generate follow-up questions', { error });
      return [];
    }
  }

  /**
   * Score question relevance to the prompt
   * @param {Object} question - Question object
   * @param {string} prompt - Original prompt
   * @returns {Promise<number>} Relevance score (0-1)
   */
  async scoreQuestionRelevance(question, prompt) {
    // Calculate multiple relevance factors
    const factors = {
      ambiguityReduction: await this.measureAmbiguityReduction(question, prompt),
      informationGain: await this.calculateInfoGain(question, prompt),
      userEffort: await this.estimateAnswerEffort(question),
      criticalityScore: await this.assessCriticality(question, prompt),
    };

    // Weight factors and return composite score
    const score =
      factors.ambiguityReduction * 0.35 +
      factors.informationGain * 0.35 +
      (1 - factors.userEffort) * 0.15 +
      factors.criticalityScore * 0.15;

    return Math.min(Math.max(score, 0), 1);
  }

  /**
   * Measure how much a question reduces ambiguity
   * @private
   */
  async measureAmbiguityReduction(question, prompt) {
    // Simple heuristic: questions about specifics reduce more ambiguity
    const specificityKeywords = ['exactly', 'specific', 'particular', 'precise', 'which'];
    let score = 0;

    specificityKeywords.forEach(keyword => {
      if (question.title.toLowerCase().includes(keyword)) score += 0.2;
    });

    // Questions with examples typically reduce ambiguity
    if (question.examples && question.examples.length > 3) score += 0.3;

    return Math.min(score, 1);
  }

  /**
   * Calculate information gain from a question
   * @private
   */
  async calculateInfoGain(question, prompt) {
    // Questions about missing elements have high info gain
    const promptLower = prompt.toLowerCase();
    const questionLower = question.title.toLowerCase();

    let score = 0;

    // Check if question addresses something not in prompt
    const questionKeywords = questionLower.split(/\s+/);
    questionKeywords.forEach(keyword => {
      if (keyword.length > 4 && !promptLower.includes(keyword)) {
        score += 0.1;
      }
    });

    // Questions with clear structure have higher info gain
    if (question.description && question.description.length > 50) score += 0.2;

    return Math.min(score, 1);
  }

  /**
   * Estimate effort required to answer a question
   * @private
   */
  async estimateAnswerEffort(question) {
    let effort = 0;

    // Open-ended questions require more effort
    if (question.title.includes('describe') || question.title.includes('explain')) {
      effort += 0.3;
    }

    // Questions requiring lists or multiple items
    if (question.title.includes('list') || question.title.includes('all')) {
      effort += 0.2;
    }

    // Questions with many examples are easier to answer
    if (question.examples && question.examples.length >= 4) {
      effort -= 0.2;
    }

    return Math.min(Math.max(effort, 0), 1);
  }

  /**
   * Assess how critical a question is for the task
   * @private
   */
  async assessCriticality(question, prompt) {
    // Questions about constraints and requirements are critical
    const criticalTerms = ['must', 'require', 'constrain', 'limit', 'restrict', 'need'];
    let score = 0;

    criticalTerms.forEach(term => {
      if (question.title.toLowerCase().includes(term)) score += 0.2;
    });

    // First question is typically most critical (by design)
    if (question.id === 1) score += 0.3;

    return Math.min(score, 1);
  }

  /**
   * Rank questions by relevance scores
   * @param {Array} questions - Array of questions
   * @param {string} prompt - Original prompt
   * @returns {Promise<Array>} Ranked questions
   */
  async rankQuestionsByRelevance(questions, prompt) {
    // Score all questions
    const scoredQuestions = await Promise.all(
      questions.map(async (question) => ({
        ...question,
        relevanceScore: await this.scoreQuestionRelevance(question, prompt),
      }))
    );

    // Sort by relevance score (descending)
    return scoredQuestions.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }
}
