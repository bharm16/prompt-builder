/**
 * Configuration for video prompt detection markers
 */

export const DETECTION_MARKERS = {
  // Legacy template markers (original format)
  LEGACY: [
    '**main prompt:**',
    '**technical parameters:**',
    'camera movement:',
  ],

  // Modern template markers (current format)
  MODERN: [
    '**prompt:**',
    '**guiding principles',
    '**writing rules',
    '**technical specs',
    '**alternative approaches',
    'variation 1 (different camera)',
    'variation 2 (different lighting/mood)',
  ],

  // Natural-language cinematographic markers
  CINEMATOGRAPHIC: [
    'camera',
    'close-up',
    'close up',
    'wide shot',
    'medium shot',
    'eye-level',
    'eye level',
    'low angle',
    'high angle',
    'tracking shot',
    'dolly',
    'pan',
    'tilt',
    'zoom',
    'focus pull',
    'depth of field',
    'handheld',
    'steadicam',
    'crane shot',
    'aerial shot',
    'pov',
    'slow motion',
    'time-lapse',
    'frame',
    'cinematic',
    'lens',
    'bokeh',
    'rack focus',
    'establishing shot',
    'over-the-shoulder',
  ],

  // Technical field markers
  TECHNICAL_FIELDS: [
    'duration:',
    'aspect ratio:',
    'frame rate:',
    'audio:',
  ],
};

/**
 * Detection thresholds for identifying video prompts
 */
export const DETECTION_THRESHOLDS = {
  // Minimum technical fields for detection
  MIN_TECH_FIELDS_WITH_SPECS: 2,
  MIN_TECH_FIELDS_WITH_ALTERNATIVES: 3,
  CINEMATOGRAPHIC_THRESHOLD: 2,
};
