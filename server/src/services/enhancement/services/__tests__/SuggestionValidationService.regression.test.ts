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

  it('ranks word-count-adjacent suggestions first and keeps out-of-range at the end', () => {
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

    // All 5 survive; preferred-range suggestions appear first
    expect(result.length).toBe(5);
    const firstThree = result.slice(0, 3);
    expect(firstThree.every((item) => {
      const wc = item.text.trim().split(/\s+/).length;
      return wc >= 2 && wc <= 6;
    })).toBe(true);
  });

  it('does not suppress valid camera-focus suggestions when only shot siblings are locked', () => {
    const service = createService();

    const result = service.sanitizeSuggestions(
      [
        { text: 'deep bokeh focus separation' },
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
      'deep bokeh focus separation'
    );
  });

  it('rejects movement-heavy suggestions when the highlighted slot is camera focus', () => {
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

    expect(result.map((item) => item.text)).toEqual(['branches swaying']);
  });

  it('rejects long clause-style replacements for adjective-like slots', () => {
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

  it('rejects non-human subject class drift when context is explicitly human', () => {
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

    expect(result).toEqual([]);
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

    expect(result.map((item) => item.text)).toEqual(['soft diffused amber warmth']);
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

    expect(result.map((item) => item.text)).toEqual(['soft diffused amber warmth']);
  });

  it('keeps exterior location beats for environment.location even when the wider scene is inside a vehicle', () => {
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
      'tranquil lakeside dock at sunset',
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

    expect(result.map((item) => item.text)).toEqual(['soft, whispering zephyr']);
  });

  // --- Fail-closed validation regression tests ---

  it('returns no suggestions when every candidate fails hard slot-fit checks', () => {
    const service = createService();

    const result = service.sanitizeSuggestions(
      [
        { text: 'high-angle wide shot with soft focus' },
        { text: 'tracking camera along the corridor' },
      ],
      {
        highlightedText: 'warm natural glow',
        highlightedCategory: 'lighting.source',
        isVideoPrompt: true,
        isPlaceholder: false,
      }
    );

    expect(result).toEqual([]);
  });

  it('never returns suggestions that fail hard validation checks', () => {
    const service = createService();

    const result = service.sanitizeSuggestions(
      [
        { text: 'warm natural glow' },                           // identical to highlight
        { text: 'rewrite the entire prompt section' },           // meta-language
        { text: 'consider using alternative approaches here' },  // template artifact + conversational prefix
        { text: 'soft amber warmth' },                           // valid
      ],
      {
        highlightedText: 'warm natural glow',
        isVideoPrompt: true,
        isPlaceholder: false,
      }
    );

    // Only the valid suggestion passes hard checks
    expect(result.map((item) => item.text)).toEqual(['soft amber warmth']);
  });

  it('rejects possessive noun phrases that break article agreement in drop-in slots', () => {
    const service = createService();

    const result = service.sanitizeSuggestions(
      [
        { text: "infant's wide-eyed, tear-streaked face" },
        { text: 'wide-eyed infant face' },
      ],
      {
        highlightedText: "toddler's tiny rosy-cheeked face",
        highlightedCategory: 'subject.appearance',
        isVideoPrompt: true,
        isPlaceholder: false,
        contextBefore: 'slowly zooming in on a ',
        contextAfter: ' and plump hands gripping the wheel',
      } as Parameters<SuggestionValidationService['sanitizeSuggestions']>[1] & {
        contextBefore: string;
        contextAfter: string;
      }
    );

    expect(result.map((item) => item.text)).toEqual(['wide-eyed infant face']);
  });

  it('rejects category drift for lighting.timeOfDay slots', () => {
    const service = createService();

    const result = service.sanitizeSuggestions(
      [
        { text: 'amber backlight casting soft halos' },
        { text: 'misty blue hour' },
      ],
      {
        highlightedText: 'golden hour sunlight',
        highlightedCategory: 'lighting.timeOfDay',
        isVideoPrompt: true,
        isPlaceholder: false,
        contextBefore: 'Warm, ',
        contextAfter: ' streams through the car windows',
      } as Parameters<SuggestionValidationService['sanitizeSuggestions']>[1] & {
        contextBefore: string;
        contextAfter: string;
      }
    );

    expect(result.map((item) => item.text)).toEqual(['misty blue hour']);
  });

  it('rejects external location swaps for environment.context slots', () => {
    const service = createService();

    const result = service.sanitizeSuggestions(
      [
        { text: 'misty morning lake reflected in glass' },
        { text: 'rain-streaked windshield glass' },
      ],
      {
        highlightedText: "car's front window",
        highlightedCategory: 'environment.context',
        isVideoPrompt: true,
        isPlaceholder: false,
        contextBefore: 'with the soft blur of a park view visible through the ',
        contextAfter: ', creating a sense of intimate observation',
      } as Parameters<SuggestionValidationService['sanitizeSuggestions']>[1] & {
        contextBefore: string;
        contextAfter: string;
      }
    );

    expect(result.map((item) => item.text)).toEqual(['rain-streaked windshield glass']);
  });

  it('rejects body-part drift for face-detail subject spans', () => {
    const service = createService();

    const result = service.sanitizeSuggestions(
      [
        { text: 'bright eyes and flushed cheeks' },
        { text: 'tiny feet swinging in the air' },
        { text: 'tiny hands reaching for the window' },
      ],
      {
        highlightedText: "toddler's tiny rosy-cheeked face",
        highlightedCategory: 'subject.appearance',
        isVideoPrompt: true,
        isPlaceholder: false,
        contextBefore: 'slowly zooming in on a ',
        contextAfter: ' and plump hands gripping the wheel',
      } as Parameters<SuggestionValidationService['sanitizeSuggestions']>[1] & {
        contextBefore: string;
        contextAfter: string;
      }
    );

    expect(result.map((item) => item.text)).toEqual([
      'bright eyes and flushed cheeks',
    ]);
  });

  it('rejects hand-detail role drift to socks and toys', () => {
    const service = createService();

    const result = service.sanitizeSuggestions(
      [
        { text: 'soft little hands with bitten nails' },
        { text: 'tiny hands with mismatched socks' },
        { text: 'small, chubby fingers playing with a toy' },
      ],
      {
        highlightedText: 'plump hands',
        highlightedCategory: 'subject.appearance',
        isVideoPrompt: true,
        isPlaceholder: false,
        contextBefore: "a toddler's face and ",
        contextAfter: ' gripping a dark grey steering wheel',
      } as Parameters<SuggestionValidationService['sanitizeSuggestions']>[1] & {
        contextBefore: string;
        contextAfter: string;
      }
    );

    expect(result.map((item) => item.text)).toEqual([
      'soft little hands with bitten nails',
    ]);
  });

  it('rejects object-overlap action suggestions and preserves verb-only hand interactions', () => {
    const service = createService();

    const analysis = service.analyzeSuggestions(
      [
        { text: 'turning the wheel slightly' },
        { text: 'pressing gently' },
        { text: 'leaning forward with excitement' },
      ],
      {
        highlightedText: 'gripping',
        highlightedCategory: 'action.movement',
        isVideoPrompt: true,
        isPlaceholder: false,
        contextBefore: "a toddler's tiny rosy-cheeked face and plump hands ",
        contextAfter: ' a dark grey steering wheel.',
        spanAnchors: '- subject: "plump hands"\n- subject: "steering wheel"',
      } as Parameters<SuggestionValidationService['analyzeSuggestions']>[1] & {
        contextBefore: string;
        contextAfter: string;
        spanAnchors: string;
      }
    );

    expect(analysis.primary.map((item) => item.text)).toEqual(['pressing gently']);
    expect(analysis.rejected).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ text: 'turning the wheel slightly', reason: 'object_overlap' }),
        expect.objectContaining({ text: 'leaning forward with excitement', reason: 'object_overlap' }),
      ])
    );
  });

  it('rejects noun-phrase replacements in adverb lighting slots', () => {
    const service = createService();

    const result = service.sanitizeSuggestions(
      [
        { text: 'hazy amber glow' },
        { text: 'softly' },
      ],
      {
        highlightedText: 'intensely',
        highlightedCategory: 'lighting.quality',
        isVideoPrompt: true,
        isPlaceholder: false,
        contextBefore: 'Warm, golden hour sunlight streams ',
        contextAfter: ' through the car windows.',
      } as Parameters<SuggestionValidationService['sanitizeSuggestions']>[1] & {
        contextBefore: string;
        contextAfter: string;
      }
    );

    expect(result.map((item) => item.text)).toEqual(['softly']);
  });

  it('keeps shadow-specific lighting replacements for shadow spans', () => {
    const service = createService();

    const result = service.sanitizeSuggestions(
      [
        { text: 'soft amber diffusion' },
        { text: 'soft dashboard shadows' },
      ],
      {
        highlightedText: 'soft, elongated shadows',
        highlightedCategory: 'lighting.quality',
        isVideoPrompt: true,
        isPlaceholder: false,
        contextBefore: 'and casting ',
        contextAfter: ' across the dashboard.',
      } as Parameters<SuggestionValidationService['sanitizeSuggestions']>[1] & {
        contextBefore: string;
        contextAfter: string;
      }
    );

    expect(result.map((item) => item.text)).toEqual(['soft dashboard shadows']);
  });

  it('treats same-family nearby camera and shot locks as soft overlaps, not hard conflicts', () => {
    const service = createService();

    const result = service.sanitizeSuggestions(
      [{ text: 'low-angle view' }],
      {
        highlightedText: 'eye level',
        highlightedCategory: 'camera.angle',
        lockedSpanCategories: ['shot.type'],
        isVideoPrompt: true,
        isPlaceholder: false,
        nearbySpanHints: '- camera: "eye-level shot"\n- shot: "Medium close-up"',
      } as Parameters<SuggestionValidationService['sanitizeSuggestions']>[1] & {
        nearbySpanHints: string;
      }
    );

    expect(result.map((item) => item.text)).toEqual(['low-angle view']);
  });
});
