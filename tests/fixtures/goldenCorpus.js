/**
 * Golden corpus for parser validation.
 *
 * Each entry defines the original prompt plus the spans that must be present
 * once the extraction pipeline completes. Expected spans use literal quotes so
 * tests can look up exact matches regardless of indices.
 */
export const GOLDEN_CORPUS = [
  {
    name: 'lexicon-core',
    text: '🎥 A slow dolly shot through the rain-soaked alley, bathed in golden hour glow, captured on a 35mm lens at 24fps.',
    expected: [
      { quote: 'dolly shot', category: 'camera', source: 'LEXICON' },
      { quote: 'golden hour glow', category: 'lighting', source: 'LEXICON' },
      { quote: '35mm', category: 'technical', source: 'LEXICON' },
      { quote: '24fps', category: 'technical', source: 'LEXICON' },
    ],
  },
  {
    name: 'technical-range',
    text: 'Set exposure between 1/125-1/60 sec with ISO 800 on a Steadicam push-in.',
    expected: [
      { quote: '1/125-1/60 sec', category: 'technical', source: 'LEXICON' },
      { quote: 'ISO 800', category: 'technical', source: 'LEXICON' },
    ],
  },
  {
    name: 'style-pair',
    text: 'A dreamy painterly look with a pastel palette and noir lighting treatment.',
    expected: [
      { quote: 'dreamy painterly look', category: 'style', source: 'LEXICON' },
      { quote: 'noir lighting treatment', category: 'style', source: 'LEXICON' },
    ],
  },
  {
    name: 'environment-double',
    text: 'Set in a rain-soaked alleyway beside a fog-drenched rooftop.',
    expected: [
      { quote: 'rain-soaked alleyway', category: 'environment', source: 'LEXICON' },
      { quote: 'fog-drenched rooftop', category: 'environment', source: 'LEXICON' },
    ],
  },
  {
    name: 'emoji-lighting',
    text: '🌌 Neon signage glow wraps the scene while soft key light adds depth, captured on a 50mm lens at 60fps.',
    expected: [
      { quote: 'Neon signage glow', category: 'lighting', source: 'LEXICON' },
      { quote: 'soft key light', category: 'lighting', source: 'LEXICON' },
      { quote: '50mm', category: 'technical', source: 'LEXICON' },
      { quote: '60fps', category: 'technical', source: 'LEXICON' },
    ],
  },
  {
    name: 'context-priority',
    text: 'The lone astronaut calibrates instruments inside the abandoned station while the camera pans across the console.',
    context: {
      subject: 'lone astronaut',
      location: 'abandoned station',
    },
    expected: [
      { quote: 'lone astronaut', category: 'subject', source: 'CONTEXT' },
      { quote: 'abandoned station', category: 'environment', source: 'CONTEXT' },
    ],
  },
  {
    name: 'ambient-nlp',
    text: 'Soft ambient light bathes the corridor walls.',
    expected: [
      { quote: 'ambient light', category: 'lighting', source: 'NLP' },
      { quote: 'corridor', category: 'environment', source: 'NLP' },
    ],
  },
  {
    name: 'aperture-range',
    text: 'Documentary handheld aesthetic with a push-in shot at f/2.8-f/5.6.',
    expected: [
      { quote: 'Documentary handheld aesthetic', category: 'style', source: 'LEXICON' },
      { quote: 'f/2.8-f/5.6', category: 'technical', source: 'LEXICON' },
    ],
  },
  {
    name: 'context-emoji',
    text: '✨ The hero pilot adjusts controls inside the derelict ship at blue hour.',
    context: {
      subject: 'hero pilot',
      location: 'derelict ship',
      time: 'blue hour',
    },
    expected: [
      { quote: 'hero pilot', category: 'subject', source: 'CONTEXT' },
      { quote: 'derelict ship', category: 'environment', source: 'CONTEXT' },
      { quote: 'blue hour', category: 'timeOfDay', source: 'CONTEXT' },
    ],
  },
  {
    name: 'lighting-nlp-gap',
    text: 'Flickering practical light spills into the market square.',
    expected: [
      { quote: 'practical light', category: 'lighting', source: 'LEXICON' },
      { quote: 'market', category: 'environment', source: 'NLP' },
    ],
  },
];
