/**
 * @test {RobustLlmClient}
 * @description Comprehensive tests for Robust LLM Client with two-pass architecture
 * 
 * This test demonstrates:
 * - Two-pass architecture detection (GPT-4o-mini + complex schema)
 * - Pass 1: Free-text reasoning
 * - Pass 2: JSON structuring
 * - Token allocation (60% reasoning, 40% structuring)
 * - Single-pass for GPT-4o or simple schemas
 * - Model detection logic
 * 
 * Pattern: TypeScript test with typed mocks
 */

import { describe, it, expect, vi, beforeEach, afterEach, type MockedFunction } from 'vitest';
import { RobustLlmClient } from '../RobustLlmClient';
import { SubstringPositionCache } from '../../cache/SubstringPositionCache';
import type { AIService } from '../../../../services/ai-model/AIModelService';
import type { LabelSpansParams, LabelSpansResult } from '../../types';

// Mock dependencies
vi.mock('../../utils/policyUtils', () => ({
  sanitizePolicy: vi.fn((p) => p || {}),
  sanitizeOptions: vi.fn((o) => o || {}),
  buildTaskDescription: vi.fn((maxSpans, policy) => `Identify up to ${maxSpans} spans`),
}));

vi.mock('../../utils/jsonUtils', () => ({
  parseJson: vi.fn((text) => {
    try {
      return { ok: true, value: JSON.parse(text) };
    } catch {
      return { ok: false, error: 'Invalid JSON' };
    }
  }),
  buildUserPayload: vi.fn((payload) => JSON.stringify(payload)),
}));

vi.mock('../../validation/SchemaValidator', () => ({
  validateSchemaOrThrow: vi.fn(),
}));

vi.mock('../../validation/SpanValidator', () => ({
  validateSpans: vi.fn((params) => ({
    ok: true,
    result: {
      spans: params.spans || [],
      meta: params.meta || { version: 'v1', notes: '' },
      isAdversarial: params.isAdversarial || false,
    },
  })),
}));

vi.mock('../../utils/promptBuilder', () => ({
  buildSystemPrompt: vi.fn((text, useRouter) => '# System Prompt\nLabel spans.'),
  BASE_SYSTEM_PROMPT: '# System Prompt\nLabel spans.',
}));

vi.mock('../../config/SpanLabelingConfig', () => {
  const estimateMaxTokens = (maxSpans: number) => 400 + (maxSpans * 25);
  return {
    default: {
      DEFAULT_OPTIONS: {
        maxSpans: 10,
        minConfidence: 0.5,
        templateVersion: 'v1',
      },
      PERFORMANCE: {
        TOKEN_ESTIMATION_BASE: 400,
        TOKEN_ESTIMATION_PER_SPAN: 25,
        MAX_TOKEN_RESPONSE_LIMIT: 4000,
      },
      NLP_FAST_PATH: {
        TRACK_METRICS: false,
        ENABLED: false,
      },
      estimateMaxTokens,
    },
  };
});

describe('RobustLlmClient', () => {
  let client: RobustLlmClient;
  let mockAIService: {
    execute: MockedFunction<AIService['execute']>;
  };
  let mockCache: SubstringPositionCache;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    mockAIService = {
      execute: vi.fn(),
    };

    mockCache = new SubstringPositionCache();

    client = new RobustLlmClient();
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.SPAN_MODEL;
  });

  // ============================================
  // Two-Pass Architecture Tests
  // ============================================

  describe('Two-Pass Architecture', () => {
    it('should use two-pass for GPT-4o-mini with complex schema', async () => {
      // Arrange - Set environment to use mini model
      process.env.SPAN_MODEL = 'gpt-4o-mini-2024-07-18';

      const reasoningResponse = {
        text: JSON.stringify({
          analysis: 'I identified entities: camera movement, subject identity, lighting',
        }),
        metadata: {},
      };

      const structuringResponse = {
        text: JSON.stringify({
          analysis_trace: 'Analyzed entities and relationships',
          spans: [
            { text: 'camera pans', role: 'camera.movement', confidence: 0.9 },
            { text: 'detective', role: 'subject.identity', confidence: 0.95 },
          ],
          meta: { version: 'v1', notes: 'Labeled 2 spans' },
          isAdversarial: false,
        }),
        metadata: {},
      };

      mockAIService.execute
        .mockResolvedValueOnce(reasoningResponse) // Pass 1: Reasoning
        .mockResolvedValueOnce(structuringResponse); // Pass 2: Structuring

      const params: LabelSpansParams = {
        text: 'The camera pans to reveal a detective in soft light',
        policy: { allowOverlap: false },
        maxSpans: 10,
        aiService: mockAIService as unknown as AIService,
      };

      // Act
      const result = await client.getSpans({
        text: params.text,
        policy: params.policy || {},
        options: { maxSpans: params.maxSpans || 10 },
        enableRepair: false,
        aiService: mockAIService as unknown as AIService,
        cache: mockCache,
      });

      // Assert - Should have called AI service twice (two-pass)
      expect(mockAIService.execute).toHaveBeenCalledTimes(2);

      // Verify Pass 1: Reasoning
      const pass1Call = mockAIService.execute.mock.calls[0];
      expect(pass1Call[0]).toBe('span_labeling');
      expect(pass1Call[1].systemPrompt).toContain('Pass 1: REASONING');
      expect(pass1Call[1].maxTokens).toBeLessThan(600); // 60% of ~1000 tokens

      // Verify Pass 2: Structuring
      const pass2Call = mockAIService.execute.mock.calls[1];
      expect(pass2Call[1].systemPrompt).toContain('Pass 2: STRUCTURING');
      expect(pass2Call[1].maxTokens).toBeLessThan(400); // 40% of ~1000 tokens
      expect(pass2Call[1].enableBookending).toBe(true);

      expect(result.spans).toHaveLength(2);
    });

    it('should use single-pass for GPT-4o', async () => {
      // Arrange - Set environment to use GPT-4o
      process.env.SPAN_MODEL = 'gpt-4o-2024-08-06';

      const response = {
        text: JSON.stringify({
          analysis_trace: 'Analyzed text',
          spans: [
            { text: 'camera pans', role: 'camera.movement', confidence: 0.9 },
          ],
          meta: { version: 'v1', notes: 'Labeled 1 span' },
          isAdversarial: false,
        }),
        metadata: {},
      };

      mockAIService.execute.mockResolvedValue(response);

      // Act
      await client.getSpans({
        text: 'The camera pans',
        policy: {},
        options: { maxSpans: 10 },
        enableRepair: false,
        aiService: mockAIService as unknown as AIService,
        cache: mockCache,
      });

      // Assert - Should only call once (single-pass)
      expect(mockAIService.execute).toHaveBeenCalledTimes(1);
      const call = mockAIService.execute.mock.calls[0];
      expect(call[1].systemPrompt).not.toContain('Pass 1: REASONING');
      expect(call[1].enableBookending).toBe(true);
    });

    it('should allocate 60% tokens to reasoning pass', async () => {
      // Arrange
      process.env.SPAN_MODEL = 'gpt-4o-mini-2024-07-18';

      // estimateMaxTokens(10) = 400 + (10 * 25) = 650
      const expectedMaxTokens = 650;
      mockAIService.execute
        .mockResolvedValueOnce({
          text: 'Reasoning',
          metadata: {},
        })
        .mockResolvedValueOnce({
          text: JSON.stringify({
            analysis_trace: 'Analysis',
            spans: [],
            meta: { version: 'v1', notes: '' },
            isAdversarial: false,
          }),
          metadata: {},
        });

      // Act
      await client.getSpans({
        text: 'Test text',
        policy: {},
        options: { maxSpans: 10 },
        enableRepair: false,
        aiService: mockAIService as unknown as AIService,
        cache: mockCache,
      });

      // Assert - Pass 1 should use ~60% of tokens (650 * 0.6 = 390)
      const pass1Call = mockAIService.execute.mock.calls[0];
      const pass1Tokens = pass1Call[1].maxTokens;
      expect(pass1Tokens).toBe(Math.floor(expectedMaxTokens * 0.6));
    });

    it('should allocate 40% tokens to structuring pass', async () => {
      // Arrange
      process.env.SPAN_MODEL = 'gpt-4o-mini-2024-07-18';

      // estimateMaxTokens(10) = 400 + (10 * 25) = 650
      const expectedMaxTokens = 650;
      mockAIService.execute
        .mockResolvedValueOnce({
          text: 'Reasoning analysis',
          metadata: {},
        })
        .mockResolvedValueOnce({
          text: JSON.stringify({
            analysis_trace: 'Analysis',
            spans: [],
            meta: { version: 'v1', notes: '' },
            isAdversarial: false,
          }),
          metadata: {},
        });

      // Act
      await client.getSpans({
        text: 'Test text',
        policy: {},
        options: { maxSpans: 10 },
        enableRepair: false,
        aiService: mockAIService as unknown as AIService,
        cache: mockCache,
      });

      // Assert - Pass 2 should use ~40% of tokens (650 * 0.4 = 260)
      const pass2Call = mockAIService.execute.mock.calls[1];
      const pass2Tokens = pass2Call[1].maxTokens;
      expect(pass2Tokens).toBe(Math.floor(expectedMaxTokens * 0.4));
    });

    it('should disable bookending for reasoning pass', async () => {
      // Arrange
      process.env.SPAN_MODEL = 'gpt-4o-mini-2024-07-18';

      mockAIService.execute
        .mockResolvedValueOnce({
          text: 'Reasoning',
          metadata: {},
        })
        .mockResolvedValueOnce({
          text: JSON.stringify({
            analysis_trace: 'Analysis',
            spans: [],
            meta: { version: 'v1', notes: '' },
            isAdversarial: false,
          }),
          metadata: {},
        });

      // Act
      await client.getSpans({
        text: 'Test',
        policy: {},
        options: { maxSpans: 10 },
        enableRepair: false,
        aiService: mockAIService as unknown as AIService,
        cache: mockCache,
      });

      // Assert - Pass 1 should have bookending disabled
      const pass1Call = mockAIService.execute.mock.calls[0];
      expect(pass1Call[1].enableBookending).toBe(false);
    });

    it('should enable bookending for structuring pass', async () => {
      // Arrange
      process.env.SPAN_MODEL = 'gpt-4o-mini-2024-07-18';

      mockAIService.execute
        .mockResolvedValueOnce({
          text: 'Reasoning',
          metadata: {},
        })
        .mockResolvedValueOnce({
          text: JSON.stringify({
            analysis_trace: 'Analysis',
            spans: [],
            meta: { version: 'v1', notes: '' },
            isAdversarial: false,
          }),
          metadata: {},
        });

      // Act
      await client.getSpans({
        text: 'Test',
        policy: {},
        options: { maxSpans: 10 },
        enableRepair: false,
        aiService: mockAIService as unknown as AIService,
        cache: mockCache,
      });

      // Assert - Pass 2 should have bookending enabled
      const pass2Call = mockAIService.execute.mock.calls[1];
      expect(pass2Call[1].enableBookending).toBe(true);
    });
  });

  // ============================================
  // Model Detection Tests
  // ============================================

  describe('Model Detection', () => {
    it('should detect GPT-4o-mini from environment variable', async () => {
      // Arrange
      process.env.SPAN_MODEL = 'gpt-4o-mini-2024-07-18';

      mockAIService.execute
        .mockResolvedValueOnce({
          text: 'Reasoning',
          metadata: {},
        })
        .mockResolvedValueOnce({
          text: JSON.stringify({
            analysis_trace: 'Analysis',
            spans: [],
            meta: { version: 'v1', notes: '' },
            isAdversarial: false,
          }),
          metadata: {},
        });

      // Act
      await client.getSpans({
        text: 'Test',
        policy: {},
        options: { maxSpans: 10 },
        enableRepair: false,
        aiService: mockAIService as unknown as AIService,
        cache: mockCache,
      });

      // Assert - Should use two-pass
      expect(mockAIService.execute).toHaveBeenCalledTimes(2);
    });

    it('should detect GPT-4o-mini from model name containing "mini"', async () => {
      // Arrange
      process.env.SPAN_MODEL = 'mini-model-v1';

      mockAIService.execute
        .mockResolvedValueOnce({
          text: 'Reasoning',
          metadata: {},
        })
        .mockResolvedValueOnce({
          text: JSON.stringify({
            analysis_trace: 'Analysis',
            spans: [],
            meta: { version: 'v1', notes: '' },
            isAdversarial: false,
          }),
          metadata: {},
        });

      // Act
      await client.getSpans({
        text: 'Test',
        policy: {},
        options: { maxSpans: 10 },
        enableRepair: false,
        aiService: mockAIService as unknown as AIService,
        cache: mockCache,
      });

      // Assert - Should use two-pass
      expect(mockAIService.execute).toHaveBeenCalledTimes(2);
    });

    it('should default to single-pass when model unknown', async () => {
      // Arrange - No environment variable, model not detected
      delete process.env.SPAN_MODEL;

      const response = {
        text: JSON.stringify({
          analysis_trace: 'Analysis',
          spans: [],
          meta: { version: 'v1', notes: '' },
          isAdversarial: false,
        }),
        metadata: {},
      };

      mockAIService.execute.mockResolvedValue(response);

      // Act
      await client.getSpans({
        text: 'Test',
        policy: {},
        options: { maxSpans: 10 },
        enableRepair: false,
        aiService: mockAIService as unknown as AIService,
        cache: mockCache,
      });

      // Assert - Should use single-pass
      expect(mockAIService.execute).toHaveBeenCalledTimes(1);
    });

    it('should use single-pass for GPT-4o model', async () => {
      // Arrange
      process.env.SPAN_MODEL = 'gpt-4o-2024-08-06';

      const response = {
        text: JSON.stringify({
          analysis_trace: 'Analysis',
          spans: [],
          meta: { version: 'v1', notes: '' },
          isAdversarial: false,
        }),
        metadata: {},
      };

      mockAIService.execute.mockResolvedValue(response);

      // Act
      await client.getSpans({
        text: 'Test',
        policy: {},
        options: { maxSpans: 10 },
        enableRepair: false,
        aiService: mockAIService as unknown as AIService,
        cache: mockCache,
      });

      // Assert - Should use single-pass
      expect(mockAIService.execute).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================
  // Two-Pass Flow Tests
  // ============================================

  describe('Two-Pass Flow', () => {
    it('should pass reasoning output to structuring prompt', async () => {
      // Arrange
      process.env.SPAN_MODEL = 'gpt-4o-mini-2024-07-18';

      const reasoningOutput = 'I identified: camera movement "pans", subject "detective"';
      const structuringResponse = {
        text: JSON.stringify({
          analysis_trace: 'Used Pass 1 analysis',
          spans: [
            { text: 'pans', role: 'camera.movement', confidence: 0.9 },
            { text: 'detective', role: 'subject.identity', confidence: 0.95 },
          ],
          meta: { version: 'v1', notes: '' },
          isAdversarial: false,
        }),
        metadata: {},
      };

      mockAIService.execute
        .mockResolvedValueOnce({
          text: reasoningOutput,
          metadata: {},
        })
        .mockResolvedValueOnce(structuringResponse);

      // Act
      await client.getSpans({
        text: 'The camera pans to reveal a detective',
        policy: {},
        options: { maxSpans: 10 },
        enableRepair: false,
        aiService: mockAIService as unknown as AIService,
        cache: mockCache,
      });

      // Assert - Pass 2 prompt should include Pass 1 output
      const pass2Call = mockAIService.execute.mock.calls[1];
      expect(pass2Call[1].systemPrompt).toContain(reasoningOutput);
      expect(pass2Call[1].systemPrompt).toContain('Pass 1 Analysis:');
    });

    it('should structure Pass 1 reasoning into JSON schema', async () => {
      // Arrange
      process.env.SPAN_MODEL = 'gpt-4o-mini-2024-07-18';

      const reasoningOutput = 'Analysis: Found camera movement and subject';
      const structuringResponse = {
        text: JSON.stringify({
          analysis_trace: 'Converted Pass 1 analysis to structured format',
          spans: [
            { text: 'camera movement', role: 'camera.movement', confidence: 0.9 },
          ],
          meta: { version: 'v1', notes: 'Converted from reasoning' },
          isAdversarial: false,
        }),
        metadata: {},
      };

      mockAIService.execute
        .mockResolvedValueOnce({
          text: reasoningOutput,
          metadata: {},
        })
        .mockResolvedValueOnce(structuringResponse);

      // Act
      const result = await client.getSpans({
        text: 'Camera movement reveals subject',
        policy: {},
        options: { maxSpans: 10 },
        enableRepair: false,
        aiService: mockAIService as unknown as AIService,
        cache: mockCache,
      });

      // Assert - Result should have structured spans
      expect(result.spans).toBeDefined();
      expect(Array.isArray(result.spans)).toBe(true);
    });
  });

  // ============================================
  // Error Handling Tests
  // ============================================

  describe('Error Handling', () => {
    it('should handle errors in Pass 1', async () => {
      // Arrange
      process.env.SPAN_MODEL = 'gpt-4o-mini-2024-07-18';

      const error = new Error('API rate limit');
      mockAIService.execute.mockRejectedValueOnce(error);

      // Act & Assert
      await expect(
        client.getSpans({
          text: 'Test',
          policy: {},
          options: { maxSpans: 10 },
          enableRepair: false,
          aiService: mockAIService as unknown as AIService,
          cache: mockCache,
        })
      ).rejects.toThrow('API rate limit');
    });

    it('should handle errors in Pass 2', async () => {
      // Arrange
      process.env.SPAN_MODEL = 'gpt-4o-mini-2024-07-18';

      const error = new Error('JSON parsing failed');
      mockAIService.execute
        .mockResolvedValueOnce({
          text: 'Reasoning output',
          metadata: {},
        })
        .mockRejectedValueOnce(error);

      // Act & Assert
      await expect(
        client.getSpans({
          text: 'Test',
          policy: {},
          options: { maxSpans: 10 },
          enableRepair: false,
          aiService: mockAIService as unknown as AIService,
          cache: mockCache,
        })
      ).rejects.toThrow('JSON parsing failed');
    });

    it('should handle invalid JSON in Pass 2 response', async () => {
      // Arrange
      process.env.SPAN_MODEL = 'gpt-4o-mini-2024-07-18';

      // Reset parseJson mock to return error on second call
      const { parseJson } = await import('../../utils/jsonUtils');
      vi.mocked(parseJson).mockClear();
      vi.mocked(parseJson)
        .mockReturnValueOnce({
          ok: true,
          value: { reasoning: 'Analysis' },
        })
        .mockReturnValueOnce({
          ok: false,
          error: 'Invalid JSON',
        });

      mockAIService.execute
        .mockResolvedValueOnce({
          text: 'Reasoning',
          metadata: {},
        })
        .mockResolvedValueOnce({
          text: 'Invalid JSON response',
          metadata: {},
        });

      // Act & Assert
      await expect(
        client.getSpans({
          text: 'Test',
          policy: {},
          options: { maxSpans: 10 },
          enableRepair: false,
          aiService: mockAIService as unknown as AIService,
          cache: mockCache,
        })
      ).rejects.toThrow('Invalid JSON');
    });
  });

  // ============================================
  // Integration with Single-Pass Tests
  // ============================================

  describe('Single-Pass Integration', () => {
    it('should use single-pass when not using GPT-4o-mini', async () => {
      // Arrange - Use GPT-4o
      process.env.SPAN_MODEL = 'gpt-4o-2024-08-06';

      const responseData = {
        analysis_trace: 'Single-pass analysis',
        spans: [
          { text: 'test', role: 'subject.identity', confidence: 0.9 },
        ],
        meta: { version: 'v1', notes: '' },
        isAdversarial: false,
      };

      const response = {
        text: JSON.stringify(responseData),
        metadata: {},
      };

      // Reset parseJson mock to ensure it parses correctly
      const { parseJson } = await import('../../utils/jsonUtils');
      vi.mocked(parseJson).mockClear();
      vi.mocked(parseJson).mockReturnValue({
        ok: true,
        value: responseData,
      });

      mockAIService.execute.mockResolvedValue(response);

      // Act
      const result = await client.getSpans({
        text: 'Test text',
        policy: {},
        options: { maxSpans: 10 },
        enableRepair: false,
        aiService: mockAIService as unknown as AIService,
        cache: mockCache,
      });

      // Assert
      expect(mockAIService.execute).toHaveBeenCalledTimes(1);
      expect(result.spans).toHaveLength(1);
    });

    it('should enable bookending for single-pass extraction', async () => {
      // Arrange
      process.env.SPAN_MODEL = 'gpt-4o-2024-08-06';

      const response = {
        text: JSON.stringify({
          analysis_trace: 'Analysis',
          spans: [],
          meta: { version: 'v1', notes: '' },
          isAdversarial: false,
        }),
        metadata: {},
      };

      mockAIService.execute.mockResolvedValue(response);

      // Act
      await client.getSpans({
        text: 'Test',
        policy: {},
        options: { maxSpans: 10 },
        enableRepair: false,
        aiService: mockAIService as unknown as AIService,
        cache: mockCache,
      });

      // Assert
      const call = mockAIService.execute.mock.calls[0];
      expect(call[1].enableBookending).toBe(true);
    });
  });
});

