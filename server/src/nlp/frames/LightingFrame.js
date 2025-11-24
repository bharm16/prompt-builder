/**
 * Lighting Frame - Domain-Specific Frame for Lighting and Illumination
 * 
 * This frame captures the semantics of lighting in video generation,
 * covering light sources, qualities, and atmospheric effects.
 * 
 * Lighting is critical for video generation as it defines:
 * - Mood and atmosphere
 * - Time of day
 * - Visual style
 * - Depth and texture
 * 
 * Unlike Motion (subject movement) or Cinematography (camera operation),
 * the Lighting frame describes the illumination environment.
 */

import { LIGHTING_STYLES, TIME_OF_DAY_LIGHTING } from '../gazetteers/lightingTerms.js';

/**
 * Lighting frame definition
 */
export const LightingFrame = {
  name: 'Lighting',
  description: 'Illumination, light quality, and atmospheric lighting effects',
  
  /**
   * Lexical Units - terms that evoke lighting
   */
  lexicalUnits: {
    // State verbs (how something is lit)
    illumination: ['illuminated', 'lit', 'lighted', 'glowing', 'shining', 'bright', 'luminous'],
    shadow: ['shadowed', 'darkened', 'dim', 'dark', 'obscured'],
    
    // Active lighting verbs
    lighting: ['illuminate', 'illuminates', 'light', 'lights', 'lighting', 'shine', 'shines', 'shining'],
    
    // Lighting effects
    effects: ['highlighted', 'silhouetted', 'backlit', 'front-lit'],
    
    // Light quality adjectives
    quality: ['soft', 'hard', 'diffused', 'harsh', 'gentle', 'warm', 'cool', 'natural'],
    
    // Lighting setups (compound terms)
    setups: ['key light', 'fill light', 'back light', 'rim light', 'practical light'],
    
    // Moods/styles
    moods: ['high-key', 'low-key', 'chiaroscuro', 'rembrandt', 'butterfly'],
    
    // Time-of-day lighting
    timeOfDay: ['golden hour', 'blue hour', 'magic hour', 'noon', 'dusk', 'dawn', 'sunrise', 'sunset'],
  },

  /**
   * Frame Elements - components of lighting
   */
  frameElements: {
    // ===== CORE ELEMENTS =====
    
    SCENE: {
      type: 'Core',
      definition: 'What is being lit',
      examples: ['the forest', 'the character', 'the room'],
      mapsTo: 'environment.location',
      required: true,
    },
    
    SOURCE: {
      type: 'Core',
      definition: 'The light source',
      examples: ['sun', 'neon sign', 'candles', 'fire', 'lamp'],
      mapsTo: 'lighting.source',
      required: false,
    },
    
    // ===== PERIPHERAL ELEMENTS =====
    
    QUALITY: {
      type: 'Peripheral',
      definition: 'Quality or character of the light',
      examples: ['soft', 'hard', 'diffused', 'harsh'],
      mapsTo: 'lighting.quality',
      keywords: ['soft', 'hard', 'diffused', 'harsh', 'gentle', 'direct'],
    },
    
    TIME: {
      type: 'Peripheral',
      definition: 'Time of day associated with lighting',
      examples: ['golden hour', 'night', 'dawn'],
      mapsTo: 'lighting.timeOfDay',
      keywords: Object.keys(TIME_OF_DAY_LIGHTING),
    },
    
    COLOR_TEMP: {
      type: 'Peripheral',
      definition: 'Color temperature of light',
      examples: ['warm', 'cool', 'neutral', 'orange', 'blue'],
      mapsTo: 'lighting.colorTemperature',
      keywords: ['warm', 'cool', 'neutral', 'cold', 'hot'],
    },
    
    DIRECTION: {
      type: 'Peripheral',
      definition: 'Direction light comes from',
      examples: ['from above', 'from below', 'from the side', 'from behind'],
      mapsTo: 'lighting.direction',
      keywords: ['above', 'below', 'front', 'back', 'side', 'overhead'],
    },
    
    INTENSITY: {
      type: 'Peripheral',
      definition: 'Brightness or strength of light',
      examples: ['bright', 'dim', 'subtle', 'intense', 'strong'],
      mapsTo: 'lighting.intensity',
      keywords: ['bright', 'dim', 'subtle', 'intense', 'strong', 'faint'],
    },
    
    MOOD: {
      type: 'Peripheral',
      definition: 'Emotional quality created by lighting',
      examples: ['dramatic', 'mysterious', 'cheerful', 'ominous'],
      mapsTo: 'mood',
      keywords: ['dramatic', 'mysterious', 'cheerful', 'ominous', 'romantic', 'eerie'],
    },
    
    EFFECT: {
      type: 'Peripheral',
      definition: 'Special lighting effects',
      examples: ['volumetric lighting', 'lens flare', 'bloom', 'god rays'],
      mapsTo: 'lighting.effect',
      keywords: ['volumetric', 'lens flare', 'bloom', 'god rays', 'light shafts'],
    },
  },

  /**
   * Pattern detection for frame elements
   */
  patterns: {
    SCENE: {
      syntactic: ['NP that is being lit', 'subject of lighting verb'],
      position: 'subject',
    },
    SOURCE: {
      syntactic: ['PP with "by", "from"', 'NP after "by"'],
      prepositions: ['by', 'from'],
      indicators: ['sun', 'moon', 'lamp', 'fire', 'candle', 'neon', 'light'],
    },
    QUALITY: {
      syntactic: ['JJ modifying "light"'],
      position: 'pre-noun',
      keywords: ['soft', 'hard', 'diffused', 'harsh', 'gentle'],
    },
    TIME: {
      syntactic: ['Time-of-day expressions'],
      keywords: Object.keys(TIME_OF_DAY_LIGHTING),
    },
    DIRECTION: {
      syntactic: ['PP indicating direction'],
      prepositions: ['from', 'above', 'below', 'behind'],
    },
  },

  /**
   * Check if a term evokes the Lighting frame
   * 
   * @param {string} term - Term to check
   * @param {Object} context - Surrounding context
   * @returns {boolean|string} False or the lighting category
   */
  evokesFrame(term, context = {}) {
    const normalized = term.toLowerCase();
    
    // Check all lexical unit categories
    for (const [category, terms] of Object.entries(this.lexicalUnits)) {
      if (Array.isArray(terms) && terms.includes(normalized)) {
        return category;
      }
    }
    
    // Check compound terms (multi-word)
    const compoundTerms = this.lexicalUnits.setups.concat(this.lexicalUnits.timeOfDay);
    for (const compound of compoundTerms) {
      if (normalized.includes(compound) || compound.includes(normalized)) {
        return 'compound';
      }
    }
    
    return false;
  },

  /**
   * Get all lighting terms
   * 
   * @returns {Array<string>} All lexical units
   */
  getAllLexicalUnits() {
    const allUnits = [];
    for (const terms of Object.values(this.lexicalUnits)) {
      if (Array.isArray(terms)) {
        allUnits.push(...terms);
      }
    }
    return allUnits;
  },

  /**
   * Get lighting style definition from gazetteer
   * 
   * @param {string} term - Lighting term
   * @returns {Object|null} Lighting definition
   */
  getLightingDefinition(term) {
    const normalized = term.toLowerCase();
    return LIGHTING_STYLES[normalized] || TIME_OF_DAY_LIGHTING[normalized] || null;
  },

  /**
   * Infer lighting characteristics from term
   * 
   * @param {string} term - Lighting term
   * @returns {Object|null} Lighting characteristics
   */
  inferCharacteristics(term) {
    const category = this.evokesFrame(term);
    
    if (!category) return null;
    
    const definition = this.getLightingDefinition(term);
    
    return {
      term,
      category,
      type: definition?.type || 'unknown',
      definition: definition?.definition || null,
      mood: definition?.mood || definition?.usage || null,
      characteristics: definition?.characteristics || [],
    };
  },

  /**
   * Detect time of day from lighting description
   * 
   * @param {string} text - Text to analyze
   * @returns {string|null} Time of day or null
   */
  detectTimeOfDay(text) {
    const normalized = text.toLowerCase();
    
    for (const timeOfDay of this.lexicalUnits.timeOfDay) {
      if (normalized.includes(timeOfDay)) {
        return timeOfDay;
      }
    }
    
    return null;
  },

  /**
   * Detect lighting quality
   * 
   * @param {string} text - Text to analyze
   * @returns {Array<string>} Detected qualities
   */
  detectQualities(text) {
    const normalized = text.toLowerCase();
    const found = [];
    
    for (const quality of this.lexicalUnits.quality) {
      if (normalized.includes(quality)) {
        found.push(quality);
      }
    }
    
    return found;
  },

  /**
   * Classify lighting mood (high-key vs low-key)
   * 
   * @param {Array<string>} qualities - Detected lighting qualities
   * @param {string} timeOfDay - Time of day if detected
   * @returns {string} Mood classification
   */
  classifyMood(qualities, timeOfDay) {
    // High-key indicators
    const highKeyIndicators = ['bright', 'soft', 'gentle', 'cheerful'];
    // Low-key indicators
    const lowKeyIndicators = ['dark', 'harsh', 'dramatic', 'shadowed'];
    
    const hasHighKey = qualities.some(q => highKeyIndicators.includes(q));
    const hasLowKey = qualities.some(q => lowKeyIndicators.includes(q));
    
    if (timeOfDay) {
      if (['golden hour', 'sunrise', 'dawn'].includes(timeOfDay)) return 'high-key';
      if (['night', 'dusk', 'blue hour'].includes(timeOfDay)) return 'low-key';
    }
    
    if (hasHighKey && !hasLowKey) return 'high-key';
    if (hasLowKey && !hasHighKey) return 'low-key';
    
    return 'neutral';
  },
};

export default LightingFrame;

