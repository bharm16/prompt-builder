/**
 * Creative Example Bank - Artistic and Poetic Language
 * 
 * Examples focused on metaphors, imagery, stylistic devices, creative writing,
 * and artistic expression. Helps the model correctly identify figurative language,
 * emotional tone, and literary devices.
 * 
 * From PDF: Context-aware example selection for creative and expressive text.
 */

export const creativeExamples = [
  {
    input: "The sunset painted the sky in shades of amber and crimson, like a canvas ablaze",
    output: {
      spans: [
        { text: "sunset", role: "subject.object", confidence: 0.9 },
        { text: "painted", role: "metaphor.verb", confidence: 0.95 },
        { text: "shades of amber and crimson", role: "style.color", confidence: 0.9 },
        { text: "like a canvas ablaze", role: "metaphor.simile", confidence: 0.95 }
      ],
      meta: {
        version: "v3.0",
        notes: "Metaphorical language and vivid imagery"
      }
    },
    domains: ['creative', 'poetic'],
    keywords: ['sunset', 'painted', 'amber', 'crimson', 'canvas', 'metaphor'],
    ambiguity: 'figurative_language'
  },

  {
    input: "Her voice trembled like autumn leaves in a restless wind",
    output: {
      spans: [
        { text: "Her voice", role: "subject.attribute", confidence: 0.9 },
        { text: "trembled", role: "action.quality", confidence: 0.85 },
        { text: "like autumn leaves in a restless wind", role: "metaphor.simile", confidence: 0.95 }
      ],
      meta: {
        version: "v3.0",
        notes: "Simile comparing abstract quality to natural imagery"
      }
    },
    domains: ['creative', 'poetic'],
    keywords: ['voice', 'trembled', 'autumn', 'leaves', 'wind', 'simile'],
    ambiguity: 'simile_structure'
  },

  {
    input: "Time is a thief that steals our moments, leaving only memories as breadcrumbs",
    output: {
      spans: [
        { text: "Time is a thief", role: "metaphor.personification", confidence: 0.95 },
        { text: "steals our moments", role: "metaphor.action", confidence: 0.9 },
        { text: "memories as breadcrumbs", role: "metaphor.comparison", confidence: 0.95 }
      ],
      meta: {
        version: "v3.0",
        notes: "Extended metaphor with personification"
      }
    },
    domains: ['creative', 'poetic', 'philosophical'],
    keywords: ['time', 'thief', 'steals', 'memories', 'breadcrumbs', 'personification'],
    ambiguity: 'extended_metaphor'
  },

  {
    input: "The city breathed with a thousand neon lungs, exhaling jazz and cigarette smoke",
    output: {
      spans: [
        { text: "city breathed", role: "metaphor.personification", confidence: 0.95 },
        { text: "thousand neon lungs", role: "metaphor.image", confidence: 0.95 },
        { text: "exhaling jazz and cigarette smoke", role: "metaphor.action", confidence: 0.9 }
      ],
      meta: {
        version: "v3.0",
        notes: "Vivid personification with sensory details"
      }
    },
    domains: ['creative', 'noir', 'atmospheric'],
    keywords: ['city', 'breathed', 'neon', 'lungs', 'jazz', 'smoke', 'atmosphere'],
    ambiguity: 'atmospheric_personification'
  },

  {
    input: "Silence wrapped around them like a velvet shroud, heavy and suffocating",
    output: {
      spans: [
        { text: "Silence", role: "subject.abstract", confidence: 0.9 },
        { text: "wrapped around them", role: "metaphor.action", confidence: 0.95 },
        { text: "like a velvet shroud", role: "metaphor.simile", confidence: 0.95 },
        { text: "heavy and suffocating", role: "mood.quality", confidence: 0.9 }
      ],
      meta: {
        version: "v3.0",
        notes: "Abstract concept given physical properties"
      }
    },
    domains: ['creative', 'dramatic'],
    keywords: ['silence', 'wrapped', 'velvet', 'shroud', 'heavy', 'suffocating'],
    ambiguity: 'abstract_made_concrete'
  },

  {
    input: "Stars danced across the obsidian canvas, each one a distant promise of light",
    output: {
      spans: [
        { text: "Stars danced", role: "metaphor.personification", confidence: 0.95 },
        { text: "obsidian canvas", role: "metaphor.comparison", confidence: 0.9 },
        { text: "each one a distant promise of light", role: "metaphor.symbolism", confidence: 0.9 }
      ],
      meta: {
        version: "v3.0",
        notes: "Layered metaphors with personification and symbolism"
      }
    },
    domains: ['creative', 'poetic', 'cosmic'],
    keywords: ['stars', 'danced', 'obsidian', 'canvas', 'promise', 'light'],
    ambiguity: 'layered_metaphors'
  },

  {
    input: "His words cut through the tension, sharp as broken glass and twice as dangerous",
    output: {
      spans: [
        { text: "His words", role: "subject.abstract", confidence: 0.9 },
        { text: "cut through", role: "metaphor.action", confidence: 0.95 },
        { text: "the tension", role: "mood.atmosphere", confidence: 0.85 },
        { text: "sharp as broken glass", role: "metaphor.simile", confidence: 0.95 },
        { text: "twice as dangerous", role: "mood.quality", confidence: 0.85 }
      ],
      meta: {
        version: "v3.0",
        notes: "Words given physical cutting properties"
      }
    },
    domains: ['creative', 'dramatic'],
    keywords: ['words', 'cut', 'tension', 'sharp', 'glass', 'dangerous'],
    ambiguity: 'speech_as_weapon'
  },

  {
    input: "The melody lingered like perfume, sweet and haunting long after the song ended",
    output: {
      spans: [
        { text: "melody", role: "subject.auditory", confidence: 0.9 },
        { text: "lingered", role: "action.duration", confidence: 0.85 },
        { text: "like perfume", role: "metaphor.synesthesia", confidence: 0.95 },
        { text: "sweet and haunting", role: "mood.quality", confidence: 0.9 }
      ],
      meta: {
        version: "v3.0",
        notes: "Synesthesia: auditory described through olfactory sense"
      }
    },
    domains: ['creative', 'sensory', 'musical'],
    keywords: ['melody', 'lingered', 'perfume', 'sweet', 'haunting', 'song'],
    ambiguity: 'synesthesia'
  },

  {
    input: "Rain wept against the windowpane, each drop a tiny confession of the storm's sorrow",
    output: {
      spans: [
        { text: "Rain wept", role: "metaphor.personification", confidence: 0.95 },
        { text: "windowpane", role: "environment.object", confidence: 0.8 },
        { text: "each drop a tiny confession", role: "metaphor.symbolism", confidence: 0.95 },
        { text: "storm's sorrow", role: "metaphor.emotion", confidence: 0.9 }
      ],
      meta: {
        version: "v3.0",
        notes: "Weather personified with emotional attributes"
      }
    },
    domains: ['creative', 'poetic', 'melancholy'],
    keywords: ['rain', 'wept', 'window', 'confession', 'storm', 'sorrow'],
    ambiguity: 'weather_personification'
  },

  {
    input: "The old library held secrets between its pages like pressed flowers from forgotten summers",
    output: {
      spans: [
        { text: "old library", role: "environment.location", confidence: 0.85 },
        { text: "held secrets", role: "metaphor.action", confidence: 0.9 },
        { text: "between its pages", role: "environment.context", confidence: 0.8 },
        { text: "like pressed flowers from forgotten summers", role: "metaphor.simile", confidence: 0.95 }
      ],
      meta: {
        version: "v3.0",
        notes: "Nostalgic metaphor connecting knowledge and memory"
      }
    },
    domains: ['creative', 'nostalgic', 'literary'],
    keywords: ['library', 'secrets', 'pages', 'pressed flowers', 'summers', 'forgotten'],
    ambiguity: 'nostalgic_imagery'
  }
];

