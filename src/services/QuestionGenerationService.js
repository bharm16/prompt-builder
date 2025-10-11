import { logger } from '../infrastructure/Logger.js';
import { cacheService } from './CacheService.js';

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

    // Call Claude API
    const response = await this.claudeClient.complete(systemPrompt, {
      maxTokens: 2048,
    });

    // Parse response
    let questionsText = response.content[0].text;

    // Clean up response - remove markdown code blocks if present
    questionsText = questionsText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const questionsData = JSON.parse(questionsText);

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
    return `You are an expert at understanding user intent and generating relevant clarifying questions.

Given the user's initial prompt: "${prompt}"

Generate 3 highly relevant, context-specific questions that will help improve and clarify this prompt. The questions should:

1. Be directly relevant to the specific content and intent of the user's prompt
2. Help uncover important details, constraints, or preferences
3. Be natural and conversational
4. Include 3-4 example answers for each question

Return ONLY a valid JSON object in this exact format (no markdown, no code blocks, no explanations):

{
  "questions": [
    {
      "id": 1,
      "title": "Context-specific question about the main focus or key details?",
      "description": "Why this question matters for this specific prompt",
      "field": "specificAspects",
      "examples": [
        "Example answer 1",
        "Example answer 2",
        "Example answer 3",
        "Example answer 4"
      ]
    },
    {
      "id": 2,
      "title": "Question about audience, expertise level, or background?",
      "description": "Why this matters for tailoring the response",
      "field": "backgroundLevel",
      "examples": [
        "Example answer 1",
        "Example answer 2",
        "Example answer 3"
      ]
    },
    {
      "id": 3,
      "title": "Question about purpose, use case, or intended outcome?",
      "description": "Why understanding this helps",
      "field": "intendedUse",
      "examples": [
        "Example answer 1",
        "Example answer 2",
        "Example answer 3"
      ]
    }
  ]
}`;
  }
}
