import { logger } from '../../infrastructure/Logger.js';

/**
 * VideoPromptService
 * 
 * Responsible for video prompt detection, analysis, and constraint management.
 * Handles video-specific phrase role detection and replacement constraints.
 * 
 * Single Responsibility: Video prompt logic and constraints
 */
export class VideoPromptService {
  constructor() {}

  /**
   * Count words in a string
   * @param {string} text - Text to count words in
   * @returns {number} Word count
   */
  countWords(text) {
    if (!text || typeof text !== 'string') {
      return 0;
    }

    return text
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
  }

  /**
   * Check if this is a video prompt
   * @param {string} fullPrompt - Full prompt text
   * @returns {boolean} True if video prompt
   */
  isVideoPrompt(fullPrompt) {
    if (typeof fullPrompt !== 'string' || fullPrompt.trim().length === 0) {
      return false;
    }

    const normalized = fullPrompt.toLowerCase();

    const legacyMarkers = ['**main prompt:**', '**technical parameters:**', 'camera movement:'];
    if (legacyMarkers.some((marker) => normalized.includes(marker))) {
      return true;
    }

    const modernTemplateMarkers = [
      '**prompt:**',
      '**guiding principles',
      '**writing rules',
      '**technical specs',
      '**alternative approaches',
      'variation 1 (different camera)',
      'variation 2 (different lighting/mood)',
    ];

    if (modernTemplateMarkers.some((marker) => normalized.includes(marker))) {
      return true;
    }

    const technicalFields = ['duration:', 'aspect ratio:', 'frame rate:', 'audio:'];
    const matchedTechFields = technicalFields.filter((field) => normalized.includes(field));
    if (normalized.includes('technical specs') && matchedTechFields.length >= 2) {
      return true;
    }

    if (matchedTechFields.length >= 3 && normalized.includes('alternative approaches')) {
      return true;
    }

    return false;
  }

  /**
   * Detect the likely role of a highlighted phrase within a video prompt
   * @param {string} highlightedText - Highlighted text
   * @param {string} contextBefore - Text before highlight
   * @param {string} contextAfter - Text after highlight
   * @param {string} explicitCategory - Explicit category if provided
   * @returns {string|null} Phrase role
   */
  detectVideoPhraseRole(highlightedText, contextBefore, contextAfter, explicitCategory) {
    const text = highlightedText?.trim() || '';
    const normalizedCategory = explicitCategory
      ? explicitCategory.toLowerCase()
      : '';

    const mapCategory = (category) => {
      if (!category) {
        return null;
      }

      // Normalize to lowercase for consistent matching
      const norm = category.toLowerCase();

      // Subject/Character (includes Appearance from span labeler)
      if (/subject|character|figure|talent|person|performer|appearance/.test(norm)) {
        return 'subject or character detail';
      }

      // Lighting (includes TimeOfDay from span labeler)
      if (/light|lighting|illumination|shadow|timeofday|timeday/.test(norm)) {
        return 'lighting description';
      }

      // Camera (includes CameraMove and Framing from span labeler)
      if (/camera|framing|shot|lens|cameramove|angle|viewpoint/.test(norm)) {
        return 'camera or framing description';
      }

      // Environment/Location
      if (/location|setting|environment|background|place/.test(norm)) {
        return 'location or environment detail';
      }

      // Wardrobe/Costume (new from span labeler)
      if (/wardrobe|clothing|costume|attire|outfit/.test(norm)) {
        return 'wardrobe and costume detail';
      }

      // Color (from span labeler)
      if (/color|colour|palette|hue|saturation/.test(norm)) {
        return 'color and visual tone';
      }

      // Style/Aesthetic
      if (/style|tone|aesthetic|mood|genre/.test(norm)) {
        return 'style or tone descriptor';
      }

      // Technical (from span labeler)
      if (/technical|spec|duration|framerate|resolution/.test(norm)) {
        return 'technical specification';
      }

      // Audio
      if (/audio|music|sound|score/.test(norm)) {
        return 'audio or score descriptor';
      }

      // Descriptive (catch-all from span labeler)
      if (/descriptive|general/.test(norm)) {
        return 'general visual detail';
      }

      return null;
    };

    const categoryRole = mapCategory(normalizedCategory);
    if (categoryRole) {
      logger.debug('Category mapped from explicit category', {
        input: normalizedCategory,
        output: categoryRole,
      });
      return categoryRole;
    }

    if (!text) {
      return 'general visual detail';
    }

    const combinedContext = `${contextBefore || ''} ${contextAfter || ''}`.toLowerCase();

    const contextRole = mapCategory(combinedContext);
    if (contextRole) {
      return contextRole;
    }

    if (/\b(location|setting|background|environment|interior|exterior|room|space|chamber|landscape|street)\b/.test(combinedContext)) {
      return 'location or environment detail';
    }

    if (/\b(camera|shot|angle|frame|lens|dolly|pan|tilt|tracking|handheld|static)\b/.test(combinedContext)) {
      return 'camera or framing description';
    }

    if (/\b(light|lighting|illuminated|glow|shadow|contrast|exposure|flare)\b/.test(combinedContext)) {
      return 'lighting description';
    }

    if (/\bcharacter|figure|subject|person|leader|speaker|performer|actor|portrait\b/.test(combinedContext)) {
      return 'subject or character detail';
    }

    if (/\bstyle|aesthetic|tone|mood|vibe|genre|inspired\b/.test(combinedContext)) {
      return 'style or tone descriptor';
    }

    if (/\bscore|music|soundtrack|audio\b/.test(combinedContext)) {
      return 'audio or score descriptor';
    }

    return 'general visual detail';
  }

  /**
   * Resolve video replacement constraints based on highlight context
   * @param {Object} details - Details about the highlight
   * @param {Object} options - Options like forceMode
   * @returns {Object} Constraint configuration
   */
  getVideoReplacementConstraints(details = {}, options = {}) {
    const {
      highlightWordCount = 0,
      phraseRole,
      highlightedText,
      highlightedCategory,
      highlightedCategoryConfidence,
    } = details;
    const { forceMode } = options;

    const trimmedText = (highlightedText || '').trim();
    const normalizedRole = (phraseRole || '').toLowerCase();
    const normalizedCategory = (highlightedCategory || '').toLowerCase();
    const highlightWordCountSafe = Number.isFinite(highlightWordCount)
      ? Math.max(0, Math.floor(highlightWordCount))
      : 0;
    const highlightIsSentence =
      /[.!?]$/.test(trimmedText) || highlightWordCountSafe >= 12;

    const categoryIsReliable =
      highlightedCategoryConfidence === undefined ||
      highlightedCategoryConfidence === null ||
      !Number.isFinite(highlightedCategoryConfidence)
        ? true
        : highlightedCategoryConfidence >= 0.45;

    const trustedCategory =
      highlightedCategory && categoryIsReliable ? normalizedCategory : '';
    const categorySource = trustedCategory || normalizedRole;

    const slotDescriptor =
      phraseRole ||
      (highlightedCategory ? `${highlightedCategory} detail` : 'visual detail');

    const ensureBounds = (min, max) => {
      const lower = Math.max(1, Math.round(min));
      const upper = Math.max(lower, Math.round(max));
      return { min: lower, max: upper };
    };

    const buildConstraint = (config) => {
      const bounds = ensureBounds(config.minWords, config.maxWords);
      return {
        ...config,
        minWords: bounds.min,
        maxWords: bounds.max,
        maxSentences: config.maxSentences ?? 1,
        slotDescriptor,
      };
    };

    const micro = () =>
      buildConstraint({
        mode: 'micro',
        minWords: Math.max(2, Math.min(3, highlightWordCountSafe + 1)),
        maxWords: Math.min(6, Math.max(4, highlightWordCountSafe + 2)),
        maxSentences: 1,
        disallowTerminalPunctuation: true,
        formRequirement: '2-6 word cinematic noun phrase describing the same subject',
        focusGuidance: [
          'Use precise visual modifiers (wardrobe, era, material)',
          'Avoid verbs; keep the replacement as a noun phrase',
        ],
        extraRequirements: ['Keep it a noun phrase (no verbs)'],
      });

    const lighting = () =>
      buildConstraint({
        mode: 'lighting',
        minWords: Math.max(6, Math.min(8, highlightWordCountSafe + 1)),
        maxWords: Math.min(14, Math.max(9, highlightWordCountSafe + 4)),
        maxSentences: 1,
        formRequirement:
          'Single lighting clause covering source, direction, and color temperature',
        focusGuidance: [
          'Name the light source and direction',
          'Include color temperature or mood language',
        ],
        extraRequirements: ['Mention light source + direction', 'Reference color temperature or mood'],
      });

    const camera = () =>
      buildConstraint({
        mode: 'camera',
        minWords: Math.max(6, Math.min(8, highlightWordCountSafe + 1)),
        maxWords: Math.min(12, Math.max(9, highlightWordCountSafe + 3)),
        maxSentences: 1,
        formRequirement:
          'Single movement clause combining camera move, lens, and framing',
        focusGuidance: [
          'Pair a camera move with a lens choice and framing detail',
          'Stay in the same tense and perspective as the template',
        ],
        extraRequirements: ['Include a lens or focal length', 'Reference camera movement'],
      });

    const location = () =>
      buildConstraint({
        mode: 'location',
        minWords: Math.max(6, Math.min(8, highlightWordCountSafe + 1)),
        maxWords: Math.min(14, Math.max(9, highlightWordCountSafe + 4)),
        maxSentences: 1,
        formRequirement: 'Concise location beat with time-of-day or atmosphere',
        focusGuidance: [
          'Anchor the setting with sensory specifics',
          'Mention time of day or atmospheric detail',
        ],
        extraRequirements: ['Include a sensory or atmospheric hook'],
      });

    const style = () =>
      buildConstraint({
        mode: 'style',
        minWords: Math.max(5, Math.min(7, highlightWordCountSafe + 1)),
        maxWords: Math.min(12, Math.max(8, highlightWordCountSafe + 3)),
        maxSentences: 1,
        formRequirement: 'Compact stylistic phrase referencing medium, era, or tone',
        focusGuidance: [
          'Reference a medium, era, or artistic influence',
          'Keep it tightly scoped to the highlighted span',
        ],
        extraRequirements: [],
      });

    const phrase = () =>
      buildConstraint({
        mode: 'phrase',
        minWords: Math.max(5, Math.min(7, highlightWordCountSafe + 1)),
        maxWords: Math.min(12, Math.max(8, highlightWordCountSafe + 3)),
        maxSentences: 1,
        formRequirement: 'Single cinematic clause focused on one production choice',
        focusGuidance: [
          'Emphasize one production detail (camera, lighting, subject, or location)',
          'Avoid expanding beyond the surrounding sentence',
        ],
        extraRequirements: [],
      });

    const sentence = () =>
      buildConstraint({
        mode: 'sentence',
        minWords: Math.max(10, Math.min(12, highlightWordCountSafe + 2)),
        maxWords: Math.min(25, Math.max(14, highlightWordCountSafe + 6)),
        maxSentences: 1,
        formRequirement: 'Single cinematic sentence that flows with the template',
        focusGuidance: [
          'Lead with the most important cinematic detail',
          'Keep it punchy—no compound sentences',
        ],
        extraRequirements: [],
      });

    if (forceMode === 'micro') {
      return micro();
    }
    if (forceMode === 'phrase') {
      return phrase();
    }
    if (forceMode === 'sentence') {
      return sentence();
    }
    if (forceMode === 'lighting') {
      return lighting();
    }
    if (forceMode === 'camera') {
      return camera();
    }
    if (forceMode === 'location') {
      return location();
    }
    if (forceMode === 'style') {
      return style();
    }

    const isSubject =
      categorySource.includes('subject') || categorySource.includes('character');
    const isLighting = categorySource.includes('lighting');
    const isCamera =
      categorySource.includes('camera') ||
      categorySource.includes('framing') ||
      categorySource.includes('shot');
    const isLocation =
      categorySource.includes('location') ||
      categorySource.includes('environment') ||
      categorySource.includes('setting');
    const isStyle =
      categorySource.includes('style') ||
      categorySource.includes('tone') ||
      categorySource.includes('aesthetic');
    const isAudio = categorySource.includes('audio') || categorySource.includes('score');
    const highlightIsVeryShort = highlightWordCountSafe <= 3;

    if (isSubject || highlightIsVeryShort) {
      return micro();
    }

    if (isLighting) {
      return lighting();
    }

    if (isCamera) {
      return camera();
    }

    if (isLocation) {
      return location();
    }

    if (isStyle || isAudio) {
      return style();
    }

    if (!highlightIsSentence && highlightWordCountSafe <= 8) {
      return phrase();
    }

    return sentence();
  }

  /**
   * Determine the next fallback constraint mode to try
   * @param {Object} currentConstraints - Current constraint configuration
   * @param {Object} details - Details about the highlight
   * @param {Set} attemptedModes - Set of already attempted modes
   * @returns {Object|null} Next fallback constraints or null
   */
  getVideoFallbackConstraints(
    currentConstraints,
    details = {},
    attemptedModes = new Set()
  ) {
    const fallbackOrder = [];

    if (!currentConstraints) {
      fallbackOrder.push('phrase', 'micro');
    } else if (currentConstraints.mode === 'sentence') {
      fallbackOrder.push('phrase', 'micro');
    } else if (currentConstraints.mode === 'phrase') {
      fallbackOrder.push('micro');
    } else if (
      currentConstraints.mode === 'lighting' ||
      currentConstraints.mode === 'camera' ||
      currentConstraints.mode === 'location' ||
      currentConstraints.mode === 'style'
    ) {
      fallbackOrder.push('micro');
    }

    for (const mode of fallbackOrder) {
      if (attemptedModes.has(mode)) {
        continue;
      }

      return this.getVideoReplacementConstraints(details, { forceMode: mode });
    }

    return null;
  }

  /**
   * Get category-specific focus guidance for better suggestions
   * @param {string} phraseRole - Role of the phrase
   * @param {string} categoryHint - Category hint
   * @returns {Array|null} Array of guidance strings or null
   */
  getCategoryFocusGuidance(phraseRole, categoryHint) {
    if (!phraseRole) return null;
    
    const role = phraseRole.toLowerCase();
    const hint = (categoryHint || '').toLowerCase();
    
    // Lighting-specific guidance
    if (role.includes('lighting') || hint.includes('light') || hint.includes('timeofday')) {
      return [
        'Light direction: front light, side/Rembrandt, backlight/rim, overhead, under-lighting',
        'Quality: hard shadows, soft diffused, directional beam, ambient fill',
        'Color temperature: warm tungsten (3200K), daylight (5600K), cool blue (7000K)',
        'Contrast ratio: high-key (2:1), low-key (8:1), film noir (16:1)',
        'Practical sources: window light, neon signs, candlelight, LED panels, streetlamps',
      ];
    }
    
    // Camera/Framing-specific guidance
    if (role.includes('camera') || role.includes('framing') || hint.includes('camera') || hint.includes('framing')) {
      return [
        'Movement: dolly in/out, crane up/down, pan left/right, tilt up/down, tracking shot',
        'Lens choice: 24mm wide, 35mm, 50mm normal, 85mm portrait, 200mm telephoto',
        "Angle: eye-level, high angle, low angle, Dutch tilt, bird's-eye view, worm's-eye",
        'Shot size: extreme close-up (ECU), close-up (CU), medium (MS), wide (WS), extreme wide (EWS)',
        'Focus technique: shallow DOF f/1.4, deep focus f/16, rack focus transition, selective focus',
      ];
    }
    
    // Subject/Character-specific guidance
    if (role.includes('subject') || role.includes('character') || hint.includes('appearance') || hint.includes('subject')) {
      return [
        'Physical characteristics: 2-3 specific, observable traits (age markers, build, distinctive features)',
        'Facial details: expression, eye contact, micro-expressions, emotional tells',
        'Posture and gesture: specific body language, stance, hand positions',
        'Movement quality: gait, rhythm, energy level, physical presence',
        'Distinguishing marks: that make the character immediately recognizable',
      ];
    }
    
    // Wardrobe-specific guidance
    if (role.includes('wardrobe') || hint.includes('wardrobe') || hint.includes('costume')) {
      return [
        'Garment specifics: cut, fit, silhouette, fabric texture (silk, denim, leather)',
        'Condition: pristine/new, lived-in/worn, weathered/distressed, torn/damaged',
        'Era markers: period-appropriate details, vintage vs contemporary',
        'Color palette: specific hues, patterns (plaid, stripes), color relationships',
        'Accessories: hat, jewelry, shoes, watch, bag - one focal accessory per variant',
      ];
    }
    
    // Environment/Location-specific guidance  
    if (role.includes('location') || role.includes('environment') || hint.includes('environment') || hint.includes('location')) {
      return [
        'Architectural details: materials (brick, glass, wood), structural elements, scale',
        'Atmospheric conditions: fog, rain, dust, haze, clarity',
        'Spatial relationships: foreground/background elements, depth, proximity',
        'Environmental lighting: natural vs artificial, ambient quality, shadows',
        'Setting specificity: named location type, cultural markers, time period indicators',
      ];
    }
    
    // Color-specific guidance
    if (role.includes('color') || hint.includes('color') || hint.includes('colour')) {
      return [
        'Color palette: specific hues (cerulean, burnt sienna), saturation level',
        'Color relationships: complementary, analogous, monochromatic scheme',
        'Color grading: teal and orange, bleach bypass, desaturated, vibrant',
        'Dominant vs accent colors: 70-30 rule, color hierarchy',
        'Emotional color coding: warm/inviting vs cool/distant, symbolic color use',
      ];
    }
    
    // Style/Aesthetic-specific guidance
    if (role.includes('style') || role.includes('tone') || hint.includes('style') || hint.includes('aesthetic')) {
      return [
        'Film stock reference: 35mm, 16mm, 8mm, digital cinema camera',
        'Genre aesthetic: film noir, neo-noir, western, sci-fi, documentary verité',
        'Cinematographer reference: Roger Deakins, Emmanuel Lubezki, Hoyte van Hoytema',
        'Post-processing: color grading approach, grain structure, sharpness',
        'Movement style: handheld/Steadicam, locked-off tripod, gimbal smooth',
      ];
    }
    
    // Technical-specific guidance
    if (role.includes('technical') || hint.includes('technical') || hint.includes('spec')) {
      return [
        'Duration: specific length (4s, 8s, 15s, 30s clip)',
        'Frame rate: 24fps cinematic, 30fps standard, 60fps smooth, 120fps slow-motion',
        'Resolution: 1080p, 4K, 8K, aspect ratio (16:9, 2.39:1 anamorphic)',
        'Camera body: RED, ARRI, Sony Venice, Blackmagic',
        'Technical effects: time-remapping, speed ramping, freeze frame',
      ];
    }
    
    return null;
  }
}
