/**
 * Category mapping patterns for video phrase role detection
 */

export const CATEGORY_PATTERNS = {
  // Subject/Character (includes Appearance from span labeler)
  SUBJECT: {
    pattern: /subject|character|figure|talent|person|performer|appearance/,
    role: 'subject or character detail',
  },

  // Lighting (includes TimeOfDay from span labeler)
  LIGHTING: {
    pattern: /light|lighting|illumination|shadow|timeofday|timeday/,
    role: 'lighting description',
  },

  // Camera (includes CameraMove and Framing from span labeler)
  CAMERA: {
    pattern: /camera|framing|shot|lens|cameramove|angle|viewpoint/,
    role: 'camera or framing description',
  },

  // Environment/Location
  LOCATION: {
    pattern: /location|setting|environment|background|place/,
    role: 'location or environment detail',
  },

  // Wardrobe/Costume (from span labeler)
  WARDROBE: {
    pattern: /wardrobe|clothing|costume|attire|outfit/,
    role: 'wardrobe and costume detail',
  },

  // Color (from span labeler)
  COLOR: {
    pattern: /color|colour|palette|hue|saturation/,
    role: 'color and visual tone',
  },

  // Style/Aesthetic
  STYLE: {
    pattern: /style|tone|aesthetic|mood|genre/,
    role: 'style or tone descriptor',
  },

  // Technical (from span labeler)
  TECHNICAL: {
    pattern: /technical|spec|duration|framerate|resolution/,
    role: 'technical specification',
  },

  // Audio
  AUDIO: {
    pattern: /audio|music|sound|score/,
    role: 'audio or score descriptor',
  },

  // Descriptive (catch-all from span labeler)
  DESCRIPTIVE: {
    pattern: /descriptive|general/,
    role: 'general visual detail',
  },
};

/**
 * Context patterns for phrase role detection
 */
export const CONTEXT_PATTERNS = {
  location: /\b(location|setting|background|environment|interior|exterior|room|space|chamber|landscape|street)\b/,
  camera: /\b(camera|shot|angle|frame|lens|dolly|pan|tilt|tracking|handheld|static)\b/,
  lighting: /\b(light|lighting|illuminated|glow|shadow|contrast|exposure|flare)\b/,
  character: /\bcharacter|figure|subject|person|leader|speaker|performer|actor|portrait\b/,
  style: /\bstyle|aesthetic|tone|mood|vibe|genre|inspired\b/,
  audio: /\bscore|music|soundtrack|audio\b/,
};

/**
 * Default role when no category matches
 */
export const DEFAULT_ROLE = 'general visual detail';

