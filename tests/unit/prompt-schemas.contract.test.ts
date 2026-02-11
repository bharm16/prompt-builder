import { describe, expect, it } from 'vitest';

import {
  compileSchema,
  promptSchema,
  suggestionSchema,
  customSuggestionSchema,
  sceneChangeSchema,
  coherenceCheckSchema,
  coherenceCheckOutputSchema,
  creativeSuggestionSchema,
  videoValidationSchema,
  parseConceptSchema,
  completeSceneSchema,
  variationsSchema,
} from '@config/schemas';

describe('prompt schemas contract', () => {
  it('accepts a valid prompt optimization request', () => {
    const result = promptSchema.safeParse({
      prompt: 'A cinematic dolly-in through a rainy neon alley.',
      targetModel: 'sora-2',
      lockedSpans: [{ text: 'neon alley', category: 'environment.location' }],
      generationParams: { fps: 24, duration_s: 6 },
    });

    expect(result.success).toBe(true);
  });

  it('rejects invalid prompt optimization payloads', () => {
    const invalidMode = promptSchema.safeParse({
      prompt: 'A cinematic scene',
      mode: 'audio',
    });
    const emptyPrompt = promptSchema.safeParse({
      prompt: '',
      mode: 'video',
    });

    expect(invalidMode.success).toBe(false);
    expect(emptyPrompt.success).toBe(false);
  });

  it('enforces compile contract for target model', () => {
    expect(
      compileSchema.safeParse({
        prompt: 'A cinematic scene',
        targetModel: 'sora-2',
      }).success
    ).toBe(true);

    expect(
      compileSchema.safeParse({
        prompt: 'A cinematic scene',
      }).success
    ).toBe(false);
  });
});

describe('suggestion schemas contract', () => {
  it('accepts a valid enhancement suggestion payload', () => {
    const result = suggestionSchema.safeParse({
      highlightedText: 'golden hour light',
      fullPrompt: 'A woman walks down the street in golden hour light.',
      highlightedCategory: 'lighting',
      allLabeledSpans: [
        {
          text: 'golden hour light',
          role: 'lighting',
          start: 30,
          end: 47,
          confidence: 0.9,
        },
      ],
      brainstormContext: {
        version: '1',
        elements: { subject: 'woman', action: 'walking' },
      },
    });

    expect(result.success).toBe(true);
  });

  it('rejects invalid suggestion payloads', () => {
    const missingHighlightedText = suggestionSchema.safeParse({
      highlightedText: '',
      fullPrompt: 'A full prompt',
    });
    const tooManyHistoryEntries = suggestionSchema.safeParse({
      highlightedText: 'hero',
      fullPrompt: 'A full prompt',
      editHistory: Array.from({ length: 51 }).map((_, index) => ({
        original: `o-${index}`,
        replacement: `r-${index}`,
      })),
    });

    expect(missingHighlightedText.success).toBe(false);
    expect(tooManyHistoryEntries.success).toBe(false);
  });

  it('validates custom suggestion, scene change, and coherence-check contracts', () => {
    expect(
      customSuggestionSchema.safeParse({
        highlightedText: 'hero',
        customRequest: 'Make this more cinematic',
        fullPrompt: 'A hero runs through rain.',
      }).success
    ).toBe(true);
    expect(
      customSuggestionSchema.safeParse({
        highlightedText: 'hero',
        fullPrompt: 'A hero runs through rain.',
      }).success
    ).toBe(false);

    expect(
      sceneChangeSchema.safeParse({
        changedField: 'lighting',
        newValue: 'moonlit',
        fullPrompt: 'A hero runs through rain.',
      }).success
    ).toBe(true);

    expect(
      coherenceCheckSchema.safeParse({
        beforePrompt: 'A hero runs through rain.',
        afterPrompt: 'A hero sprints through rain.',
        appliedChange: {
          spanId: 's-1',
          oldText: 'runs',
          newText: 'sprints',
        },
      }).success
    ).toBe(true);
  });
});

describe('video schemas contract', () => {
  it('accepts valid video/creative payloads', () => {
    expect(
      creativeSuggestionSchema.safeParse({
        elementType: 'style',
        context: { mood: 'moody' },
      }).success
    ).toBe(true);
    expect(
      videoValidationSchema.safeParse({
        elements: { subject: 'hero', location: 'city' },
      }).success
    ).toBe(true);
    expect(
      parseConceptSchema.safeParse({
        concept: 'A rainy cyberpunk chase scene.',
      }).success
    ).toBe(true);
    expect(
      completeSceneSchema.safeParse({
        existingElements: { subject: 'hero' },
      }).success
    ).toBe(true);
    expect(
      variationsSchema.safeParse({
        elements: { subject: 'hero' },
      }).success
    ).toBe(true);
  });

  it('rejects invalid video payloads', () => {
    expect(
      parseConceptSchema.safeParse({
        concept: '',
      }).success
    ).toBe(false);
    expect(
      videoValidationSchema.safeParse({
        elements: 'not-an-object',
      }).success
    ).toBe(false);
  });
});

describe('output schemas contract', () => {
  it('accepts valid coherence-check output and rejects invalid edit types', () => {
    const valid = coherenceCheckOutputSchema.safeParse({
      conflicts: [
        {
          severity: 'medium',
          message: 'Action conflicts with prior span.',
          reasoning: 'The replacement changed tense.',
          recommendations: [
            {
              title: 'Keep tense consistent',
              rationale: 'Maintain continuity',
              edits: [
                {
                  type: 'replaceSpanText',
                  spanId: 'span-1',
                  replacementText: 'runs',
                },
              ],
            },
          ],
        },
      ],
      harmonizations: [],
    });

    const invalid = coherenceCheckOutputSchema.safeParse({
      conflicts: [
        {
          message: 'bad',
          reasoning: 'bad',
          recommendations: [
            {
              title: 'bad',
              rationale: 'bad',
              edits: [{ type: 'unknown-edit' }],
            },
          ],
        },
      ],
      harmonizations: [],
    });

    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });
});
