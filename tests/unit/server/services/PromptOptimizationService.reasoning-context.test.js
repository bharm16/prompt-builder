import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PromptOptimizationService } from '../../../../server/src/services/PromptOptimizationService.js';

// Mock dependencies
vi.mock('../../../../server/src/infrastructure/Logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../../../../server/src/services/CacheService.js', () => ({
  cacheService: {
    generateKey: vi.fn(() => 'test-key'),
    get: vi.fn(async () => null),
    set: vi.fn(async () => true),
    getConfig: vi.fn(() => ({ ttl: 3600, namespace: 'prompt' })),
  },
}));

describe('PromptOptimizationService - Reasoning Mode Context Integration', () => {
  let service;

  beforeEach(() => {
    vi.clearAllMocks();
    const mockClient = {
      complete: vi.fn(async () => ({
        content: [{ text: 'Optimized output' }],
        usage: { input_tokens: 10, output_tokens: 20 },
      })),
    };
    service = new PromptOptimizationService(mockClient);
  });

  describe('Context Injection into Reasoning Template', () => {
    it('should inject full context early in reasoning template', () => {
      const context = {
        specificAspects: 'focus on edge cases and error handling',
        backgroundLevel: 'expert developer',
        intendedUse: 'production code review',
      };

      const template = service.getReasoningPrompt(
        'review this authentication code',
        context
      );

      // Context should appear in <original_prompt> section
      const originalPromptIndex = template.indexOf('<original_prompt>');
      const contextIndex = template.indexOf('USER-PROVIDED CONTEXT');
      const transformationIndex = template.indexOf('<transformation_process>');

      // Verify context appears
      expect(contextIndex).toBeGreaterThan(0);
      expect(template).toContain('focus on edge cases and error handling');
      expect(template).toContain('expert developer');
      expect(template).toContain('production code review');

      // Verify context appears BEFORE transformation instructions
      expect(contextIndex).toBeLessThan(transformationIndex);
      expect(contextIndex).toBeGreaterThan(originalPromptIndex);
    });

    it('should inject partial context gracefully', () => {
      const context = {
        specificAspects: 'performance optimization',
        // backgroundLevel and intendedUse intentionally omitted
      };

      const template = service.getReasoningPrompt('optimize database query', context);

      expect(template).toContain('performance optimization');
      expect(template).toContain('USER-PROVIDED CONTEXT');
      expect(template).not.toContain('undefined');
      expect(template).not.toContain('null');
    });

    it('should handle context with only backgroundLevel', () => {
      const context = {
        backgroundLevel: 'beginner',
      };

      const template = service.getReasoningPrompt('explain REST APIs', context);

      expect(template).toContain('beginner');
      expect(template).toContain('Target Audience Level');
    });

    it('should handle context with only intendedUse', () => {
      const context = {
        intendedUse: 'teaching material for bootcamp',
      };

      const template = service.getReasoningPrompt('create tutorial', context);

      expect(template).toContain('teaching material for bootcamp');
      expect(template).toContain('Intended Use Case');
    });

    it('should not inject context section when context is null', () => {
      const template = service.getReasoningPrompt('simple prompt', null);

      expect(template).not.toContain('USER-PROVIDED CONTEXT');
    });

    it('should not inject context section when context is empty object', () => {
      const template = service.getReasoningPrompt('simple prompt', {});

      expect(template).not.toContain('USER-PROVIDED CONTEXT');
    });

    it('should integrate context into transformation steps', () => {
      const context = {
        specificAspects: 'security best practices',
        backgroundLevel: 'senior engineer',
      };

      const template = service.getReasoningPrompt('API design guide', context);

      // Transformation steps should mention context integration
      expect(template).toContain('Integrate user-provided requirements');
      expect(template).toMatch(/context requirements|user specified/i);
    });
  });

  describe('buildSystemPrompt() - Context Routing', () => {
    it('should pass context to getReasoningPrompt for reasoning mode', () => {
      const spyGetReasoning = vi.spyOn(service, 'getReasoningPrompt');
      const context = {
        specificAspects: 'test focus',
        backgroundLevel: 'expert',
      };

      service.buildSystemPrompt('test prompt', 'reasoning', context);

      expect(spyGetReasoning).toHaveBeenCalledWith(
        'test prompt',
        context,
        undefined, // brainstormContext
        null // domainContent (not provided to buildSystemPrompt)
      );
    });

    it('should not duplicate context in reasoning mode', () => {
      const context = {
        specificAspects: 'focus on performance and scalability',
      };

      const systemPrompt = service.buildSystemPrompt(
        'optimize microservices architecture',
        'reasoning',
        context
      );

      // Count occurrences of context value
      const matches = (
        systemPrompt.match(/focus on performance and scalability/g) || []
      ).length;

      // Should appear only once (in template, not appended)
      expect(matches).toBe(1);
    });

    it('should still append context for non-reasoning modes', () => {
      const context = {
        specificAspects: 'focus on examples',
        backgroundLevel: 'intermediate',
      };

      const systemPrompt = service.buildSystemPrompt(
        'explain concept',
        'optimize', // not reasoning mode
        context
      );

      // Should contain the context addition section
      expect(systemPrompt).toContain(
        'IMPORTANT - User has provided additional context'
      );
    });
  });

  describe('Context + Brainstorm Combined', () => {
    it('should handle both context and brainstormContext together', () => {
      const context = {
        specificAspects: 'cinematic composition',
        intendedUse: 'film production',
      };

      const brainstormContext = {
        elements: {
          subject: 'lone astronaut',
          location: 'space station',
          mood: 'contemplative',
        },
      };

      const template = service.getReasoningPrompt('video prompt', context, brainstormContext);

      // Should contain user context
      expect(template).toContain('cinematic composition');
      expect(template).toContain('film production');

      // Should contain brainstorm elements
      expect(template).toContain('lone astronaut');
      expect(template).toContain('space station');
      expect(template).toContain('contemplative');
    });

    it('should number transformation steps correctly with both contexts', () => {
      const context = { specificAspects: 'test' };
      const brainstormContext = { elements: { subject: 'test' } };

      const template = service.getReasoningPrompt('prompt', context, brainstormContext);

      // Should have proper step numbering
      expect(template).toContain('1. **Extract the core objective**');
      expect(template).toContain('2. **Integrate user-provided requirements**');
      expect(template).toContain('3. **Integrate brainstorm elements**');
    });
  });

  describe('Logging', () => {
    it('should log context usage for debugging', async () => {
      const { logger } = await import(
        '../../../../server/src/infrastructure/Logger.js'
      );

      const context = {
        specificAspects: 'test aspects',
        backgroundLevel: 'expert',
        intendedUse: 'production',
      };

      service.getReasoningPrompt('test', context);

      expect(logger.info).toHaveBeenCalledWith('Context provided for reasoning mode', {
        hasSpecificAspects: true,
        hasBackgroundLevel: true,
        hasIntendedUse: true,
      });
    });

    it('should not log when context is null', async () => {
      const { logger } = await import(
        '../../../../server/src/infrastructure/Logger.js'
      );

      service.getReasoningPrompt('test', null);

      expect(logger.info).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle context with empty string values', () => {
      const context = {
        specificAspects: '',
        backgroundLevel: 'expert',
        intendedUse: '',
      };

      const template = service.getReasoningPrompt('test', context);

      // Should only show non-empty fields
      expect(template).toContain('expert');
      expect(template).not.toMatch(/specificAspects|intendedUse/);
    });

    it('should handle context with whitespace-only values', () => {
      const context = {
        specificAspects: '   ',
        backgroundLevel: 'beginner',
      };

      const template = service.getReasoningPrompt('test', context);

      // Should not create context section for whitespace-only values
      expect(template).toContain('beginner');
    });

    it('should preserve special characters in context values', () => {
      const context = {
        specificAspects: 'focus on <edge-cases> & "error handling"',
        intendedUse: 'API v2.0 (breaking changes)',
      };

      const template = service.getReasoningPrompt('test', context);

      expect(template).toContain('focus on <edge-cases> & "error handling"');
      expect(template).toContain('API v2.0 (breaking changes)');
    });

    it('should handle very long context values', () => {
      const longText = 'a'.repeat(500);
      const context = {
        specificAspects: longText,
      };

      const template = service.getReasoningPrompt('test', context);

      expect(template).toContain(longText);
      expect(template.length).toBeGreaterThan(1000);
    });
  });

  describe('Template Structure Validation', () => {
    it('should maintain proper template structure with context', () => {
      const context = {
        specificAspects: 'test',
        backgroundLevel: 'expert',
      };

      const template = service.getReasoningPrompt('test prompt', context);

      // Verify all required sections exist
      const sections = [
        'You are an expert prompt engineer',
        '<core_principles>',
        '<original_prompt>',
        'USER-PROVIDED CONTEXT',
        '<transformation_process>',
      ];

      sections.forEach((section) => {
        expect(template, `Section "${section}" should exist in template`).toContain(section);
      });

      // Verify context appears within original_prompt section
      const originalPromptIndex = template.indexOf('<original_prompt>');
      const contextIndex = template.indexOf('USER-PROVIDED CONTEXT');
      const originalPromptEndIndex = template.indexOf('</original_prompt>');

      expect(contextIndex).toBeGreaterThan(originalPromptIndex);
      expect(contextIndex).toBeLessThan(originalPromptEndIndex);
    });

    it('should include proper guidance for context integration', () => {
      const context = { specificAspects: 'test' };
      const template = service.getReasoningPrompt('test', context);

      expect(template).toContain('requirements that MUST be integrated');
      expect(template).toContain('Ensure these requirements are woven naturally');
    });
  });

  describe('Automatic Context Inference', () => {
    it('should automatically infer context for reasoning mode when not provided', async () => {
      // Mock the Claude client to return responses for all 3 stages:
      // 1. Context inference
      // 2. Stage 1: Domain content generation
      // 3. Stage 2: Final optimization
      const mockClient = {
        complete: vi
          .fn()
          .mockResolvedValueOnce({
            // First call: context inference
            content: [
              {
                text: JSON.stringify({
                  specificAspects: 'DOM manipulation, parsing algorithms, rendering efficiency',
                  backgroundLevel: 'expert',
                  intendedUse: 'production optimization',
                }),
              },
            ],
          })
          .mockResolvedValueOnce({
            // Second call: Stage 1 domain content generation
            content: [
              {
                text: JSON.stringify({
                  warnings: [
                    'Avoid re-parsing the entire document on every keystroke',
                    'Consider that DOM mutations trigger style recalculation'
                  ],
                  deliverables: [
                    'Performance profiling report comparing parse times',
                    'Flame graph from Chrome DevTools'
                  ],
                  constraints: []
                }),
              },
            ],
          })
          .mockResolvedValueOnce({
            // Third call: Stage 2 final optimization
            content: [
              {
                text: '**Goal**\nOptimize canvas highlighting performance...',
              },
            ],
            usage: { input_tokens: 100, output_tokens: 200 },
          }),
      };

      service = new PromptOptimizationService(mockClient);

      const result = await service.optimize({
        prompt:
          'analyze the canvas highlighting implementation and reduce parse time',
        mode: 'reasoning',
        // NOTE: No context provided!
      });

      // Verify THREE API calls were made (context inference + Stage 1 + Stage 2)
      expect(mockClient.complete).toHaveBeenCalledTimes(3);

      // Verify first call was for context inference
      const firstCall = mockClient.complete.mock.calls[0];
      expect(firstCall[0]).toContain('Analyze this prompt and infer appropriate context');
      expect(firstCall[0]).toContain('canvas highlighting');

      // Verify second call was for domain content generation (Stage 1)
      const secondCall = mockClient.complete.mock.calls[1];
      expect(secondCall[0]).toContain('Generate domain-specific content');

      // Verify result is returned
      expect(result).toContain('Optimize canvas highlighting');
    });

    it('should use provided context instead of inferring', async () => {
      const mockClient = {
        complete: vi
          .fn()
          .mockResolvedValueOnce({
            // First call: Stage 1 domain content generation
            content: [
              {
                text: JSON.stringify({
                  warnings: ['React-specific warning'],
                  deliverables: ['React deliverable'],
                  constraints: []
                }),
              },
            ],
          })
          .mockResolvedValueOnce({
            // Second call: Stage 2 final optimization
            content: [{ text: '**Goal**\nOptimize...' }],
            usage: { input_tokens: 100, output_tokens: 200 },
          }),
      };

      service = new PromptOptimizationService(mockClient);

      const explicitContext = {
        specificAspects: 'React performance',
        backgroundLevel: 'intermediate',
        intendedUse: 'learning',
      };

      await service.optimize({
        prompt: 'test prompt',
        mode: 'reasoning',
        context: explicitContext, // Explicit context provided
      });

      // Should call twice (Stage 1 + Stage 2, no context inference)
      expect(mockClient.complete).toHaveBeenCalledTimes(2);

      // Verify first call was for domain content generation (NOT inference)
      const firstCall = mockClient.complete.mock.calls[0];
      expect(firstCall[0]).not.toContain('Analyze this prompt and infer');
      expect(firstCall[0]).toContain('Generate domain-specific content');
    });

    it('should handle inference failures gracefully', async () => {
      const mockClient = {
        complete: vi
          .fn()
          .mockRejectedValueOnce(new Error('Network error')) // Context inference fails
          .mockResolvedValueOnce({
            // Stage 1 still runs with fallback minimal context
            content: [
              {
                text: JSON.stringify({
                  warnings: [],
                  deliverables: [],
                  constraints: []
                }),
              },
            ],
          })
          .mockResolvedValueOnce({
            // Stage 2: final optimization
            content: [{ text: '**Goal**\nOptimize...' }],
            usage: { input_tokens: 100, output_tokens: 200 },
          }),
      };

      service = new PromptOptimizationService(mockClient);

      const result = await service.optimize({
        prompt: 'test prompt',
        mode: 'reasoning',
      });

      // Should still succeed with fallback context
      expect(result).toBeTruthy();
      expect(result).toContain('Goal');
    });

    it('should parse JSON from markdown code blocks', async () => {
      const mockClient = {
        complete: vi.fn().mockResolvedValueOnce({
          content: [
            {
              text: '```json\n{\n  "specificAspects": "test aspects",\n  "backgroundLevel": "expert",\n  "intendedUse": "testing"\n}\n```',
            },
          ],
        }),
      };

      service = new PromptOptimizationService(mockClient);

      const context = await service.inferContextFromPrompt('test prompt');

      expect(context.specificAspects).toBe('test aspects');
      expect(context.backgroundLevel).toBe('expert');
      expect(context.intendedUse).toBe('testing');
    });

    it('should validate and correct invalid background levels', async () => {
      const mockClient = {
        complete: vi.fn().mockResolvedValueOnce({
          content: [
            {
              text: JSON.stringify({
                specificAspects: 'test',
                backgroundLevel: 'advanced', // Invalid level
                intendedUse: 'testing',
              }),
            },
          ],
        }),
      };

      service = new PromptOptimizationService(mockClient);

      const context = await service.inferContextFromPrompt('test prompt');

      // Should default to intermediate
      expect(context.backgroundLevel).toBe('intermediate');
    });

    it('should not infer context for non-reasoning modes', async () => {
      const mockClient = {
        complete: vi.fn().mockResolvedValueOnce({
          content: [{ text: 'Optimized output' }],
          usage: { input_tokens: 100, output_tokens: 200 },
        }),
      };

      service = new PromptOptimizationService(mockClient);

      await service.optimize({
        prompt: 'test prompt',
        mode: 'code', // Not reasoning mode
        // No context provided
      });

      // Should only call once (optimization, not inference)
      expect(mockClient.complete).toHaveBeenCalledTimes(1);

      // Verify it was optimization call, not inference
      const firstCall = mockClient.complete.mock.calls[0];
      expect(firstCall[0]).not.toContain('Analyze this prompt and infer');
    });

    it('should log inference success with details', async () => {
      const { logger } = await import(
        '../../../../server/src/infrastructure/Logger.js'
      );

      const mockClient = {
        complete: vi.fn().mockResolvedValueOnce({
          content: [
            {
              text: JSON.stringify({
                specificAspects: 'API design, performance',
                backgroundLevel: 'expert',
                intendedUse: 'production',
              }),
            },
          ],
        }),
      };

      service = new PromptOptimizationService(mockClient);

      await service.inferContextFromPrompt('design API for high performance');

      expect(logger.info).toHaveBeenCalledWith('Successfully inferred context', {
        hasSpecificAspects: true,
        backgroundLevel: 'expert',
        hasIntendedUse: true,
      });
    });

    it('should return minimal context on JSON parse failure', async () => {
      const mockClient = {
        complete: vi.fn().mockResolvedValueOnce({
          content: [{ text: 'Invalid JSON response' }],
        }),
      };

      service = new PromptOptimizationService(mockClient);

      const context = await service.inferContextFromPrompt('test prompt');

      // Should return fallback context
      expect(context).toEqual({
        specificAspects: '',
        backgroundLevel: 'intermediate',
        intendedUse: '',
      });
    });
  });
});
