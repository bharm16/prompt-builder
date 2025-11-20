import { logger } from '../../infrastructure/Logger.js';
import { cacheService } from '../cache/CacheService.js';
import { StructuredOutputEnforcer } from '../../utils/StructuredOutputEnforcer.js';
import { TemperatureOptimizer } from '../../utils/TemperatureOptimizer.js';

import { PromptAnalyzer } from './services/PromptAnalyzer.js';
import { QuestionScorer } from './services/QuestionScorer.js';
import {
  buildQuestionGenerationPrompt,
  buildFollowUpPrompt,
  QUESTION_SCHEMA,
} from './config/promptTemplate.js';

/**
 * QuestionGenerationService - Main orchestrator for question generation
 * 
 * Helps users improve their prompts by generating context-specific questions.
 * Coordinates prompt analysis, question generation, and relevance scoring.
 */
export class QuestionGenerationService {
  constructor(aiService) {
    this.ai = aiService;
    this.cacheConfig = cacheService.getConfig('questionGeneration');
    
    // Initialize specialized services
    this.promptAnalyzer = new PromptAnalyzer();
    this.questionScorer = new QuestionScorer();
  }

  /**
   * Generate context questions for a prompt
   * @param {string} prompt - User's prompt
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Questions object with ranked questions
   */
  async generateQuestions(prompt, options = {}) {
    logger.info('Generating questions', { promptLength: prompt?.length });

    if (!prompt) {
      throw new Error('Prompt is required');
    }

    // Determine optimal question count based on prompt complexity
    const questionCount = options.count || await this.promptAnalyzer.determineQuestionCount(prompt);
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

    // Build system prompt
    const systemPrompt = buildQuestionGenerationPrompt(prompt, questionCount);

    // Get optimal temperature
    const temperature = TemperatureOptimizer.getOptimalTemperature('question-generation', {
      diversity: 'high',
      precision: 'medium',
    });

    // Call AI service with structured output enforcement
    const questionsData = await StructuredOutputEnforcer.enforceJSON(
      this.ai,
      systemPrompt,
      {
        schema: QUESTION_SCHEMA,
        isArray: false,
        maxTokens: 2048,
        maxRetries: 2,
        temperature,
        operation: 'question_generation', // Route through aiService
      }
    );

    // Apply relevance scoring to rank questions
    if (questionsData.questions) {
      questionsData.questions = await this.questionScorer.rankQuestionsByRelevance(
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
   * Generate follow-up questions based on previous answers
   * @param {string} prompt - Original prompt
   * @param {Object} previousAnswers - Answers to previous questions
   * @returns {Promise<Array>} Follow-up questions
   */
  async generateFollowUpQuestions(prompt, previousAnswers) {
    const followUpPrompt = buildFollowUpPrompt(prompt, previousAnswers);

    try {
      const response = await this.ai.execute('question_generation', {
        systemPrompt: followUpPrompt,
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
}

// Export singleton instance
export const questionGenerationService = new QuestionGenerationService();

