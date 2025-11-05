import { normalizeText } from '../utils/textHelpers.js';

/**
 * Model-specific detection patterns and keywords
 */
const MODEL_PATTERNS = {
  sora: {
    keywords: ['sora', 'openai video', 'openai gen'],
    technicalMarkers: ['realistic motion', 'physics simulation', 'long-form'],
    indicators: /\b(sora|openai\s*video|continuous\s*action|realistic\s*physics)\b/i,
  },
  veo3: {
    keywords: ['veo3', 'veo 3', 'google veo', 'vertex'],
    technicalMarkers: ['atmospheric', 'cinematic lighting', 'mood'],
    indicators: /\b(veo\s*3|veo3|google\s*veo|vertex\s*ai|atmospheric\s*lighting)\b/i,
  },
  runway: {
    keywords: ['runway', 'runwayml', 'gen-3', 'gen3'],
    technicalMarkers: ['stylized', 'artistic', 'filter', 'aesthetic'],
    indicators: /\b(runway|runwayml|gen[_\s-]?3|stylized\s*content|artistic\s*filter)\b/i,
  },
  kling: {
    keywords: ['kling', 'kuaishou'],
    technicalMarkers: ['character', 'facial', 'expression', 'animation'],
    indicators: /\b(kling|kuaishou|character\s*animation|facial\s*expression)\b/i,
  },
  luma: {
    keywords: ['luma', 'luma dream', 'dream machine'],
    technicalMarkers: ['surreal', 'abstract', 'morphing', 'dreamlike'],
    indicators: /\b(luma|dream\s*machine|surreal|morphing\s*effects|abstract\s*visual)\b/i,
  },
};

/**
 * Model strengths and optimal use cases
 */
const MODEL_STRENGTHS = {
  sora: {
    primary: ['Realistic motion', 'Physics simulation', 'Long takes (up to 60s)', 'Natural movement'],
    secondary: ['Consistent characters', 'Complex camera moves', 'Environmental physics'],
    weaknesses: ['Stylized content', 'Text rendering', 'Fast cuts'],
  },
  veo3: {
    primary: ['Cinematic lighting', 'Atmospheric effects', 'Mood creation', 'Color grading'],
    secondary: ['Natural environments', 'Weather effects', 'Time-of-day transitions'],
    weaknesses: ['Fast action', 'Character close-ups', 'Abstract content'],
  },
  runway: {
    primary: ['Stylized visuals', 'Artistic filters', 'Creative effects', 'Color manipulation'],
    secondary: ['Short-form content', 'Music videos', 'Abstract visuals'],
    weaknesses: ['Photorealism', 'Long sequences', 'Complex physics'],
  },
  kling: {
    primary: ['Character animation', 'Facial expressions', 'Dialogue scenes', 'Close-ups'],
    secondary: ['Lip-sync', 'Emotion portrayal', 'Character interaction'],
    weaknesses: ['Wide shots', 'Environmental detail', 'Complex motion'],
  },
  luma: {
    primary: ['Surreal visuals', 'Abstract concepts', 'Morphing effects', 'Dreamlike sequences'],
    secondary: ['Experimental content', 'Transitions', 'Non-realistic imagery'],
    weaknesses: ['Photorealism', 'Precise control', 'Technical accuracy'],
  },
};

/**
 * Model-specific optimal parameters
 */
const MODEL_OPTIMAL_PARAMS = {
  sora: {
    duration: '10-60 seconds',
    motion: 'Continuous, natural',
    camera: 'Smooth, realistic moves',
    lighting: 'Natural, physically accurate',
    style: 'Photorealistic',
  },
  veo3: {
    duration: '5-30 seconds',
    motion: 'Moderate pace',
    camera: 'Cinematic framing',
    lighting: 'Dramatic, intentional',
    style: 'Cinematic realism',
  },
  runway: {
    duration: '3-15 seconds',
    motion: 'Stylized, artistic',
    camera: 'Creative angles',
    lighting: 'Stylized, expressive',
    style: 'Artistic, filtered',
  },
  kling: {
    duration: '5-20 seconds',
    motion: 'Character-focused',
    camera: 'Close to medium shots',
    lighting: 'Flattering, clear',
    style: 'Natural to stylized',
  },
  luma: {
    duration: '3-10 seconds',
    motion: 'Fluid, morphing',
    camera: 'Dynamic, unconventional',
    lighting: 'Surreal, dreamlike',
    style: 'Abstract, experimental',
  },
};

/**
 * Service responsible for detecting target AI video model
 */
export class ModelTargetDetector {
  /**
   * Detect which AI video model the prompt is targeting
   * @param {string} fullPrompt - Full prompt text
   * @returns {string|null} Model identifier or null if unclear
   */
  detectTargetModel(fullPrompt) {
    if (typeof fullPrompt !== 'string' || fullPrompt.trim().length === 0) {
      return null;
    }

    const normalized = normalizeText(fullPrompt);
    const scores = {};

    // Score each model based on pattern matches
    for (const [model, patterns] of Object.entries(MODEL_PATTERNS)) {
      scores[model] = this._scoreModel(normalized, patterns);
    }

    // Find model with highest score
    const entries = Object.entries(scores);
    const maxScore = Math.max(...entries.map(([, score]) => score));

    // Require minimum confidence threshold
    if (maxScore < 2) {
      return null; // No clear model detected
    }

    const detectedModel = entries.find(([, score]) => score === maxScore)?.[0];
    return detectedModel || null;
  }

  /**
   * Score a model based on pattern matches
   * @param {string} normalizedText - Normalized prompt text
   * @param {Object} patterns - Model patterns
   * @returns {number} Match score
   * @private
   */
  _scoreModel(normalizedText, patterns) {
    let score = 0;

    // Check regex indicator (strong signal)
    if (patterns.indicators.test(normalizedText)) {
      score += 5;
    }

    // Check keywords (medium signal)
    patterns.keywords.forEach((keyword) => {
      if (normalizedText.includes(keyword)) {
        score += 2;
      }
    });

    // Check technical markers (weak signal)
    patterns.technicalMarkers.forEach((marker) => {
      if (normalizedText.includes(marker)) {
        score += 1;
      }
    });

    return score;
  }

  /**
   * Get model capabilities (strengths and weaknesses)
   * @param {string} model - Model identifier
   * @returns {Object|null} Capabilities object or null
   */
  getModelCapabilities(model) {
    if (!model || !MODEL_STRENGTHS[model]) {
      return null;
    }

    return MODEL_STRENGTHS[model];
  }

  /**
   * Get model optimal parameters
   * @param {string} model - Model identifier
   * @returns {Object|null} Optimal parameters or null
   */
  getModelOptimalParams(model) {
    if (!model || !MODEL_OPTIMAL_PARAMS[model]) {
      return null;
    }

    return MODEL_OPTIMAL_PARAMS[model];
  }

  /**
   * Get model-specific guidance for a category
   * @param {string} model - Model identifier
   * @param {string} category - Category being edited
   * @returns {Array<string>} Array of guidance strings
   */
  getModelSpecificGuidance(model, category) {
    if (!model || !category) {
      return [];
    }

    const capabilities = this.getModelCapabilities(model);
    if (!capabilities) {
      return [];
    }

    const normalizedCategory = category.toLowerCase();
    const guidance = [];

    // Model-specific category guidance
    if (model === 'sora') {
      if (normalizedCategory.includes('motion') || normalizedCategory.includes('action')) {
        guidance.push('Describe continuous, realistic motion with physical accuracy');
        guidance.push('Mention how objects interact with environment and physics');
        guidance.push('Specify natural movement patterns (walking, flowing, falling)');
      }
      if (normalizedCategory.includes('camera')) {
        guidance.push('Use smooth, realistic camera movements (dolly, crane, pan)');
        guidance.push('Avoid rapid cuts or jarring transitions');
      }
    }

    if (model === 'veo3') {
      if (normalizedCategory.includes('lighting')) {
        guidance.push('Emphasize atmospheric and cinematic lighting quality');
        guidance.push('Specify light direction, quality, and mood impact');
        guidance.push('Use technical terms: key light, rim light, 3-point setup');
      }
      if (normalizedCategory.includes('mood') || normalizedCategory.includes('atmosphere')) {
        guidance.push('Leverage Veo3\'s strength in atmospheric effects');
        guidance.push('Describe environmental mood and feeling');
      }
    }

    if (model === 'runway') {
      if (normalizedCategory.includes('style')) {
        guidance.push('Embrace stylized, artistic approaches');
        guidance.push('Reference art styles, filters, or visual treatments');
        guidance.push('Consider non-realistic color grading and effects');
      }
    }

    if (model === 'kling') {
      if (normalizedCategory.includes('subject') || normalizedCategory.includes('character')) {
        guidance.push('Focus on facial expressions and character emotion');
        guidance.push('Describe specific facial features and expressions');
        guidance.push('Mention eye contact, subtle gestures, reactions');
      }
    }

    if (model === 'luma') {
      if (normalizedCategory.includes('style') || normalizedCategory.includes('visual')) {
        guidance.push('Embrace surreal and abstract concepts');
        guidance.push('Use dreamlike, morphing, or fluid descriptions');
        guidance.push('Don\'t worry about physical realism');
      }
    }

    return guidance;
  }

  /**
   * Format model context for prompt inclusion
   * @param {string} model - Model identifier
   * @returns {string} Formatted context
   */
  formatModelContext(model) {
    if (!model) {
      return '';
    }

    const capabilities = this.getModelCapabilities(model);
    const params = this.getModelOptimalParams(model);

    if (!capabilities || !params) {
      return '';
    }

    const modelName = model.charAt(0).toUpperCase() + model.slice(1);
    let context = `\n**TARGET MODEL: ${modelName}**\n`;
    context += `Primary Strengths: ${capabilities.primary.join(', ')}\n`;
    context += `Optimize for: ${params.motion}, ${params.camera}, ${params.lighting}\n`;
    context += `Weakness to avoid: ${capabilities.weaknesses.join(', ')}\n`;

    return context;
  }
}

