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

  it('keeps human actor class for subject identity replacements when context is explicitly human', () => {
    const service = createService();

    const result = service.sanitizeSuggestions(
      [
        { text: 'curious puppy with floppy ears' },
        { text: 'giggling toddler with bright pigtails' },
      ],
      {
        highlightedText: 'playful baby',
        highlightedCategory: 'subject.identity',
        isVideoPrompt: true,
        isPlaceholder: true,
        contextBefore: 'A charming and ',
        contextAfter: ' seated in the driver seat',
      } as Parameters<SuggestionValidationService['sanitizeSuggestions']>[1] & {
        contextBefore: string;
        contextAfter: string;
      }
    );

    expect(result.map((item) => item.text)).toEqual([
      'giggling toddler with bright pigtails',
    ]);
  });

  it('rejects movement-style clauses for shot framing slots', () => {
    const service = createService();

    const result = service.sanitizeSuggestions(
      [
        { text: 'tracking shot moving alongside the car' },
        { text: 'high-angle close-up with soft focus' },
      ],
      {
        highlightedText: 'eye-level close-up',
        highlightedCategory: 'shot.type',
        isVideoPrompt: true,
        isPlaceholder: true,
      }
    );

    expect(result.map((item) => item.text)).toEqual([
      'high-angle close-up with soft focus',
    ]);
  });

  it('rejects human-action drift for environment movement actions', () => {
    const service = createService();

    const contextualInput = {
      highlightedText: 'background trees sway gently',
      highlightedCategory: 'action.movement',
      isVideoPrompt: true,
      isPlaceholder: false,
      contextBefore:
        'the baby smiles while sunlight streams through windows, and the ',
      contextAfter: ' in the distance.',
      spanAnchors: '- environment: "lush green trees"',
      nearbySpanHints: '- environment: "sunny park"',
    } as Parameters<SuggestionValidationService['sanitizeSuggestions']>[1] & {
      contextBefore: string;
      contextAfter: string;
      spanAnchors: string;
      nearbySpanHints: string;
    };

    const result = service.sanitizeSuggestions(
      [
        { text: 'taps the dashboard with tiny fingers' },
        { text: 'branches swaying in the breeze' },
      ],
      contextualInput
    );

    expect(result.map((item) => item.text)).toEqual([
      'branches swaying in the breeze',
    ]);
  });

  it('rejects source-direction lighting clauses for lighting quality slots', () => {
    const service = createService();

    const result = service.sanitizeSuggestions(
      [
        { text: 'side lighting to create dramatic shadows' },
        { text: 'soft diffused amber warmth' },
      ],
      {
        highlightedText: 'warm, golden glow',
        highlightedCategory: 'lighting.quality',
        isVideoPrompt: true,
        isPlaceholder: true,
      }
    );

    expect(result.map((item) => item.text)).toEqual([
      'soft diffused amber warmth',
    ]);
  });

  it('rejects scene-content drift in style slots even when camera words appear', () => {
    const service = createService();

    const result = service.sanitizeSuggestions(
      [
        { text: 'serene mountain landscape at dawn' },
        { text: 'gleaming silver spaceship in soft focus' },
        { text: 'vintage Kodachrome slide with warm tones' },
      ],
      {
        highlightedText: 'pure, innocent delight',
        highlightedCategory: 'style.aesthetic',
        isVideoPrompt: true,
        isPlaceholder: false,
      }
    );

    expect(result.map((item) => item.text)).toEqual([
      'vintage Kodachrome slide with warm tones',
    ]);
  });

  it('rejects camera/environment drift for lighting quality slots', () => {
    const service = createService();

    const result = service.sanitizeSuggestions(
      [
        { text: 'soft focus with motion-blurred trees' },
        { text: 'gentle snowfall blanketing the park' },
        { text: 'soft diffused amber warmth' },
      ],
      {
        highlightedText: 'ethereal, luminous glow',
        highlightedCategory: 'lighting.quality',
        isVideoPrompt: true,
        isPlaceholder: false,
      }
    );

    expect(result.map((item) => item.text)).toEqual([
      'soft diffused amber warmth',
    ]);
  });

  it('uses surrounding context to enforce vehicle-interior location coherence', () => {
    const service = createService();

    const result = service.sanitizeSuggestions(
      [
        { text: 'tranquil lakeside dock at sunset' },
        { text: 'backseat of a vintage station wagon' },
      ],
      {
        highlightedText: 'front row position',
        highlightedCategory: 'environment.location',
        isVideoPrompt: true,
        isPlaceholder: false,
        contextBefore:
          "Inside the car cabin, the toddler settles into the driver's seat.",
        contextAfter: 'Tiny hands hold the steering wheel.',
      } as Parameters<SuggestionValidationService['sanitizeSuggestions']>[1] & {
        contextBefore: string;
        contextAfter: string;
      }
    );

    expect(result.map((item) => item.text)).toEqual([
      'backseat of a vintage station wagon',
    ]);
  });

  it('does not over-constrain outdoor location slots when context mentions windows only', () => {
    const service = createService();

    const result = service.sanitizeSuggestions(
      [
        { text: 'lush meadow dotted with wildflowers' },
        { text: 'sunlit autumn grove with golden leaves' },
      ],
      {
        highlightedText: 'picturesque, sun-drenched park',
        highlightedCategory: 'environment.location',
        isVideoPrompt: true,
        isPlaceholder: true,
        contextBefore: 'Through the softly blurred windows, the background reveals a ',
        contextAfter: ', teeming with life.',
      } as Parameters<SuggestionValidationService['sanitizeSuggestions']>[1] & {
        contextBefore: string;
        contextAfter: string;
      }
    );

    expect(result.map((item) => item.text)).toEqual([
      'lush meadow dotted with wildflowers',
      'sunlit autumn grove with golden leaves',
    ]);
  });

  it('rejects camera-shot drift in lighting source slots', () => {
    const service = createService();

    const result = service.sanitizeSuggestions(
      [
        { text: 'high-angle wide shot with soft focus' },
        { text: 'backlit golden sun through the rear window' },
      ],
      {
        highlightedText: 'Abundant, warm, golden sunlight',
        highlightedCategory: 'lighting.source',
        isVideoPrompt: true,
        isPlaceholder: false,
      }
    );

    expect(result.map((item) => item.text)).toEqual([
      'backlit golden sun through the rear window',
    ]);
  });

  it('rejects non-human and role-shift drift for subject emotion slots in human context', () => {
    const service = createService();

    const result = service.sanitizeSuggestions(
      [
        { text: 'gleeful puppy with wagging tail' },
        { text: 'cheerful clown juggling brightly colored balls' },
        { text: 'beaming child with sparkling eyes' },
      ],
      {
        highlightedText: 'vibrant sense of joy',
        highlightedCategory: 'subject.emotion',
        isVideoPrompt: true,
        isPlaceholder: false,
        contextBefore: 'At its heart sits a tiny, grinning toddler,',
        contextAfter: 'in the driver seat',
      } as Parameters<SuggestionValidationService['sanitizeSuggestions']>[1] & {
        contextBefore: string;
        contextAfter: string;
      }
    );

    expect(result.map((item) => item.text)).toEqual([
      'beaming child with sparkling eyes',
    ]);
  });

  it('rejects disruptive weather swaps when source weather is a breeze-like condition', () => {
    const service = createService();

    const result = service.sanitizeSuggestions(
      [
        { text: 'gentle snowfall blanketing the park' },
        { text: 'soft, whispering zephyr' },
      ],
      {
        highlightedText: 'light, unseen breeze',
        highlightedCategory: 'environment.weather',
        isVideoPrompt: true,
        isPlaceholder: true,
      }
    );

    expect(result.map((item) => item.text)).toEqual([
      'soft, whispering zephyr',
    ]);
  });
});
