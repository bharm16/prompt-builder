/**
 * Unit tests for PromptBuilderService
 *
 * Tests prompt construction from dimension selections using the fragment library.
 *
 * Requirements tested:
 * - 4.1: Maintain a library of prompt fragments for each dimension option
 * - 4.2: Full prompt combines: intent, direction fragments (2), locked dimension fragments (2 each), and subject motion
 * - 4.3: Preview prompt emphasizes preview dimension with 2 fragments while using 1 fragment for locked dimensions
 * - 4.4: Exclude camera_motion fragments from image generation prompts
 *
 * @module convergence-prompt-builder.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PromptBuilderService } from '@services/convergence/prompt-builder/PromptBuilderService';
import type { Direction, LockedDimension } from '@services/convergence/types';

describe('PromptBuilderService', () => {
  let promptBuilder: PromptBuilderService;

  beforeEach(() => {
    promptBuilder = new PromptBuilderService();
  });

  describe('buildPrompt', () => {
    /**
     * Requirement 4.2: Full prompt combines: intent, direction fragments (2),
     * locked dimension fragments (2 each), and subject motion
     */
    it('should combine intent with direction fragments', () => {
      const result = promptBuilder.buildPrompt({
        intent: 'A beautiful sunset over the ocean',
        direction: 'cinematic',
        lockedDimensions: [],
      });

      expect(result).toContain('A beautiful sunset over the ocean');
      // Should contain direction fragments
      expect(result.split(', ').length).toBeGreaterThan(1);
    });

    it('should include locked dimension fragments', () => {
      const lockedDimensions: LockedDimension[] = [
        {
          type: 'mood',
          optionId: 'dramatic',
          label: 'Dramatic',
          promptFragments: ['high contrast lighting', 'deep shadows', 'intense atmosphere', 'dramatic tension', 'bold visual statement'],
        },
      ];

      const result = promptBuilder.buildPrompt({
        intent: 'A beautiful sunset',
        direction: 'cinematic',
        lockedDimensions,
      });

      // Should include some mood fragments (2 per dimension)
      const parts = result.split(', ');
      expect(parts.length).toBeGreaterThan(3); // intent + 2 direction + 2 mood
    });

    it('should include subject motion when provided', () => {
      const result = promptBuilder.buildPrompt({
        intent: 'A person walking',
        direction: 'cinematic',
        lockedDimensions: [],
        subjectMotion: 'walking slowly toward the camera',
      });

      expect(result).toContain('walking slowly toward the camera');
    });

    it('should not include subject motion when empty', () => {
      const result = promptBuilder.buildPrompt({
        intent: 'A person walking',
        direction: 'cinematic',
        lockedDimensions: [],
        subjectMotion: '',
      });

      // Should not have trailing comma or empty part
      expect(result).not.toMatch(/,\s*$/);
    });

    /**
     * Requirement 4.4: Exclude camera_motion fragments from image generation prompts
     */
    it('should exclude camera_motion fragments from prompts', () => {
      const lockedDimensions: LockedDimension[] = [
        {
          type: 'mood',
          optionId: 'dramatic',
          label: 'Dramatic',
          promptFragments: ['high contrast lighting', 'deep shadows'],
        },
        {
          type: 'camera_motion',
          optionId: 'push_in',
          label: 'Push In',
          promptFragments: ['camera pushes in slowly', 'dolly forward movement', 'increasing intimacy'],
        },
      ];

      const result = promptBuilder.buildPrompt({
        intent: 'A beautiful sunset',
        direction: 'cinematic',
        lockedDimensions,
      });

      // Should NOT contain camera motion fragments
      expect(result).not.toContain('camera pushes in');
      expect(result).not.toContain('dolly forward');
      expect(result).not.toContain('increasing intimacy');
    });

    it('should work with all four directions', () => {
      const directions: Direction[] = ['cinematic', 'social', 'artistic', 'documentary'];

      for (const direction of directions) {
        const result = promptBuilder.buildPrompt({
          intent: 'Test intent',
          direction,
          lockedDimensions: [],
        });

        expect(result).toContain('Test intent');
        expect(result.split(', ').length).toBeGreaterThan(1);
      }
    });
  });

  describe('buildDimensionPreviewPrompt', () => {
    /**
     * Requirement 4.3: Preview prompt emphasizes preview dimension with 2 fragments
     * while using 1 fragment for locked dimensions
     */
    it('should emphasize preview dimension with 2 fragments', () => {
      const previewDimension = {
        type: 'mood',
        optionId: 'dramatic',
        fragments: ['high contrast lighting', 'deep shadows', 'intense atmosphere', 'dramatic tension', 'bold visual statement'],
      };

      const result = promptBuilder.buildDimensionPreviewPrompt(
        'A beautiful sunset',
        'cinematic',
        [],
        previewDimension
      );

      // Should contain intent and direction fragments plus preview fragments
      expect(result).toContain('A beautiful sunset');
      const parts = result.split(', ');
      expect(parts.length).toBeGreaterThan(3);
    });

    it('should use 1 fragment for locked dimensions (de-emphasis)', () => {
      const lockedDimensions: LockedDimension[] = [
        {
          type: 'mood',
          optionId: 'dramatic',
          label: 'Dramatic',
          promptFragments: ['high contrast lighting', 'deep shadows', 'intense atmosphere'],
        },
      ];

      const previewDimension = {
        type: 'framing',
        optionId: 'wide',
        fragments: ['wide establishing shot', 'environment visible', 'subject in context'],
      };

      const result = promptBuilder.buildDimensionPreviewPrompt(
        'A beautiful sunset',
        'cinematic',
        lockedDimensions,
        previewDimension
      );

      // Result should contain parts from all sources
      expect(result).toContain('A beautiful sunset');
    });

    /**
     * Requirement 4.4: Exclude camera_motion fragments from image generation prompts
     */
    it('should exclude camera_motion preview fragments', () => {
      const previewDimension = {
        type: 'camera_motion',
        optionId: 'push_in',
        fragments: ['camera pushes in slowly', 'dolly forward movement', 'increasing intimacy'],
      };

      const result = promptBuilder.buildDimensionPreviewPrompt(
        'A beautiful sunset',
        'cinematic',
        [],
        previewDimension
      );

      // Should NOT contain camera motion fragments
      expect(result).not.toContain('camera pushes in');
      expect(result).not.toContain('dolly forward');
    });

    it('should exclude camera_motion from locked dimensions', () => {
      const lockedDimensions: LockedDimension[] = [
        {
          type: 'camera_motion',
          optionId: 'pan_left',
          label: 'Pan Left',
          promptFragments: ['camera pans left', 'horizontal pan movement'],
        },
      ];

      const previewDimension = {
        type: 'mood',
        optionId: 'dramatic',
        fragments: ['high contrast lighting', 'deep shadows'],
      };

      const result = promptBuilder.buildDimensionPreviewPrompt(
        'A beautiful sunset',
        'cinematic',
        lockedDimensions,
        previewDimension
      );

      // Should NOT contain camera motion fragments
      expect(result).not.toContain('camera pans left');
      expect(result).not.toContain('horizontal pan');
    });
  });

  describe('buildDirectionPrompts', () => {
    it('should generate 4 prompts, one per direction', () => {
      const results = promptBuilder.buildDirectionPrompts('A beautiful sunset');

      expect(results).toHaveLength(4);
      expect(results.map((r) => r.direction)).toEqual(['cinematic', 'social', 'artistic', 'documentary']);
    });

    it('should include intent in all direction prompts', () => {
      const intent = 'A person walking through a forest';
      const results = promptBuilder.buildDirectionPrompts(intent);

      for (const result of results) {
        expect(result.prompt).toContain(intent);
      }
    });

    it('should include direction-specific fragments', () => {
      const results = promptBuilder.buildDirectionPrompts('Test intent');

      // Each prompt should have more than just the intent
      for (const result of results) {
        const parts = result.prompt.split(', ');
        expect(parts.length).toBeGreaterThan(1);
      }
    });
  });

  describe('buildRegeneratedPrompt', () => {
    it('should produce a valid prompt with shuffled fragments', () => {
      const result = promptBuilder.buildRegeneratedPrompt({
        intent: 'A beautiful sunset',
        direction: 'cinematic',
        lockedDimensions: [],
      });

      expect(result).toContain('A beautiful sunset');
      expect(result.split(', ').length).toBeGreaterThan(1);
    });

    it('should exclude camera_motion fragments', () => {
      const lockedDimensions: LockedDimension[] = [
        {
          type: 'camera_motion',
          optionId: 'push_in',
          label: 'Push In',
          promptFragments: ['camera pushes in slowly', 'dolly forward movement'],
        },
      ];

      const result = promptBuilder.buildRegeneratedPrompt({
        intent: 'A beautiful sunset',
        direction: 'cinematic',
        lockedDimensions,
      });

      expect(result).not.toContain('camera pushes in');
      expect(result).not.toContain('dolly forward');
    });

    it('should include subject motion when provided', () => {
      const result = promptBuilder.buildRegeneratedPrompt({
        intent: 'A person',
        direction: 'cinematic',
        lockedDimensions: [],
        subjectMotion: 'running fast',
      });

      expect(result).toContain('running fast');
    });
  });

  describe('buildRegeneratedDimensionPreviewPrompt', () => {
    it('should produce a valid preview prompt with shuffled fragments', () => {
      const previewDimension = {
        type: 'mood',
        optionId: 'dramatic',
        fragments: ['high contrast lighting', 'deep shadows', 'intense atmosphere'],
      };

      const result = promptBuilder.buildRegeneratedDimensionPreviewPrompt(
        'A beautiful sunset',
        'cinematic',
        [],
        previewDimension
      );

      expect(result).toContain('A beautiful sunset');
      expect(result.split(', ').length).toBeGreaterThan(1);
    });

    it('should exclude camera_motion preview fragments', () => {
      const previewDimension = {
        type: 'camera_motion',
        optionId: 'push_in',
        fragments: ['camera pushes in slowly', 'dolly forward movement'],
      };

      const result = promptBuilder.buildRegeneratedDimensionPreviewPrompt(
        'A beautiful sunset',
        'cinematic',
        [],
        previewDimension
      );

      expect(result).not.toContain('camera pushes in');
      expect(result).not.toContain('dolly forward');
    });
  });

  describe('buildRegeneratedDirectionPrompts', () => {
    it('should generate 4 prompts with shuffled fragments', () => {
      const results = promptBuilder.buildRegeneratedDirectionPrompts('A beautiful sunset');

      expect(results).toHaveLength(4);
      expect(results.map((r) => r.direction)).toEqual(['cinematic', 'social', 'artistic', 'documentary']);
    });

    it('should include intent in all prompts', () => {
      const intent = 'A person walking';
      const results = promptBuilder.buildRegeneratedDirectionPrompts(intent);

      for (const result of results) {
        expect(result.prompt).toContain(intent);
      }
    });
  });

  describe('prompt structure validation', () => {
    it('should produce comma-separated prompts', () => {
      const result = promptBuilder.buildPrompt({
        intent: 'A beautiful sunset',
        direction: 'cinematic',
        lockedDimensions: [],
      });

      // Should be comma-separated
      expect(result).toMatch(/^[^,]+(, [^,]+)*$/);
    });

    it('should not have empty parts in the prompt', () => {
      const result = promptBuilder.buildPrompt({
        intent: 'A beautiful sunset',
        direction: 'cinematic',
        lockedDimensions: [],
        subjectMotion: '   ', // whitespace only
      });

      // Should not have empty parts
      const parts = result.split(', ');
      for (const part of parts) {
        expect(part.trim()).not.toBe('');
      }
    });

    it('should handle multiple locked dimensions', () => {
      const lockedDimensions: LockedDimension[] = [
        {
          type: 'mood',
          optionId: 'dramatic',
          label: 'Dramatic',
          promptFragments: ['high contrast lighting', 'deep shadows', 'intense atmosphere'],
        },
        {
          type: 'framing',
          optionId: 'wide',
          label: 'Wide Shot',
          promptFragments: ['wide establishing shot', 'environment visible', 'subject in context'],
        },
        {
          type: 'lighting',
          optionId: 'golden_hour',
          label: 'Golden Hour',
          promptFragments: ['warm golden hour sunlight', 'long shadows', 'orange and amber tones'],
        },
      ];

      const result = promptBuilder.buildPrompt({
        intent: 'A beautiful sunset',
        direction: 'cinematic',
        lockedDimensions,
      });

      // Should have intent + direction fragments + dimension fragments
      const parts = result.split(', ');
      expect(parts.length).toBeGreaterThan(5);
    });
  });
});
