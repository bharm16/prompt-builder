/**
 * LLMJudgeService Tests
 * 
 * Tests PDF Section 5.3 implementation: LLM-as-a-Judge evaluation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LLMJudgeService } from '../../../server/src/services/quality-feedback/services/LLMJudgeService.js';

describe('LLMJudgeService', () => {
  let judgeService;
  let mockAiService;

  beforeEach(() => {
    mockAiService = {
      execute: vi.fn(),
    };
    judgeService = new LLMJudgeService(mockAiService);
  });

  describe('evaluateSuggestions', () => {
    it('should evaluate video prompt suggestions', async () => {
      const mockEvaluation = {
        rubricScores: {
          cinematicQuality: 4,
          visualGrounding: 5,
          safety: 5,
          diversity: 3,
        },
        feedback: ['Good technical terminology'],
        strengths: ['Strong visual descriptions'],
        weaknesses: ['Could be more diverse'],
        detailedNotes: 'Overall solid suggestions',
      };

      // Mock StructuredOutputEnforcer (via aiService)
      mockAiService.execute.mockResolvedValue({
        content: [{ text: JSON.stringify(mockEvaluation) }],
      });

      const result = await judgeService.evaluateSuggestions({
        suggestions: [
          { text: 'Wide shot, 35mm anamorphic lens' },
          { text: 'Close-up with shallow depth of field' },
        ],
        context: {
          highlightedText: 'camera shot',
          isVideoPrompt: true,
        },
        rubricType: 'video',
      });

      expect(result).toHaveProperty('overallScore');
      expect(result).toHaveProperty('rubricScores');
      expect(result).toHaveProperty('metadata');
      expect(result.metadata.rubricUsed).toBe('video_prompt_evaluation');
    });

    it('should evaluate general text suggestions', async () => {
      const mockEvaluation = {
        rubricScores: {
          coherence: 4,
          specificity: 4,
          usefulness: 5,
          diversity: 3,
        },
        feedback: ['Clear improvements'],
        strengths: ['Good coherence'],
        weaknesses: [],
        detailedNotes: 'Quality suggestions',
      };

      mockAiService.execute.mockResolvedValue({
        content: [{ text: JSON.stringify(mockEvaluation) }],
      });

      const result = await judgeService.evaluateSuggestions({
        suggestions: [
          { text: 'The report analyzes market trends' },
          { text: 'The study examines consumer behavior' },
        ],
        context: {
          highlightedText: 'the document',
          isVideoPrompt: false,
        },
        rubricType: 'general',
      });

      expect(result).toHaveProperty('overallScore');
      expect(result.metadata.rubricUsed).toBe('general_text_evaluation');
    });

    it('should auto-detect rubric type from context', async () => {
      const mockEvaluation = {
        rubricScores: { cinematicQuality: 4, visualGrounding: 4, safety: 5, diversity: 3 },
        feedback: [],
        strengths: [],
        weaknesses: [],
        detailedNotes: '',
      };

      mockAiService.execute.mockResolvedValue({
        content: [{ text: JSON.stringify(mockEvaluation) }],
      });

      const result = await judgeService.evaluateSuggestions({
        suggestions: [{ text: 'test' }],
        context: {
          highlightedText: 'test',
          isVideoPrompt: true,
        },
        // No rubricType specified - should auto-detect as 'video'
      });

      expect(result.metadata.rubricUsed).toBe('video_prompt_evaluation');
    });

    it('should return fallback evaluation on error', async () => {
      mockAiService.execute.mockRejectedValue(new Error('API failure'));

      const result = await judgeService.evaluateSuggestions({
        suggestions: [{ text: 'test' }],
        context: {
          highlightedText: 'test',
          isVideoPrompt: false,
        },
      });

      expect(result.overallScore).toBe(60);
      expect(result.metadata.fallback).toBe(true);
      expect(result.feedback).toContain('Unable to complete automated evaluation');
    });

    it('should include evaluation time in metadata', async () => {
      const mockEvaluation = {
        rubricScores: { coherence: 4, specificity: 4, usefulness: 4, diversity: 3 },
        feedback: [],
        strengths: [],
        weaknesses: [],
        detailedNotes: '',
      };

      mockAiService.execute.mockResolvedValue({
        content: [{ text: JSON.stringify(mockEvaluation) }],
      });

      const result = await judgeService.evaluateSuggestions({
        suggestions: [{ text: 'test' }],
        context: { highlightedText: 'test' },
      });

      expect(result.metadata).toHaveProperty('evaluationTime');
      expect(typeof result.metadata.evaluationTime).toBe('number');
    });
  });

  describe('evaluateSingleSuggestion', () => {
    it('should evaluate a single suggestion', async () => {
      const mockEvaluation = {
        rubricScores: { coherence: 5, specificity: 4, usefulness: 5, diversity: 3 },
        feedback: [],
        strengths: [],
        weaknesses: [],
        detailedNotes: '',
      };

      mockAiService.execute.mockResolvedValue({
        content: [{ text: JSON.stringify(mockEvaluation) }],
      });

      const result = await judgeService.evaluateSingleSuggestion(
        'The report clearly articulates the findings',
        { highlightedText: 'the document' },
        'general'
      );

      expect(result).toHaveProperty('overallScore');
      expect(result).toHaveProperty('rubricScores');
    });
  });

  describe('compareSuggestionSets', () => {
    it('should compare two sets and determine winner', async () => {
      // Mock evaluations for both sets
      const evalA = {
        rubricScores: { coherence: 5, specificity: 5, usefulness: 5, diversity: 4 },
        feedback: [],
        strengths: [],
        weaknesses: [],
        detailedNotes: '',
      };

      const evalB = {
        rubricScores: { coherence: 3, specificity: 3, usefulness: 3, diversity: 2 },
        feedback: [],
        strengths: [],
        weaknesses: [],
        detailedNotes: '',
      };

      mockAiService.execute
        .mockResolvedValueOnce({ content: [{ text: JSON.stringify(evalA) }] })
        .mockResolvedValueOnce({ content: [{ text: JSON.stringify(evalB) }] });

      const comparison = await judgeService.compareSuggestionSets(
        [{ text: 'High quality A' }],
        [{ text: 'Lower quality B' }],
        { highlightedText: 'test' },
        'general'
      );

      expect(comparison).toHaveProperty('setA');
      expect(comparison).toHaveProperty('setB');
      expect(comparison).toHaveProperty('winner');
      expect(comparison).toHaveProperty('scoreDifference');
      expect(comparison).toHaveProperty('criteriaComparison');
      expect(comparison.winner).toBe('A'); // Set A should win with higher scores
    });

    it('should detect tie when scores are equal', async () => {
      const evalSame = {
        rubricScores: { coherence: 4, specificity: 4, usefulness: 4, diversity: 3 },
        feedback: [],
        strengths: [],
        weaknesses: [],
        detailedNotes: '',
      };

      mockAiService.execute
        .mockResolvedValueOnce({ content: [{ text: JSON.stringify(evalSame) }] })
        .mockResolvedValueOnce({ content: [{ text: JSON.stringify(evalSame) }] });

      const comparison = await judgeService.compareSuggestionSets(
        [{ text: 'Set A' }],
        [{ text: 'Set B' }],
        { highlightedText: 'test' },
        'general'
      );

      expect(comparison.winner).toBe('TIE');
      expect(comparison.scoreDifference).toBe(0);
    });

    it('should provide per-criterion comparison', async () => {
      const evalA = {
        rubricScores: { coherence: 5, specificity: 4, usefulness: 5, diversity: 3 },
        feedback: [],
        strengths: [],
        weaknesses: [],
        detailedNotes: '',
      };

      const evalB = {
        rubricScores: { coherence: 3, specificity: 5, usefulness: 4, diversity: 4 },
        feedback: [],
        strengths: [],
        weaknesses: [],
        detailedNotes: '',
      };

      mockAiService.execute
        .mockResolvedValueOnce({ content: [{ text: JSON.stringify(evalA) }] })
        .mockResolvedValueOnce({ content: [{ text: JSON.stringify(evalB) }] });

      const comparison = await judgeService.compareSuggestionSets(
        [{ text: 'Set A' }],
        [{ text: 'Set B' }],
        { highlightedText: 'test' },
        'general'
      );

      expect(comparison.criteriaComparison.coherence.winner).toBe('A');
      expect(comparison.criteriaComparison.specificity.winner).toBe('B');
    });
  });

  describe('_buildJudgePrompt', () => {
    it('should build prompt with rubric criteria', () => {
      const suggestions = [
        { text: 'Suggestion 1' },
        { text: 'Suggestion 2' },
      ];

      const context = {
        highlightedText: 'test',
        isVideoPrompt: true,
      };

      const { VIDEO_RUBRIC } = await import('../../../server/src/services/quality-feedback/config/judgeRubrics.js');
      
      const prompt = judgeService._buildJudgePrompt(suggestions, context, VIDEO_RUBRIC);

      expect(prompt).toContain('Suggestion 1');
      expect(prompt).toContain('Suggestion 2');
      expect(prompt).toContain('cinematicQuality');
      expect(prompt).toContain('visualGrounding');
      expect(prompt).toContain('safety');
      expect(prompt).toContain('diversity');
      expect(prompt).toContain('VIDEO PROMPT');
    });
  });

  describe('_getEvaluationSchema', () => {
    it('should generate schema from rubric', async () => {
      const { VIDEO_RUBRIC } = await import('../../../server/src/services/quality-feedback/config/judgeRubrics.js');
      
      const schema = judgeService._getEvaluationSchema(VIDEO_RUBRIC);

      expect(schema.type).toBe('object');
      expect(schema.properties).toHaveProperty('rubricScores');
      expect(schema.properties).toHaveProperty('feedback');
      expect(schema.properties).toHaveProperty('strengths');
      expect(schema.properties.rubricScores.properties).toHaveProperty('cinematicQuality');
    });
  });
});

