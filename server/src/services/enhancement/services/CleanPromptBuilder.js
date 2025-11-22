const UNIVERSAL_ORDER = 'Shot Type > Subject > Action > Setting > Camera Behavior > Lighting > Style';

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
  buildPrompt(params = {}) {
    return this._buildSpanPrompt({ ...params, mode: params?.isPlaceholder ? 'placeholder' : 'rewrite' });
  }

  buildRewritePrompt(params = {}) {
    return this._buildSpanPrompt({ ...params, mode: 'rewrite' });
  }

  buildPlaceholderPrompt(params = {}) {
    return this._buildSpanPrompt({ ...params, mode: 'placeholder' });
  }

  /**
   * Build prompt for custom request path
   */
  buildCustomPrompt({ highlightedText, customRequest, fullPrompt, isVideoPrompt }) {
    const promptPreview = this._trim(fullPrompt, 800);
    const inline = this._inlineContext('', highlightedText, '');

    return [
      'You are a span-level video prompt editor. Use the PDF-aligned rules.',
      `Full prompt snapshot: "${promptPreview}"`,
      `Highlighted: "${inline}"`,
      `Custom request: ${customRequest}`,
      `Universal order: ${UNIVERSAL_ORDER}.`,
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
  _buildSpanPrompt(params) {
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

  _buildOrthogonalAttributePrompt(ctx) {
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
    } = ctx;

    return [
      'You are an expert Cinematographer and Prompt Engineer for span-level replacements.',
      `Context sentence: "${inlineContext}"`,
      `Prefix to preserve: "${prefix}"`,
      `Suffix to preserve: "${suffix}"`,
      `Full prompt snapshot: "${promptPreview}"`,
      modelLine,
      sectionLine,
      `Universal prompt order: ${UNIVERSAL_ORDER}. Stay in the current slot.`,
      `Slot: ${slotLabel}. This is Design 1 (Orthogonal Attribute Injector).`,
      'Goal: Generate 12 drop-in replacements that vary one technical attribute each.',
      'Rules:',
      '- Stay inside the same slot; do not alter subject or main action.',
      '- Use Director\'s Lexicon: shot types, lens specs, camera moves, lighting patterns.',
      '- Each option must be visually orthogonal (different direction/quality/source/move/focal length).',
      '- One clip, one action: avoid sequences or multi-sentence phrasing.',
      '- Keep grammar identical to the surrounding sentence; no leading verbs unless the slot is an action.',
      constraintLine,
      guidance || '',
      `Output JSON array only: [{"text":"...","category":"${slotLabel}","explanation":"visual change on screen"}].`,
      'Make explanations act as visual rationales (how the frame changes).',
      'Force diversity: later options must avoid reusing nouns/verbs from earlier ones.',
    ]
      .filter(Boolean)
      .join('\n');
  }

  _buildVisualDecompositionPrompt(ctx) {
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
    } = ctx;

    return [
      'You are a Visual Director translating abstract descriptors into grounded, camera-visible details.',
      `Context sentence: "${inlineContext}"`,
      `Prefix to preserve: "${prefix}"`,
      `Suffix to preserve: "${suffix}"`,
      `Full prompt snapshot: "${promptPreview}"`,
      modelLine,
      sectionLine,
      `Universal prompt order: ${UNIVERSAL_ORDER}. Stay in the current slot.`,
      `Slot: ${slotLabel}. This is Design 2 (Visual Decomposition Expander).`,
      'Rules:',
      '- Provide 12 replacements that fit grammatically in the sentence.',
      '- Show, don\'t tell: convert abstract terms into physical cues (materials, silhouette, lighting, movement).',
      '- Ensure visual variance across style, mood, composition, and texture; avoid synonym collapse.',
      '- Keep replacements as noun/adjective phrases when the original span is not a verb.',
      '- Do not introduce new subjects or actions unless the span is a placeholder.',
      constraintLine,
      guidance || '',
      `Output JSON array only: [{"text":"...","category":"${slotLabel}","explanation":"visual rationale"}].`,
      'Make explanations clear: what the viewer sees change on screen.',
    ]
      .filter(Boolean)
      .join('\n');
  }

  _buildNarrativeEditorPrompt(ctx) {
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
    } = ctx;

    return [
      'You are a Grammar-Constrained Narrative Editor for video prompts.',
      `Context sentence: "${inlineContext}"`,
      `Prefix to preserve: "${prefix}"`,
      `Suffix to preserve: "${suffix}"`,
      `Full prompt snapshot: "${promptPreview}"`,
      modelLine,
      sectionLine,
      `Universal prompt order: ${UNIVERSAL_ORDER}. Stay in the current slot.`,
      `Slot: ${slotLabel}. This is Design 3 (One Clip, One Action).`,
      'Rules:',
      '- Generate 12 replacements that keep the same tense and grammatical structure.',
      '- One continuous action/state only; forbid sequences ("and then", "after", "starts to").',
      '- Keep subject and setting intact; replacements must be camera-visible physical behavior.',
      '- Avoid auxiliary clutter; single concise clause.',
      constraintLine,
      guidance || '',
      `Output JSON array only: [{"text":"...","category":"${slotLabel}","explanation":"visual change"}].`,
      'Explanations should describe how the motion or tempo changes on screen.',
    ]
      .filter(Boolean)
      .join('\n');
  }

  _sharedContext({
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
  }) {
    const inlineContext = this._inlineContext(contextBefore, highlightedText, contextAfter);
    const prefix = this._trim(contextBefore, 220, true);
    const suffix = this._trim(contextAfter, 220);
    const promptPreview = this._trim(fullPrompt, 800);

    const anchors = [];
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
        .filter(Boolean);
      if (rejected.length) {
        anchors.push(`Avoid previously rejected: ${rejected.join('; ')}`);
      }
    }

    const lengthHint = Number.isFinite(highlightWordCount)
      ? ` Aim for roughly ${highlightWordCount} words (drop-in parity).`
      : '';

    const constraintLine = videoConstraints
      ? `Keep drop-in length ${videoConstraints.minWords || 0}-${videoConstraints.maxWords || 25} words, max sentences ${videoConstraints.maxSentences ?? 1}, mode ${videoConstraints.mode || 'standard'}.${lengthHint}`
      : `Keep a single concise span (no multi-sentence output).${lengthHint}`;

    const modelLine = modelTarget ? `Target model: ${modelTarget}.` : '';
    const sectionLine = promptSection ? `Prompt section: ${promptSection}.` : '';
    const slotLabel = slot || 'descriptor';
    const guidance = anchors.length
      ? `Context notes: ${anchors.join(' | ')}`
      : '';

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
    };
  }

  _resolveSlot({ highlightedText, phraseRole, highlightedCategory, contextBefore, contextAfter }) {
    const text = (highlightedText || '').toLowerCase();
    const role = (phraseRole || '').toLowerCase();
    const category = (highlightedCategory || '').toLowerCase();
    const neighbor = `${contextBefore || ''} ${contextAfter || ''}`.toLowerCase();

    const actionPattern = /\b(run|runs|running|walk|walking|walks|jump|jumping|flying|flies|dive|dives|leap|leaping|climb|climbing|turns?|spins?|raises?|holds?|throws?|looking|gazing|smiling|staring)\b/;
    const cameraPattern = /\bshot|frame|framing|lens|camera|angle|dolly|pan|tilt|zoom|close[- ]?up|wide|overhead\b/;
    const lightingPattern = /\blight|lighting|shadow|glow|sunset|golden hour|neon|moody|illum|rim\b/;
    const stylePattern = /\bstyle|aesthetic|vibe|tone|noir|cyberpunk|vintage|retro|minimal|surreal\b/;
    const settingPattern = /\bforest|city|street|room|interior|exterior|desert|ocean|mountain|space|hall\b/;
    const subjectPattern = /\bface|eyes|hair|hands|wearing|dressed|outfit|clothing|skin|build|silhouette\b/;
    const technicalPattern = /\b16:9|9:16|fps|frame rate|aspect ratio|resolution|4k|8k|mm\b/;

    if (actionPattern.test(text) || actionPattern.test(neighbor) || /action|movement|gesture/.test(role)) {
      return 'action';
    }
    if (cameraPattern.test(text) || /camera|framing|shot/.test(role) || /camera/.test(category)) {
      return 'camera';
    }
    if (lightingPattern.test(text) || /lighting/.test(role) || /light/.test(category)) {
      return 'lighting';
    }
    if (technicalPattern.test(text) || /technical|aspect|spec|lens/.test(role)) {
      return 'technical';
    }
    if (stylePattern.test(text) || /style|aesthetic|tone/.test(role) || /style/.test(category)) {
      return 'style';
    }
    if (subjectPattern.test(text) || /subject|character|appearance|wardrobe/.test(role)) {
      return 'subject';
    }
    if (settingPattern.test(text) || /location|environment|setting/.test(role)) {
      return 'setting';
    }
    return 'descriptor';
  }

  _pickDesign(slot, isVideoPrompt, mode) {
    if (mode === 'placeholder') {
      return slot === 'action' ? 'narrative' : 'visual';
    }
    if (slot === 'action') return 'narrative';
    if (slot === 'camera' || slot === 'lighting' || slot === 'technical') {
      return 'orthogonal';
    }
    if (!isVideoPrompt) return 'visual';
    return 'visual';
  }

  _inlineContext(before, highlight, after) {
    return `${before || ''}${highlight || ''}${after || ''}`;
  }

  _trim(text, length, fromEnd = false) {
    if (!text) return '';
    if (text.length <= length) return text;
    return fromEnd ? text.slice(-length) : text.slice(0, length);
  }
}
