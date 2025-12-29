/**
 * KlingStrategy - Prompt optimization for Kling AI 2.6
 *
 * Implements optimization for Kling's MDT (Multimodal Diffusion Transformer)
 * architecture with audio-visual screenplay formatting.
 *
 * Key features:
 * - Strips generic "sound"/"noise" terms to prevent white noise generation
 * - Strips visual quality tokens from audio description sections
 * - Formats dialogue as `[Character] ([Emotion]): "[Line]"`
 * - Extracts sound effects to separate `Audio:` blocks
 * - Injects "synced lips", "natural speech", "high fidelity audio" triggers
 * - Uses @Element syntax for reference images
 * - Maintains MemFlow context tracking for multi-shot narratives
 *
 * @module KlingStrategy
 */

import {
  BaseStrategy,
  type NormalizeResult,
  type TransformResult,
  type AugmentResult,
} from './BaseStrategy';
import type { PromptOptimizationResult, PromptContext, VideoPromptIR } from './types';

/**
 * Generic sound/noise terms to strip (prevent white noise generation)
 */
const GENERIC_SOUND_TERMS = [
  'sound',
  'sounds',
  'noise',
  'noises',
  'audio',
  'sonic',
  'acoustics',
  'acoustic',
] as const;

/**
 * Visual quality tokens to strip from audio sections
 */
const VISUAL_QUALITY_TOKENS = [
  '4k',
  '8k',
  'hd',
  'uhd',
  'high resolution',
  'high-resolution',
  'ultra hd',
  'ultra-hd',
  'cinematic',
  'film grain',
  'bokeh',
  'depth of field',
  'lens flare',
  'chromatic aberration',
  'sharp',
  'crisp',
  'vivid',
  'vibrant',
] as const;

/**
 * Audio trigger terms for Kling
 */
const AUDIO_TRIGGERS = [
  'synced lips',
  'natural speech',
  'high fidelity audio',
] as const;

/**
 * Emotion indicators for dialogue formatting
 */
const EMOTION_INDICATORS = [
  'angrily',
  'happily',
  'sadly',
  'excitedly',
  'nervously',
  'calmly',
  'fearfully',
  'joyfully',
  'sarcastically',
  'whispers',
  'shouts',
  'yells',
  'screams',
  'murmurs',
  'laughs',
  'cries',
  'sighs',
] as const;

/**
 * Emotion mapping from adverbs to adjectives
 */
const EMOTION_MAP: Record<string, string> = {
  angrily: 'angry',
  happily: 'happy',
  sadly: 'sad',
  excitedly: 'excited',
  nervously: 'nervous',
  calmly: 'calm',
  fearfully: 'fearful',
  joyfully: 'joyful',
  sarcastically: 'sarcastic',
  whispers: 'whispering',
  shouts: 'shouting',
  yells: 'yelling',
  screams: 'screaming',
  murmurs: 'murmuring',
  laughs: 'laughing',
  cries: 'crying',
  sighs: 'sighing',
};

/**
 * Sound effect indicators
 */
const SFX_INDICATORS = [
  'sfx:',
  'sound effect:',
  'sound of',
  'the sound of',
  'hear',
  'hears',
  'hearing',
  'bang',
  'crash',
  'boom',
  'whoosh',
  'splash',
  'thud',
  'click',
  'beep',
  'ring',
  'buzz',
  'hum',
  'roar',
  'thunder',
  'explosion',
  'footsteps',
  'door',
  'glass',
  'metal',
  'wind',
  'rain',
  'water',
] as const;

/**
 * Ambience indicators
 */
const AMBIENCE_INDICATORS = [
  'ambience:',
  'ambient:',
  'background:',
  'atmosphere:',
  'environmental sound',
  'room tone',
  'city sounds',
  'nature sounds',
  'crowd noise',
  'traffic',
  'birds chirping',
  'wind blowing',
  'rain falling',
  'ocean waves',
] as const;

/**
 * Music indicators
 */
const MUSIC_INDICATORS = [
  'music:',
  'soundtrack:',
  'score:',
  'playing music',
  'background music',
  'musical',
  'melody',
  'song',
  'tune',
  'rhythm',
  'beat',
  'orchestra',
  'piano',
  'guitar',
  'violin',
  'drums',
] as const;


/**
 * Dialogue pattern for extraction
 * Matches patterns like: "Character says 'line'" or "Character: 'line'"
 */
const DIALOGUE_PATTERNS = [
  // "Character says 'line'" or "Character says "line""
  /(\w+(?:\s+\w+)?)\s+(?:says?|said|speaks?|spoke|tells?|told|asks?|asked|replies?|replied|responds?|responded|exclaims?|exclaimed|whispers?|whispered|shouts?|shouted|yells?|yelled|screams?|screamed|murmurs?|murmured)\s*[:\s]*["']([^"']+)["']/gi,
  // "Character: 'line'" or 'Character: "line"'
  /(\w+(?:\s+\w+)?)\s*:\s*["']([^"']+)["']/gi,
  // Quoted speech with attribution after
  /["']([^"']+)["']\s*(?:says?|said)\s+(\w+(?:\s+\w+)?)/gi,
] as const;

/**
 * Parsed dialogue line
 */
interface DialogueLine {
  character: string;
  emotion: string | undefined;
  line: string;
}

/**
 * Parsed audio block
 */
interface AudioBlock {
  type: 'sfx' | 'ambience' | 'music';
  description: string;
}

/**
 * MemFlow context for multi-shot continuity
 */
interface MemFlowContext {
  entityIds: string[];
  continuityDescription: string;
}

/**
 * Kling screenplay structure
 */
interface KlingScreenplayBlock {
  visual: string;
  negativePrompt?: string;
  audio: AudioBlock[];
  dialogue: DialogueLine[];
  memflowContext: MemFlowContext | undefined;
  elementReferences: string[];
}

/**
 * KlingStrategy optimizes prompts for Kling AI 2.6's MDT architecture
 */
export class KlingStrategy extends BaseStrategy {
  readonly modelId = 'kling-26';
  readonly modelName = 'Kling AI 2.6';

  // Track entities across shots for MemFlow
  private entityRegistry: Map<string, string> = new Map();
  private shotCounter = 0;

  /**
   * Validate input against Kling-specific constraints
   */
  protected async doValidate(input: string, context?: PromptContext): Promise<void> {
    // Check for aspect ratio constraints if provided
    if (context?.constraints?.formRequirement) {
      const aspectRatio = context.constraints.formRequirement;
      const validAspectRatios = ['16:9', '9:16', '1:1', '4:3', '3:4'];
      if (!validAspectRatios.includes(aspectRatio)) {
        this.addWarning(`Aspect ratio "${aspectRatio}" may not be supported by Kling`);
      }
    }

    // Check for very long prompts
    const wordCount = input.split(/\s+/).length;
    if (wordCount > 300) {
      this.addWarning('Prompt exceeds 300 words; Kling may truncate or ignore excess content');
    }

    // Check for dialogue without clear character attribution
    const hasQuotes = /["'][^"']+["']/.test(input);
    const hasCharacter = /\b(?:man|woman|person|character|he|she|they)\b/i.test(input);
    if (hasQuotes && !hasCharacter) {
      this.addWarning('Dialogue detected without clear character attribution; consider adding character names');
    }
  }

  /**
   * Normalize input by stripping generic sound/noise terms and visual tokens from audio sections
   */
  protected doNormalize(input: string, context?: PromptContext): NormalizeResult {
    let text = input;
    const changes: string[] = [];
    const strippedTokens: string[] = [];

    // Compound audio phrases that should NOT be stripped
    const compoundAudioPhrases = [
      'city sounds',
      'nature sounds',
      'crowd noise',
      'background noise',
      'ambient sound',
      'ambient sounds',
      'environmental sound',
      'environmental sounds',
      'room sound',
      'room sounds',
      'street sounds',
      'ocean sounds',
      'forest sounds',
      'traffic noise',
      'white noise',
    ];

    // Strip generic sound/noise terms (prevent white noise generation)
    // But preserve compound phrases that describe specific audio
    for (const term of GENERIC_SOUND_TERMS) {
      // Check if this term is part of a compound phrase we want to keep
      const isPartOfCompound = compoundAudioPhrases.some(phrase => {
        const lowerText = text.toLowerCase();
        return lowerText.includes(phrase.toLowerCase());
      });

      if (!isPartOfCompound) {
        // Only strip standalone generic terms, not specific sound descriptions
        const standalonePattern = new RegExp(`\b${this.escapeRegex(term)}\b(?!\s+(?:of|effect|track|design))`, 'gi');
        if (standalonePattern.test(text)) {
          const before = text;
          text = text.replace(standalonePattern, '');
          if (text !== before) {
            changes.push(`Stripped generic sound term: "${term}"`);
            strippedTokens.push(term);
          }
        }
      }
    }

    // Identify audio sections and strip visual quality tokens from them
    const audioSectionPattern = /(?:audio|sound|music|sfx|ambience)[:\s]+[^.!?]+[.!?]?/gi;
    const audioSections = text.match(audioSectionPattern) || [];

    for (const section of audioSections) {
      let cleanedSection = section;
      for (const token of VISUAL_QUALITY_TOKENS) {
        if (this.containsWord(cleanedSection, token)) {
          cleanedSection = this.replaceWord(cleanedSection, token, '');
          changes.push(`Stripped visual token "${token}" from audio section`);
          strippedTokens.push(token);
        }
      }
      if (cleanedSection !== section) {
        text = text.replace(section, cleanedSection);
      }
    }

    // Clean up whitespace
    text = this.cleanWhitespace(text);

    return { text, changes, strippedTokens };
  }

  /**
   * Transform input into screenplay format with dialogue and audio blocks
   */
  protected doTransform(ir: VideoPromptIR, context?: PromptContext): TransformResult {
    const changes: string[] = [];

    // Parse the input into screenplay structure using raw input for dialogue fidelity
    const screenplay = this.parseScreenplay(ir.raw, context);
    
    // We can enrich the visual description using the IR if we want,
    // but Kling screenplay parsing already separates dialogue from visual.
    // Let's ensure the visual part is clean.
    if (!screenplay.visual || screenplay.visual.length < 10) {
        // If parsed visual is empty/weak, try to synthesize from IR
        const visualParts = [];
        if (ir.camera.shotType) visualParts.push(ir.camera.shotType);
        if (ir.subjects.length > 0) visualParts.push(ir.subjects.map(s => s.text).join(' and '));
        if (ir.actions.length > 0) visualParts.push(ir.actions.join(' and '));
        if (ir.environment.setting) visualParts.push(`in ${ir.environment.setting}`);
        
        const synthesizedVisual = visualParts.join(' ');
        if (synthesizedVisual.length > screenplay.visual.length) {
            screenplay.visual = synthesizedVisual;
            changes.push('Synthesized visual description from IR (parsed visual was sparse)');
        }
    }

    // Build the formatted prompt
    let prompt = this.formatScreenplay(screenplay);

    // Track changes
    if (screenplay.dialogue.length > 0) {
      changes.push(`Formatted ${screenplay.dialogue.length} dialogue line(s) to screenplay format`);
    }
    if (screenplay.audio.length > 0) {
      changes.push(`Extracted ${screenplay.audio.length} audio block(s)`);
    }
    if (screenplay.elementReferences.length > 0) {
      changes.push(`Added ${screenplay.elementReferences.length} @Element reference(s)`);
    }
    if (screenplay.memflowContext) {
      changes.push('Added MemFlow context for continuity');
    }

    // Clean up final prompt
    prompt = this.cleanWhitespace(prompt);

    return { prompt, changes };
  }

  /**
   * Augment result with Kling-specific audio triggers
   */
  protected doAugment(
    result: PromptOptimizationResult,
    _context?: PromptContext
  ): AugmentResult {
    const changes: string[] = [];
    const triggersInjected: string[] = [];

    let prompt = typeof result.prompt === 'string' ? result.prompt : JSON.stringify(result.prompt);

    // Check if prompt has dialogue content
    const hasDialogue = /\[.+\]\s*\(.+\)\s*:\s*"/.test(prompt) || /["'][^"']+["']/.test(prompt);

    // Inject audio triggers for dialogue content
    if (hasDialogue) {
      for (const trigger of AUDIO_TRIGGERS) {
        if (!prompt.toLowerCase().includes(trigger.toLowerCase())) {
          prompt = `${prompt}, ${trigger}`;
          triggersInjected.push(trigger);
          changes.push(`Injected audio trigger: "${trigger}"`);
        }
      }
    } else {
      // For non-dialogue content, only inject high fidelity audio if there's audio content
      const hasAudio = /audio:|sfx:|ambience:|music:/i.test(prompt);
      if (hasAudio && !prompt.toLowerCase().includes('high fidelity audio')) {
        prompt = `${prompt}, high fidelity audio`;
        triggersInjected.push('high fidelity audio');
        changes.push('Injected audio trigger: "high fidelity audio"');
      }
    }

    // Clean up final prompt
    prompt = this.cleanWhitespace(prompt);

    return {
      prompt,
      changes,
      triggersInjected,
    };
  }

  // ============================================================ 
  // Private Helper Methods
  // ============================================================ 

  /**
   * Parse input into screenplay structure
   */
  private parseScreenplay(input: string, context?: PromptContext): KlingScreenplayBlock {
    const dialogue = this.extractDialogue(input);
    const audio = this.extractAudio(input);
    const elementReferences = this.extractElementReferences(input, context);
    const visual = this.extractVisualDescription(input, dialogue, audio);
    const memflowContext = this.buildMemFlowContext(input, context);

    return {
      visual,
      audio,
      dialogue,
      memflowContext,
      elementReferences,
    };
  }

  /**
   * Extract dialogue lines from input
   */
  private extractDialogue(input: string): DialogueLine[] {
    const dialogueLines: DialogueLine[] = [];
    const processedLines = new Set<string>();

    // Try each dialogue pattern
    for (const pattern of DIALOGUE_PATTERNS) {
      // Reset lastIndex for global regex
      pattern.lastIndex = 0;
      let match;

      while ((match = pattern.exec(input)) !== null) {
        let character: string;
        let line: string;

        // Handle different capture group orders
        if (match[1] && match[2]) {
          // Check if first group looks like a character name
          if (/^[A-Z]/.test(match[1]) || match[1].length < match[2].length) {
            character = match[1];
            line = match[2];
          } else {
            character = match[2];
            line = match[1];
          }
        } else {
          continue;
        }

        // Skip if we've already processed this line
        const lineKey = `${character}:${line}`;
        if (processedLines.has(lineKey)) {
          continue;
        }
        processedLines.add(lineKey);

        // Detect emotion from context
        const emotion = this.detectEmotion(input, match.index);

        dialogueLines.push({
          character: this.normalizeCharacterName(character),
          emotion,
          line: line.trim(),
        });
      }
    }

    return dialogueLines;
  }

  /**
   * Detect emotion from context around dialogue
   */
  private detectEmotion(input: string, position: number): string | undefined {
    // Look at text around the dialogue position
    const contextStart = Math.max(0, position - 50);
    const contextEnd = Math.min(input.length, position + 50);
    const context = input.substring(contextStart, contextEnd).toLowerCase();

    for (const indicator of EMOTION_INDICATORS) {
      if (context.includes(indicator.toLowerCase())) {
        return EMOTION_MAP[indicator] || indicator;
      }
    }

    return undefined;
  }

  /**
   * Normalize character name
   */
  private normalizeCharacterName(name: string): string {
    // Capitalize first letter of each word
    return name
      .trim()
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Extract audio blocks from input
   */
  private extractAudio(input: string): AudioBlock[] {
    const audioBlocks: AudioBlock[] = [];
    const lowerInput = input.toLowerCase();

    // Extract SFX
    for (const indicator of SFX_INDICATORS) {
      if (lowerInput.includes(indicator.toLowerCase())) {
        const description = this.extractAudioDescription(input, indicator);
        if (description) {
          audioBlocks.push({ type: 'sfx', description });
        }
      }
    }

    // Extract Ambience
    for (const indicator of AMBIENCE_INDICATORS) {
      if (lowerInput.includes(indicator.toLowerCase())) {
        const description = this.extractAudioDescription(input, indicator);
        if (description) {
          audioBlocks.push({ type: 'ambience', description });
        }
      }
    }

    // Extract Music
    for (const indicator of MUSIC_INDICATORS) {
      if (lowerInput.includes(indicator.toLowerCase())) {
        const description = this.extractAudioDescription(input, indicator);
        if (description) {
          audioBlocks.push({ type: 'music', description });
        }
      }
    }

    // Deduplicate by description
    const seen = new Set<string>();
    return audioBlocks.filter(block => {
      const key = `${block.type}:${block.description}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Extract audio description following an indicator
   */
  private extractAudioDescription(input: string, indicator: string): string | null {
    const lowerInput = input.toLowerCase();
    const pos = lowerInput.indexOf(indicator.toLowerCase());

    if (pos === -1) return null;

    // Extract text after the indicator until punctuation or end
    const afterIndicator = input.substring(pos + indicator.length);
    const match = afterIndicator.match(/^[:\s]*([^.!?,;]+)/);

    if (match && match[1]) {
      const description = match[1].trim();
      if (description.length > 2) {
        return description;
      }
    }

    // If indicator is a standalone word (like "thunder"), use it as description
    if (!indicator.includes(':')) {
      return indicator;
    }

    return null;
  }

  /**
   * Extract @Element references from context assets
   */
  private extractElementReferences(input: string, context?: PromptContext): string[] {
    const references: string[] = [];

    // Check for existing @Element syntax in input
    const elementPattern = /@Element\(([^)]+)\)/g;
    let match;
    while ((match = elementPattern.exec(input)) !== null) {
      if (match[1]) {
        references.push(match[1]);
      }
    }

    // Add references from context assets
    if (context?.assets) {
      for (const asset of context.assets) {
        if (asset.type === 'image' && asset.token) {
          if (!references.includes(asset.token)) {
            references.push(asset.token);
          }
        }
      }
    }

    return references;
  }

  /**
   * Extract visual description (everything not dialogue or audio)
   */
  private extractVisualDescription(
    input: string,
    dialogue: DialogueLine[],
    audio: AudioBlock[]
  ): string {
    let visual = input;

    // Remove dialogue patterns
    for (const pattern of DIALOGUE_PATTERNS) {
      visual = visual.replace(pattern, '');
    }

    // Remove audio indicators and their descriptions
    for (const indicator of [...SFX_INDICATORS, ...AMBIENCE_INDICATORS, ...MUSIC_INDICATORS]) {
      const pattern = new RegExp(`${this.escapeRegex(indicator)}[:\\s]*[^.!?,;]*[.!?,;]?`, 'gi');
      visual = visual.replace(pattern, '');
    }

    // Clean up
    visual = this.cleanWhitespace(visual);

    return visual;
  }

  /**
   * Build MemFlow context for multi-shot continuity
   */
  private buildMemFlowContext(
    input: string,
    context?: PromptContext
  ): MemFlowContext | undefined {
    // Check if this is part of a multi-shot sequence
    if (!context?.history || context.history.length === 0) {
      return undefined;
    }

    // Extract entity references from current input
    const entityPattern = /\b(?:the\s+)?(?:same\s+)?(\w+(?:\s+\w+)?)\s+(?:from|in)\s+(?:shot|scene|previous)/gi;
    const entities: string[] = [];
    let match;

    while ((match = entityPattern.exec(input)) !== null) {
      if (match[1]) {
        entities.push(match[1]);
      }
    }

    // Also check for character names that appear in history
    // EditHistoryEntry has original/replacement fields, not prompt
    const characterPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g;
    while ((match = characterPattern.exec(input)) !== null) {
      const name = match[1];
      if (name) {
        // Check if this character appeared in previous edits
        const appearedBefore = context.history.some(h => {
          const original = h.original?.toLowerCase() ?? '';
          const replacement = h.replacement?.toLowerCase() ?? '';
          const nameLower = name.toLowerCase();
          return original.includes(nameLower) || replacement.includes(nameLower);
        });
        if (appearedBefore && !entities.includes(name)) {
          entities.push(name);
        }
      }
    }

    if (entities.length === 0) {
      return undefined;
    }

    // Generate entity IDs
    const entityIds = entities.map(entity => {
      const entityKey = entity.toLowerCase();
      const existingId = this.entityRegistry.get(entityKey);
      if (existingId) {
        return existingId;
      }
      const newId = `entity_${this.shotCounter++}`;
      this.entityRegistry.set(entityKey, newId);
      return newId;
    });

    return {
      entityIds,
      continuityDescription: `Maintaining visual consistency for: ${entities.join(', ')}`,
    };
  }

  /**
   * Format screenplay structure into Kling prompt format
   */
  private formatScreenplay(screenplay: KlingScreenplayBlock): string {
    const parts: string[] = [];

    // Add visual description
    if (screenplay.visual) {
      parts.push(screenplay.visual);
    }

    // Add @Element references
    for (const ref of screenplay.elementReferences) {
      if (!parts.some(p => p.includes(`@Element(${ref})`))) {
        parts.push(`@Element(${ref})`);
      }
    }

    // Add formatted dialogue
    for (const line of screenplay.dialogue) {
      const emotionPart = line.emotion ? ` (${line.emotion})` : '';
      parts.push(`[${line.character}]${emotionPart}: "${line.line}"`);
    }

    // Add audio blocks
    for (const audio of screenplay.audio) {
      const typeLabel = audio.type.toUpperCase();
      parts.push(`Audio (${typeLabel}): ${audio.description}`);
    }

    // Add MemFlow context if present
    if (screenplay.memflowContext) {
      parts.push(`[MemFlow: ${screenplay.memflowContext.continuityDescription}]`);
    }

    return parts.join('. ');
  }

  /**
   * Reset entity registry (for testing or new sequences)
   */
  public resetEntityRegistry(): void {
    this.entityRegistry.clear();
    this.shotCounter = 0;
  }
}

/**
 * Singleton instance for convenience
 */
export const klingStrategy = new KlingStrategy();