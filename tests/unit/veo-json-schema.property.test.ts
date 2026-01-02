/**
 * Property-based tests for Veo JSON Schema Validity
 *
 * Tests the following correctness property:
 * - Property 5: Veo JSON Schema Validity
 *
 * For any Veo prompt, the transform phase SHALL produce a valid JSON object
 * containing at minimum: subject.description, subject.action, camera.type,
 * camera.movement, environment.lighting fields.
 *
 * @module veo-json-schema.property.test
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

import { VeoStrategy, type VeoPromptSchema } from '@services/video-prompt-analysis/strategies/VeoStrategy';

describe('VeoStrategy Property Tests', () => {
  const strategy = new VeoStrategy();

  // Sample prompts for testing
  const samplePrompts = [
    'A woman walking in the park',
    'A cinematic shot of a car driving through the city at night',
    'Close up of a flower blooming in slow motion',
    'A man running through a forest with dramatic lighting',
    'Aerial view of a beach at sunset with golden hour lighting',
    'A dog playing in the snow, wide shot',
    'Two people talking in a cafe, medium shot',
    'A bird flying over mountains with cloudy weather',
    'A chef cooking in a kitchen with soft lighting',
    'A dancer performing on stage with dramatic backlighting',
  ];

  // Camera types for testing
  const cameraTypes = [
    'wide shot',
    'close up',
    'medium shot',
    'aerial view',
    'low angle',
    'high angle',
    'pov',
    'tracking shot',
  ];

  // Camera movements for testing
  const cameraMovements = [
    'pan left',
    'pan right',
    'tilt up',
    'tilt down',
    'dolly in',
    'zoom out',
    'tracking',
    'static',
    'orbit',
  ];

  // Lighting keywords for testing
  const lightingKeywords = [
    'natural light',
    'golden hour',
    'dramatic lighting',
    'soft lighting',
    'backlit',
    'neon',
    'volumetric lighting',
  ];

  // Weather keywords for testing
  const weatherKeywords = [
    'sunny',
    'cloudy',
    'rainy',
    'snowy',
    'foggy',
    'stormy',
  ];

  // Style presets for testing
  const stylePresets = [
    'cinematic',
    'documentary',
    'commercial',
    'anime',
    'realistic',
    'noir',
    'sci-fi',
  ];

  /**
   * Property 5: Veo JSON Schema Validity
   *
   * For any Veo prompt, the transform phase SHALL produce a valid JSON object
   * containing at minimum: subject.description, subject.action, camera.type,
   * camera.movement, environment.lighting fields.
   *
   * **Feature: video-model-optimization, Property 5: Veo JSON Schema Validity**
   * **Validates: Requirements 7.2, 7.3, 7.5**
   */
  describe('Property 5: Veo JSON Schema Validity', () => {
    it('produces valid JSON schema for any prompt', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...samplePrompts),
          async (prompt) => {
            const normalized = strategy.normalize(prompt);
            const result = await strategy.transform(normalized);

            // Result should be an object (JSON schema)
            expect(typeof result.prompt).toBe('object');

            const schema = result.prompt as unknown as VeoPromptSchema;

            // Validate required fields exist
            expect(schema).toHaveProperty('subject');
            expect(schema).toHaveProperty('camera');
            expect(schema).toHaveProperty('environment');

            // Validate subject fields
            expect(schema.subject).toHaveProperty('description');
            expect(schema.subject).toHaveProperty('action');
            expect(typeof schema.subject.description).toBe('string');
            expect(typeof schema.subject.action).toBe('string');

            // Validate camera fields
            expect(schema.camera).toHaveProperty('type');
            expect(schema.camera).toHaveProperty('movement');
            expect(typeof schema.camera.type).toBe('string');
            expect(typeof schema.camera.movement).toBe('string');

            // Validate environment fields
            expect(schema.environment).toHaveProperty('lighting');
            expect(typeof schema.environment.lighting).toBe('string');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('detects camera types correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...cameraTypes),
          fc.string({ minLength: 5, maxLength: 30 }),
          async (cameraType, suffix) => {
            const prompt = `A person ${suffix} ${cameraType}`;
            const normalized = strategy.normalize(prompt);
            const result = await strategy.transform(normalized);

            const schema = result.prompt as unknown as VeoPromptSchema;

            // Camera type should be detected
            expect(schema.camera.type).toBeDefined();
            expect(typeof schema.camera.type).toBe('string');
            expect(schema.camera.type.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('detects camera movements correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...cameraMovements),
          fc.string({ minLength: 5, maxLength: 30 }),
          async (movement, prefix) => {
            const prompt = `${prefix} with ${movement}`;
            const normalized = strategy.normalize(prompt);
            const result = await strategy.transform(normalized);

            const schema = result.prompt as unknown as VeoPromptSchema;

            // Camera movement should be detected
            expect(schema.camera.movement).toBeDefined();
            expect(typeof schema.camera.movement).toBe('string');
            expect(schema.camera.movement.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('detects lighting correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...lightingKeywords),
          fc.string({ minLength: 5, maxLength: 30 }),
          async (lighting, prefix) => {
            const prompt = `${prefix} with ${lighting}`;
            const normalized = strategy.normalize(prompt);
            const result = await strategy.transform(normalized);

            const schema = result.prompt as unknown as VeoPromptSchema;

            // Lighting should be detected
            expect(schema.environment.lighting).toBeDefined();
            expect(typeof schema.environment.lighting).toBe('string');
            expect(schema.environment.lighting.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('detects weather when present', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...weatherKeywords),
          fc.string({ minLength: 5, maxLength: 30 }),
          async (weather, prefix) => {
            const prompt = `${prefix} on a ${weather} day`;
            const normalized = strategy.normalize(prompt);
            const result = await strategy.transform(normalized);

            const schema = result.prompt as unknown as VeoPromptSchema;

            // Weather should be detected
            expect(schema.environment.weather).toBeDefined();
            expect(typeof schema.environment.weather).toBe('string');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('isValidSchema correctly validates schema structure', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...samplePrompts),
          async (prompt) => {
            const normalized = strategy.normalize(prompt);
            const result = await strategy.transform(normalized);

            // The schema should pass validation
            expect(strategy.isValidSchema(result.prompt)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('isValidSchema rejects invalid schemas', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.constant('string'),
            fc.constant(123),
            fc.constant({}),
            fc.constant({ subject: {} }),
            fc.constant({ subject: { description: 'test' } }),
            fc.constant({ subject: { description: 'test', action: 'test' } }),
            fc.constant({ 
              subject: { description: 'test', action: 'test' },
              camera: {}
            }),
          ),
          (invalidSchema) => {
            expect(strategy.isValidSchema(invalidSchema)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('augment injects style_preset', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...samplePrompts),
          async (prompt) => {
            const normalized = strategy.normalize(prompt);
            const transformResult = await strategy.transform(normalized);
            const augmentResult = strategy.augment(transformResult);

            const schema = augmentResult.prompt as unknown as VeoPromptSchema;

            // style_preset should be injected
            const stylePreset = schema.style_preset;
            expect(stylePreset).toBeDefined();
            expect(typeof stylePreset).toBe('string');
            if (!stylePreset) {
              return;
            }
            expect(stylePreset.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('detects style presets from keywords', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...stylePresets),
          fc.string({ minLength: 5, maxLength: 30 }),
          async (style, suffix) => {
            const prompt = `A ${style} shot of ${suffix}`;
            const normalized = strategy.normalize(prompt);
            const transformResult = await strategy.transform(normalized);
            const augmentResult = strategy.augment(transformResult);

            const schema = augmentResult.prompt as unknown as VeoPromptSchema;

            // style_preset should be detected
            expect(schema.style_preset).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('preserves JSON structure during augmentation', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...samplePrompts),
          async (prompt) => {
            const normalized = strategy.normalize(prompt);
            const transformResult = await strategy.transform(normalized);
            const augmentResult = strategy.augment(transformResult);

            const schema = augmentResult.prompt as unknown as VeoPromptSchema;

            // All required fields should still be present after augmentation
            expect(schema.subject).toBeDefined();
            expect(schema.subject.description).toBeDefined();
            expect(schema.subject.action).toBeDefined();
            expect(schema.camera).toBeDefined();
            expect(schema.camera.type).toBeDefined();
            expect(schema.camera.movement).toBeDefined();
            expect(schema.environment).toBeDefined();
            expect(schema.environment.lighting).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('handles random text inputs gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 100 }),
          async (randomText) => {
            // Filter out empty or whitespace-only strings
            if (randomText.trim().length === 0) return;

            const normalized = strategy.normalize(randomText);
            
            // Skip if normalization resulted in empty string
            if (normalized.trim().length === 0) return;

            const result = await strategy.transform(normalized);

            // Should still produce valid schema structure
            expect(typeof result.prompt).toBe('object');
            
            const schema = result.prompt as unknown as VeoPromptSchema;
            expect(schema.subject).toBeDefined();
            expect(schema.camera).toBeDefined();
            expect(schema.environment).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Normalization: Markdown and Filler Stripping', () => {
    it('strips markdown formatting', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            '# Header text',
            '**bold text**',
            '*italic text*',
            '`code text`',
            '[link](url)',
            '- list item',
            '1. numbered item',
            '> blockquote',
          ),
          (markdownText) => {
            const result = strategy.normalize(markdownText);

            // Markdown syntax should be stripped
            expect(result).not.toContain('#');
            expect(result).not.toContain('**');
            expect(result).not.toContain('`');
            expect(result).not.toContain('[');
            expect(result).not.toContain('](');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('strips conversational filler', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'I want a video of a cat',
            'Please create a scene with a dog',
            'Can you make a video of birds',
            'I would like to see a sunset',
            'Could you generate a forest scene',
          ),
          (fillerText) => {
            const result = strategy.normalize(fillerText);

            // Conversational filler should be stripped
            expect(result.toLowerCase()).not.toContain('i want');
            expect(result.toLowerCase()).not.toContain('please create');
            expect(result.toLowerCase()).not.toContain('can you');
            expect(result.toLowerCase()).not.toContain('i would like');
            expect(result.toLowerCase()).not.toContain('could you');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Flow Editing Mode', () => {
    it('detects edit instructions', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(
            'Remove the car from the scene',
            'Delete the background',
            'Add a tree to the left',
            'Change the color to blue',
            'Replace the sky with sunset',
          ),
          async (editInstruction) => {
            const normalized = strategy.normalize(editInstruction);
            const result = await strategy.transform(normalized);

            const schema = result.prompt as unknown as VeoPromptSchema;

            // Should be in edit mode
            expect(schema.mode).toBe('edit');
            expect(schema.edit_config).toBeDefined();
            expect(schema.edit_config?.instruction).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('preserves generation mode for non-edit prompts', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...samplePrompts),
          async (prompt) => {
            const normalized = strategy.normalize(prompt);
            const result = await strategy.transform(normalized);

            const schema = result.prompt as unknown as VeoPromptSchema;

            // Should be in generate mode
            expect(schema.mode).toBe('generate');
            expect(schema.edit_config).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
