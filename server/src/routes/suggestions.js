import express from 'express';
import { logger } from '@infrastructure/Logger';
import { LLMJudgeService } from '../services/quality-feedback/services/LLMJudgeService.js';

/**
 * Create suggestions route with dependency injection
 * @param {Object} aiService - AI Model Service instance
 * @returns {Router} Express router
 */
export function createSuggestionsRoute(aiService) {
  const router = express.Router();

  // Initialize LLM Judge Service
  const llmJudge = new LLMJudgeService(aiService);

/**
 * POST /api/suggestions/evaluate
 * 
 * Optional quality evaluation endpoint using LLM-as-a-Judge
 * 
 * Body:
 * {
 *   suggestions: Array<{text: string}>, // Suggestions to evaluate
 *   context: {
 *     highlightedText: string,           // Original text
 *     fullPrompt?: string,               // Full prompt (optional)
 *     isVideoPrompt?: boolean            // Video context flag
 *   },
 *   rubric?: 'video' | 'general'         // Optional rubric override
 * }
 * 
 * Response:
 * {
 *   evaluation: {
 *     overallScore: number (0-100),
 *     rubricScores: { criterionName: 1-5, ... },
 *     feedback: string[],
 *     strengths: string[],
 *     weaknesses: string[],
 *     detailedNotes: string,
 *     metadata: { ... }
 *   }
 * }
 */
router.post('/evaluate', async (req, res) => {
  const startTime = performance.now();
  
  try {
    const { suggestions, context, rubric } = req.body;

    // Validation
    if (!suggestions || !Array.isArray(suggestions) || suggestions.length === 0) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'suggestions must be a non-empty array',
      });
    }

    if (!context || !context.highlightedText) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'context.highlightedText is required',
      });
    }

    const operation = 'evaluateSuggestions';
    const requestId = req.id;
    
    logger.debug(`Starting ${operation}`, {
      operation,
      requestId,
      suggestionCount: suggestions.length,
      rubric: rubric || 'auto-detect',
      isVideoPrompt: context.isVideoPrompt,
    });

    // Perform evaluation
    const evaluation = await llmJudge.evaluateSuggestions({
      suggestions,
      context,
      rubricType: rubric,
    });

    const responseTime = Math.round(performance.now() - startTime);

    logger.info(`${operation} completed`, {
      operation,
      requestId,
      duration: responseTime,
      overallScore: evaluation.overallScore,
    });

    res.json({
      evaluation,
      responseTime,
    });
  } catch (error) {
    const responseTime = Math.round(performance.now() - startTime);
    const operation = 'evaluateSuggestions';
    const requestId = req.id;
    
    logger.error(`${operation} failed`, error as Error, {
      operation,
      requestId,
      duration: responseTime,
    });

    res.status(500).json({
      error: 'Evaluation failed',
      message: error.message,
      responseTime,
    });
  }
});

/**
 * POST /api/suggestions/evaluate/single
 * 
 * Evaluate a single suggestion in detail
 * 
 * Body:
 * {
 *   suggestion: string,
 *   context: { ... },
 *   rubric?: 'video' | 'general'
 * }
 */
router.post('/evaluate/single', async (req, res) => {
  const startTime = performance.now();
  
  try {
    const { suggestion, context, rubric } = req.body;

    if (!suggestion || typeof suggestion !== 'string') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'suggestion must be a string',
      });
    }

    if (!context || !context.highlightedText) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'context.highlightedText is required',
      });
    }

    const operation = 'evaluateSingleSuggestion';
    const requestId = req.id;
    
    logger.debug(`Starting ${operation}`, {
      operation,
      requestId,
      suggestionLength: suggestion.length,
      rubric: rubric || 'auto-detect',
    });

    const evaluation = await llmJudge.evaluateSingleSuggestion(
      suggestion,
      context,
      rubric
    );

    const responseTime = Math.round(performance.now() - startTime);
    const operation = 'evaluateSingleSuggestion';
    const requestId = req.id;

    logger.info(`${operation} completed`, {
      operation,
      requestId,
      duration: responseTime,
      overallScore: evaluation.overallScore,
    });

    res.json({
      evaluation,
      responseTime,
    });
  } catch (error) {
    const responseTime = Math.round(performance.now() - startTime);
    
    logger.error('Single suggestion evaluation failed', {
      error: error.message,
      responseTime,
    });

    res.status(500).json({
      error: 'Evaluation failed',
      message: error.message,
      responseTime,
    });
  }
});

/**
 * POST /api/suggestions/evaluate/compare
 * 
 * Compare two sets of suggestions
 * 
 * Body:
 * {
 *   setA: Array<{text: string}>,
 *   setB: Array<{text: string}>,
 *   context: { ... },
 *   rubric?: 'video' | 'general'
 * }
 * 
 * Response:
 * {
 *   comparison: {
 *     setA: { evaluation... },
 *     setB: { evaluation... },
 *     winner: 'A' | 'B' | 'TIE',
 *     scoreDifference: number,
 *     criteriaComparison: { ... }
 *   }
 * }
 */
router.post('/evaluate/compare', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { setA, setB, context, rubric } = req.body;

    if (!Array.isArray(setA) || !Array.isArray(setB)) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'setA and setB must be arrays',
      });
    }

    if (!context || !context.highlightedText) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'context.highlightedText is required',
      });
    }

    const operation = 'compareSuggestionSets';
    const requestId = req.id;
    
    logger.debug(`Starting ${operation}`, {
      operation,
      requestId,
      setACount: setA.length,
      setBCount: setB.length,
    });

    const comparison = await llmJudge.compareSuggestionSets(
      setA,
      setB,
      context,
      rubric
    );

    const responseTime = Math.round(performance.now() - startTime);
    const operation = 'compareSuggestionSets';
    const requestId = req.id;

    logger.info(`${operation} completed`, {
      operation,
      requestId,
      duration: responseTime,
      winner: comparison.winner,
      scoreDifference: comparison.scoreDifference,
    });

    res.json({
      comparison,
      responseTime,
    });
  } catch (error) {
    const responseTime = Math.round(performance.now() - startTime);
    
    logger.error('Comparison evaluation failed', {
      error: error.message,
      responseTime,
    });

    res.status(500).json({
      error: 'Evaluation failed',
      message: error.message,
      responseTime,
    });
  }
});

/**
 * GET /api/suggestions/evaluate/rubrics
 * 
 * Get available rubric definitions
 * 
 * Response:
 * {
 *   rubrics: {
 *     video: { ... },
 *     general: { ... }
 *   }
 * }
 */
router.get('/rubrics', (req, res) => {
  const { VIDEO_RUBRIC, GENERAL_RUBRIC } = require('../services/quality-feedback/config/judgeRubrics.js');
  
  res.json({
    rubrics: {
      video: VIDEO_RUBRIC,
      general: GENERAL_RUBRIC,
    },
  });
});

  return router;
}

