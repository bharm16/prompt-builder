/**
 * Category-specific focus guidance for video prompt suggestions
 * Provides detailed technical guidance for each production category
 */

export const CATEGORY_GUIDANCE = {
  /**
   * Subject-specific guidance
   */
  subject: [
    'Person type: specific occupation, age group, character archetype',
    'Object type: vehicle, tool, artifact, natural object with defining characteristics',
    'Animal type: species, breed, age, distinctive markings',
    'Identity markers: 2-3 key identifiers that make the subject recognizable',
    'Avoid vague terms: use "young painter" not "person", "bengal cat" not "cat"',
  ],

  /**
   * Lighting-specific guidance
   */
  lighting: [
    'Light direction: front light, side/Rembrandt, backlight/rim, overhead, under-lighting',
    'Quality: hard shadows, soft diffused, directional beam, ambient fill',
    'Color temperature: warm tungsten (3200K), daylight (5600K), cool blue (7000K)',
    'Contrast ratio: high-key (2:1), low-key (8:1), film noir (16:1)',
    'Practical sources: window light, neon signs, candlelight, LED panels, streetlamps',
  ],

  /**
   * Camera/Framing-specific guidance
   */
  camera: [
    'Movement: dolly in/out, crane up/down, pan left/right, tilt up/down, tracking shot',
    'Lens choice: 24mm (wide/deep focus), 50mm (normal), 85mm (portrait/shallow focus)',
    "Angle: eye-level, high angle, low angle, Dutch tilt, bird's-eye view, worm's-eye",
    'Shot size: extreme close-up (ECU), close-up (CU), medium (MS), wide (WS), extreme wide (EWS)',
    'Focus Rule: Wide shots = Deep Focus (f/11). Close-ups = Shallow Focus (f/1.8).',
  ],

  /**
   * Subject/Character-specific guidance
   */
  subject: [
    'Physical characteristics: 2-3 specific, observable traits (age markers, build, distinctive features)',
    'Facial details: expression, eye contact, micro-expressions, emotional tells',
    'Posture and gesture: specific body language, stance, hand positions',
    'Movement quality: gait, rhythm, energy level, physical presence',
    'Distinguishing marks: that make the character immediately recognizable',
  ],

  /**
   * Wardrobe-specific guidance
   */
  wardrobe: [
    'Garment specifics: cut, fit, silhouette, fabric texture (silk, denim, leather)',
    'Condition: pristine/new, lived-in/worn, weathered/distressed, torn/damaged',
    'Era markers: period-appropriate details, vintage vs contemporary',
    'Color palette: specific hues, patterns (plaid, stripes), color relationships',
    'Accessories: hat, jewelry, shoes, watch, bag - one focal accessory per variant',
  ],

  /**
   * Environment/Location-specific guidance
   */
  location: [
    'Architectural details: materials (brick, glass, wood), structural elements, scale',
    'Atmospheric conditions: fog, rain, dust, haze, clarity',
    'Spatial relationships: foreground/background elements, depth, proximity',
    'Environmental lighting: natural vs artificial, ambient quality, shadows',
    'Setting specificity: named location type, cultural markers, time period indicators',
  ],

  /**
   * Color-specific guidance
   */
  color: [
    'Color palette: specific hues (cerulean, burnt sienna), saturation level',
    'Color relationships: complementary, analogous, monochromatic scheme',
    'Color grading: teal and orange, bleach bypass, desaturated, vibrant',
    'Dominant vs accent colors: 70-30 rule, color hierarchy',
    'Emotional color coding: warm/inviting vs cool/distant, symbolic color use',
  ],

  /**
   * Style/Aesthetic-specific guidance
   */
  style: [
    'Film stock reference: 35mm, 16mm, 8mm, digital cinema camera',
    'Genre aesthetic: film noir, neo-noir, western, sci-fi, documentary verité',
    'Cinematographer reference: Roger Deakins, Emmanuel Lubezki, Hoyte van Hoytema',
    'Post-processing: color grading approach, grain structure, sharpness',
    'Movement style: handheld/Steadicam, locked-off tripod, gimbal smooth',
  ],

  /**
   * Action-specific guidance
   */
  action: [
    'Movement type: walking, running, reaching, turning, gesturing, jumping',
    'Movement quality: slow/deliberate, quick/sharp, fluid/graceful, hesitant/cautious',
    'Direction: toward camera, away from camera, left to right, ascending, descending',
    'Interaction: with objects, with environment, with other subjects, solo movement',
    'Intensity: subtle gesture, normal motion, dramatic action, explosive movement',
  ],

  /**
   * Technical-specific guidance
   */
  technical: [
    'Duration: specific length (4s, 8s, 15s, 30s clip)',
    'Frame rate: 24fps (cinematic), 30fps (standard), 60fps (high action/sports)',
    'Resolution: 1080p, 4K, 8K, aspect ratio (16:9, 2.39:1 anamorphic)',
    'Camera body: RED, ARRI, Sony Venice, Blackmagic',
    'Technical effects: time-remapping, speed ramping, freeze frame',
  ],
};

/**
 * Mapping of role keywords to guidance categories
 */
export const GUIDANCE_MAPPING = {
  subject: 'subject',
  character: 'subject',
  person: 'subject',
  
  appearance: 'subject',
  physical: 'subject',
  
  lighting: 'lighting',
  timeofday: 'lighting',
  light: 'lighting',
  
  camera: 'camera',
  framing: 'camera',
  
  wardrobe: 'wardrobe',
  costume: 'wardrobe',
  
  location: 'location',
  environment: 'location',
  
  color: 'color',
  colour: 'color',
  
  action: 'action',
  movement: 'action',
  gesture: 'action',
  
  style: 'style',
  aesthetic: 'style',
  tone: 'style',
  
  technical: 'technical',
  spec: 'technical',
};

