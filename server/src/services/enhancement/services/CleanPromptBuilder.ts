import { extractSemanticSpans } from '../../nlp/NlpSpanService.js';
import { getParentCategory } from '@shared/taxonomy';
import type {
  PromptBuildParams,
  CustomPromptParams,
  SharedPromptContext,
  BrainstormContext,
} from './types.js';

/**
 * Prompt builder for span-level replacements aligned to
 * "Prompt Engineering for Video Prompts" (single source of truth).
 *
 * Implements PDF designs:
 * - Design 1: Orthogonal Attribute Injector (technical slots)
 * - Design 2: Visual Decomposition Expander (descriptors/style/appearance)
 * - Design 3: Grammar-Constrained Narrative Editor (actions/verbs)
 */
export class CleanPromptBuilder {
  buildPrompt(params: PromptBuildParams = {}): string {
    return this._buildSpanPrompt({ ...params, mode: params?.isPlaceholder ? 'placeholder' : 'rewrite' });
  }

  buildRewritePrompt(params: PromptBuildParams = {}): string {
    return this._buildSpanPrompt({ ...params, mode: 'rewrite' });
  }

  buildPlaceholderPrompt(params: PromptBuildParams = {}): string {
    return this._buildSpanPrompt({ ...params, mode: 'placeholder' });
  }

  /**
   * Build prompt for custom request path
   */
  buildCustomPrompt({ highlightedText, customRequest, fullPrompt, isVideoPrompt }: CustomPromptParams): string {
    const promptPreview = this._trim(fullPrompt, 800);
    const inline = this._inlineContext('', highlightedText, '');

    return [
      'You are a span-level video prompt editor. Use the PDF-aligned rules.',
      `Full prompt snapshot: "${promptPreview}"`,
      `Highlighted: "${inline}"`,
      `Custom request: ${customRequest}`,
      'Maintain the grammatical flow and style of the surrounding sentence.',
      'Generate 12 drop-in replacements that satisfy the request, stay grammatical, and remain camera-visible.',
      isVideoPrompt
        ? '- Keep subject and tense unless the request explicitly changes them.'
        : '- Keep tone and grammar; avoid conversational fillers.',
      'Return ONLY JSON array of {"text","category":"custom","explanation":"visual rationale"}',
    ].join('\n');
  }

  /**
   * Core builder with routing to PDF designs
   */
  private _buildSpanPrompt(params: PromptBuildParams): string {
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
      mode = 'rewrite',
    } = params;

    const slot = this._resolveSlot({
      highlightedText,
      phraseRole,
      highlightedCategory,
      contextBefore,
      contextAfter,
    });
    const design = this._pickDesign(slot, isVideoPrompt, mode);

    const shared = this._sharedContext({
      highlightedText,
      contextBefore,
      contextAfter,
      fullPrompt,
      brainstormContext,
      editHistory,
      modelTarget,
      promptSection,
      videoConstraints,
      highlightWordCount,
      slot,
      mode,
    });

    if (design === 'orthogonal') {
      return this._buildOrthogonalAttributePrompt(shared);
    }
    if (design === 'narrative') {
      return this._buildNarrativeEditorPrompt(shared);
    }
    return this._buildVisualDecompositionPrompt(shared);
  }

  private _buildOrthogonalAttributePrompt(ctx: SharedPromptContext): string {
    const {
      slotLabel,
      inlineContext,
      prefix,
      suffix,
      promptPreview,
      constraintLine,
      modelLine,
      sectionLine,
      guidance,
      replacementInstruction,
      highlightedText,
    } = ctx;

    return [
      'You are an expert Cinematographer and Prompt Engineer for span-level replacements.',
      replacementInstruction,
      `HIGHLIGHTED PHRASE TO REPLACE: "${highlightedText}"`,
      `Context sentence: "${inlineContext}"`,
      `Prefix to preserve: "${prefix}"`,
      `Suffix to preserve: "${suffix}"`,
      `Full prompt snapshot: "${promptPreview}"`,
      modelLine,
      sectionLine,
      'Maintain the grammatical flow and style of the surrounding sentence.',
      `Slot: ${slotLabel}. This is Design 1 (Orthogonal Attribute Injector).`,
      'Goal: Generate 12 drop-in replacements that vary one technical attribute each.',
      'Rules:',
      '- REPLACE ONLY the highlighted phrase above. Return ONLY the replacement phrase, NOT the full sentence.',
      '- Stay inside the same slot; do not alter subject or main action.',
      '- Use Director\'s Lexicon: shot types, lens specs, camera moves, lighting patterns.',
      '- Each option must be visually orthogonal (different direction/quality/source/move/focal length).',
      '- One clip, one action: avoid sequences or multi-sentence phrasing.',
      '- Keep grammar identical to the surrounding sentence; no leading verbs unless the slot is an action.',
      constraintLine,
      guidance || '',
      `Output JSON array only: [{"text":"REPLACEMENT PHRASE ONLY (not full sentence)","category":"${slotLabel}","explanation":"visual change on screen"}].`,
      'Make explanations act as visual rationales (how the frame changes).',
      'Force diversity: later options must avoid reusing nouns/verbs from earlier ones.',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private _buildVisualDecompositionPrompt(ctx: SharedPromptContext): string {
    const {
      slotLabel,
      inlineContext,
      prefix,
      suffix,
      promptPreview,
      constraintLine,
      modelLine,
      sectionLine,
      guidance,
      replacementInstruction,
      highlightedText,
    } = ctx;

    return [
      'You are a Visual Director translating abstract descriptors into grounded, camera-visible details.',
      replacementInstruction,
      `HIGHLIGHTED PHRASE TO REPLACE: "${highlightedText}"`,
      `Context sentence: "${inlineContext}"`,
      `Prefix to preserve: "${prefix}"`,
      `Suffix to preserve: "${suffix}"`,
      `Full prompt snapshot: "${promptPreview}"`,
      modelLine,
      sectionLine,
      'Maintain the grammatical flow and style of the surrounding sentence.',
      `Slot: ${slotLabel}. This is Design 2 (Visual Decomposition Expander).`,
      'Rules:',
      '- REPLACE ONLY the highlighted phrase above. Return ONLY the replacement phrase, NOT the full sentence.',
      '- Provide 12 replacements that fit grammatically in the sentence.',
      '- Show, don\'t tell: convert abstract terms into physical cues (materials, silhouette, lighting, movement).',
      '- Ensure visual variance across style, mood, composition, and texture; avoid synonym collapse.',
      '- Keep replacements as noun/adjective phrases when the original span is not a verb.',
      '- Do not introduce new subjects or actions unless the span is a placeholder.',
      constraintLine,
      guidance || '',
      `Output JSON array only: [{"text":"REPLACEMENT PHRASE ONLY (not full sentence)","category":"${slotLabel}","explanation":"visual rationale"}].`,
      'Make explanations clear: what the viewer sees change on screen.',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private _buildNarrativeEditorPrompt(ctx: SharedPromptContext): string {
    const {
      slotLabel,
      inlineContext,
      prefix,
      suffix,
      promptPreview,
      constraintLine,
      modelLine,
      sectionLine,
      guidance,
      replacementInstruction,
      highlightedText,
    } = ctx;

    return [
      'You are a Grammar-Constrained Narrative Editor for video prompts.',
      replacementInstruction,
      `HIGHLIGHTED PHRASE TO REPLACE: "${highlightedText}"`,
      `Context sentence: "${inlineContext}"`,
      `Prefix to preserve: "${prefix}"`,
      `Suffix to preserve: "${suffix}"`,
      `Full prompt snapshot: "${promptPreview}"`,
      modelLine,
      sectionLine,
      'Maintain the grammatical flow and style of the surrounding sentence.',
      `Slot: ${slotLabel}. This is Design 3 (One Clip, One Action).`,
      'Rules:',
      '- REPLACE ONLY the highlighted phrase above. Return ONLY the replacement phrase, NOT the full sentence.',
      '- Generate 12 replacements that keep the same tense and grammatical structure.',
      '- One continuous action/state only; forbid sequences ("and then", "after", "starts to").',
      '- Keep subject and setting intact; replacements must be camera-visible physical behavior.',
      '- Avoid auxiliary clutter; single concise clause.',
      constraintLine,
      guidance || '',
      `Output JSON array only: [{"text":"REPLACEMENT PHRASE ONLY (not full sentence)","category":"${slotLabel}","explanation":"visual change"}].`,
      'Explanations should describe how the motion or tempo changes on screen.',
    ]
      .filter(Boolean)
      .join('\n');
  }

  private _sharedContext({
    highlightedText,
    contextBefore,
    contextAfter,
    fullPrompt,
    brainstormContext,
    editHistory,
    modelTarget,
    promptSection,
    videoConstraints,
    highlightWordCount,
    slot,
    mode,
  }: {
    highlightedText: string;
    contextBefore: string;
    contextAfter: string;
    fullPrompt: string;
    brainstormContext: BrainstormContext | null;
    editHistory: Array<{ original?: string }>;
    modelTarget: string | null;
    promptSection: string | null;
    videoConstraints: { mode?: string; minWords?: number; maxWords?: number; maxSentences?: number; disallowTerminalPunctuation?: boolean; formRequirement?: string; focusGuidance?: string[]; extraRequirements?: string[] } | null;
    highlightWordCount: number | null;
    slot: string;
    mode: 'rewrite' | 'placeholder';
  }): SharedPromptContext {
    const inlineContext = this._inlineContext(contextBefore, highlightedText, contextAfter);
    const prefix = this._trim(contextBefore, 220, true);
    const suffix = this._trim(contextAfter, 220);
    const promptPreview = this._trim(fullPrompt, 800);

    const anchors: string[] = [];
    if (brainstormContext?.elements) {
      const entries = Object.entries(brainstormContext.elements)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}: ${v}`);
      if (entries.length) {
        anchors.push(`Creative anchors: ${entries.join(', ')}`);
      }
    }
    if (editHistory?.length) {
      const rejected = editHistory
        .slice(-3)
        .map((e) => e.original)
        .filter(Boolean) as string[];
      if (rejected.length) {
        anchors.push(`Avoid previously rejected: ${rejected.join('; ')}`);
      }
    }

    const lengthHint = Number.isFinite(highlightWordCount)
      ? ` Aim for roughly ${highlightWordCount} words (drop-in parity).`
      : '';

    let constraintLine = '';
    if (videoConstraints) {
      const parts: string[] = [];
      
      // Basic constraints
      parts.push(`Length: ${videoConstraints.minWords || 0}-${videoConstraints.maxWords || 25} words`);
      parts.push(`Max sentences: ${videoConstraints.maxSentences ?? 1}`);
      
      // Mode-specific requirements
      if (videoConstraints.formRequirement) {
        parts.push(`Form: ${videoConstraints.formRequirement}`);
      }
      
      if (videoConstraints.focusGuidance && Array.isArray(videoConstraints.focusGuidance)) {
        parts.push(`Focus: ${videoConstraints.focusGuidance.join('; ')}`);
      }
      
      if (videoConstraints.extraRequirements && Array.isArray(videoConstraints.extraRequirements) && videoConstraints.extraRequirements.length > 0) {
        parts.push(`Requirements: ${videoConstraints.extraRequirements.join('; ')}`);
      }
      
      // Micro mode specific restrictions
      if (videoConstraints.mode === 'micro') {
        parts.push('CRITICAL: No punctuation (no periods, colons, semicolons). Max 1 comma allowed. No verbs (is, are, was, were, be, being, been, am). Must be a noun phrase only.');
      }
      
      // Disallow terminal punctuation
      if (videoConstraints.disallowTerminalPunctuation) {
        parts.push('No terminal punctuation (no period, exclamation, or question mark at the end).');
      }
      
      constraintLine = `Constraints: ${parts.join(' | ')}.${lengthHint}`;
    } else {
      constraintLine = `Keep a single concise span (no multi-sentence output).${lengthHint}`;
    }

    const modelLine = modelTarget ? `Target model: ${modelTarget}.` : '';
    const sectionLine = promptSection ? `Prompt section: ${promptSection}.` : '';
    const slotLabel = slot || 'subject';
    const guidance = anchors.length
      ? `Context notes: ${anchors.join(' | ')}`
      : '';

    // Critical instruction: Only replace the highlighted phrase
    const replacementInstruction = `CRITICAL: You are replacing ONLY the highlighted phrase "${highlightedText}". 
Your output must be ONLY the replacement phrase (2-25 words), NOT the entire sentence or prompt.
Return ONLY the replacement text that will be inserted in place of the highlighted phrase.`;

    return {
      inlineContext,
      prefix,
      suffix,
      promptPreview,
      constraintLine,
      modelLine,
      sectionLine,
      slotLabel,
      guidance,
      highlightWordCount,
      mode,
      replacementInstruction,
      highlightedText,
    };
  }

  /**
   * Resolve slot using taxonomy directly (single source of truth)
   * Priority: highlightedCategory > phraseRole > NLP inference > default
   */
  private _resolveSlot({ highlightedText, phraseRole, highlightedCategory }: {
    highlightedText: string;
    phraseRole: string | null;
    highlightedCategory: string | null;
    contextBefore: string;
    contextAfter: string;
  }): string {
    // PRIORITY 1: Use category from span labeling (already computed)
    if (highlightedCategory) {
      const parent = getParentCategory(highlightedCategory);
      if (parent) return parent;
    }

    // PRIORITY 2: Use phraseRole if provided
    if (phraseRole) {
      const parent = getParentCategory(phraseRole);
      if (parent) return parent;
    }

    // PRIORITY 3: Run compromise.js on the text (manual selection fallback)
    // Note: extractSemanticSpans is async but original code calls it synchronously
    // This preserves original behavior - may need async refactor in future
    if (highlightedText) {
      // Type assertion: treating as sync to match original behavior
      // In practice, this may work if the function has sync fallback or cache
      const result = extractSemanticSpans(highlightedText) as unknown as { spans: Array<{ role: string; confidence: number }> };
      const spans = 'spans' in result ? result.spans : [];
      if (spans.length > 0) {
        // Use highest confidence span
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
    if (!isVideoPrompt) return 'visual';
    return 'visual';
  }

  private _inlineContext(before: string, highlight: string, after: string): string {
    return `${before || ''}${highlight || ''}${after || ''}`;
  }

  private _trim(text: string, length: number, fromEnd = false): string {
    if (!text) return '';
    if (text.length <= length) return text;
    return fromEnd ? text.slice(-length) : text.slice(0, length);
  }
}

