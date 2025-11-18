import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PromptOptimizationService } from '../../../../server/src/services/prompt-optimization/PromptOptimizationService.js';

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

describe('PromptOptimizationService - Stage 1 Domain Content Generation', () => {
  let service;
  let mockClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = {
      complete: vi.fn(),
    };
    service = new PromptOptimizationService(mockClient);
  });

  describe('generateDomainSpecificContent()', () => {
    it('should generate domain-specific warnings and deliverables', async () => {
      const context = {
        specificAspects: 'PostgreSQL query optimization',
        backgroundLevel: 'expert',
        intendedUse: 'production performance tuning',
      };

      mockClient.complete.mockResolvedValue({
        content: [
          {
            text: JSON.stringify({
              warnings: [
                'Avoid sequential scans on tables >1M rows - ensure WHERE clause predicates are covered by B-tree or GiST indexes',
                'Consider that PostgreSQL query planner may choose sequential scan over index if table statistics are stale - run ANALYZE regularly',
                'Account for index-only scans when covering indexes include all SELECT columns',
              ],
              deliverables: [
                'EXPLAIN ANALYZE output showing query execution plan with actual row counts and timing',
                'Index usage report identifying unused or duplicate indexes',
                'Performance comparison table showing query execution times before and after optimization',
              ],
              constraints: [
                'Must maintain under 100ms query time for user-facing endpoints',
                'Cannot introduce breaking changes to existing query API',
              ],
            }),
          },
        ],
      });

      const result = await service.generateDomainSpecificContent('optimize database queries', context);

      // Verify structure
      expect(result).toHaveProperty('warnings');
      expect(result).toHaveProperty('deliverables');
      expect(result).toHaveProperty('constraints');

      // Verify content
      expect(result.warnings).toHaveLength(3);
      expect(result.deliverables).toHaveLength(3);
      expect(result.constraints).toHaveLength(2);

      // Verify domain specificity (check actual content from mock)
      expect(result.warnings[0]).toContain('sequential scans');
      expect(result.warnings[0]).toContain('B-tree');
      expect(result.warnings[1]).toContain('PostgreSQL'); // Second warning has PostgreSQL
      expect(result.deliverables[0]).toContain('EXPLAIN ANALYZE');
    });

    it('should include domain focus in Stage 1 prompt', async () => {
      const context = {
        specificAspects: 'React hooks, useEffect cleanup, memory leaks',
        backgroundLevel: 'intermediate',
        intendedUse: 'learning',
      };

      mockClient.complete.mockResolvedValue({
        content: [
          {
            text: JSON.stringify({
              warnings: ['Test warning'],
              deliverables: ['Test deliverable'],
              constraints: [],
            }),
          },
        ],
      });

      await service.generateDomainSpecificContent('explain React hooks', context);

      const callArgs = mockClient.complete.mock.calls[0][0];

      // Verify domain is included in prompt
      expect(callArgs).toContain('React hooks, useEffect cleanup, memory leaks');
      expect(callArgs).toContain('intermediate');
      expect(callArgs).toContain('learning');
    });

    it('should use low temperature for consistency', async () => {
      const context = {
        specificAspects: 'test domain',
        backgroundLevel: 'expert',
      };

      mockClient.complete.mockResolvedValue({
        content: [
          {
            text: JSON.stringify({
              warnings: ['warning'],
              deliverables: ['deliverable'],
              constraints: [],
            }),
          },
        ],
      });

      await service.generateDomainSpecificContent('test prompt', context);

      const options = mockClient.complete.mock.calls[0][1];
      expect(options.temperature).toBe(0.3);
    });

    it('should handle JSON in markdown code blocks', async () => {
      mockClient.complete.mockResolvedValue({
        content: [
          {
            text: '```json\n{"warnings": ["test"], "deliverables": ["test"], "constraints": []}\n```',
          },
        ],
      });

      const result = await service.generateDomainSpecificContent('test', {
        specificAspects: 'test',
      });

      expect(result.warnings).toEqual(['test']);
      expect(result.deliverables).toEqual(['test']);
    });

    it('should handle JSON without markdown wrapper', async () => {
      mockClient.complete.mockResolvedValue({
        content: [
          {
            text: '{"warnings": ["direct"], "deliverables": ["json"], "constraints": []}',
          },
        ],
      });

      const result = await service.generateDomainSpecificContent('test', {
        specificAspects: 'test',
      });

      expect(result.warnings).toEqual(['direct']);
      expect(result.deliverables).toEqual(['json']);
    });

    it('should return empty arrays on JSON parse failure', async () => {
      const { logger } = await import('../../../../server/src/infrastructure/Logger.js');

      mockClient.complete.mockResolvedValue({
        content: [{ text: 'invalid json response' }],
      });

      const result = await service.generateDomainSpecificContent('test', {
        specificAspects: 'test',
      });

      expect(result).toEqual({
        warnings: [],
        deliverables: [],
        constraints: [],
      });

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to generate domain-specific content in Stage 1',
        expect.any(Object)
      );
    });

    it('should return empty arrays on API failure', async () => {
      const { logger } = await import('../../../../server/src/infrastructure/Logger.js');

      mockClient.complete.mockRejectedValue(new Error('API error'));

      const result = await service.generateDomainSpecificContent('test', {
        specificAspects: 'test',
      });

      expect(result).toEqual({
        warnings: [],
        deliverables: [],
        constraints: [],
      });

      expect(logger.error).toHaveBeenCalled();
    });

    it('should validate structure and reject invalid responses', async () => {
      mockClient.complete.mockResolvedValue({
        content: [
          {
            text: JSON.stringify({
              warnings: 'not an array', // Invalid!
              deliverables: ['valid'],
              constraints: [],
            }),
          },
        ],
      });

      const result = await service.generateDomainSpecificContent('test', {
        specificAspects: 'test',
      });

      expect(result).toEqual({
        warnings: [],
        deliverables: [],
        constraints: [],
      });
    });

    it('should log successful generation with counts', async () => {
      const { logger } = await import('../../../../server/src/infrastructure/Logger.js');

      mockClient.complete.mockResolvedValue({
        content: [
          {
            text: JSON.stringify({
              warnings: ['w1', 'w2', 'w3'],
              deliverables: ['d1', 'd2'],
              constraints: ['c1'],
            }),
          },
        ],
      });

      await service.generateDomainSpecificContent('test', { specificAspects: 'test' });

      expect(logger.info).toHaveBeenCalledWith(
        'Stage 1 domain content generated successfully',
        {
          warningCount: 3,
          deliverableCount: 2,
          constraintCount: 1,
        }
      );
    });

    it('should include anti-pattern examples in Stage 1 prompt', async () => {
      mockClient.complete.mockResolvedValue({
        content: [
          {
            text: JSON.stringify({
              warnings: ['test'],
              deliverables: ['test'],
              constraints: [],
            }),
          },
        ],
      });

      await service.generateDomainSpecificContent('test', { specificAspects: 'test' });

      const callArgs = mockClient.complete.mock.calls[0][0];

      // Verify anti-patterns are included to guide quality
      expect(callArgs).toContain('EXAMPLES OF BAD WARNINGS');
      expect(callArgs).toContain('Think about performance');
      expect(callArgs).toContain('too generic');
    });

    it('should tailor deliverable examples to expertise level', async () => {
      mockClient.complete.mockResolvedValue({
        content: [
          {
            text: JSON.stringify({
              warnings: ['test'],
              deliverables: ['test'],
              constraints: [],
            }),
          },
        ],
      });

      // Test expert level
      await service.generateDomainSpecificContent('test', {
        specificAspects: 'test',
        backgroundLevel: 'expert',
      });

      const expertCall = mockClient.complete.mock.calls[0][0];
      expect(expertCall).toContain('Flame graph');
      expect(expertCall).toContain('hotspot analysis');

      mockClient.complete.mockClear();

      // Test beginner level
      await service.generateDomainSpecificContent('test', {
        specificAspects: 'test',
        backgroundLevel: 'beginner',
      });

      const beginnerCall = mockClient.complete.mock.calls[0][0];
      expect(beginnerCall).toContain('Step-by-step explanation');
      expect(beginnerCall).toContain('visual diagrams');
    });

    it('should include use case in deliverable guidance', async () => {
      mockClient.complete.mockResolvedValue({
        content: [
          {
            text: JSON.stringify({
              warnings: ['test'],
              deliverables: ['test'],
              constraints: [],
            }),
          },
        ],
      });

      await service.generateDomainSpecificContent('test', {
        specificAspects: 'test',
        intendedUse: 'production deployment',
      });

      const callArgs = mockClient.complete.mock.calls[0][0];
      expect(callArgs).toContain('production');
      expect(callArgs).toContain('Production-ready implementation');
    });
  });

  describe('Integration with optimize()', () => {
    it('should call generateDomainSpecificContent when context is provided', async () => {
      const spyGenerate = vi.spyOn(service, 'generateDomainSpecificContent');

      mockClient.complete
        .mockResolvedValueOnce({
          // Stage 1
          content: [
            {
              text: JSON.stringify({
                warnings: ['test warning'],
                deliverables: ['test deliverable'],
                constraints: [],
              }),
            },
          ],
        })
        .mockResolvedValueOnce({
          // Stage 2
          content: [{ text: '**Goal**\nTest output' }],
          usage: { input_tokens: 100, output_tokens: 200 },
        });

      await service.optimize({
        prompt: 'test prompt',
        mode: 'reasoning',
        context: { specificAspects: 'React performance' },
      });

      expect(spyGenerate).toHaveBeenCalledWith('test prompt', {
        specificAspects: 'React performance',
      });
    });

    it('should not call generateDomainSpecificContent for non-reasoning modes', async () => {
      const spyGenerate = vi.spyOn(service, 'generateDomainSpecificContent');

      mockClient.complete.mockResolvedValue({
        content: [{ text: 'optimized' }],
        usage: { input_tokens: 100, output_tokens: 200 },
      });

      await service.optimize({
        prompt: 'test prompt',
        mode: 'code', // Not reasoning mode
        context: { specificAspects: 'test' },
      });

      expect(spyGenerate).not.toHaveBeenCalled();
    });

    it('should skip Stage 1 when context is empty', async () => {
      const spyGenerate = vi.spyOn(service, 'generateDomainSpecificContent');

      mockClient.complete.mockResolvedValue({
        content: [{ text: '**Goal**\nTest' }],
        usage: { input_tokens: 100, output_tokens: 200 },
      });

      await service.optimize({
        prompt: 'test prompt',
        mode: 'reasoning',
        context: {}, // Empty context
      });

      expect(spyGenerate).not.toHaveBeenCalled();
    });
  });
});
