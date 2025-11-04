import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseStrategy } from '../BaseStrategy.js';

// Mock logger
vi.mock('../../../../infrastructure/Logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Concrete implementation for testing abstract base class
class TestStrategy extends BaseStrategy {
  async optimize(params) {
    return 'optimized: ' + params.prompt;
  }
}

describe('BaseStrategy', () => {
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

    strategy = new TestStrategy('test', mockClaudeClient, mockTemplateService);
  });

  describe('Constructor', () => {
    it('should initialize with correct name and dependencies', () => {
      expect(strategy.name).toBe('test');
      expect(strategy.claudeClient).toBe(mockClaudeClient);
      expect(strategy.templateService).toBe(mockTemplateService);
    });
  });

  describe('Abstract Methods', () => {
    it('should throw error if optimize() not implemented', async () => {
      const baseStrategy = new BaseStrategy('base', mockClaudeClient, mockTemplateService);

      await expect(
        baseStrategy.optimize({ prompt: 'test' })
      ).rejects.toThrow('optimize() must be implemented by BaseStrategy');
    });

    it('should return null for default generateDomainContent()', async () => {
      const result = await strategy.generateDomainContent('test', {});
      expect(result).toBeNull();
    });
  });

  describe('buildDomainContentSection', () => {
    it('should return empty string when no domain content provided', () => {
      const result = strategy.buildDomainContentSection(null, {});
      expect(result).toBe('');
    });

    it('should build correct section with domain content', () => {
      const domainContent = {
        warnings: ['Warning 1', 'Warning 2', 'Warning 3'],
        deliverables: ['Deliverable 1', 'Deliverable 2'],
        constraints: ['Constraint 1'],
      };

      const sectionConfig = {
        warnings: { title: 'WARNINGS' },
        deliverables: { title: 'DELIVERABLES' },
        constraints: { title: 'CONSTRAINTS' },
      };

      const result = strategy.buildDomainContentSection(domainContent, sectionConfig);

      expect(result).toContain('PRE-GENERATED DOMAIN-SPECIFIC CONTENT');
      expect(result).toContain('**WARNINGS:**');
      expect(result).toContain('1. Warning 1');
      expect(result).toContain('2. Warning 2');
      expect(result).toContain('3. Warning 3');
      expect(result).toContain('**DELIVERABLES:**');
      expect(result).toContain('1. Deliverable 1');
      expect(result).toContain('2. Deliverable 2');
      expect(result).toContain('**CONSTRAINTS:**');
      expect(result).toContain('1. Constraint 1');
      expect(result).toContain('incorporate these verbatim');
      expect(result).toContain('do not make them more generic');
    });

    it('should skip empty sections', () => {
      const domainContent = {
        warnings: ['Warning 1'],
        deliverables: [], // Empty array
        constraints: null, // Null value
      };

      const sectionConfig = {
        warnings: { title: 'WARNINGS' },
        deliverables: { title: 'DELIVERABLES' },
        constraints: { title: 'CONSTRAINTS' },
      };

      const result = strategy.buildDomainContentSection(domainContent, sectionConfig);

      expect(result).toContain('**WARNINGS:**');
      expect(result).not.toContain('**DELIVERABLES:**');
      expect(result).not.toContain('**CONSTRAINTS:**');
    });

    it('should handle sections with many items', () => {
      const domainContent = {
        items: Array.from({ length: 10 }, (_, i) => `Item ${i + 1}`),
      };

      const sectionConfig = {
        items: { title: 'ITEMS' },
      };

      const result = strategy.buildDomainContentSection(domainContent, sectionConfig);

      expect(result).toContain('1. Item 1');
      expect(result).toContain('10. Item 10');
    });

    it('should preserve exact item text', () => {
      const domainContent = {
        technical: ['Use O(n log n) algorithm', 'Ensure thread-safety with mutex locks'],
      };

      const sectionConfig = {
        technical: { title: 'TECHNICAL REQUIREMENTS' },
      };

      const result = strategy.buildDomainContentSection(domainContent, sectionConfig);

      expect(result).toContain('1. Use O(n log n) algorithm');
      expect(result).toContain('2. Ensure thread-safety with mutex locks');
    });
  });

  describe('buildContextSection', () => {
    it('should return empty string when no context provided', () => {
      const result = strategy.buildContextSection(null);
      expect(result).toBe('');
    });

    it('should return empty string when context is empty object', () => {
      const result = strategy.buildContextSection({});
      expect(result).toBe('');
    });

    it('should return empty string when all context values are falsy', () => {
      const result = strategy.buildContextSection({
        specificAspects: null,
        backgroundLevel: '',
        intendedUse: undefined,
      });
      expect(result).toBe('');
    });

    it('should build section with all context fields', () => {
      const context = {
        specificAspects: 'Security and performance',
        backgroundLevel: 'Expert',
        intendedUse: 'Production deployment',
      };

      const result = strategy.buildContextSection(context);

      expect(result).toContain('USER-PROVIDED CONTEXT');
      expect(result).toContain('**Focus Areas:** Security and performance');
      expect(result).toContain('**Expertise Level:** Expert');
      expect(result).toContain('**Intended Use:** Production deployment');
      expect(result).toContain('MUST be integrated');
    });

    it('should include only provided context fields', () => {
      const context = {
        specificAspects: 'Error handling',
        backgroundLevel: null,
        intendedUse: null,
      };

      const result = strategy.buildContextSection(context);

      expect(result).toContain('**Focus Areas:** Error handling');
      expect(result).not.toContain('**Expertise Level:**');
      expect(result).not.toContain('**Intended Use:**');
    });

    it('should handle context with only backgroundLevel', () => {
      const context = {
        backgroundLevel: 'Beginner',
      };

      const result = strategy.buildContextSection(context);

      expect(result).toContain('**Expertise Level:** Beginner');
    });

    it('should handle context with only intendedUse', () => {
      const context = {
        intendedUse: 'Educational tutorial',
      };

      const result = strategy.buildContextSection(context);

      expect(result).toContain('**Intended Use:** Educational tutorial');
    });
  });

  describe('parseJsonFromResponse', () => {
    it('should parse plain JSON', () => {
      const json = '{"key": "value", "number": 42}';
      const result = strategy.parseJsonFromResponse(json);

      expect(result).toEqual({ key: 'value', number: 42 });
    });

    it('should parse JSON with leading/trailing whitespace', () => {
      const json = '  \n{"key": "value"}  \n';
      const result = strategy.parseJsonFromResponse(json);

      expect(result).toEqual({ key: 'value' });
    });

    it('should extract JSON from markdown code fence with json label', () => {
      const response = '```json\n{"key": "value"}\n```';
      const result = strategy.parseJsonFromResponse(response);

      expect(result).toEqual({ key: 'value' });
    });

    it('should extract JSON from markdown code fence without json label', () => {
      const response = '```\n{"key": "value"}\n```';
      const result = strategy.parseJsonFromResponse(response);

      expect(result).toEqual({ key: 'value' });
    });

    it('should extract JSON from code fence with extra text before', () => {
      const response = 'Here is the result:\n```json\n{"key": "value"}\n```';
      const result = strategy.parseJsonFromResponse(response);

      expect(result).toEqual({ key: 'value' });
    });

    it('should extract JSON from code fence with extra text after', () => {
      const response = '```json\n{"key": "value"}\n```\nThat was the result.';
      const result = strategy.parseJsonFromResponse(response);

      expect(result).toEqual({ key: 'value' });
    });

    it('should parse complex nested JSON', () => {
      const json = JSON.stringify({
        warnings: ['Warning 1', 'Warning 2'],
        nested: {
          deep: {
            value: 42,
          },
        },
      });

      const result = strategy.parseJsonFromResponse(json);

      expect(result).toEqual({
        warnings: ['Warning 1', 'Warning 2'],
        nested: {
          deep: {
            value: 42,
          },
        },
      });
    });

    it('should handle JSON with escaped characters', () => {
      const json = '{"message": "Line 1\\nLine 2\\tTabbed"}';
      const result = strategy.parseJsonFromResponse(json);

      expect(result).toEqual({ message: 'Line 1\nLine 2\tTabbed' });
    });

    it('should throw error for invalid JSON', () => {
      const { logger } = require('../../../../infrastructure/Logger.js');

      const invalid = '{invalid json}';

      expect(() => strategy.parseJsonFromResponse(invalid)).toThrow('Invalid JSON response from LLM');
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to parse JSON from response',
        expect.objectContaining({
          strategy: 'test',
          error: expect.any(String),
          rawOutput: '{invalid json}',
        })
      );
    });

    it('should throw error for empty string', () => {
      expect(() => strategy.parseJsonFromResponse('')).toThrow('Invalid JSON response from LLM');
    });

    it('should throw error for non-JSON text', () => {
      expect(() => strategy.parseJsonFromResponse('This is not JSON')).toThrow(
        'Invalid JSON response from LLM'
      );
    });

    it('should log truncated output on error', () => {
      const { logger } = require('../../../../infrastructure/Logger.js');

      const longInvalid = 'x'.repeat(300) + '{invalid}';

      expect(() => strategy.parseJsonFromResponse(longInvalid)).toThrow();

      // Should truncate to 200 chars
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to parse JSON from response',
        expect.objectContaining({
          rawOutput: expect.stringMatching(/^x{200}$/),
        })
      );
    });

    it('should handle JSON with unicode characters', () => {
      const json = '{"emoji": "🚀", "chinese": "中文"}';
      const result = strategy.parseJsonFromResponse(json);

      expect(result).toEqual({ emoji: '🚀', chinese: '中文' });
    });

    it('should handle JSON arrays', () => {
      const json = '["item1", "item2", "item3"]';
      const result = strategy.parseJsonFromResponse(json);

      expect(result).toEqual(['item1', 'item2', 'item3']);
    });

    it('should extract multiline JSON from code fence', () => {
      const response = `\`\`\`json
{
  "warnings": [
    "Warning 1",
    "Warning 2"
  ],
  "deliverables": [
    "Deliverable 1"
  ]
}
\`\`\``;

      const result = strategy.parseJsonFromResponse(response);

      expect(result).toEqual({
        warnings: ['Warning 1', 'Warning 2'],
        deliverables: ['Deliverable 1'],
      });
    });
  });

  describe('getConfig', () => {
    it('should return default configuration', () => {
      const config = strategy.getConfig();

      expect(config).toEqual({
        maxTokens: 2500,
        temperature: 0.3,
        timeout: 30000,
      });
    });

    it('should be overridable by subclasses', () => {
      class CustomStrategy extends BaseStrategy {
        async optimize() {
          return 'optimized';
        }

        getConfig() {
          return {
            maxTokens: 5000,
            temperature: 0.7,
            timeout: 60000,
          };
        }
      }

      const customStrategy = new CustomStrategy('custom', mockClaudeClient, mockTemplateService);
      const config = customStrategy.getConfig();

      expect(config).toEqual({
        maxTokens: 5000,
        temperature: 0.7,
        timeout: 60000,
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle domain content with undefined sections', () => {
      const domainContent = {
        warnings: ['Warning 1'],
        deliverables: undefined,
      };

      const sectionConfig = {
        warnings: { title: 'WARNINGS' },
        deliverables: { title: 'DELIVERABLES' },
      };

      const result = strategy.buildDomainContentSection(domainContent, sectionConfig);

      expect(result).toContain('**WARNINGS:**');
      expect(result).not.toContain('**DELIVERABLES:**');
    });

    it('should handle context with extra unexpected fields', () => {
      const context = {
        specificAspects: 'Testing',
        unexpectedField: 'Should be ignored',
        anotherExtra: 123,
      };

      const result = strategy.buildContextSection(context);

      expect(result).toContain('**Focus Areas:** Testing');
      expect(result).not.toContain('unexpectedField');
      expect(result).not.toContain('anotherExtra');
    });

    it('should handle JSON parsing with BOM character', () => {
      // BOM (Byte Order Mark) at start
      const json = '\uFEFF{"key": "value"}';
      const result = strategy.parseJsonFromResponse(json);

      expect(result).toEqual({ key: 'value' });
    });

    it('should handle empty domain content object', () => {
      const result = strategy.buildDomainContentSection({}, {});
      expect(result).toBe('');
    });

    it('should handle section config with no matching content', () => {
      const domainContent = {
        fieldA: ['Item A'],
      };

      const sectionConfig = {
        fieldB: { title: 'FIELD B' },
        fieldC: { title: 'FIELD C' },
      };

      const result = strategy.buildDomainContentSection(domainContent, sectionConfig);

      // Should have header but no sections
      expect(result).toContain('PRE-GENERATED DOMAIN-SPECIFIC CONTENT');
      expect(result).not.toContain('**FIELD B:**');
      expect(result).not.toContain('**FIELD C:**');
    });
  });
});
