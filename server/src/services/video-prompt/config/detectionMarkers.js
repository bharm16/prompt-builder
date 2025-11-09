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
};

