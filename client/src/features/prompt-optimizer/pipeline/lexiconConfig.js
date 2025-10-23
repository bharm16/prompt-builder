export const LEXICON_PHRASES = [
  {
    category: 'camera',
    phrases: [
      'dolly shot',
      'slow push-in',
      'slow push in',
      'wide establishing shot',
      'tracking shot',
      'handheld tracking',
      'crane sweep',
      'fpv flythrough',
      'over-the-shoulder shot',
    ],
  },
  {
    category: 'lighting',
    phrases: [
      'golden hour glow',
      'soft rim lighting',
      'warm practical glow',
      'cool moonlit wash',
      'neon signage glow',
      'flickering torchlight',
      'soft key light',
      'dramatic backlight',
    ],
  },
  {
    category: 'style',
    phrases: [
      'noir lighting treatment',
      'pastel color palette',
      'pastel palette',
      'documentary handheld aesthetic',
      'dreamy painterly look',
      'grainy analog texture',
      'high-contrast chiaroscuro',
      'sleek futuristic aesthetic',
    ],
  },
  {
    category: 'environment',
    phrases: [
      'rain-soaked alleyway',
      'fog-drenched rooftop',
      'misty forest clearing',
      'sunlit cobblestone street',
      'industrial warehouse floor',
      'glittering city skyline',
    ],
  },
];

export const RANGE_PATTERNS = [
  {
    category: 'technical',
    regex: /\b(?:\d+(?:\/\d+)?(?:\.\d+)?)\s?-\s?(?:\d+(?:\/\d+)?(?:\.\d+)?)(?:\s?(?:mm|fps|k|°?k|kelvin|sec|secs|seconds|s|ms))\b/gi,
    metadata: { type: 'range', unit: 'numeric' },
  },
  {
    category: 'technical',
    regex: /\bf\/\d+(?:\.\d+)?\s?-\s?f\/\d+(?:\.\d+)?\b/gi,
    metadata: { type: 'range', unit: 'aperture' },
  },
];

export const SINGLE_PATTERNS = [
  {
    category: 'technical',
    regex: /\b(?:iso\s?\d{3,5}|[0-9]+(?:\.\d+)?\s?(?:mm|fps|k|°?k|kelvin|sec|secs|seconds|s|ms|hz|khz|mhz)|f\/\d+(?:\.\d+)?|t\d+(?:\.\d+)?|1\/\d+(?:\.\d+)?\s?sec)\b/gi,
    specificity: 2,
  },
  {
    category: 'camera',
    regex: /\b(?:handheld|steadicam|gimbal|fpv|dolly|crane|tilt|pan|push-in|push in|pull-back|pull back)\b[^\n,.;:]{0,40}\b(?:shot|move|move|sweep|sequence)\b/gi,
    specificity: 1,
  },
  {
    category: 'lighting',
    regex: /\b(?:key|fill|rim|back|practical|spot|lantern|torch|softbox)\b[^\n]{0,30}\b(?:light|lighting|glow)\b/gi,
    specificity: 1,
  },
];
