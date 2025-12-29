/**
 * VeoStrategy - Prompt optimization for Google Veo 4
 *
 * Implements optimization for Veo's Gemini-integrated video generation
 * with JSON schema serialization.
 *
 * Key features:
 * - Strips markdown formatting and conversational filler
 * - Serializes prompts to JSON schema with subject, camera, environment, audio fields
 * - Injects style_preset based on detected keywords
 * - Preserves JSON structure while adding style metadata
 * - Supports brand context (hex codes, style guides)
 * - Supports "Flow" editing mode for edit prompts
 *
 * @module VeoStrategy
 */

import {
  BaseStrategy,
  type NormalizeResult,
  type TransformResult,
  type AugmentResult,
} from './BaseStrategy';
import type { PromptOptimizationResult, PromptContext } from './types';

/**
 * Markdown patterns to strip
 */
const MARKDOWN_PATTERNS = [
  /#{1,6}\s+/g,           // Headers
  /\*\*([^*]+)\*\*/g,     // Bold
  /\*([^*]+)\*/g,         // Italic
  /__([^_]+)__/g,         // Bold (underscore)
  /_([^_]+)_/g,           // Italic (underscore)
  /`([^`]+)`/g,           // Inline code
  /```[\s\S]*?```/g,      // Code blocks
  /\[([^\]]+)\]\([^)]+\)/g, // Links
  /!\[([^\]]*)\]\([^)]+\)/g, // Images
  /^\s*[-*+]\s+/gm,       // Unordered lists
  /^\s*\d+\.\s+/gm,       // Ordered lists
  /^\s*>\s+/gm,           // Blockquotes
  /---+/g,                // Horizontal rules
  /\|[^|]+\|/g,           // Tables
] as const;

/**
 * Conversational filler phrases to strip
 */
const CONVERSATIONAL_FILLERS = [
  'i want',
  'i would like',
  'i need',
  'please create',
  'please make',
  'please generate',
  'can you',
  'could you',
  'would you',
  'i\'d like',
  'i\'m looking for',
  'i\'m thinking of',
  'i was thinking',
  'maybe something like',
  'something like',
  'kind of like',
  'sort of like',
  'you know',
  'basically',
  'essentially',
  'actually',
  'literally',
  'honestly',
  'to be honest',
  'in my opinion',
  'i think',
  'i believe',
  'i guess',
  'i suppose',
  'um',
  'uh',
  'like',
  'so yeah',
  'anyway',
  'anyways',
] as const;

/**
 * Camera type keywords
 */
const CAMERA_TYPES: Record<string, string> = {
  'wide shot': 'wide',
  'wide angle': 'wide',
  'establishing shot': 'establishing',
  'close up': 'close-up',
  'close-up': 'close-up',
  'closeup': 'close-up',
  'extreme close up': 'extreme-close-up',
  'extreme close-up': 'extreme-close-up',
  'medium shot': 'medium',
  'medium close up': 'medium-close-up',
  'full shot': 'full',
  'long shot': 'long',
  'aerial shot': 'aerial',
  'aerial view': 'aerial',
  'bird\'s eye': 'birds-eye',
  'birds eye': 'birds-eye',
  'overhead': 'overhead',
  'low angle': 'low-angle',
  'high angle': 'high-angle',
  'dutch angle': 'dutch',
  'pov': 'pov',
  'point of view': 'pov',
  'over the shoulder': 'over-shoulder',
  'two shot': 'two-shot',
};

/**
 * Camera movement keywords
 */
const CAMERA_MOVEMENTS: Record<string, string> = {
  'pan': 'pan',
  'panning': 'pan',
  'pan left': 'pan-left',
  'pan right': 'pan-right',
  'tilt': 'tilt',
  'tilting': 'tilt',
  'tilt up': 'tilt-up',
  'tilt down': 'tilt-down',
  'dolly': 'dolly',
  'dolly in': 'dolly-in',
  'dolly out': 'dolly-out',
  'truck': 'truck',
  'trucking': 'truck',
  'zoom': 'zoom',
  'zoom in': 'zoom-in',
  'zoom out': 'zoom-out',
  'tracking': 'tracking',
  'tracking shot': 'tracking',
  'follow': 'follow',
  'following': 'follow',
  'crane': 'crane',
  'crane shot': 'crane',
  'steadicam': 'steadicam',
  'handheld': 'handheld',
  'static': 'static',
  'stationary': 'static',
  'orbit': 'orbit',
  'orbiting': 'orbit',
  'push in': 'push-in',
  'pull out': 'pull-out',
};

/**
 * Lighting keywords
 */
const LIGHTING_KEYWORDS: Record<string, string> = {
  'natural light': 'natural',
  'natural lighting': 'natural',
  'daylight': 'daylight',
  'sunlight': 'sunlight',
  'golden hour': 'golden-hour',
  'blue hour': 'blue-hour',
  'sunset': 'sunset',
  'sunrise': 'sunrise',
  'moonlight': 'moonlight',
  'candlelight': 'candlelight',
  'neon': 'neon',
  'neon lights': 'neon',
  'fluorescent': 'fluorescent',
  'dramatic lighting': 'dramatic',
  'soft lighting': 'soft',
  'hard lighting': 'hard',
  'backlit': 'backlit',
  'backlighting': 'backlit',
  'silhouette': 'silhouette',
  'rim light': 'rim',
  'rim lighting': 'rim',
  'low key': 'low-key',
  'high key': 'high-key',
  'chiaroscuro': 'chiaroscuro',
  'ambient': 'ambient',
  'studio lighting': 'studio',
  'three point': 'three-point',
  'volumetric': 'volumetric',
  'volumetric lighting': 'volumetric',
};

/**
 * Weather keywords
 */
const WEATHER_KEYWORDS: Record<string, string> = {
  'sunny': 'sunny',
  'cloudy': 'cloudy',
  'overcast': 'overcast',
  'rainy': 'rainy',
  'rain': 'rainy',
  'raining': 'rainy',
  'snowy': 'snowy',
  'snow': 'snowy',
  'snowing': 'snowy',
  'foggy': 'foggy',
  'fog': 'foggy',
  'misty': 'misty',
  'mist': 'misty',
  'stormy': 'stormy',
  'storm': 'stormy',
  'thunderstorm': 'thunderstorm',
  'windy': 'windy',
  'wind': 'windy',
  'clear': 'clear',
  'hazy': 'hazy',
  'humid': 'humid',
};

/**
 * Style preset keywords
 */
const STYLE_PRESETS: Record<string, string> = {
  'cinematic': 'cinematic',
  'film': 'cinematic',
  'movie': 'cinematic',
  'hollywood': 'cinematic',
  'documentary': 'documentary',
  'commercial': 'commercial',
  'advertisement': 'commercial',
  'ad': 'commercial',
  'music video': 'music-video',
  'anime': 'anime',
  'animated': 'animated',
  'cartoon': 'cartoon',
  'realistic': 'realistic',
  'photorealistic': 'photorealistic',
  'hyperrealistic': 'hyperrealistic',
  'surreal': 'surreal',
  'abstract': 'abstract',
  'minimalist': 'minimalist',
  'vintage': 'vintage',
  'retro': 'retro',
  'noir': 'noir',
  'sci-fi': 'sci-fi',
  'fantasy': 'fantasy',
  'horror': 'horror',
  'romantic': 'romantic',
  'dramatic': 'dramatic',
  'epic': 'epic',
  'indie': 'indie',
  'artistic': 'artistic',
  'experimental': 'experimental',
};

/**
 * Edit instruction patterns for Flow mode
 */
const EDIT_PATTERNS = [
  /remove\s+(?:the\s+)?(.+)/i,
  /delete\s+(?:the\s+)?(.+)/i,
  /erase\s+(?:the\s+)?(.+)/i,
  /add\s+(?:a\s+)?(.+)/i,
  /insert\s+(?:a\s+)?(.+)/i,
  /change\s+(?:the\s+)?(.+)\s+to\s+(.+)/i,
  /replace\s+(?:the\s+)?(.+)\s+with\s+(.+)/i,
  /make\s+(?:the\s+)?(.+)\s+(.+)/i,
  /mask\s+(?:the\s+)?(.+)/i,
] as const;


/**
 * Veo JSON prompt schema
 */
export interface VeoPromptSchema {
  mode: 'generate' | 'edit';
  edit_config?: {
    instruction: string;
    mask?: string;
  };
  negative_prompt?: string;
  subject: {
    description: string;
    action: string;
  };
  camera: {
    type: string;
    movement: string;
  };
  environment: {
    lighting: string;
    weather?: string;
    setting?: string;
  };
  audio?: {
    dialogue?: string;
    ambience?: string;
    music?: string;
  };
  style_preset?: string;
  brand_context?: {
    colors?: string[];
    style_guide?: string;
  };
}

/**
 * VeoStrategy optimizes prompts for Google Veo 4's Gemini-integrated generation
 */
export class VeoStrategy extends BaseStrategy {
  readonly modelId = 'veo-4';
  readonly modelName = 'Google Veo 4';

  // Session state for Flow editing mode
  private sessionState: Map<string, VeoPromptSchema> = new Map();

  /**
   * Validate input against Veo-specific constraints
   */
  protected async doValidate(input: string, context?: PromptContext): Promise<void> {
    // Check for aspect ratio constraints if provided
    if (context?.constraints?.formRequirement) {
      const aspectRatio = context.constraints.formRequirement;
      const validAspectRatios = ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'];
      if (!validAspectRatios.includes(aspectRatio)) {
        this.addWarning(`Aspect ratio "${aspectRatio}" may not be supported by Veo`);
      }
    }

    // Check for very long prompts
    const wordCount = input.split(/\s+/).length;
    if (wordCount > 400) {
      this.addWarning('Prompt exceeds 400 words; Veo may truncate or ignore excess content');
    }

    // Check for potential JSON in input (might be malformed)
    if (input.includes('{') && input.includes('}')) {
      try {
        JSON.parse(input);
        this.addWarning('Input appears to be JSON; will be processed as text and re-serialized');
      } catch {
        // Not valid JSON, which is fine
      }
    }
  }

  /**
   * Normalize input by stripping markdown and conversational filler
   */
  protected doNormalize(input: string, _context?: PromptContext): NormalizeResult {
    let text = input;
    const changes: string[] = [];
    const strippedTokens: string[] = [];

    // Strip markdown formatting
    for (const pattern of MARKDOWN_PATTERNS) {
      const before = text;
      // For patterns with capture groups, replace with the captured content
      if (pattern.source.includes('(')) {
        text = text.replace(pattern, '$1');
      } else {
        text = text.replace(pattern, ' ');
      }
      if (text !== before) {
        changes.push('Stripped markdown formatting');
        strippedTokens.push('markdown');
        break; // Only log once
      }
    }

    // Strip conversational filler phrases
    for (const filler of CONVERSATIONAL_FILLERS) {
      const pattern = new RegExp(`\\b${this.escapeRegex(filler)}\\b`, 'gi');
      if (pattern.test(text)) {
        text = text.replace(pattern, '');
        changes.push(`Stripped conversational filler: "${filler}"`);
        strippedTokens.push(filler);
      }
    }

    // Clean up whitespace
    text = this.cleanWhitespace(text);

    return { text, changes, strippedTokens };
  }

  /**
   * Transform input into Veo JSON schema
   */
  protected doTransform(input: string, context?: PromptContext): TransformResult {
    const changes: string[] = [];

    // Check if this is an edit instruction (Flow mode)
    const editInfo = this.detectEditMode(input);
    
    let schema: VeoPromptSchema;
    
    if (editInfo) {
      schema = this.buildEditSchema(input, editInfo, context);
      changes.push('Detected Flow editing mode');
    } else {
      schema = this.buildGenerateSchema(input, context);
      changes.push('Built generation schema');
    }

    // Track what was extracted
    if (schema.subject.description) {
      changes.push('Extracted subject description');
    }
    if (schema.subject.action) {
      changes.push('Extracted subject action');
    }
    if (schema.camera.type !== 'medium') {
      changes.push(`Detected camera type: ${schema.camera.type}`);
    }
    if (schema.camera.movement !== 'static') {
      changes.push(`Detected camera movement: ${schema.camera.movement}`);
    }
    if (schema.environment.weather) {
      changes.push(`Detected weather: ${schema.environment.weather}`);
    }
    if (schema.audio) {
      changes.push('Extracted audio information');
    }

    return { 
      prompt: schema as unknown as Record<string, unknown>, 
      changes 
    };
  }

  /**
   * Augment result with style_preset and brand_context
   */
  protected doAugment(
    result: PromptOptimizationResult,
    context?: PromptContext
  ): AugmentResult {
    const changes: string[] = [];
    const triggersInjected: string[] = [];

    // Get the schema from the result
    let schema: VeoPromptSchema;
    if (typeof result.prompt === 'object') {
      schema = result.prompt as unknown as VeoPromptSchema;
    } else {
      // If somehow we got a string, parse it
      try {
        schema = JSON.parse(result.prompt as string) as VeoPromptSchema;
      } catch {
        // Return as-is if we can't parse
        return {
          prompt: result.prompt,
          changes: ['Could not augment non-JSON prompt'],
          triggersInjected: [],
        };
      }
    }

    // Detect and inject style_preset if not already set
    if (!schema.style_preset) {
      const detectedStyle = this.detectStylePreset(
        typeof result.prompt === 'string' 
          ? result.prompt 
          : JSON.stringify(result.prompt)
      );
      if (detectedStyle) {
        schema.style_preset = detectedStyle;
        triggersInjected.push(`style_preset: ${detectedStyle}`);
        changes.push(`Injected style_preset: "${detectedStyle}"`);
      } else {
        // Default to cinematic if no style detected
        schema.style_preset = 'cinematic';
        triggersInjected.push('style_preset: cinematic');
        changes.push('Injected default style_preset: "cinematic"');
      }
    }

    // Inject brand_context if provided in context
    if (context?.apiParams?.brandColors || context?.apiParams?.styleGuide) {
      const brandContext: { colors?: string[]; style_guide?: string } = {};
      if (context.apiParams.brandColors) {
        brandContext.colors = context.apiParams.brandColors as string[];
      }
      if (context.apiParams.styleGuide) {
        brandContext.style_guide = context.apiParams.styleGuide as string;
      }
      schema.brand_context = brandContext;
      triggersInjected.push('brand_context');
      changes.push('Injected brand_context from API params');
    }

    // Store in session state for Flow editing
    if (context?.apiParams?.sessionId) {
      const sessionId = String(context.apiParams.sessionId);
      this.sessionState.set(sessionId, schema);
      changes.push('Stored schema in session state for Flow editing');
    }

    return {
      prompt: schema as unknown as Record<string, unknown>,
      changes,
      triggersInjected,
    };
  }

  // ============================================================
  // Private Helper Methods
  // ============================================================

  /**
   * Detect if input is an edit instruction (Flow mode)
   */
  private detectEditMode(input: string): { instruction: string; mask?: string } | null {
    const lowerInput = input.toLowerCase();

    for (const pattern of EDIT_PATTERNS) {
      const match = input.match(pattern);
      if (match) {
        // Check for mask instruction
        const maskMatch = input.match(/mask\s+(?:the\s+)?(.+)/i);
        
        const result: { instruction: string; mask?: string } = {
          instruction: match[0],
        };
        if (maskMatch && maskMatch[1]) {
          result.mask = maskMatch[1];
        }
        return result;
      }
    }

    // Check for explicit edit keywords
    const editKeywords = ['edit', 'modify', 'adjust', 'fix', 'correct', 'update'];
    if (editKeywords.some(kw => lowerInput.startsWith(kw))) {
      return {
        instruction: input,
      };
    }

    return null;
  }

  /**
   * Build schema for edit mode (Flow)
   */
  private buildEditSchema(
    _input: string,
    editInfo: { instruction: string; mask?: string },
    context?: PromptContext
  ): VeoPromptSchema {
    // Try to get previous state from session
    let baseSchema: VeoPromptSchema | undefined;
    if (context?.apiParams?.sessionId) {
      const sessionId = String(context.apiParams.sessionId);
      baseSchema = this.sessionState.get(sessionId);
    }

    // If no previous state, create minimal schema
    if (!baseSchema) {
      baseSchema = {
        mode: 'generate',
        subject: { description: '', action: '' },
        camera: { type: 'medium', movement: 'static' },
        environment: { lighting: 'natural' },
      };
    }

    const editConfig: { instruction: string; mask?: string } = {
      instruction: editInfo.instruction,
    };
    if (editInfo.mask) {
      editConfig.mask = editInfo.mask;
    }

    return {
      ...baseSchema,
      mode: 'edit',
      edit_config: editConfig,
    };
  }

  /**
   * Build schema for generation mode
   */
  private buildGenerateSchema(input: string, context?: PromptContext): VeoPromptSchema {
    const subject = this.extractSubject(input);
    const camera = this.extractCamera(input);
    const environment = this.extractEnvironment(input);
    const audio = this.extractAudio(input);

    const schema: VeoPromptSchema = {
      mode: 'generate',
      subject,
      camera,
      environment,
    };

    // Only add audio if we found any
    if (audio.dialogue || audio.ambience || audio.music) {
      schema.audio = audio;
    }

    // Add negative prompt if provided in context
    if (context?.apiParams?.negativePrompt) {
      schema.negative_prompt = String(context.apiParams.negativePrompt);
    }

    return schema;
  }

  /**
   * Extract subject information from input
   */
  private extractSubject(input: string): { description: string; action: string } {
    const sentences = this.extractSentences(input);
    
    // Look for subject patterns
    const subjectPatterns = [
      /(?:a|an|the)\s+(\w+(?:\s+\w+){0,4})\s+(?:is|are|was|were)\s+(\w+ing\b[^.]*)/i,
      /(\w+(?:\s+\w+){0,4})\s+(\w+s?\b[^.]*)/i,
    ];

    let description = '';
    let action = '';

    for (const sentence of sentences) {
      for (const pattern of subjectPatterns) {
        const match = sentence.match(pattern);
        if (match && match[1] && match[2]) {
          if (!description) {
            description = match[1].trim();
          }
          if (!action) {
            action = match[2].trim();
          }
          break;
        }
      }
      if (description && action) break;
    }

    // Fallback: use first sentence as description, look for verbs for action
    if (!description && sentences.length > 0) {
      const firstSentence = sentences[0];
      description = firstSentence ?? '';
    }
    if (!action) {
      const verbMatch = input.match(/\b(\w+ing)\b/);
      action = verbMatch && verbMatch[1] ? verbMatch[1] : 'moving';
    }

    return { description, action };
  }

  /**
   * Extract camera information from input
   */
  private extractCamera(input: string): { type: string; movement: string } {
    const lowerInput = input.toLowerCase();
    
    let type = 'medium'; // default
    let movement = 'static'; // default

    // Detect camera type
    for (const [keyword, value] of Object.entries(CAMERA_TYPES)) {
      if (lowerInput.includes(keyword)) {
        type = value;
        break;
      }
    }

    // Detect camera movement
    for (const [keyword, value] of Object.entries(CAMERA_MOVEMENTS)) {
      if (lowerInput.includes(keyword)) {
        movement = value;
        break;
      }
    }

    return { type, movement };
  }

  /**
   * Extract environment information from input
   */
  private extractEnvironment(input: string): { lighting: string; weather?: string; setting?: string } {
    const lowerInput = input.toLowerCase();
    
    let lighting = 'natural'; // default
    let weather: string | undefined;
    let setting: string | undefined;

    // Detect lighting
    for (const [keyword, value] of Object.entries(LIGHTING_KEYWORDS)) {
      if (lowerInput.includes(keyword)) {
        lighting = value;
        break;
      }
    }

    // Detect weather
    for (const [keyword, value] of Object.entries(WEATHER_KEYWORDS)) {
      if (lowerInput.includes(keyword)) {
        weather = value;
        break;
      }
    }

    // Extract setting from location patterns
    const settingPatterns = [
      /(?:in|at|on)\s+(?:a|an|the)\s+(\w+(?:\s+\w+){0,3})/i,
      /(?:inside|outside|within)\s+(?:a|an|the)?\s*(\w+(?:\s+\w+){0,3})/i,
    ];

    for (const pattern of settingPatterns) {
      const match = input.match(pattern);
      if (match && match[1]) {
        setting = match[1].trim();
        break;
      }
    }

    const result: { lighting: string; weather?: string; setting?: string } = { lighting };
    if (weather) result.weather = weather;
    if (setting) result.setting = setting;

    return result;
  }

  /**
   * Extract audio information from input
   */
  private extractAudio(input: string): { dialogue?: string; ambience?: string; music?: string } {
    const result: { dialogue?: string; ambience?: string; music?: string } = {};

    // Extract dialogue
    const dialoguePatterns = [
      /["']([^"']+)["']/g,
      /says?\s+["']([^"']+)["']/gi,
      /speaking\s+["']([^"']+)["']/gi,
    ];

    for (const pattern of dialoguePatterns) {
      const match = input.match(pattern);
      if (match) {
        // Extract the actual dialogue content
        const dialogueMatch = match[0].match(/["']([^"']+)["']/);
        if (dialogueMatch && dialogueMatch[1]) {
          result.dialogue = dialogueMatch[1];
          break;
        }
      }
    }

    // Extract ambience
    const ambiencePatterns = [
      /(?:ambient|ambience|background)\s*(?:sound|noise|audio)?[:\s]+([^.!?,]+)/i,
      /(?:sounds?\s+of|hearing)\s+([^.!?,]+)/i,
    ];

    for (const pattern of ambiencePatterns) {
      const match = input.match(pattern);
      if (match && match[1]) {
        result.ambience = match[1].trim();
        break;
      }
    }

    // Extract music
    const musicPatterns = [
      /(?:music|soundtrack|score)[:\s]+([^.!?,]+)/i,
      /(?:playing|with)\s+(\w+\s+music)/i,
      /(\w+\s+(?:music|melody|tune))/i,
    ];

    for (const pattern of musicPatterns) {
      const match = input.match(pattern);
      if (match && match[1]) {
        result.music = match[1].trim();
        break;
      }
    }

    return result;
  }

  /**
   * Detect style preset from input
   */
  private detectStylePreset(input: string): string | null {
    const lowerInput = input.toLowerCase();

    for (const [keyword, value] of Object.entries(STYLE_PRESETS)) {
      if (lowerInput.includes(keyword)) {
        return value;
      }
    }

    return null;
  }

  /**
   * Validate that a schema has required fields
   */
  public isValidSchema(schema: unknown): schema is VeoPromptSchema {
    if (!schema || typeof schema !== 'object') {
      return false;
    }

    const s = schema as Record<string, unknown>;

    // Check required top-level fields
    if (!s.subject || typeof s.subject !== 'object') return false;
    if (!s.camera || typeof s.camera !== 'object') return false;
    if (!s.environment || typeof s.environment !== 'object') return false;

    const subject = s.subject as Record<string, unknown>;
    const camera = s.camera as Record<string, unknown>;
    const environment = s.environment as Record<string, unknown>;

    // Check required nested fields
    if (typeof subject.description !== 'string') return false;
    if (typeof subject.action !== 'string') return false;
    if (typeof camera.type !== 'string') return false;
    if (typeof camera.movement !== 'string') return false;
    if (typeof environment.lighting !== 'string') return false;

    return true;
  }

  /**
   * Reset session state (for testing or new sessions)
   */
  public resetSessionState(): void {
    this.sessionState.clear();
  }

  /**
   * Get session state for a given session ID
   */
  public getSessionState(sessionId: string): VeoPromptSchema | undefined {
    return this.sessionState.get(sessionId);
  }
}

/**
 * Singleton instance for convenience
 */
export const veoStrategy = new VeoStrategy();
