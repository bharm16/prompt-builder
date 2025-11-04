import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VideoStrategy } from '../VideoStrategy.js';

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
      optimization: {
        video: 2000,
      },
    },
    temperatures: {
      optimization: {
        video: 0.4,
      },
    },
    timeouts: {
      optimization: {
        video: 30000,
      },
    },
  },
}));

vi.mock('../../../VideoPromptTemplates.js', () => ({
  generateVideoPrompt: vi.fn((prompt) => `VIDEO_TEMPLATE: ${prompt}`),
}));

describe('VideoStrategy', () => {
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

    strategy = new VideoStrategy(mockClaudeClient, mockTemplateService);
  });

  describe('Constructor', () => {
    it('should initialize with correct name', () => {
      expect(strategy.name).toBe('video');
    });

    it('should store claude client and template service', () => {
      expect(strategy.claudeClient).toBe(mockClaudeClient);
      expect(strategy.templateService).toBe(mockTemplateService);
    });
  });

  describe('generateDomainContent', () => {
    it('should always return null for video mode', async () => {
      const result = await strategy.generateDomainContent('Test prompt', {});
      expect(result).toBeNull();
    });

    it('should return null regardless of prompt content', async () => {
      const result1 = await strategy.generateDomainContent('', {});
      const result2 = await strategy.generateDomainContent('Complex video prompt', {});
      const result3 = await strategy.generateDomainContent('a'.repeat(10000), {});

      expect(result1).toBeNull();
      expect(result2).toBeNull();
      expect(result3).toBeNull();
    });

    it('should not call Claude client', async () => {
      await strategy.generateDomainContent('Test', {});
      expect(mockClaudeClient.complete).not.toHaveBeenCalled();
    });
  });

  describe('optimize', () => {
    it('should use generateVideoPrompt helper', async () => {
      const { generateVideoPrompt } = require('../../../VideoPromptTemplates.js');

      mockClaudeClient.complete.mockResolvedValue({
        content: [{ text: 'Optimized video prompt' }],
      });

      await strategy.optimize({
        prompt: 'Create a video of a sunset',
      });

      expect(generateVideoPrompt).toHaveBeenCalledWith('Create a video of a sunset');
    });

    it('should call Claude with generated system prompt', async () => {
      const { generateVideoPrompt } = require('../../../VideoPromptTemplates.js');
      generateVideoPrompt.mockReturnValue('System prompt for video generation');

      mockClaudeClient.complete.mockResolvedValue({
        content: [{ text: 'Optimized video prompt' }],
      });

      await strategy.optimize({
        prompt: 'Generate a beach scene',
      });

      expect(mockClaudeClient.complete).toHaveBeenCalledWith(
        'System prompt for video generation',
        expect.any(Object)
      );
    });

    it('should call Claude with correct config', async () => {
      mockClaudeClient.complete.mockResolvedValue({
        content: [{ text: 'Optimized' }],
      });

      await strategy.optimize({
        prompt: 'Test video prompt',
      });

      expect(mockClaudeClient.complete).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          maxTokens: 2000,
          temperature: 0.4,
          timeout: 30000,
        })
      );
    });

    it('should return trimmed optimized text', async () => {
      mockClaudeClient.complete.mockResolvedValue({
        content: [{ text: '  \n Optimized video prompt content  \n\n' }],
      });

      const result = await strategy.optimize({
        prompt: 'Original prompt',
      });

      expect(result).toBe('Optimized video prompt content');
    });

    it('should log optimization start and completion', async () => {
      const { logger } = require('../../../../infrastructure/Logger.js');

      mockClaudeClient.complete.mockResolvedValue({
        content: [{ text: 'Optimized video prompt' }],
      });

      await strategy.optimize({
        prompt: 'Test',
      });

      expect(logger.info).toHaveBeenCalledWith('Optimizing prompt with video strategy');
      expect(logger.info).toHaveBeenCalledWith(
        'Video optimization complete',
        expect.objectContaining({
          originalLength: 4,
          optimizedLength: expect.any(Number),
        })
      );
    });

    it('should ignore context parameter (video mode does not use it)', async () => {
      mockClaudeClient.complete.mockResolvedValue({
        content: [{ text: 'Optimized' }],
      });

      await strategy.optimize({
        prompt: 'Test',
        context: {
          specificAspects: 'Should be ignored',
          backgroundLevel: 'Expert',
        },
      });

      // Should not use template service (uses generateVideoPrompt instead)
      expect(mockTemplateService.load).not.toHaveBeenCalled();
    });

    it('should ignore domainContent parameter', async () => {
      mockClaudeClient.complete.mockResolvedValue({
        content: [{ text: 'Optimized' }],
      });

      await strategy.optimize({
        prompt: 'Test',
        domainContent: {
          warnings: ['Should be ignored'],
        },
      });

      expect(mockTemplateService.load).not.toHaveBeenCalled();
    });

    it('should ignore brainstormContext parameter', async () => {
      mockClaudeClient.complete.mockResolvedValue({
        content: [{ text: 'Optimized' }],
      });

      await strategy.optimize({
        prompt: 'Test',
        brainstormContext: {
          someData: 'Should be ignored',
        },
      });

      expect(mockTemplateService.load).not.toHaveBeenCalled();
    });
  });

  describe('getConfig', () => {
    it('should return video-specific configuration', () => {
      const config = strategy.getConfig();

      expect(config).toEqual({
        maxTokens: 2000,
        temperature: 0.4,
        timeout: 30000,
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long video prompts', async () => {
      const longPrompt = 'Create a video of '.repeat(1000) + 'a sunset';

      mockClaudeClient.complete.mockResolvedValue({
        content: [{ text: 'Optimized' }],
      });

      const result = await strategy.optimize({
        prompt: longPrompt,
      });

      expect(result).toBe('Optimized');

      const { generateVideoPrompt } = require('../../../VideoPromptTemplates.js');
      expect(generateVideoPrompt).toHaveBeenCalledWith(longPrompt);
    });

    it('should handle empty video prompts', async () => {
      mockClaudeClient.complete.mockResolvedValue({
        content: [{ text: 'Optimized empty prompt' }],
      });

      const result = await strategy.optimize({
        prompt: '',
      });

      expect(result).toBe('Optimized empty prompt');
    });

    it('should handle unicode characters in video prompts', async () => {
      mockClaudeClient.complete.mockResolvedValue({
        content: [{ text: 'Optimized unicode' }],
      });

      await strategy.optimize({
        prompt: '🎬 Video with emoji 中文字符',
      });

      const { generateVideoPrompt } = require('../../../VideoPromptTemplates.js');
      expect(generateVideoPrompt).toHaveBeenCalledWith('🎬 Video with emoji 中文字符');
    });

    it('should handle Claude API errors', async () => {
      mockClaudeClient.complete.mockRejectedValue(new Error('API timeout'));

      await expect(
        strategy.optimize({
          prompt: 'Test video',
        })
      ).rejects.toThrow('API timeout');
    });

    it('should handle whitespace-only responses', async () => {
      mockClaudeClient.complete.mockResolvedValue({
        content: [{ text: '   \n\n   ' }],
      });

      const result = await strategy.optimize({
        prompt: 'Test',
      });

      expect(result).toBe(''); // Trimmed to empty string
    });

    it('should handle responses with only newlines', async () => {
      mockClaudeClient.complete.mockResolvedValue({
        content: [{ text: '\n\n\n' }],
      });

      const result = await strategy.optimize({
        prompt: 'Test',
      });

      expect(result).toBe('');
    });

    it('should handle special characters in video prompts', async () => {
      mockClaudeClient.complete.mockResolvedValue({
        content: [{ text: 'Optimized special chars' }],
      });

      const result = await strategy.optimize({
        prompt: 'Video with <tags> and "quotes" and \'apostrophes\' and & symbols',
      });

      expect(result).toBe('Optimized special chars');
    });

    it('should handle multiline video prompts', async () => {
      const multilinePrompt = `Scene 1: A sunset over the ocean
Scene 2: Waves crashing on shore
Scene 3: Seagulls flying overhead`;

      mockClaudeClient.complete.mockResolvedValue({
        content: [{ text: 'Optimized multiline' }],
      });

      const result = await strategy.optimize({
        prompt: multilinePrompt,
      });

      expect(result).toBe('Optimized multiline');

      const { generateVideoPrompt } = require('../../../VideoPromptTemplates.js');
      expect(generateVideoPrompt).toHaveBeenCalledWith(multilinePrompt);
    });
  });

  describe('Integration with Base Class', () => {
    it('should inherit from BaseStrategy', () => {
      const BaseStrategy = require('../BaseStrategy.js').BaseStrategy;
      expect(strategy).toBeInstanceOf(BaseStrategy);
    });

    it('should have access to inherited methods', () => {
      expect(typeof strategy.buildDomainContentSection).toBe('function');
      expect(typeof strategy.buildContextSection).toBe('function');
      expect(typeof strategy.parseJsonFromResponse).toBe('function');
    });

    it('should override getConfig from base class', () => {
      const baseConfig = {
        maxTokens: 2500,
        temperature: 0.3,
        timeout: 30000,
      };

      const videoConfig = strategy.getConfig();

      expect(videoConfig).not.toEqual(baseConfig);
      expect(videoConfig.maxTokens).toBe(2000);
      expect(videoConfig.temperature).toBe(0.4);
    });
  });

  describe('generateVideoPrompt Interaction', () => {
    it('should pass prompt exactly as received', async () => {
      const { generateVideoPrompt } = require('../../../VideoPromptTemplates.js');

      mockClaudeClient.complete.mockResolvedValue({
        content: [{ text: 'Result' }],
      });

      const originalPrompt = 'Exact prompt text with specifics';
      await strategy.optimize({ prompt: originalPrompt });

      expect(generateVideoPrompt).toHaveBeenCalledWith(originalPrompt);
      expect(generateVideoPrompt).toHaveBeenCalledTimes(1);
    });

    it('should use return value from generateVideoPrompt', async () => {
      const { generateVideoPrompt } = require('../../../VideoPromptTemplates.js');
      const customSystemPrompt = 'Custom system prompt for video';
      generateVideoPrompt.mockReturnValue(customSystemPrompt);

      mockClaudeClient.complete.mockResolvedValue({
        content: [{ text: 'Result' }],
      });

      await strategy.optimize({ prompt: 'Test' });

      expect(mockClaudeClient.complete).toHaveBeenCalledWith(
        customSystemPrompt,
        expect.any(Object)
      );
    });
  });
});
