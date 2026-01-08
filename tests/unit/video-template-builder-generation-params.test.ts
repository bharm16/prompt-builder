import { describe, it, expect } from 'vitest';
import { OpenAIVideoTemplateBuilder } from '@server/services/prompt-optimization/strategies/video-templates/OpenAIVideoTemplateBuilder';
import { GroqVideoTemplateBuilder } from '@server/services/prompt-optimization/strategies/video-templates/GroqVideoTemplateBuilder';
import { OpenAIVideoTemplateBuilderLocked } from '@server/services/prompt-optimization/strategies/video-templates/OpenAIVideoTemplateBuilderLocked';
import { GroqVideoTemplateBuilderLocked } from '@server/services/prompt-optimization/strategies/video-templates/GroqVideoTemplateBuilderLocked';
import { type VideoTemplateContext } from '@server/services/prompt-optimization/strategies/video-templates/BaseVideoTemplateBuilder';

describe('VideoTemplateBuilder - Generation Params', () => {
  const mockContext: VideoTemplateContext = {
    userConcept: 'A cat sitting on a windowsill',
    interpretedPlan: null,
    includeInstructions: true,
  };

  const generationParams = {
    aspect_ratio: '16:9',
    resolution: '1080p',
    duration_s: 5,
    fps: 24,
    audio: true,
  };

  describe('OpenAIVideoTemplateBuilder', () => {
    it('should include generationParams in developerMessage', () => {
      const builder = new OpenAIVideoTemplateBuilder();
      const result = builder.buildTemplate({
        ...mockContext,
        generationParams,
      });

      expect(result.developerMessage).toBeDefined();
      expect(result.developerMessage).toContain('USER OVERRIDES');
      expect(result.developerMessage).toContain('- Aspect Ratio: 16:9');
      expect(result.developerMessage).toContain('- Resolution: 1080p');
      expect(result.developerMessage).toContain('- Duration: 5s');
      expect(result.developerMessage).toContain('- Frame Rate: 24fps');
      expect(result.developerMessage).toContain('- Audio: Enabled');
    });

    it('should handle boolean audio param correctly', () => {
      const builder = new OpenAIVideoTemplateBuilder();
      const result = builder.buildTemplate({
        ...mockContext,
        generationParams: { ...generationParams, audio: false },
      });

      expect(result.developerMessage).toContain('- Audio: Muted');
    });

    it('should not include USER OVERRIDES section if no params provided', () => {
      const builder = new OpenAIVideoTemplateBuilder();
      const result = builder.buildTemplate({
        ...mockContext,
      });

      expect(result.developerMessage).not.toContain('USER OVERRIDES');
    });
  });

  describe('GroqVideoTemplateBuilder', () => {
    it('should include generationParams in systemPrompt', () => {
      const builder = new GroqVideoTemplateBuilder();
      const result = builder.buildTemplate({
        ...mockContext,
        generationParams,
      });

      expect(result.systemPrompt).toContain('USER OVERRIDES');
      expect(result.systemPrompt).toContain('- Aspect Ratio: 16:9');
      expect(result.systemPrompt).toContain('- Resolution: 1080p');
      expect(result.systemPrompt).toContain('- Duration: 5s');
      expect(result.systemPrompt).toContain('- Frame Rate: 24fps');
      expect(result.systemPrompt).toContain('- Audio: Enabled');
    });

    it('should handle boolean audio param correctly', () => {
      const builder = new GroqVideoTemplateBuilder();
      const result = builder.buildTemplate({
        ...mockContext,
        generationParams: { ...generationParams, audio: false },
      });

      expect(result.systemPrompt).toContain('- Audio: Muted');
    });

    it('should not include USER OVERRIDES section if no params provided', () => {
      const builder = new GroqVideoTemplateBuilder();
      const result = builder.buildTemplate({
        ...mockContext,
      });

      expect(result.systemPrompt).not.toContain('USER OVERRIDES');
    });
  });

  describe('OpenAIVideoTemplateBuilderLocked', () => {
    it('should pass generationParams to base builder', () => {
      const builder = new OpenAIVideoTemplateBuilderLocked();
      const lockedSpans = [{ text: 'locked text' }];
      const result = builder.buildTemplate({
        ...mockContext,
        lockedSpans,
        generationParams,
      });

      // Locked builder appends to developerMessage, so we check if the base content is there
      expect(result.developerMessage).toContain('USER OVERRIDES');
      expect(result.developerMessage).toContain('- Aspect Ratio: 16:9');
      expect(result.developerMessage).toContain('LOCKED SPANS');
    });
  });

  describe('GroqVideoTemplateBuilderLocked', () => {
    it('should pass generationParams to base builder', () => {
      const builder = new GroqVideoTemplateBuilderLocked();
      const lockedSpans = [{ text: 'locked text' }];
      const result = builder.buildTemplate({
        ...mockContext,
        lockedSpans,
        generationParams,
      });

      // Locked builder appends to systemPrompt, so we check if the base content is there
      expect(result.systemPrompt).toContain('USER OVERRIDES');
      expect(result.systemPrompt).toContain('- Aspect Ratio: 16:9');
      expect(result.systemPrompt).toContain('LOCKED SPANS');
    });
  });
});
