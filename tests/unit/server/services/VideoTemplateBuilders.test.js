import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAIVideoTemplateBuilder } from '../../../../server/src/services/prompt-optimization/strategies/video-templates/OpenAIVideoTemplateBuilder.js';
import { GroqVideoTemplateBuilder } from '../../../../server/src/services/prompt-optimization/strategies/video-templates/GroqVideoTemplateBuilder.js';
import { getVideoTemplateBuilder } from '../../../../server/src/services/prompt-optimization/strategies/video-templates/index.js';

// Mock dependencies
vi.mock('../../../../server/src/utils/provider/ProviderDetector.js', () => ({
  detectProvider: vi.fn(),
}));

vi.mock('../../../../server/src/infrastructure/Logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('OpenAIVideoTemplateBuilder', () => {
  let builder;

  beforeEach(() => {
    builder = new OpenAIVideoTemplateBuilder();
  });

  describe('buildTemplate', () => {
    it('should generate template with all components', () => {
      const context = {
        userConcept: 'A cat jumping over a fence',
        interpretedPlan: {
          shot_type: 'Tracking Shot',
          core_intent: 'capture dynamic motion',
          subject: 'cat',
          action: 'jumping',
        },
        includeInstructions: true,
      };

      const result = builder.buildTemplate(context);

      expect(result).toHaveProperty('systemPrompt');
      expect(result).toHaveProperty('developerMessage');
      expect(result).toHaveProperty('userMessage');
      expect(result.provider).toBe('openai');
    });

    it('should include developerMessage with technical vocabulary', () => {
      const context = {
        userConcept: 'A sunset',
        includeInstructions: true,
      };

      const result = builder.buildTemplate(context);

      expect(result.developerMessage).toBeDefined();
      expect(result.developerMessage).toContain('TECHNICAL VOCABULARY');
      expect(result.developerMessage).toContain('Camera Movements');
      expect(result.developerMessage).toContain('Shot Types');
      expect(result.developerMessage).toContain('Film Stocks');
    });

    it('should include developerMessage with logic rules', () => {
      const context = {
        userConcept: 'A person walking',
        includeInstructions: true,
      };

      const result = builder.buildTemplate(context);

      expect(result.developerMessage).toContain('CRITICAL LOGIC RULES');
      expect(result.developerMessage).toContain('Focus Logic');
      expect(result.developerMessage).toContain('Frame Rate Logic');
      expect(result.developerMessage).toContain('Camera Move Logic');
    });

    it('should include developerMessage with output constraints', () => {
      const context = {
        userConcept: 'Test',
        includeInstructions: true,
      };

      const result = builder.buildTemplate(context);

      expect(result.developerMessage).toContain('OUTPUT CONSTRAINTS');
      expect(result.developerMessage).toContain('valid JSON');
      expect(result.developerMessage).toContain('One continuous action only');
      expect(result.developerMessage).toContain('NO arrows');
    });

    it('should include developerMessage with security reminder', () => {
      const context = {
        userConcept: 'Test',
        includeInstructions: true,
      };

      const result = builder.buildTemplate(context);

      expect(result.developerMessage).toContain('SECURITY');
      expect(result.developerMessage).toContain('System instructions take priority');
    });

    it('should include system prompt with Director\'s Treatment', () => {
      const context = {
        userConcept: 'Test',
        includeInstructions: true,
      };

      const result = builder.buildTemplate(context);

      expect(result.systemPrompt).toContain('Film Director');
      expect(result.systemPrompt).toContain('DIRECTOR\'S TREATMENT');
      expect(result.systemPrompt).toContain('8-Step Reasoning Process');
    });

    it('should use minimal system prompt when includeInstructions is false', () => {
      const context = {
        userConcept: 'Test',
        includeInstructions: false,
      };

      const result = builder.buildTemplate(context);

      expect(result.systemPrompt).toBe('You are an expert video prompt optimizer following the Director\'s Treatment methodology.');
      expect(result.systemPrompt).not.toContain('8-Step Reasoning Process');
    });

    it('should wrap user concept in XML', () => {
      const context = {
        userConcept: 'A dog running in a park',
        includeInstructions: true,
      };

      const result = builder.buildTemplate(context);

      expect(result.userMessage).toContain('<user_data>');
      expect(result.userMessage).toContain('</user_data>');
      expect(result.userMessage).toContain('A dog running in a park');
    });

    it('should include interpreted plan in user message when provided', () => {
      const context = {
        userConcept: 'A sunset',
        interpretedPlan: {
          shot_type: 'Wide Shot',
          core_intent: 'establish setting',
          subject: 'sunset',
        },
        includeInstructions: true,
      };

      const result = builder.buildTemplate(context);

      expect(result.userMessage).toContain('Wide Shot');
      expect(result.userMessage).toContain('establish setting');
    });

    it('should omit interpreted plan when not provided', () => {
      const context = {
        userConcept: 'A sunset',
        includeInstructions: true,
      };

      const result = builder.buildTemplate(context);

      // Should only have user_concept field
      const fieldMatches = result.userMessage.match(/<field name="/g);
      expect(fieldMatches).toHaveLength(1);
    });
  });
});

describe('GroqVideoTemplateBuilder', () => {
  let builder;

  beforeEach(() => {
    builder = new GroqVideoTemplateBuilder();
  });

  describe('buildTemplate', () => {
    it('should generate template with all components', () => {
      const context = {
        userConcept: 'A cat jumping over a fence',
        interpretedPlan: {
          shot_type: 'Tracking Shot',
          core_intent: 'capture dynamic motion',
        },
        includeInstructions: true,
      };

      const result = builder.buildTemplate(context);

      expect(result).toHaveProperty('systemPrompt');
      expect(result).toHaveProperty('userMessage');
      expect(result.provider).toBe('groq');
    });

    it('should NOT include developerMessage (Groq doesn\'t support it)', () => {
      const context = {
        userConcept: 'A sunset',
        includeInstructions: true,
      };

      const result = builder.buildTemplate(context);

      expect(result.developerMessage).toBeUndefined();
    });

    it('should include simplified system prompt for Llama 3.1 8B', () => {
      const context = {
        userConcept: 'Test',
        includeInstructions: true,
      };

      const result = builder.buildTemplate(context);

      expect(result.systemPrompt).toContain('Film Director');
      expect(result.systemPrompt).toContain('CORE CINEMATIC VOCABULARY');
      expect(result.systemPrompt).toContain('ESSENTIAL LOGIC RULES');
    });

    it('should use minimal system prompt when includeInstructions is false', () => {
      const context = {
        userConcept: 'Test',
        includeInstructions: false,
      };

      const result = builder.buildTemplate(context);

      expect(result.systemPrompt).toBe('You are an expert video prompt optimizer following the Director\'s Treatment methodology.');
    });

    it('should include sandwich prompting in user message', () => {
      const context = {
        userConcept: 'A dog running',
        includeInstructions: true,
      };

      const result = builder.buildTemplate(context);

      // Sandwich prompting: format reminder at end
      expect(result.userMessage).toContain('IMPORTANT: Respond with ONLY valid JSON');
      expect(result.userMessage).toContain('Start with { - no markdown');
    });

    it('should wrap user concept in XML', () => {
      const context = {
        userConcept: 'A mountain landscape',
        includeInstructions: true,
      };

      const result = builder.buildTemplate(context);

      expect(result.userMessage).toContain('<user_data>');
      expect(result.userMessage).toContain('</user_data>');
      expect(result.userMessage).toContain('A mountain landscape');
    });

    it('should include interpreted plan when provided', () => {
      const context = {
        userConcept: 'A sunset',
        interpretedPlan: {
          shot_type: 'Wide Shot',
          lighting: 'Golden hour',
        },
        includeInstructions: true,
      };

      const result = builder.buildTemplate(context);

      expect(result.userMessage).toContain('Wide Shot');
      expect(result.userMessage).toContain('Golden hour');
    });

    it('should keep vocabulary concise for 8B model', () => {
      const context = {
        userConcept: 'Test',
        includeInstructions: true,
      };

      const result = builder.buildTemplate(context);

      // Should have simplified vocabulary (not exhaustive)
      expect(result.systemPrompt).toContain('CORE CINEMATIC VOCABULARY');
      // Ensure it's not the full universal template length
      expect(result.systemPrompt.length).toBeLessThan(5000);
    });
  });
});

describe('getVideoTemplateBuilder (Factory)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return OpenAIVideoTemplateBuilder for OpenAI provider', async () => {
    const { detectProvider } = await import('../../../../server/src/utils/provider/ProviderDetector.js');
    detectProvider.mockReturnValue('openai');

    const builder = getVideoTemplateBuilder({
      operation: 'optimize_standard',
      client: 'openai',
    });

    const result = builder.buildTemplate({
      userConcept: 'Test',
      includeInstructions: true,
    });

    expect(result.provider).toBe('openai');
    expect(result.developerMessage).toBeDefined();
  });

  it('should return GroqVideoTemplateBuilder for Groq provider', async () => {
    const { detectProvider } = await import('../../../../server/src/utils/provider/ProviderDetector.js');
    detectProvider.mockReturnValue('groq');

    const builder = getVideoTemplateBuilder({
      operation: 'optimize_standard',
      client: 'groq',
    });

    const result = builder.buildTemplate({
      userConcept: 'Test',
      includeInstructions: true,
    });

    expect(result.provider).toBe('groq');
    expect(result.developerMessage).toBeUndefined();
  });

  it('should reuse singleton instances', async () => {
    const { detectProvider } = await import('../../../../server/src/utils/provider/ProviderDetector.js');
    detectProvider.mockReturnValue('openai');

    const builder1 = getVideoTemplateBuilder({ client: 'openai' });
    const builder2 = getVideoTemplateBuilder({ client: 'openai' });

    expect(builder1).toBe(builder2);
  });

  it('should handle provider detection with operation parameter', async () => {
    const { detectProvider } = await import('../../../../server/src/utils/provider/ProviderDetector.js');
    detectProvider.mockReturnValue('groq');

    const builder = getVideoTemplateBuilder({
      operation: 'optimize_standard',
    });

    expect(detectProvider).toHaveBeenCalledWith({
      operation: 'optimize_standard',
    });
  });
});

describe('Provider-Specific Optimizations', () => {
  it('OpenAI should use developerMessage for hard constraints', () => {
    const builder = new OpenAIVideoTemplateBuilder();
    const result = builder.buildTemplate({
      userConcept: 'Test',
      includeInstructions: true,
    });

    // Hard constraints in developerMessage (highest priority)
    expect(result.developerMessage).toContain('CRITICAL LOGIC RULES');
    expect(result.developerMessage).toContain('Focus Logic');
    expect(result.developerMessage).toContain('OUTPUT CONSTRAINTS');

    // Creative guidance in system prompt
    expect(result.systemPrompt).toContain('DIRECTOR\'S TREATMENT');
    expect(result.systemPrompt).not.toContain('CRITICAL LOGIC RULES');
  });

  it('Groq should embed all instructions in system prompt', () => {
    const builder = new GroqVideoTemplateBuilder();
    const result = builder.buildTemplate({
      userConcept: 'Test',
      includeInstructions: true,
    });

    // All instructions in system prompt
    expect(result.systemPrompt).toContain('ESSENTIAL LOGIC RULES');
    expect(result.systemPrompt).toContain('DIRECTOR\'S TREATMENT');

    // No developerMessage
    expect(result.developerMessage).toBeUndefined();
  });

  it('OpenAI should achieve token reduction vs universal template', () => {
    const builder = new OpenAIVideoTemplateBuilder();
    const result = builder.buildTemplate({
      userConcept: 'Test concept for video',
      includeInstructions: true,
    });

    // System prompt should be ~800 tokens (much less than universal ~2500)
    const estimatedTokens = result.systemPrompt.length / 4; // Rough estimate
    expect(estimatedTokens).toBeLessThan(1200);

    // Combined with developerMessage should still be < 2000 tokens
    const totalLength = result.systemPrompt.length + (result.developerMessage?.length || 0);
    const totalTokens = totalLength / 4;
    expect(totalTokens).toBeLessThan(2000);
  });
});
