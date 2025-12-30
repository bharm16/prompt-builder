import { normalizeText } from '@services/video-prompt-analysis/utils/textHelpers';

/**
 * Model-specific detection patterns and keywords
 * 
 * Includes both legacy model patterns and new POE model patterns:
 * - runway-gen45: Runway Gen-4.5 (A2D architecture)
 * - luma-ray3: Luma Ray-3 (causal chain expansion)
 * - kling-26: Kling AI 2.6 (MDT with audio-visual)
 * - sora-2: OpenAI Sora 2 (physics simulation)
 * - veo-4: Google Veo 4 (JSON schema)
 */
const MODEL_PATTERNS = {
  // Legacy patterns (kept for backward compatibility)
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
  
  // New POE model patterns (Requirements 2.1-2.6)
  'runway-gen45': {
    keywords: ['gen-4.5', 'gen4.5', 'gen 4.5', 'runway gen 4.5', 'whisper thunder'],
    technicalMarkers: ['csae', 'a2d', 'continuous shot', 'fluid motion'],
    indicators: /\b(gen[_\s-]?4\.?5|runway\s*gen\s*4\.?5|whisper\s*thunder)\b/i,
  },
  'luma-ray3': {
    keywords: ['ray-3', 'ray3', 'ray 3', 'luma ray', 'luma ray-3'],
    technicalMarkers: ['causal chain', 'hdr', 'keyframes'],
    indicators: /\b(ray[_\s-]?3|luma\s*ray[_\s-]?3?)\b/i,
  },
  'kling-26': {
    keywords: ['kling 2.6', 'kling2.6', 'kling ai 2.6'],
    technicalMarkers: ['screenplay', 'dialogue', 'memflow', 'synced lips'],
    indicators: /\b(kling[_\s-]?2\.?6|kling\s*ai\s*2\.?6)\b/i,
  },
  'sora-2': {
    keywords: ['sora 2', 'sora2', 'openai sora 2'],
    technicalMarkers: ['newtonian physics', 'momentum conservation', 'temporal sequence'],
    indicators: /\b(sora[_\s-]?2|openai\s*sora\s*2)\b/i,
  },
  'veo-4': {
    keywords: ['veo 4', 'veo4', 'google veo 4'],
    technicalMarkers: ['json schema', 'style_preset', 'flow editing'],
    indicators: /\b(veo[_\s-]?4|google\s*veo\s*4)\b/i,
  },
  'wan-2.2': {
    keywords: ['wan 2.1', 'wan 2.2', 'wan2.1', 'wan2.2', 'wan t2v', 'alibaba wan'],
    technicalMarkers: ['moe', 'bilingual', '1080p 30fps', 'mixture of experts'],
    indicators: /\b(wan[_\s-]?[2]\.?[12]|alibaba\s*wan|moe\s*architecture)\b/i,
  },
} as const;

/**
 * Model strengths and optimal use cases
 */
const MODEL_STRENGTHS = {
  // Legacy models
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
  
  // New POE models
  'runway-gen45': {
    primary: ['A2D architecture', 'CSAE protocol', 'Continuous shots', 'Fluid motion'],
    secondary: ['Cinematographic triggers', 'Consistent geometry', 'Camera motion mapping'],
    weaknesses: ['Emotional/abstract terms', 'Morphing effects', 'Blur effects'],
  },
  'luma-ray3': {
    primary: ['Causal chain expansion', 'HDR pipeline', 'Keyframe interpolation', 'Motion triggers'],
    secondary: ['16-bit color', 'ACES colorspace', 'Slow motion'],
    weaknesses: ['Loop/seamless when API loop enabled', 'Redundant resolution tokens'],
  },
  'kling-26': {
    primary: ['Audio-visual sync', 'Screenplay formatting', 'Dialogue scenes', 'MemFlow context'],
    secondary: ['Synced lips', 'Natural speech', 'High fidelity audio'],
    weaknesses: ['Generic sound terms', 'Visual tokens in audio sections'],
  },
  'sora-2': {
    primary: ['Physics grounding', 'Temporal segmentation', 'Newtonian physics', 'Momentum conservation'],
    secondary: ['Cameo identity tokens', 'Aspect ratio validation', 'JSON response format'],
    weaknesses: ['Public figure names', 'Unauthorized celebrity references'],
  },
  'veo-4': {
    primary: ['JSON schema serialization', 'Gemini integration', 'Flow editing', 'Style presets'],
    secondary: ['Brand context injection', 'Structured prompts', 'Edit mode support'],
    weaknesses: ['Markdown formatting', 'Conversational filler'],
  },
  'wan-2.2': {
    primary: ['Mixture-of-Experts (MoE) efficiency', '1080p 30fps native', 'Bilingual prompt adherence', 'Variable aspect ratios'],
    secondary: ['Cinematic motion', 'Complex scene understanding', 'Prompt-to-video alignment'],
    weaknesses: ['English-only without translations', 'Low-resolution legacy triggers'],
  },
} as const;

/**
 * Model-specific optimal parameters
 */
const MODEL_OPTIMAL_PARAMS = {
  // Legacy models
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
  
  // New POE models
  'runway-gen45': {
    duration: '5-20 seconds',
    motion: 'Single continuous shot, fluid motion',
    camera: 'CSAE protocol (Camera first)',
    lighting: 'Cinematographic, shallow depth of field',
    style: 'A2D optimized, consistent geometry',
  },
  'luma-ray3': {
    duration: '5-15 seconds',
    motion: 'Causal chain, cause-effect sequences',
    camera: 'Keyframe interpolation',
    lighting: 'HDR, 16-bit color, ACES',
    style: 'High dynamic range',
  },
  'kling-26': {
    duration: '5-30 seconds',
    motion: 'Character-focused, dialogue sync',
    camera: 'Close to medium for dialogue',
    lighting: 'Clear for lip-sync',
    style: 'Screenplay format, audio-visual',
  },
  'sora-2': {
    duration: '10-60 seconds',
    motion: 'Physics-grounded, Newtonian',
    camera: 'Temporal sequences',
    lighting: 'Physically accurate',
    style: 'Physics simulation, momentum conservation',
  },
  'veo-4': {
    duration: '5-30 seconds',
    motion: 'Structured JSON control',
    camera: 'Schema-defined movements',
    lighting: 'Environment-specified',
    style: 'JSON schema, style presets',
  },
  'wan-2.2': {
    duration: '5-20 seconds',
    motion: 'MoE-optimized cinematic motion',
    camera: 'Variable aspect ratio support',
    lighting: 'Highly detailed, 1080p native',
    style: 'Bilingual narrative, high fidelity',
  },
} as const;

export type ModelId = keyof typeof MODEL_PATTERNS;

export interface ModelCapabilities {
  primary: readonly string[];
  secondary: readonly string[];
  weaknesses: readonly string[];
}

export interface ModelOptimalParams {
  duration: string;
  motion: string;
  camera: string;
  lighting: string;
  style: string;
}

interface ModelPatterns {
  keywords: readonly string[];
  technicalMarkers: readonly string[];
  indicators: RegExp;
}

/**
 * POE model IDs - the new versioned models that should take priority
 */
const POE_MODEL_IDS = ['runway-gen45', 'luma-ray3', 'kling-26', 'sora-2', 'veo-4', 'wan-2.2'] as const;

/**
 * Service responsible for detecting target AI video model
 */
export class ModelDetectionService {
  /**
   * Detect which AI video model the prompt is targeting
   * 
   * Priority order:
   * 1. POE models (versioned, more specific) - runway-gen45, luma-ray3, kling-26, sora-2, veo-4
   * 2. Legacy models - sora, veo3, runway, kling, luma
   * 
   * When no model pattern is detected, returns null (Requirement 2.6)
   */
  detectTargetModel(fullPrompt: string | null | undefined): ModelId | null {
    if (typeof fullPrompt !== 'string' || fullPrompt.trim().length === 0) {
      return null;
    }

    const normalized = normalizeText(fullPrompt);
    const scores: Record<string, number> = {};

    // Score each model based on pattern matches
    for (const [model, patterns] of Object.entries(MODEL_PATTERNS)) {
      scores[model] = this._scoreModel(normalized, patterns, model);
    }

    // Find model with highest score
    const entries = Object.entries(scores);
    const maxScore = Math.max(...entries.map(([, score]) => score));

    // Require minimum confidence threshold
    if (maxScore < 2) {
      return null; // No clear model detected
    }

    // Get all models with the max score
    const topModels = entries.filter(([, score]) => score === maxScore).map(([model]) => model);

    // If multiple models tie, prefer POE models (more specific)
    const poeMatch = topModels.find((model) => POE_MODEL_IDS.includes(model as (typeof POE_MODEL_IDS)[number]));
    if (poeMatch) {
      return poeMatch as ModelId;
    }

    // Otherwise return the first match
    return (topModels[0] as ModelId) || null;
  }

  /**
   * Score a model based on pattern matches
   * POE models get a slight boost to prefer versioned models over legacy
   */
  private _scoreModel(normalizedText: string, patterns: ModelPatterns, modelId: string): number {
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

    // POE models get a small boost when they have any match
    // This ensures versioned models are preferred over legacy when both match
    if (score > 0 && POE_MODEL_IDS.includes(modelId as (typeof POE_MODEL_IDS)[number])) {
      score += 0.5;
    }

    return score;
  }

  /**
   * Get model capabilities (strengths and weaknesses)
   */
  getModelCapabilities(model: string | null | undefined): ModelCapabilities | null {
    if (!model || !(model in MODEL_STRENGTHS)) {
      return null;
    }

    return MODEL_STRENGTHS[model as ModelId];
  }

  /**
   * Get model optimal parameters
   */
  getModelOptimalParams(model: string | null | undefined): ModelOptimalParams | null {
    if (!model || !(model in MODEL_OPTIMAL_PARAMS)) {
      return null;
    }

    return MODEL_OPTIMAL_PARAMS[model as ModelId];
  }

  /**
   * Get model-specific guidance for a category
   */
  getModelSpecificGuidance(model: string | null | undefined, category: string | null | undefined): string[] {
    if (!model || !category) {
      return [];
    }

    const capabilities = this.getModelCapabilities(model);
    if (!capabilities) {
      return [];
    }

    const normalizedCategory = category.toLowerCase();
    const guidance: string[] = [];

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
   */
  formatModelContext(model: string | null | undefined): string {
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

