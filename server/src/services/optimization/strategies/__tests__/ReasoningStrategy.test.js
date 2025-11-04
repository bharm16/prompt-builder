import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReasoningStrategy } from '../ReasoningStrategy.js';

// Mock dependencies
vi.mock('../../../../infrastructure/Logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../../config/OptimizationConfig.js', () => ({
  default: {
    tokens: {
      domainContent: 1000,
      optimization: {
        reasoning: 3000,
      },
    },
    temperatures: {
      domainContent: 0.3,
      optimization: {
        reasoning: 0.3,
      },
    },
    timeouts: {
      optimization: {
        reasoning: 45000,
      },
    },
  },
}));

describe('ReasoningStrategy', () => {
  let strategy;
  let mockClaudeClient;
  let mockTemplateService;

  beforeEach(() => {
    vi.clearAllMocks();

    mockClaudeClient = {
      complete: vi.fn(),
    };

    mockTemplateService = {
      load: vi.fn(),
    };

    strategy = new ReasoningStrategy(mockClaudeClient, mockTemplateService);
  });

  describe('Constructor', () => {
    it('should initialize with correct name', () => {
      expect(strategy.name).toBe('reasoning');
    });

    it('should store claude client and template service', () => {
      expect(strategy.claudeClient).toBe(mockClaudeClient);
      expect(strategy.templateService).toBe(mockTemplateService);
    });
  });

  describe('generateDomainContent', () => {
    it('should generate domain content with correct prompt structure', async () => {
      const { logger } = require('../../../../infrastructure/Logger.js');

      mockClaudeClient.complete.mockResolvedValue({
        content: [
          {
            text: JSON.stringify({
              warnings: ['Warning 1', 'Warning 2'],
              deliverables: ['Deliverable 1'],
              constraints: ['Constraint 1'],
            }),
          },
        ],
      });

      const result = await strategy.generateDomainContent('Test prompt for reasoning', {});

      expect(logger.info).toHaveBeenCalledWith('Generating domain content for reasoning mode');
      expect(mockClaudeClient.complete).toHaveBeenCalled();

      // Verify prompt structure
      const promptArg = mockClaudeClient.complete.mock.calls[0][0];
      expect(promptArg).toContain('Test prompt for reasoning');
      expect(promptArg).toContain('domain expert');
      expect(promptArg).toContain('Warnings');
      expect(promptArg).toContain('Deliverables');
      expect(promptArg).toContain('Constraints');
      expect(promptArg).toContain('Output ONLY a JSON object');
    });

    it('should call Claude with correct config', async () => {
      mockClaudeClient.complete.mockResolvedValue({
        content: [
          {
            text: '{"warnings": [], "deliverables": [], "constraints": []}',
          },
        ],
      });

      await strategy.generateDomainContent('Test prompt', {});

      expect(mockClaudeClient.complete).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          maxTokens: 1000,
          temperature: 0.3,
          timeout: 45000,
        })
      );
    });

    it('should parse JSON response correctly', async () => {
      mockClaudeClient.complete.mockResolvedValue({
        content: [
          {
            text: JSON.stringify({
              warnings: ['Avoid premature optimization', 'Consider edge cases'],
              deliverables: ['Fully tested code', 'Documentation'],
              constraints: ['Must use TypeScript'],
            }),
          },
        ],
      });

      const result = await strategy.generateDomainContent('Write a function', {});

      expect(result).toEqual({
        warnings: ['Avoid premature optimization', 'Consider edge cases'],
        deliverables: ['Fully tested code', 'Documentation'],
        constraints: ['Must use TypeScript'],
      });
    });

    it('should handle JSON wrapped in markdown code fence', async () => {
      mockClaudeClient.complete.mockResolvedValue({
        content: [
          {
            text: '```json\n{"warnings": ["W1"], "deliverables": ["D1"], "constraints": []}\n```',
          },
        ],
      });

      const result = await strategy.generateDomainContent('Test', {});

      expect(result).toEqual({
        warnings: ['W1'],
        deliverables: ['D1'],
        constraints: [],
      });
    });

    it('should return null and log warning on error', async () => {
      const { logger } = require('../../../../infrastructure/Logger.js');

      mockClaudeClient.complete.mockRejectedValue(new Error('API Error'));

      const result = await strategy.generateDomainContent('Test prompt', {});

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        'Domain content generation failed for reasoning mode',
        expect.objectContaining({
          error: 'API Error',
        })
      );
    });

    it('should return null and log warning on invalid JSON', async () => {
      const { logger } = require('../../../../infrastructure/Logger.js');

      mockClaudeClient.complete.mockResolvedValue({
        content: [{ text: 'Not valid JSON at all' }],
      });

      const result = await strategy.generateDomainContent('Test', {});

      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should include reasoning-specific guidance in prompt', async () => {
      mockClaudeClient.complete.mockResolvedValue({
        content: [{ text: '{"warnings": [], "deliverables": [], "constraints": []}' }],
      });

      await strategy.generateDomainContent('Complex algorithm', {});

      const promptArg = mockClaudeClient.complete.mock.calls[0][0];

      // Check for reasoning-specific content
      expect(promptArg).toContain('Sophisticated, domain-specific pitfalls');
      expect(promptArg).toContain('expert-level mistakes');
      expect(promptArg).toContain('trade-offs, scale considerations');
      expect(promptArg).toContain('Concrete outputs');
      expect(promptArg).toContain('Technical limitations');
    });

    it('should request 4-6 warnings in prompt', async () => {
      mockClaudeClient.complete.mockResolvedValue({
        content: [{ text: '{"warnings": [], "deliverables": [], "constraints": []}' }],
      });

      await strategy.generateDomainContent('Test', {});

      const promptArg = mockClaudeClient.complete.mock.calls[0][0];
      expect(promptArg).toContain('(4-6)');
      expect(promptArg).toMatch(/warnings.*4-6/i);
    });
  });

  describe('optimize', () => {
    beforeEach(() => {
      mockTemplateService.load.mockResolvedValue('Template content with {{prompt}}');
    });

    it('should build domain content section when domain content provided', async () => {
      mockClaudeClient.complete.mockResolvedValue({
        content: [{ text: 'Optimized prompt with domain content' }],
      });

      const domainContent = {
        warnings: ['Warning 1', 'Warning 2'],
        deliverables: ['Deliverable 1'],
        constraints: ['Constraint 1'],
      };

      await strategy.optimize({
        prompt: 'Original prompt',
        domainContent,
      });

      // Template should be loaded with domain section
      expect(mockTemplateService.load).toHaveBeenCalledWith(
        'reasoning',
        expect.objectContaining({
          prompt: 'Original prompt',
          domainContentSection: expect.stringContaining('WARNINGS'),
        })
      );
    });

    it('should build context section when no domain content', async () => {
      mockClaudeClient.complete.mockResolvedValue({
        content: [{ text: 'Optimized prompt' }],
      });

      const context = {
        specificAspects: 'Performance optimization',
        backgroundLevel: 'Expert',
      };

      await strategy.optimize({
        prompt: 'Original prompt',
        context,
        domainContent: null,
      });

      expect(mockTemplateService.load).toHaveBeenCalledWith(
        'reasoning',
        expect.objectContaining({
          prompt: 'Original prompt',
          domainContentSection: expect.stringContaining('USER-PROVIDED CONTEXT'),
        })
      );
    });

    it('should build transformation steps with domain content', async () => {
      mockClaudeClient.complete.mockResolvedValue({
        content: [{ text: 'Optimized' }],
      });

      await strategy.optimize({
        prompt: 'Test',
        domainContent: {
          warnings: ['W1'],
          deliverables: ['D1'],
          constraints: [],
        },
      });

      const templateVars = mockTemplateService.load.mock.calls[0][1];
      expect(templateVars.transformationSteps).toContain('Integrate pre-generated domain content');
      expect(templateVars.transformationSteps).toContain('Copy the WARNINGS');
      expect(templateVars.transformationSteps).toContain('Copy the DELIVERABLES');
      expect(templateVars.transformationSteps).toContain('Copy the CONSTRAINTS');
    });

    it('should build transformation steps without domain content', async () => {
      mockClaudeClient.complete.mockResolvedValue({
        content: [{ text: 'Optimized' }],
      });

      await strategy.optimize({
        prompt: 'Test',
        domainContent: null,
      });

      const templateVars = mockTemplateService.load.mock.calls[0][1];
      expect(templateVars.transformationSteps).toContain('Extract the core objective');
      expect(templateVars.transformationSteps).toContain('Determine specific deliverables');
      expect(templateVars.transformationSteps).toContain('Generate domain-specific warnings');
      expect(templateVars.transformationSteps).not.toContain('Integrate pre-generated');
    });

    it('should call Claude with template and correct config', async () => {
      mockTemplateService.load.mockResolvedValue('System prompt content');
      mockClaudeClient.complete.mockResolvedValue({
        content: [{ text: 'Optimized prompt result' }],
      });

      await strategy.optimize({
        prompt: 'Test prompt',
      });

      expect(mockClaudeClient.complete).toHaveBeenCalledWith(
        'System prompt content',
        expect.objectContaining({
          maxTokens: 3000,
          temperature: 0.3,
          timeout: 45000,
        })
      );
    });

    it('should return trimmed optimized text', async () => {
      mockClaudeClient.complete.mockResolvedValue({
        content: [{ text: '  \n Optimized prompt with whitespace  \n\n' }],
      });

      const result = await strategy.optimize({
        prompt: 'Test',
      });

      expect(result).toBe('Optimized prompt with whitespace');
    });

    it('should log optimization start and completion', async () => {
      const { logger } = require('../../../../infrastructure/Logger.js');

      mockClaudeClient.complete.mockResolvedValue({
        content: [{ text: 'Optimized' }],
      });

      await strategy.optimize({
        prompt: 'Original',
      });

      expect(logger.info).toHaveBeenCalledWith('Optimizing prompt with reasoning strategy');
      expect(logger.info).toHaveBeenCalledWith(
        'Reasoning optimization complete',
        expect.objectContaining({
          originalLength: 8,
          optimizedLength: 9,
        })
      );
    });

    it('should handle empty transformation steps when no domain content warnings/deliverables', async () => {
      mockClaudeClient.complete.mockResolvedValue({
        content: [{ text: 'Optimized' }],
      });

      // Domain content with empty arrays
      await strategy.optimize({
        prompt: 'Test',
        domainContent: {
          warnings: [],
          deliverables: [],
          constraints: ['C1'],
        },
      });

      const templateVars = mockTemplateService.load.mock.calls[0][1];
      // Should use fallback transformation steps since warnings and deliverables are empty
      expect(templateVars.transformationSteps).toContain('Determine specific deliverables');
    });

    it('should use domain transformation steps when either warnings or deliverables exist', async () => {
      mockClaudeClient.complete.mockResolvedValue({
        content: [{ text: 'Optimized' }],
      });

      // Only warnings, no deliverables
      await strategy.optimize({
        prompt: 'Test',
        domainContent: {
          warnings: ['W1'],
          deliverables: [],
          constraints: [],
        },
      });

      const templateVars = mockTemplateService.load.mock.calls[0][1];
      expect(templateVars.transformationSteps).toContain('Integrate pre-generated domain content');
    });
  });

  describe('buildDomainContentPrompt', () => {
    it('should create prompt with correct structure', () => {
      const prompt = strategy.buildDomainContentPrompt('Write a sorting algorithm');

      expect(prompt).toContain('domain expert');
      expect(prompt).toContain('Write a sorting algorithm');
      expect(prompt).toContain('<prompt>');
      expect(prompt).toContain('</prompt>');
      expect(prompt).toContain('warnings');
      expect(prompt).toContain('deliverables');
      expect(prompt).toContain('constraints');
      expect(prompt).toContain('"warnings": [');
      expect(prompt).toContain('"deliverables": [');
      expect(prompt).toContain('"constraints": [');
    });

    it('should request reasoning-specific elements', () => {
      const prompt = strategy.buildDomainContentPrompt('Test');

      expect(prompt).toContain('Sophisticated, domain-specific pitfalls to avoid');
      expect(prompt).toContain('not generic');
      expect(prompt).toContain('expert-level mistakes');
      expect(prompt).toContain('Concrete outputs that should be specified');
      expect(prompt).toContain('Hard technical or business constraints');
    });
  });

  describe('buildTransformationSteps', () => {
    it('should return domain-aware steps when domain content has warnings', () => {
      const domainContent = {
        warnings: ['W1'],
        deliverables: [],
        constraints: [],
      };

      const steps = strategy.buildTransformationSteps(domainContent, {}, {});

      expect(steps).toContain('Integrate pre-generated domain content');
      expect(steps).toContain('Copy the WARNINGS into your **Warnings** section');
      expect(steps).toContain('Copy the DELIVERABLES into your **Return Format** section');
      expect(steps).toContain('Copy the CONSTRAINTS into a **Constraints** section');
    });

    it('should return domain-aware steps when domain content has deliverables', () => {
      const domainContent = {
        warnings: [],
        deliverables: ['D1'],
        constraints: [],
      };

      const steps = strategy.buildTransformationSteps(domainContent, {}, {});

      expect(steps).toContain('Integrate pre-generated domain content');
    });

    it('should return fallback steps when no warnings or deliverables', () => {
      const domainContent = {
        warnings: [],
        deliverables: [],
        constraints: ['C1'],
      };

      const steps = strategy.buildTransformationSteps(domainContent, {}, {});

      expect(steps).toContain('Extract the core objective');
      expect(steps).toContain('Determine specific deliverables');
      expect(steps).toContain('Generate domain-specific warnings');
      expect(steps).not.toContain('Integrate pre-generated');
    });

    it('should return fallback steps when domain content is null', () => {
      const steps = strategy.buildTransformationSteps(null, {}, {});

      expect(steps).toContain('Extract the core objective');
      expect(steps).toContain('Remove all meta-instructions');
    });
  });

  describe('getConfig', () => {
    it('should return reasoning-specific configuration', () => {
      const config = strategy.getConfig();

      expect(config).toEqual({
        maxTokens: 3000,
        temperature: 0.3,
        timeout: 45000,
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long prompts', async () => {
      const longPrompt = 'a'.repeat(10000);

      mockClaudeClient.complete.mockResolvedValue({
        content: [{ text: '{"warnings": [], "deliverables": [], "constraints": []}' }],
      });

      const result = await strategy.generateDomainContent(longPrompt, {});

      expect(result).not.toBeNull();
      const promptArg = mockClaudeClient.complete.mock.calls[0][0];
      expect(promptArg).toContain(longPrompt);
    });

    it('should handle unicode in prompts', async () => {
      mockClaudeClient.complete.mockResolvedValue({
        content: [{ text: '{"warnings": [], "deliverables": [], "constraints": []}' }],
      });

      await strategy.generateDomainContent('🚀 Emoji prompt 中文', {});

      const promptArg = mockClaudeClient.complete.mock.calls[0][0];
      expect(promptArg).toContain('🚀 Emoji prompt 中文');
    });

    it('should handle whitespace-only responses gracefully', async () => {
      mockClaudeClient.complete.mockResolvedValue({
        content: [{ text: '   \n\n   ' }],
      });

      const result = await strategy.generateDomainContent('Test', {});

      expect(result).toBeNull();
    });

    it('should handle domain content with all empty arrays', () => {
      const domainContent = {
        warnings: [],
        deliverables: [],
        constraints: [],
      };

      const section = strategy.buildDomainContentSection(domainContent, {
        warnings: { title: 'WARNINGS' },
        deliverables: { title: 'DELIVERABLES' },
        constraints: { title: 'CONSTRAINTS' },
      });

      // Should return section but without specific items
      expect(section).toContain('PRE-GENERATED DOMAIN-SPECIFIC CONTENT');
    });

    it('should handle missing template gracefully', async () => {
      mockTemplateService.load.mockRejectedValue(new Error('Template not found'));

      await expect(
        strategy.optimize({
          prompt: 'Test',
        })
      ).rejects.toThrow('Template not found');
    });

    it('should handle Claude API failure during optimization', async () => {
      mockClaudeClient.complete.mockRejectedValue(new Error('API timeout'));

      await expect(
        strategy.optimize({
          prompt: 'Test',
        })
      ).rejects.toThrow('API timeout');
    });
  });

  describe('Integration with Base Class', () => {
    it('should use inherited buildDomainContentSection', async () => {
      mockClaudeClient.complete.mockResolvedValue({
        content: [{ text: 'Optimized' }],
      });

      const domainContent = {
        warnings: ['W1', 'W2'],
        deliverables: ['D1'],
      };

      await strategy.optimize({
        prompt: 'Test',
        domainContent,
      });

      const templateVars = mockTemplateService.load.mock.calls[0][1];
      expect(templateVars.domainContentSection).toContain('PRE-GENERATED DOMAIN-SPECIFIC CONTENT');
      expect(templateVars.domainContentSection).toContain('1. W1');
      expect(templateVars.domainContentSection).toContain('2. W2');
    });

    it('should use inherited buildContextSection', async () => {
      mockClaudeClient.complete.mockResolvedValue({
        content: [{ text: 'Optimized' }],
      });

      const context = {
        specificAspects: 'Security',
        backgroundLevel: 'Expert',
      };

      await strategy.optimize({
        prompt: 'Test',
        context,
        domainContent: null,
      });

      const templateVars = mockTemplateService.load.mock.calls[0][1];
      expect(templateVars.domainContentSection).toContain('USER-PROVIDED CONTEXT');
      expect(templateVars.domainContentSection).toContain('**Focus Areas:** Security');
    });

    it('should use inherited parseJsonFromResponse', async () => {
      // Test with markdown code fence
      mockClaudeClient.complete.mockResolvedValue({
        content: [
          {
            text: '```json\n{"warnings": ["W1"], "deliverables": [], "constraints": []}\n```',
          },
        ],
      });

      const result = await strategy.generateDomainContent('Test', {});

      expect(result.warnings).toEqual(['W1']);
    });
  });
});
