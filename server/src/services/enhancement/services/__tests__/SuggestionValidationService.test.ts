import { describe, expect, it } from 'vitest';
import { SuggestionValidationService } from '../SuggestionValidationService';
import type { VideoService } from '../types';

function createService() {
  const videoService = {
    countWords: (text: string) => text.trim().split(/\s+/).filter(Boolean).length,
  } as unknown as VideoService;

  return new SuggestionValidationService(videoService);
}

describe('SuggestionValidationService', () => {
  it('filters empty, template-like, and multiline suggestions', () => {
    const service = createService();

    const result = service.sanitizeSuggestions(
      [
        { text: '   ' },
        { text: 'Main prompt rewrite' },
        { text: 'Add subtle haze for depth' },
        { text: 'Alternative approaches for this section' },
      ],
      {
        highlightedText: 'tracking shot',
        isVideoPrompt: true,
        isPlaceholder: false,
      }
    );

    expect(result.map((item) => item.text)).toEqual([
      'Add subtle haze for depth',
    ]);
  });

  it('filters suggestions identical to the highlighted original text', () => {
    const service = createService();

    const result = service.sanitizeSuggestions(
      [
        { text: 'tracking shot' },
        { text: 'Dolly in toward the subject' },
      ],
      {
        highlightedText: 'tracking shot',
        isVideoPrompt: true,
        isPlaceholder: false,
      }
    );

    expect(result.map((item) => item.text)).toEqual(['Dolly in toward the subject']);
  });

  it('enforces placeholder length/sentence constraints', () => {
    const service = createService();

    const result = service.sanitizeSuggestions(
      [
        { text: 'tungsten glow' },
        { text: 'this is four words' },
        { text: 'single word.' },
      ],
      {
        highlightedText: 'lighting',
        isVideoPrompt: true,
        isPlaceholder: true,
        videoConstraints: {
          minWords: 1,
          maxWords: 3,
          maxSentences: 1,
          disallowTerminalPunctuation: true,
        },
      }
    );

    expect(result.map((item) => item.text)).toEqual(['tungsten glow']);
  });

  it('filters suggestions that conflict with locked span categories', () => {
    const service = createService();

    const result = service.sanitizeSuggestions(
      [
        { text: 'rim light around subject' },
        { text: 'dolly in past subject' },
      ],
      {
        highlightedText: 'camera move',
        highlightedCategory: 'camera.movement',
        lockedSpanCategories: ['lighting.quality'],
        isVideoPrompt: true,
        isPlaceholder: false,
      }
    );

    expect(result.map((item) => item.text)).toEqual(['dolly in past subject']);
  });
});
