/**
 * Camera Movement Gazetteers
 * 
 * Comprehensive lexicon of cinematography camera movements and their semantic properties.
 * Based on Section 2.2 (The "Pan" Paradox) and Section 5.4 (Cinematography Frame).
 */

/**
 * Primary camera movements that can be confused with common nouns
 * Each entry includes disambiguation context
 */
export const CAMERA_MOVES = {
  // Rotational movements
  pan: {
    type: 'rotational',
    axis: 'horizontal',
    definition: 'Horizontal rotation of camera on fixed axis',
    disambiguation: {
      verb_indicators: ['left', 'right', 'across', 'slowly', 'quickly'],
      noun_indicators: ['frying', 'cooking', 'golden', 'on', 'the', 'a'],
    },
    frame_elements: {
      direction: 'required', // left, right, across
      speed: 'optional', // slowly, quickly
      subject: 'optional', // what is being filmed
    },
  },
  tilt: {
    type: 'rotational',
    axis: 'vertical',
    definition: 'Vertical rotation of camera on fixed axis',
    disambiguation: {
      verb_indicators: ['up', 'down', 'upward', 'downward'],
      noun_indicators: ['the', 'a', 'at', 'an'],
    },
    frame_elements: {
      direction: 'required',
      speed: 'optional',
      subject: 'optional',
    },
  },
  roll: {
    type: 'rotational',
    axis: 'longitudinal',
    definition: 'Rotation along lens axis (Dutch angle in motion)',
    disambiguation: {
      verb_indicators: ['clockwise', 'counterclockwise', 'left', 'right'],
      noun_indicators: ['bread', 'drum', 'the', 'a'],
    },
    frame_elements: {
      direction: 'required',
      degrees: 'optional',
      speed: 'optional',
    },
  },

  // Translational movements
  dolly: {
    type: 'translational',
    definition: 'Camera moves toward or away from subject on track/wheels',
    disambiguation: {
      verb_indicators: ['in', 'out', 'forward', 'backward', 'toward', 'away'],
      noun_indicators: ['the', 'a', 'toy', 'child', 'wooden'],
    },
    frame_elements: {
      direction: 'required', // in, out, toward, away
      subject: 'optional',
      distance: 'optional',
    },
  },
  truck: {
    type: 'translational',
    definition: 'Camera moves laterally (perpendicular to subject)',
    disambiguation: {
      verb_indicators: ['left', 'right', 'alongside', 'parallel'],
      noun_indicators: ['the', 'a', 'pickup', 'delivery', 'red'],
    },
    frame_elements: {
      direction: 'required',
      subject: 'optional',
      distance: 'optional',
    },
  },
  pedestal: {
    type: 'translational',
    definition: 'Camera moves vertically up or down',
    disambiguation: {
      verb_indicators: ['up', 'down', 'raise', 'lower'],
      noun_indicators: ['the', 'a', 'statue', 'column', 'marble'],
    },
    frame_elements: {
      direction: 'required',
      distance: 'optional',
    },
  },
  crane: {
    type: 'translational',
    definition: 'Camera moves on crane arm (combination vertical/horizontal)',
    disambiguation: {
      verb_indicators: ['up', 'down', 'over', 'above'],
      noun_indicators: ['the', 'a', 'bird', 'construction', 'tall'],
    },
    frame_elements: {
      direction: 'required',
      subject: 'optional',
      height: 'optional',
    },
  },

  // Optical movements (lens-based)
  zoom: {
    type: 'optical',
    definition: 'Change focal length to magnify or shrink subject',
    disambiguation: {
      verb_indicators: ['in', 'out', 'on', 'to'],
      noun_indicators: ['the', 'a', 'video', 'call', 'meeting'],
    },
    frame_elements: {
      direction: 'required', // in, out
      subject: 'optional',
      speed: 'optional',
    },
  },
  focus: {
    type: 'optical',
    definition: 'Shift focus plane between subjects',
    alternatives: ['rack focus', 'pull focus', 'follow focus'],
    disambiguation: {
      verb_indicators: ['on', 'to', 'from', 'between'],
      noun_indicators: ['the', 'a', 'main', 'primary'],
    },
    frame_elements: {
      source: 'optional', // focus from
      target: 'required', // focus to
      speed: 'optional',
    },
  },

  // Complex/specialized movements
  'arc shot': {
    type: 'complex',
    definition: 'Camera moves in circular path around subject',
    aliases: ['orbit', 'circle'],
    frame_elements: {
      subject: 'required',
      direction: 'optional', // clockwise, counterclockwise
      degrees: 'optional',
    },
  },
  'tracking shot': {
    type: 'complex',
    definition: 'Camera follows subject in motion',
    aliases: ['follow shot', 'follow'],
    frame_elements: {
      subject: 'required',
      distance: 'optional',
      position: 'optional', // from behind, from side
    },
  },
  'handheld': {
    type: 'style',
    definition: 'Unstabilized camera with natural shake',
    frame_elements: {
      intensity: 'optional', // subtle, pronounced, extreme
    },
  },
  'steadicam': {
    type: 'style',
    definition: 'Stabilized handheld camera movement',
    frame_elements: {
      path: 'optional',
      subject: 'optional',
    },
  },
  'whip pan': {
    type: 'stylistic',
    definition: 'Extremely fast pan creating motion blur',
    aliases: ['swish pan', 'flick pan'],
    frame_elements: {
      direction: 'required',
      source: 'optional',
      target: 'optional',
    },
  },
};

/**
 * Camera angles/positions
 */
export const CAMERA_ANGLES = {
  'high angle': {
    definition: 'Camera positioned above subject looking down',
    effect: 'Makes subject appear smaller/vulnerable',
  },
  'low angle': {
    definition: 'Camera positioned below subject looking up',
    effect: 'Makes subject appear larger/powerful',
  },
  'eye level': {
    definition: 'Camera at subject\'s eye height',
    effect: 'Neutral perspective',
  },
  'birds eye': {
    definition: 'Camera directly above subject (90 degrees)',
    aliases: ['overhead', 'top down'],
    effect: 'Disorienting/spatial',
  },
  'dutch angle': {
    definition: 'Camera tilted on longitudinal axis',
    aliases: ['canted angle', 'oblique angle'],
    effect: 'Unease/disorientation',
  },
  'worms eye': {
    definition: 'Camera at ground level looking up',
    effect: 'Extreme power/scale',
  },
};

/**
 * Shot types and framing
 */
export const SHOT_TYPES = {
  'extreme close-up': { abbrev: 'ECU', definition: 'Very tight on detail' },
  'close-up': { abbrev: 'CU', definition: 'Face or object fills frame' },
  'medium close-up': { abbrev: 'MCU', definition: 'Head and shoulders' },
  'medium shot': { abbrev: 'MS', definition: 'Waist up' },
  'medium long shot': { abbrev: 'MLS', definition: 'Knees up' },
  'long shot': { abbrev: 'LS', definition: 'Full body' },
  'extreme long shot': { abbrev: 'ELS', definition: 'Subject small in frame' },
  'establishing shot': { definition: 'Wide shot setting scene context' },
  'over-the-shoulder': { abbrev: 'OTS', definition: 'View from behind one subject' },
  'point of view': { abbrev: 'POV', definition: 'Camera as subject\'s eyes' },
  'two-shot': { definition: 'Two subjects in frame' },
  'three-shot': { definition: 'Three subjects in frame' },
};

/**
 * Directional terms used with camera movements
 */
export const DIRECTIONS = [
  // Cardinal
  'left', 'right', 'up', 'down',
  // Relative
  'forward', 'backward', 'toward', 'away',
  // Prepositions
  'across', 'around', 'through', 'past', 'over', 'under',
  // Lateral
  'alongside', 'parallel',
  // Rotational
  'clockwise', 'counterclockwise',
  // Vertical
  'upward', 'downward', 'above', 'below',
];

/**
 * Speed modifiers for camera movements
 */
export const MOVEMENT_SPEEDS = [
  'slowly', 'quickly', 'fast', 'slow',
  'gradual', 'sudden', 'smooth', 'jerky',
  'steady', 'rapid', 'gentle', 'aggressive',
];

/**
 * All camera movement terms (for quick lookup)
 */
export const ALL_CAMERA_TERMS = [
  ...Object.keys(CAMERA_MOVES),
  ...Object.keys(CAMERA_ANGLES),
  ...Object.keys(SHOT_TYPES),
  // Flatten aliases
  ...Object.values(CAMERA_MOVES)
    .filter(move => move.aliases)
    .flatMap(move => move.aliases),
  ...Object.values(CAMERA_ANGLES)
    .filter(angle => angle.aliases)
    .flatMap(angle => angle.aliases),
  ...Object.values(CAMERA_MOVES)
    .filter(move => move.alternatives)
    .flatMap(move => move.alternatives),
];

/**
 * Check if a term is a camera movement
 */
export function isCameraMovement(term) {
  const normalized = term.toLowerCase().trim();
  return ALL_CAMERA_TERMS.includes(normalized);
}

/**
 * Get camera movement definition
 */
export function getCameraMovementDef(term) {
  const normalized = term.toLowerCase().trim();
  
  // Check primary
  if (CAMERA_MOVES[normalized]) {
    return CAMERA_MOVES[normalized];
  }
  
  // Check aliases
  for (const [key, value] of Object.entries(CAMERA_MOVES)) {
    if (value.aliases && value.aliases.includes(normalized)) {
      return { ...value, canonical: key };
    }
    if (value.alternatives && value.alternatives.includes(normalized)) {
      return { ...value, canonical: key };
    }
  }
  
  // Check angles
  if (CAMERA_ANGLES[normalized]) {
    return { ...CAMERA_ANGLES[normalized], type: 'angle' };
  }
  
  // Check shot types
  if (SHOT_TYPES[normalized]) {
    return { ...SHOT_TYPES[normalized], type: 'shot' };
  }
  
  return null;
}

export default {
  CAMERA_MOVES,
  CAMERA_ANGLES,
  SHOT_TYPES,
  DIRECTIONS,
  MOVEMENT_SPEEDS,
  ALL_CAMERA_TERMS,
  isCameraMovement,
  getCameraMovementDef,
};

