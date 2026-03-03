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

  it('does not suppress camera suggestions when only shot siblings are locked', () => {
    const service = createService();

    const result = service.sanitizeSuggestions(
      [
        { text: '85mm close-up shot with deep bokeh focus' },
        { text: 'golden backlight through the rear window' },
      ],
      {
        highlightedText: 'softly out of focus',
        highlightedCategory: 'camera.focus',
        lockedSpanCategories: ['shot.type'],
        isVideoPrompt: true,
        isPlaceholder: false,
      }
    );

    expect(result.map((item) => item.text)).toContain(
      '85mm close-up shot with deep bokeh focus'
    );
  });

  it('filters movement-heavy suggestions when the highlighted slot is camera focus', () => {
    const service = createService();

    const result = service.sanitizeSuggestions(
      [
        { text: '50mm dolly out with background blur' },
        { text: 'shallow depth of field with creamy bokeh' },
      ],
      {
        highlightedText: 'softly out of focus',
        highlightedCategory: 'camera.focus',
        isVideoPrompt: true,
        isPlaceholder: false,
      }
    );

    expect(result.map((item) => item.text)).toEqual([
      'shallow depth of field with creamy bokeh',
    ]);
  });

  it('rejects human-action drift when action context anchors to environment motion', () => {
    const service = createService();

    const contextualInput = {
      highlightedText: 'swaying gently',
      highlightedCategory: 'action.movement',
      isVideoPrompt: true,
      isPlaceholder: false,
      contextBefore:
        'In the background, a sunny park setting with lush green trees ',
      contextAfter: ' in the breeze is softly out of focus.',
      spanAnchors: '- subject: "lush green trees"',
      nearbySpanHints: '- environment: "breeze"',
    } as Parameters<SuggestionValidationService['sanitizeSuggestions']>[1] & {
      contextBefore: string;
      contextAfter: string;
      spanAnchors: string;
      nearbySpanHints: string;
    };

    const result = service.sanitizeSuggestions(
      [
        { text: 'grinning and clapping hands' },
        { text: 'branches swaying in the breeze' },
      ],
      contextualInput
    );

    expect(result.map((item) => item.text)).toEqual([
      'branches swaying in the breeze',
    ]);
  });

  it('filters long clause-style replacements for adjective-like slots', () => {
    const service = createService();

    const contextualInput = {
      highlightedText: 'warm',
      highlightedCategory: 'lighting.quality',
      isVideoPrompt: true,
      isPlaceholder: false,
      contextBefore:
        "Sunlight streams through the car windows, casting a ",
      contextAfter: ', golden glow across the scene.',
      videoConstraints: {
        minWords: 1,
        maxWords: 6,
        maxSentences: 1,
        mode: 'micro',
      },
    } as Parameters<SuggestionValidationService['sanitizeSuggestions']>[1] & {
      contextBefore: string;
      contextAfter: string;
    };

    const result = service.sanitizeSuggestions(
      [
        { text: 'diffused sidelight from the left' },
        { text: 'soft glow' },
      ],
      contextualInput
    );

    expect(result.map((item) => item.text)).toEqual(['soft glow']);
  });
});
