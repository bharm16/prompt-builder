import type { Request, Response } from 'express';
import { logger } from '@infrastructure/Logger';
import { extractUserId } from '@utils/requestHelpers';
import type { SuggestionsServices } from './serviceFactory';
import {
  validateCompareRequest,
  validateEvaluateRequest,
  validateSingleEvaluationRequest,
} from './validators';
import { loadRubrics } from './rubrics';

export interface SuggestionsHandlers {
  evaluate: (req: Request, res: Response) => Promise<Response | void>;
  evaluateSingle: (req: Request, res: Response) => Promise<Response | void>;
  compare: (req: Request, res: Response) => Promise<Response | void>;
  getRubrics: (req: Request, res: Response) => Response | void;
}

export function createSuggestionsHandlers({
  llmJudge,
}: SuggestionsServices): SuggestionsHandlers {
  return {
    async evaluate(req, res) {
      const startTime = performance.now();
      const validation = validateEvaluateRequest(req.body);

      if (!validation.ok) {
        return res.status(validation.status).json({
          error: validation.error,
          message: validation.message,
        });
      }

      const { suggestions, context, rubric } = validation.data;
      const resolvedRubric = rubric === 'general' || rubric === 'video' ? rubric : undefined;
      const operation = 'evaluateSuggestions';
      const requestId = req.id;
      const userId = extractUserId(req);

      logger.debug('Starting operation.', {
        operation,
        requestId,
        userId,
        suggestionCount: suggestions.length,
        rubric: resolvedRubric || 'auto-detect',
        isVideoPrompt: context.isVideoPrompt,
      });

      try {
        const evaluation = await llmJudge.evaluateSuggestions({
          suggestions,
          context,
          ...(resolvedRubric ? { rubricType: resolvedRubric } : {}),
        });

        const responseTime = Math.round(performance.now() - startTime);

        logger.info('Operation completed.', {
          operation,
          requestId,
          userId,
          duration: responseTime,
          overallScore: evaluation.overallScore,
        });

        return res.json({
          evaluation,
          responseTime,
        });
      } catch (error: any) {
        const responseTime = Math.round(performance.now() - startTime);
        logger.error(
          'Operation failed.',
          error instanceof Error ? error : new Error(String(error)),
          {
            operation,
            requestId,
            duration: responseTime,
          }
        );

        return res.status(500).json({
          error: 'Evaluation failed',
          message: error.message,
          responseTime,
        });
      }
    },

    async evaluateSingle(req, res) {
      const startTime = performance.now();
      const operation = 'evaluateSingleSuggestion';
      const requestId = req.id;
      const userId = extractUserId(req);

      const validation = validateSingleEvaluationRequest(req.body);
      if (!validation.ok) {
        return res.status(validation.status).json({
          error: validation.error,
          message: validation.message,
        });
      }

      const { suggestion, context, rubric } = validation.data;
      const resolvedRubric = rubric === 'general' || rubric === 'video' ? rubric : undefined;

      try {
        logger.debug('Starting operation.', {
          operation,
          requestId,
          userId,
          suggestionLength: suggestion.length,
          rubric: resolvedRubric || 'auto-detect',
        });

        const evaluation = await llmJudge.evaluateSingleSuggestion(
          suggestion,
          context,
          resolvedRubric
        );

        const responseTime = Math.round(performance.now() - startTime);

        logger.info('Operation completed.', {
          operation,
          requestId,
          userId,
          duration: responseTime,
          overallScore: evaluation.overallScore,
        });

        return res.json({
          evaluation,
          responseTime,
        });
      } catch (error: any) {
        const responseTime = Math.round(performance.now() - startTime);

        logger.error(
          'Operation failed.',
          error instanceof Error ? error : new Error(String(error)),
          {
            operation,
            requestId,
            userId,
            duration: responseTime,
          }
        );

        return res.status(500).json({
          error: 'Evaluation failed',
          message: error.message,
          responseTime,
        });
      }
    },

    async compare(req, res) {
      const startTime = performance.now();
      const operation = 'compareSuggestionSets';
      const requestId = req.id;

      const validation = validateCompareRequest(req.body);
      if (!validation.ok) {
        return res.status(validation.status).json({
          error: validation.error,
          message: validation.message,
        });
      }

      const { setA, setB, context, rubric } = validation.data;
      const resolvedRubric = rubric === 'general' || rubric === 'video' ? rubric : undefined;

      try {
        logger.debug('Starting operation.', {
          operation,
          requestId,
          setACount: setA.length,
          setBCount: setB.length,
        });

        const comparison = await llmJudge.compareSuggestionSets(
          setA,
          setB,
          context,
          resolvedRubric
        );

        const responseTime = Math.round(performance.now() - startTime);

        logger.info('Operation completed.', {
          operation,
          requestId,
          duration: responseTime,
          winner: comparison.winner,
          scoreDifference: comparison.scoreDifference,
        });

        return res.json({
          comparison,
          responseTime,
        });
      } catch (error: any) {
        const responseTime = Math.round(performance.now() - startTime);

        logger.error(
          'Operation failed.',
          error instanceof Error ? error : new Error(String(error)),
          {
            operation,
            requestId,
            duration: responseTime,
          }
        );

        return res.status(500).json({
          error: 'Evaluation failed',
          message: error.message,
          responseTime,
        });
      }
    },

    getRubrics(req, res) {
      const requestId = req.id;
      const operation = 'getRubrics';

      logger.debug('Rubrics request received', {
        operation,
        requestId,
      });

      const rubrics = loadRubrics();

      return res.json({
        rubrics,
      });
    },
  };
}
