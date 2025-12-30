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
import type { PromptOptimizationResult, PromptContext, VideoPromptIR } from './types';

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
  "i'd like",
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
   * Final adjustments after LLM rewrite
   */
  protected doTransform(llmPrompt: string | Record<string, unknown>, _ir: VideoPromptIR, _context?: PromptContext): TransformResult {
    const changes: string[] = [];
    
    // Validate that we received an object (the LLM should have generated JSON for Veo)
    let schema: Record<string, unknown>;
    if (typeof llmPrompt === 'object' && llmPrompt !== null) {
      schema = llmPrompt as Record<string, unknown>;
    } else {
      // Fallback: parse if it's a string
      try {
        schema = JSON.parse(llmPrompt as string);
      } catch {
        // Absolute fallback to a dummy schema if parsing fails
        schema = {
          mode: 'generate',
          subject: { description: String(llmPrompt), action: 'acting naturally' },
          camera: { type: 'medium', movement: 'static' },
          environment: { lighting: 'natural' }
        };
        changes.push('Failed to parse LLM JSON; used emergency fallback schema');
      }
    }

    return { 
      prompt: schema, 
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
      // Check if we can infer from raw string again as fallback
      const rawPrompt = typeof result.prompt === 'string' ? result.prompt : JSON.stringify(result.prompt);
      const detectedStyle = this.detectStylePreset(rawPrompt);
      
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
   * Build schema for generation mode using VideoPromptIR
   */
  private buildGenerateSchema(ir: VideoPromptIR, context?: PromptContext): VeoPromptSchema {
    // 1. Subject & Action
    // Use the clean narrative as the description to preserve flow
    const description = ir.raw;
    
    // Use extracted actions for the specific field, or a default
    const action = ir.actions.length > 0 ? ir.actions.join(' and ') : 'moving naturally';

    // 2. Camera
    let type = 'medium';
    if (ir.camera.shotType) {
        const shot = ir.camera.shotType.toLowerCase();
        if (shot.includes('close')) type = 'close-up';
        else if (shot.includes('wide')) type = 'wide';
        else if (shot.includes('aerial')) type = 'aerial';
        else if (shot.includes('low')) type = 'low-angle';
    } else if (ir.camera.angle) {
        const angle = ir.camera.angle.toLowerCase();
         if (angle.includes('low')) type = 'low-angle';
         else if (angle.includes('high')) type = 'high-angle';
         else if (angle.includes('bird')) type = 'birds-eye';
    }

    let movement = 'static';
    if (ir.camera.movements.length > 0) {
        const move = ir.camera.movements[0]?.toLowerCase() || '';
        if (move.includes('pan')) movement = 'pan';
        else if (move.includes('tilt')) movement = 'tilt';
        else if (move.includes('dolly') || move.includes('push') || move.includes('pull')) movement = 'dolly';
        else if (move.includes('zoom')) movement = 'zoom';
        else if (move.includes('truck') || move.includes('track')) movement = 'truck';
        else if (move.includes('handheld')) movement = 'handheld';
    }

    // 3. Environment
    let lighting = 'natural';
    if (ir.environment.lighting.length > 0) {
        lighting = ir.environment.lighting[0] || 'natural';
    }
    
    // Construct environment object respecting exactOptionalPropertyTypes
    const environment: { lighting: string; weather?: string; setting?: string } = { lighting };
    if (ir.environment.weather) environment.weather = ir.environment.weather;
    if (ir.environment.setting) environment.setting = ir.environment.setting;

    const schema: VeoPromptSchema = {
      mode: 'generate',
      subject: { description, action },
      camera: { type, movement },
      environment,
    };

    // 4. Audio
    if (ir.audio) {
       schema.audio = {};
       // Only include dialogue if it looks like actual speech or script
       if (ir.audio.dialogue && (ir.audio.dialogue.includes('"') || ir.audio.dialogue.length > 5)) {
           schema.audio.dialogue = ir.audio.dialogue;
       }
       if (ir.audio.music) schema.audio.music = ir.audio.music;
       if (ir.audio.sfx) schema.audio.ambience = ir.audio.sfx; // Map sfx to ambience/sfx
    }

    // 5. Style Preset from IR
    if (ir.meta.style.length > 0) {
        // Map detected style to preset
        for (const style of ir.meta.style) {
            const mapped = this.mapStyleToPreset(style);
            if (mapped) {
                schema.style_preset = mapped;
                break;
            }
        }
    }

    // Add negative prompt if provided in context
    if (context?.apiParams?.negativePrompt) {
      schema.negative_prompt = String(context.apiParams.negativePrompt);
    }

    return schema;
  }

  /**
   * Helper to map style string to Veo preset
   */
  private mapStyleToPreset(style: string): string | null {
      const lowerStyle = style.toLowerCase();
      for (const [key, value] of Object.entries(STYLE_PRESETS)) {
          if (lowerStyle.includes(key)) return value;
      }
      return null;
  }
  
  /**
   * Helper to detect style preset from raw string (fallback)
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