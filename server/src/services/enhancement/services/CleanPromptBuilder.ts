import { logger } from '@infrastructure/Logger';
import { extractSemanticSpans } from '@llm/span-labeling/nlp/NlpSpanService';
import { getParentCategory } from '@shared/taxonomy';
import { VISUAL_EXAMPLES, TECHNICAL_EXAMPLES, NARRATIVE_EXAMPLES } from '../config/EnhancementExamples';
import { PROMPT_PREVIEW_LIMIT } from '../constants';
import { getCategoryGuidance } from './categoryGuidance';
import { 
  getSecurityPrefix, 
  getFormatInstruction,
  detectAndGetCapabilities,
  wrapUserData,
} from '@utils/provider/index';
import type {
  PromptBuildParams,
  CustomPromptParams,
  SharedPromptContext,
  BrainstormContext,
} from './types';

/**
 * CleanPromptBuilder - Provider-Aware Implementation
 * 
 * BALANCE: Keep prompts focused but INCLUDE ESSENTIAL CONTEXT.
 * 
 * Provider-Aware Optimizations:
 * - OpenAI: Skip security prefix (goes in developerMessage instead)
 * - OpenAI with strict schema: Skip format instructions (grammar handles it)
 * - Groq/Llama: Include security and format instructions in prompt
 * 
 * Key learnings:
 * - Llama 8B needs simpler instructions (fewer rules, less verbosity)
 * - BUT it still needs the actual context to generate relevant suggestions
 * - Few-shot examples help with FORMAT but can mislead on CONTENT
 * - The full prompt preview is ESSENTIAL for contextually appropriate suggestions
 * 
 * Implements PDF designs:
 * - Design 1: Orthogonal Attribute Injector (technical slots)
 * - Design 2: Visual Decomposition Expander (descriptors/style/appearance)
 * - Design 3: Grammar-Constrained Narrative Editor (actions/verbs)
 */
export class CleanPromptBuilder {
  private readonly log = logger.child({ service: 'CleanPromptBuilder' });

  buildPrompt(params: PromptBuildParams = {}): string {
    return this._buildSpanPrompt({ ...params, mode: params?.isPlaceholder ? 'placeholder' : 'rewrite' });
  }

  buildRewritePrompt(params: PromptBuildParams = {}): string {
    return this._buildSpanPrompt({ ...params, mode: 'rewrite' });
  }

  buildPlaceholderPrompt(params: PromptBuildParams = {}): string {
    return this._buildSpanPrompt({ ...params, mode: 'placeholder' });
  }

  buildCustomPrompt({ highlightedText, customRequest, fullPrompt, isVideoPrompt }: CustomPromptParams): string {
    const startTime = performance.now();
    const operation = 'buildCustomPrompt';
    
    this.log.debug('Building custom prompt', {
      operation,
      isVideoPrompt,
      highlightLength: highlightedText.length,
      fullPromptLength: fullPrompt.length,
    });
    
    const promptPreview = this._trim(fullPrompt, PROMPT_PREVIEW_LIMIT);
    const { capabilities } = detectAndGetCapabilities({ operation: 'enhance_suggestions' });
    const useWrapper = !capabilities.strictJsonSchema;

    // Get provider-aware security prefix
    const securityPrefix = getSecurityPrefix({ operation: 'enhance_suggestions' });
    
    // Use XML wrapper for user data
    const userDataSection = wrapUserData({
      full_context: promptPreview,
      highlighted_text: highlightedText,
      custom_request: customRequest,
    });

    // Get format instruction (provider-aware)
    const formatInstruction = getFormatInstruction({ 
      operation: 'enhance_suggestions',
      isArray: !useWrapper,
      hasSchema: true,
      targetStart: useWrapper ? '{' : '[',
    });

    const outputLine = useWrapper
      ? 'Output JSON object: {"suggestions": [{"text":"replacement","category":"custom","explanation":"why this fits"}]}'
      : 'Output JSON array: [{"text":"replacement","category":"custom","explanation":"why this fits"}]';

    const result = [
      securityPrefix,
      'Generate up to 12 replacement phrases for the highlighted text.',
      '',
      userDataSection,
      '',
      'RULES:',
      '1. Replacements must fit the context of the full prompt',
      '2. Keep the same subject/topic - just vary the description',
      '3. Return ONLY the replacement phrase (2-50 words)',
      '',
      outputLine,
      formatInstruction,
    ].filter(Boolean).join('\n');
    
    const duration = Math.round(performance.now() - startTime);
    const promptLength = result.length;
    
    this.log.info('Custom prompt built', {
      operation,
      duration,
      promptLength,
    });
    
    return result;
  }

  /**
   * Core builder
   */
  private _buildSpanPrompt(params: PromptBuildParams): string {
    const startTime = performance.now();
    const operation = '_buildSpanPrompt';
    
    const {
      highlightedText = '',
      contextBefore = '',
      contextAfter = '',
      fullPrompt = '',
      brainstormContext = null,
      editHistory = [],
      modelTarget = null,
      isVideoPrompt = false,
      phraseRole = null,
      highlightedCategory = null,
      promptSection = null,
      videoConstraints = null,
      highlightWordCount = null,
      spanAnchors = '',
      nearbySpanHints = '',
      focusGuidance = [],
      mode = 'rewrite',
    } = params;

    this.log.debug('Building span prompt', {
      operation,
      mode,
      isVideoPrompt,
      hasBrainstormContext: !!brainstormContext,
      highlightLength: highlightedText.length,
    });

    const slot = this._resolveSlot({
      highlightedText,
      phraseRole,
      highlightedCategory,
      contextBefore,
      contextAfter,
    });
    const design = this._pickDesign(slot, isVideoPrompt, mode);
    
    this.log.debug('Resolved slot and design', {
      operation,
      slot,
      design,
    });

    const ctx = this._buildContext({
      highlightedText,
      highlightedCategory,
      contextBefore,
      contextAfter,
      fullPrompt,
      brainstormContext,
      editHistory,
      modelTarget,
      promptSection,
      videoConstraints,
      highlightWordCount,
      spanAnchors,
      nearbySpanHints,
      focusGuidance,
      slot,
      mode,
    });

    const { provider, capabilities } = detectAndGetCapabilities({ operation: 'enhance_suggestions' });
    const useWrapper = !capabilities.strictJsonSchema;

    // Select prompt based on design
    let result: string;
    if (design === 'orthogonal') {
      result = this._buildTechnicalPrompt(ctx, provider, useWrapper);
    } else if (design === 'narrative') {
      result = this._buildActionPrompt(ctx, provider, useWrapper);
    } else {
      result = this._buildVisualPrompt(ctx, provider, useWrapper);
    }
    
    const duration = Math.round(performance.now() - startTime);
    
    this.log.info('Span prompt built', {
      operation,
      duration,
      design,
      slot,
      promptLength: result.length,
    });
    
    return result;
  }

  /**
   * Design 1: Technical/Camera/Lighting slots
   * 
   * Provider-aware: Security prefix only added for non-OpenAI providers
   * OpenAI uses developerMessage for security (passed separately)
   */
  private _buildTechnicalPrompt(
    ctx: SharedPromptContext,
    provider: string,
    useWrapper: boolean
  ): string {
    // Get provider-aware security prefix
    const securityPrefix = getSecurityPrefix({ operation: 'enhance_suggestions' });
    
    // Use XML wrapper for user data
    const userDataSection = wrapUserData({
      full_context: ctx.promptPreview,
      highlighted_text: ctx.highlightedText,
      surrounding_context: ctx.inlineContext,
      ...(ctx.spanAnchors ? { span_anchors: ctx.spanAnchors } : {}),
      ...(ctx.nearbySpanHints ? { nearby_spans: ctx.nearbySpanHints } : {}),
    });

    // Get format instruction (provider-aware - may be empty for OpenAI with schema)
    const formatInstruction = getFormatInstruction({ 
      operation: 'enhance_suggestions',
      isArray: !useWrapper,
      hasSchema: true,
      targetStart: useWrapper ? '{' : '[',
    });

    const exampleBlock = this._buildExampleBlock(
      TECHNICAL_EXAMPLES,
      ctx.slotLabel,
      provider,
      useWrapper
    );
    const spanRule =
      ctx.spanAnchors || ctx.nearbySpanHints
        ? 'CONTEXT: Respect span anchors; avoid conflicting nearby spans.'
        : '';
    const outputLine = useWrapper
      ? `Output JSON object: {"suggestions": [{"text":"phrase","category":"${ctx.slotLabel}","explanation":"visual effect"}]}`
      : `Output JSON array: [{"text":"phrase","category":"${ctx.slotLabel}","explanation":"visual effect"}]`;

    return [
      securityPrefix,
      'Generate up to 12 alternative TECHNICAL phrases for video prompts.',
      '',
      userDataSection,
      '',
      'RULES:',
      '1. Keep the same SUBJECT - only change the technical/camera approach',
      '2. Use cinematography terms (angles, lenses, movements, lighting)',
      '3. Each option should create a different visual effect',
      '4. Return ONLY the replacement phrase (2-50 words)',
      'DIVERSITY: Vary angle, lens, movement, or lighting (not just synonyms).',
      ctx.guidance ? `GUIDANCE: ${ctx.guidance}` : '',
      ctx.focusGuidance ? `FOCUS: ${ctx.focusGuidance}` : '',
      spanRule,
      '',
      ctx.constraintLine ? `CONSTRAINTS: ${ctx.constraintLine}` : '',
      ctx.constraintNotes ? `REQUIREMENTS: ${ctx.constraintNotes}` : '',
      '',
      outputLine,
      exampleBlock,
      formatInstruction,
    ].filter(Boolean).join('\n');
  }

  /**
   * Design 2: Visual/Style/Subject slots
   * 
   * Provider-aware: Uses XML wrapper for user data
   */
  private _buildVisualPrompt(
    ctx: SharedPromptContext,
    provider: string,
    useWrapper: boolean
  ): string {
    const securityPrefix = getSecurityPrefix({ operation: 'enhance_suggestions' });
    
    const userDataSection = wrapUserData({
      full_context: ctx.promptPreview,
      highlighted_text: ctx.highlightedText,
      surrounding_context: ctx.inlineContext,
      ...(ctx.spanAnchors ? { span_anchors: ctx.spanAnchors } : {}),
      ...(ctx.nearbySpanHints ? { nearby_spans: ctx.nearbySpanHints } : {}),
    });

    const formatInstruction = getFormatInstruction({ 
      operation: 'enhance_suggestions',
      isArray: !useWrapper,
      hasSchema: true,
      targetStart: useWrapper ? '{' : '[',
    });

    const exampleBlock = this._buildExampleBlock(
      VISUAL_EXAMPLES,
      ctx.slotLabel,
      provider,
      useWrapper
    );
    const spanRule =
      ctx.spanAnchors || ctx.nearbySpanHints
        ? 'CONTEXT: Respect span anchors; avoid conflicting nearby spans.'
        : '';
    const outputLine = useWrapper
      ? `Output JSON object: {"suggestions": [{"text":"phrase","category":"${ctx.slotLabel}","explanation":"what viewer sees differently"}]}`
      : `Output JSON array: [{"text":"phrase","category":"${ctx.slotLabel}","explanation":"what viewer sees differently"}]`;

    return [
      securityPrefix,
      'Generate up to 12 alternative VISUAL DESCRIPTIONS for the highlighted phrase.',
      '',
      userDataSection,
      '',
      'RULES:',
      '1. Fill the SAME ROLE in the scene - but with VISUALLY DISTINCT alternatives',
      '2. Suggestions should produce noticeably DIFFERENT video frames',
      '3. Avoid synonyms - "silky chestnut" vs "fluffy brown" renders nearly identical',
      '4. Think: what OTHER thing could fill this role?',
      '5. Return ONLY the replacement phrase (2-50 words)',
      'DIVERSITY: Prefer role-level changes that alter the visual outcome, not minor adjective swaps.',
      ctx.guidance ? `GUIDANCE: ${ctx.guidance}` : '',
      ctx.focusGuidance ? `FOCUS: ${ctx.focusGuidance}` : '',
      spanRule,
      '',
      ctx.constraintLine ? `CONSTRAINTS: ${ctx.constraintLine}` : '',
      ctx.constraintNotes ? `REQUIREMENTS: ${ctx.constraintNotes}` : '',
      '',
      outputLine,
      exampleBlock,
      formatInstruction,
    ].filter(Boolean).join('\n');
  }

  /**
   * Design 3: Action/Verb slots
   */
  private _buildActionPrompt(
    ctx: SharedPromptContext,
    provider: string,
    useWrapper: boolean
  ): string {
    const securityPrefix = getSecurityPrefix({ operation: 'enhance_suggestions' });
    
    const userDataSection = wrapUserData({
      full_context: ctx.promptPreview,
      highlighted_text: ctx.highlightedText,
      surrounding_context: ctx.inlineContext,
      ...(ctx.spanAnchors ? { span_anchors: ctx.spanAnchors } : {}),
      ...(ctx.nearbySpanHints ? { nearby_spans: ctx.nearbySpanHints } : {}),
    });

    const formatInstruction = getFormatInstruction({ 
      operation: 'enhance_suggestions',
      isArray: !useWrapper,
      hasSchema: true,
      targetStart: useWrapper ? '{' : '[',
    });

    const exampleBlock = this._buildExampleBlock(
      NARRATIVE_EXAMPLES,
      ctx.slotLabel,
      provider,
      useWrapper
    );
    const spanRule =
      ctx.spanAnchors || ctx.nearbySpanHints
        ? 'CONTEXT: Respect span anchors; avoid conflicting nearby spans.'
        : '';
    const outputLine = useWrapper
      ? `Output JSON object: {"suggestions": [{"text":"phrase","category":"${ctx.slotLabel}","explanation":"how motion changes"}]}`
      : `Output JSON array: [{"text":"phrase","category":"${ctx.slotLabel}","explanation":"how motion changes"}]`;

    return [
      securityPrefix,
      'Generate up to 12 alternative ACTION phrases for video prompts.',
      '',
      userDataSection,
      '',
      'RULES:',
      '1. Keep the same SUBJECT doing the action - only change the action itself',
      '2. One continuous action only (no sequences like "walks then runs")',
      '3. Actions must be camera-visible physical behavior',
      '4. Return ONLY the replacement phrase (2-50 words)',
      'DIVERSITY: Vary the physical behavior or staging, not just intensity.',
      ctx.guidance ? `GUIDANCE: ${ctx.guidance}` : '',
      ctx.focusGuidance ? `FOCUS: ${ctx.focusGuidance}` : '',
      spanRule,
      '',
      ctx.constraintLine ? `CONSTRAINTS: ${ctx.constraintLine}` : '',
      ctx.constraintNotes ? `REQUIREMENTS: ${ctx.constraintNotes}` : '',
      '',
      outputLine,
      exampleBlock,
      formatInstruction,
    ].filter(Boolean).join('\n');
  }

  private _buildExampleBlock(
    examples: Array<{ text: string; explanation: string }>,
    slotLabel: string,
    provider: string,
    useWrapper: boolean
  ): string {
    if (!this._shouldIncludeExamples(provider)) return '';
    const escapeValue = (value: string): string =>
      value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const sample = examples.slice(0, 2);
    const lines = [
      'EXAMPLE OUTPUT (format only; do not copy content):',
      ...(useWrapper ? ['{', '  "suggestions": ['] : ['[']),
      ...sample.map((example, index) => {
        const suffix = index < sample.length - 1 ? ',' : '';
        return `  {"text":"${escapeValue(example.text)}","category":"${slotLabel}","explanation":"${escapeValue(example.explanation)}"}${suffix}`;
      }),
      ...(useWrapper ? ['  ]', '}'] : [']']),
    ];
    return lines.join('\n');
  }

  private _shouldIncludeExamples(provider: string): boolean {
    return provider === 'groq' || provider === 'qwen';
  }

  /**
   * Build context object
   */
  private _buildContext({
    highlightedText,
    highlightedCategory,
    contextBefore,
    contextAfter,
    fullPrompt,
    brainstormContext,
    editHistory,
    modelTarget,
    promptSection,
    videoConstraints,
    highlightWordCount,
    spanAnchors,
    nearbySpanHints,
    focusGuidance,
    slot,
    mode,
  }: {
    highlightedText: string;
    highlightedCategory: string | null;
    contextBefore: string;
    contextAfter: string;
    fullPrompt: string;
    brainstormContext: BrainstormContext | null;
    editHistory: Array<{ original?: string }>;
    modelTarget: string | null;
    promptSection: string | null;
    videoConstraints: { mode?: string; minWords?: number; maxWords?: number; maxSentences?: number; disallowTerminalPunctuation?: boolean; formRequirement?: string; focusGuidance?: string[]; extraRequirements?: string[] } | null;
    highlightWordCount: number | null;
    spanAnchors?: string;
    nearbySpanHints?: string;
    focusGuidance?: string[];
    slot: string;
    mode: 'rewrite' | 'placeholder';
  }): SharedPromptContext {
    // LONGER context windows - context is critical for relevance
    const prefix = this._trim(contextBefore, 150, true);
    const suffix = this._trim(contextAfter, 150);
    const inlineContext = `${prefix}[${highlightedText}]${suffix}`;
    
    // Longer prompt preview - the model needs to understand the full scene
    const promptPreview = this._trim(fullPrompt, PROMPT_PREVIEW_LIMIT);

    // Build constraint line
    let constraintLine = '';
    const constraintNotes: string[] = [];
    if (videoConstraints) {
      const parts: string[] = [];
      if (videoConstraints.minWords || videoConstraints.maxWords) {
        parts.push(`${videoConstraints.minWords || 2}-${videoConstraints.maxWords || 50} words`);
      }
      if (videoConstraints.mode === 'micro') {
        parts.push('noun phrases only');
      }
      constraintLine = parts.join(', ');

      if (videoConstraints.formRequirement) {
        constraintNotes.push(videoConstraints.formRequirement);
      }
      if (Array.isArray(videoConstraints.extraRequirements)) {
        constraintNotes.push(...videoConstraints.extraRequirements);
      }
    }

    // Add word count hint
    if (Number.isFinite(highlightWordCount) && highlightWordCount) {
      constraintLine = constraintLine 
        ? `${constraintLine}; aim for ~${highlightWordCount} words`
        : `aim for ~${highlightWordCount} words`;
    }

    const focusGuidanceCombined = [
      ...(videoConstraints?.focusGuidance || []),
      ...(focusGuidance || []),
    ].filter(Boolean);

    return {
      highlightedText,
      highlightedCategory,
      inlineContext,
      prefix,
      suffix,
      promptPreview,
      constraintLine,
      constraintNotes: constraintNotes.length ? constraintNotes.join(' | ') : '',
      modelLine: modelTarget ? `Target: ${modelTarget}` : '',
      sectionLine: promptSection ? `Section: ${promptSection}` : '',
      slotLabel: slot || 'subject',
      guidance: getCategoryGuidance(highlightedCategory),
      focusGuidance: focusGuidanceCombined.length ? focusGuidanceCombined.join(' | ') : '',
      spanAnchors,
      nearbySpanHints,
      highlightWordCount,
      mode,
      replacementInstruction: '',
    };
  }

  /**
   * Resolve slot using taxonomy
   */
  private _resolveSlot({ highlightedText, phraseRole, highlightedCategory }: {
    highlightedText: string;
    phraseRole: string | null;
    highlightedCategory: string | null;
    contextBefore: string;
    contextAfter: string;
  }): string {
    if (highlightedCategory) {
      const parent = getParentCategory(highlightedCategory);
      if (parent) return parent;
    }

    if (phraseRole) {
      const parent = getParentCategory(phraseRole);
      if (parent) return parent;
    }

    if (highlightedText) {
      const result = extractSemanticSpans(highlightedText) as unknown as { spans: Array<{ role: string; confidence: number }> };
      const spans = 'spans' in result ? result.spans : [];
      if (spans.length > 0) {
        const bestSpan = spans.reduce((a, b) => (a.confidence > b.confidence ? a : b));
        const parent = getParentCategory(bestSpan.role);
        if (parent) return parent;
      }
    }

    return 'subject';
  }

  private _pickDesign(slot: string, isVideoPrompt: boolean, mode: 'rewrite' | 'placeholder'): 'orthogonal' | 'narrative' | 'visual' {
    if (mode === 'placeholder') {
      return slot === 'action' ? 'narrative' : 'visual';
    }
    if (slot === 'action') return 'narrative';
    if (slot === 'camera' || slot === 'shot' || slot === 'lighting' || slot === 'technical') {
      return 'orthogonal';
    }
    return 'visual';
  }

  private _trim(text: string, length: number, fromEnd = false): string {
    if (!text) return '';
    if (text.length <= length) return text;
    return fromEnd ? text.slice(-length) : text.slice(0, length);
  }
}
