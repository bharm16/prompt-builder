/**
 * Lighting Terms Gazetteers
 * 
 * Comprehensive lexicon of cinematography lighting terms and their semantic properties.
 */

/**
 * Lighting styles and setups
 */
export const LIGHTING_STYLES = {
  // Classic setups
  'three-point lighting': {
    type: 'setup',
    definition: 'Standard setup with key, fill, and back light',
    components: ['key light', 'fill light', 'back light'],
  },
  'key light': {
    type: 'source',
    definition: 'Primary/dominant light source',
    position: 'front-side',
    intensity: 'high',
  },
  'fill light': {
    type: 'source',
    definition: 'Secondary light to reduce shadows from key',
    position: 'opposite-key',
    intensity: 'medium',
  },
  'back light': {
    type: 'source',
    definition: 'Light from behind to separate subject from background',
    aliases: ['rim light', 'hair light'],
    position: 'behind',
    intensity: 'medium',
  },
  'practical light': {
    type: 'source',
    definition: 'Light source visible in frame (lamp, candle, etc.)',
  },

  // Lighting qualities
  'hard light': {
    type: 'quality',
    definition: 'Direct light creating sharp shadows',
    characteristics: ['sharp shadows', 'high contrast', 'defined edges'],
  },
  'soft light': {
    type: 'quality',
    definition: 'Diffused light creating gentle shadows',
    characteristics: ['gentle shadows', 'low contrast', 'soft edges'],
  },
  'diffused light': {
    type: 'quality',
    definition: 'Light scattered through material',
    synonyms: ['soft light'],
  },

  // Lighting directions
  'front lighting': {
    type: 'direction',
    definition: 'Light from camera direction',
    effect: 'Flat, minimal shadows',
  },
  'side lighting': {
    type: 'direction',
    definition: 'Light from 90 degrees to subject',
    effect: 'Dramatic shadows, texture emphasis',
  },
  'back lighting': {
    type: 'direction',
    definition: 'Light from behind subject',
    aliases: ['contre-jour', 'silhouette lighting'],
    effect: 'Silhouette or rim lighting',
  },
  'top lighting': {
    type: 'direction',
    definition: 'Light from directly above',
    effect: 'Ominous shadows under features',
  },
  'bottom lighting': {
    type: 'direction',
    definition: 'Light from below subject',
    effect: 'Unnatural, horror aesthetic',
  },

  // Lighting moods/styles
  'high-key lighting': {
    type: 'mood',
    definition: 'Bright, low contrast, minimal shadows',
    usage: 'Comedies, commercials, upbeat content',
    characteristics: ['bright', 'cheerful', 'low contrast'],
  },
  'low-key lighting': {
    type: 'mood',
    definition: 'Dark, high contrast, dramatic shadows',
    usage: 'Film noir, horror, drama',
    characteristics: ['dark', 'dramatic', 'high contrast'],
  },
  'chiaroscuro': {
    type: 'mood',
    definition: 'Extreme contrast between light and dark',
    origin: 'Renaissance painting technique',
    characteristics: ['dramatic', 'high contrast', 'painterly'],
  },
  'natural lighting': {
    type: 'mood',
    definition: 'Lighting that mimics natural sources',
    sources: ['sun', 'moon', 'fire', 'sky'],
  },

  // Specialized lighting
  'rembrandt lighting': {
    type: 'portrait',
    definition: 'Light creating triangle on cheek',
    characteristics: ['triangle on cheek', 'dramatic', '45-degree angle'],
  },
  'butterfly lighting': {
    type: 'portrait',
    definition: 'Light directly in front and above',
    aliases: ['paramount lighting'],
    characteristics: ['shadow under nose', 'glamorous'],
  },
  'loop lighting': {
    type: 'portrait',
    definition: 'Key light 30-45 degrees, slight nose shadow',
    characteristics: ['small nose shadow', 'natural', 'flattering'],
  },
  'split lighting': {
    type: 'portrait',
    definition: 'Light from 90 degrees, half face lit',
    characteristics: ['half face in shadow', 'dramatic', 'mysterious'],
  },

  // Color temperature
  'warm lighting': {
    type: 'temperature',
    definition: 'Orange/yellow color temperature',
    kelvin: '2700-3500K',
    mood: 'Cozy, nostalgic, inviting',
  },
  'cool lighting': {
    type: 'temperature',
    definition: 'Blue color temperature',
    kelvin: '5000-7000K',
    mood: 'Clinical, futuristic, cold',
  },
  'neutral lighting': {
    type: 'temperature',
    definition: 'Daylight color temperature',
    kelvin: '5500-6500K',
    mood: 'Natural, balanced',
  },

  // Lighting effects
  'motivated lighting': {
    type: 'technique',
    definition: 'Lighting justified by visible source',
  },
  'ambient lighting': {
    type: 'technique',
    definition: 'Overall base illumination',
  },
  'accent lighting': {
    type: 'technique',
    definition: 'Highlighting specific area or object',
  },
  'volumetric lighting': {
    type: 'effect',
    definition: 'Visible light beams through atmosphere',
    aliases: ['god rays', 'light shafts', 'crepuscular rays'],
  },
  'lens flare': {
    type: 'effect',
    definition: 'Light scattering in lens creating artifacts',
  },
  'bloom': {
    type: 'effect',
    definition: 'Light bleeding/glow around bright areas',
  },
  'silhouette': {
    type: 'effect',
    definition: 'Subject as dark shape against bright background',
  },
};

/**
 * Color temperature terms
 */
export const COLOR_TEMPS = {
  'candlelight': '1800K',
  'tungsten': '3200K',
  'sunrise': '3500K',
  'fluorescent': '4000K',
  'daylight': '5600K',
  'overcast': '6500K',
  'shade': '7500K',
  'blue hour': '8000K',
};

/**
 * Time of day lighting characteristics
 */
export const TIME_OF_DAY_LIGHTING = {
  'golden hour': {
    time: 'Hour after sunrise / before sunset',
    color: 'Warm orange/gold',
    quality: 'Soft, directional',
    shadows: 'Long',
  },
  'blue hour': {
    time: 'Before sunrise / after sunset',
    color: 'Cool blue',
    quality: 'Diffused',
    shadows: 'Minimal',
  },
  'magic hour': {
    time: 'Same as golden hour',
    aliases: ['golden hour'],
  },
  'noon': {
    time: 'Midday',
    color: 'Neutral white',
    quality: 'Hard, overhead',
    shadows: 'Short, harsh',
  },
  'dusk': {
    time: 'Evening twilight',
    color: 'Purple/orange gradient',
    quality: 'Soft',
  },
  'dawn': {
    time: 'Morning twilight',
    color: 'Soft pink/blue',
    quality: 'Soft',
  },
};

/**
 * Lighting modifiers (equipment/techniques)
 */
export const LIGHTING_MODIFIERS = {
  'softbox': 'Enclosed diffusion',
  'umbrella': 'Reflective/diffusive modifier',
  'beauty dish': 'Portrait light with center deflection',
  'snoot': 'Narrow beam concentrator',
  'barn doors': 'Adjustable light blockers',
  'gobo': 'Pattern/shape creator',
  'scrim': 'Light diffusion material',
  'flag': 'Light blocking panel',
  'bounce': 'Reflective surface',
  'gel': 'Color filter',
  'diffusion': 'Light softening material',
};

/**
 * All lighting terms (for quick lookup)
 */
export const ALL_LIGHTING_TERMS = [
  ...Object.keys(LIGHTING_STYLES),
  ...Object.keys(TIME_OF_DAY_LIGHTING),
  ...Object.keys(LIGHTING_MODIFIERS),
  // Flatten aliases
  ...Object.values(LIGHTING_STYLES)
    .filter(style => style.aliases)
    .flatMap(style => style.aliases),
  ...Object.values(LIGHTING_STYLES)
    .filter(style => style.synonyms)
    .flatMap(style => style.synonyms),
];

/**
 * Check if term is a lighting term
 */
export function isLightingTerm(term) {
  const normalized = term.toLowerCase().trim();
  return ALL_LIGHTING_TERMS.includes(normalized);
}

/**
 * Get lighting term definition
 */
export function getLightingDef(term) {
  const normalized = term.toLowerCase().trim();
  
  if (LIGHTING_STYLES[normalized]) {
    return LIGHTING_STYLES[normalized];
  }
  
  // Check aliases
  for (const [key, value] of Object.entries(LIGHTING_STYLES)) {
    if (value.aliases && value.aliases.includes(normalized)) {
      return { ...value, canonical: key };
    }
  }
  
  if (TIME_OF_DAY_LIGHTING[normalized]) {
    return { ...TIME_OF_DAY_LIGHTING[normalized], type: 'time' };
  }
  
  return null;
}

export default {
  LIGHTING_STYLES,
  COLOR_TEMPS,
  TIME_OF_DAY_LIGHTING,
  LIGHTING_MODIFIERS,
  ALL_LIGHTING_TERMS,
  isLightingTerm,
  getLightingDef,
};

