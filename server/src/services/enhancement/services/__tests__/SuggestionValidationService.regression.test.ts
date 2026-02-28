import { describe, expect, it, vi } from 'vitest';
import { SuggestionValidationService } from '../SuggestionValidationService';
import type { VideoService } from '../types';

function createService(videoOverrides: Partial<VideoService> = {}): SuggestionValidationService {
  const videoService = {
    countWords: (text: string) => text.trim().split(/\s+/).filter(Boolean).length,
    getVideoReplacementConstraints: vi.fn(() => ({
      minWords: 2,
      maxWords: 8,
      maxSentences: 1,
    })),
    ...videoOverrides,
  } as unknown as VideoService;

  return new SuggestionValidationService(videoService);
}

describe('SuggestionValidationService regression', () => {
  it('uses video replacement constraints for placeholder validation when video prompt constraints are not passed in', () => {
    const service = createService({
      getVideoReplacementConstraints: vi.fn(() => ({
        minWords: 1,
        maxWords: 8,
        maxSentences: 1,
      })),
    });

    const result = service.sanitizeSuggestions(
      [
        { text: 'very soft warm interior glow' },
        { text: 'soft glow' },
      ],
      {
        highlightedText: 'lighting',
        isVideoPrompt: true,
        isPlaceholder: true,
      }
    );

    expect(result.map((item) => item.text)).toContain('very soft warm interior glow');
  });

  it('prefers highlighted-word-count-adjacent suggestions when enough candidates exist', () => {
    const service = createService();

    const result = service.sanitizeSuggestions(
      [
        { text: 'soft glow' },
        { text: 'gentle warm cabin light' },
        { text: 'golden interior light streaks' },
        { text: 'richly saturated volumetric rim lighting accents everywhere' },
        { text: 'ultra detailed dramatic high contrast split-tone atmospheric lighting treatment' },
      ],
      {
        highlightedText: 'warm cinematic interior lighting',
        isVideoPrompt: true,
        isPlaceholder: false,
      }
    );

    expect(result.length).toBe(3);
    expect(result.every((item) => {
      const wc = item.text.trim().split(/\s+/).length;
      return wc >= 2 && wc <= 6;
    })).toBe(true);
  });
});
