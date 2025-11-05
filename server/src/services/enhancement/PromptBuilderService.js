import { CATEGORY_CONSTRAINTS, detectSubcategory } from '../CategoryConstraints.js';

/**
 * PromptBuilderService
 * 
 * Responsible for building system prompts for different suggestion types.
 * Builds prompts for placeholder suggestions, rewrite suggestions, and custom requests.
 * 
 * Single Responsibility: Prompt construction and formatting
 */
export class PromptBuilderService {
  constructor(brainstormBuilder, videoService) {
    this.brainstormBuilder = brainstormBuilder;
    this.videoService = videoService;
  }

  /**
   * Build model and section context
   * @param {string} modelTarget - Target AI model
   * @param {string} promptSection - Template section
   * @param {string} category - Category being edited
   * @param {boolean} isVideoPrompt - Whether this is a video prompt
   * @returns {string} Formatted context section
   * @private
   */
  _buildModelAndSectionContext(modelTarget, promptSection, category, isVideoPrompt) {
    if (!isVideoPrompt) {
      return '';
    }

    let context = '';

    // Add model-specific context if detected
    if (modelTarget) {
      const modelName = modelTarget.charAt(0).toUpperCase() + modelTarget.slice(1);
      context += `\n**TARGET MODEL: ${modelName}**\n`;

      // Get model capabilities from service (would need to inject it, but for now use inline)
      const capabilities = this._getModelCapabilitiesInline(modelTarget);
      if (capabilities) {
        context += `Strengths: ${capabilities.primary.slice(0, 3).join(', ')}\n`;
        context += `Optimize for: ${capabilities.optimizeFor}\n`;
        context += `Avoid: ${capabilities.weaknesses.slice(0, 2).join(', ')}\n`;
      }

      // Add model-specific guidance for this category
      if (category) {
        const guidance = this._getModelGuidanceInline(modelTarget, category);
        if (guidance.length > 0) {
          context += `\n**Model-Specific ${category.toUpperCase()} Guidance:**\n`;
          guidance.forEach((tip) => {
            context += `- ${tip}\n`;
          });
        }
      }
    }

    // Add section-specific context if detected
    if (promptSection) {
      const sectionName = promptSection
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      context += `\n**PROMPT SECTION: ${sectionName}**\n`;

      const constraints = this._getSectionConstraintsInline(promptSection);
      if (constraints) {
        context += `Tone: ${constraints.tone.charAt(0).toUpperCase() + constraints.tone.slice(1)}\n`;
        context += `Precision: ${constraints.precision.charAt(0).toUpperCase() + constraints.precision.slice(1)}\n`;
        context += `Key Requirements: ${constraints.requirements.slice(0, 2).join(', ')}\n`;
        context += `Must Avoid: ${constraints.avoid.slice(0, 2).join(', ')}\n`;
      }
    }

    return context;
  }

  /**
   * Get model capabilities inline (simplified)
   * @private
   */
  _getModelCapabilitiesInline(model) {
    const capabilities = {
      sora: {
        primary: ['Realistic motion', 'Physics simulation', 'Long takes'],
        optimizeFor: 'Continuous action, natural movement',
        weaknesses: ['Stylized content', 'Text rendering'],
      },
      veo3: {
        primary: ['Cinematic lighting', 'Atmospheric effects', 'Mood'],
        optimizeFor: 'Lighting quality, atmosphere',
        weaknesses: ['Fast action', 'Abstract content'],
      },
      runway: {
        primary: ['Stylized visuals', 'Artistic filters', 'Creative effects'],
        optimizeFor: 'Artistic style, visual treatments',
        weaknesses: ['Photorealism', 'Long sequences'],
      },
      kling: {
        primary: ['Character animation', 'Facial expressions', 'Close-ups'],
        optimizeFor: 'Character emotion, facial detail',
        weaknesses: ['Wide shots', 'Environmental detail'],
      },
      luma: {
        primary: ['Surreal visuals', 'Morphing effects', 'Dreamlike'],
        optimizeFor: 'Abstract concepts, transitions',
        weaknesses: ['Photorealism', 'Precise control'],
      },
    };
    return capabilities[model] || null;
  }

  /**
   * Get model-specific guidance inline (simplified)
   * @private
   */
  _getModelGuidanceInline(model, category) {
    const normalizedCategory = (category || '').toLowerCase();
    const guidance = [];

    if (model === 'sora' && (normalizedCategory.includes('motion') || normalizedCategory.includes('action'))) {
      guidance.push('Describe continuous, realistic motion');
      guidance.push('Mention physical interactions');
    }

    if (model === 'veo3' && normalizedCategory.includes('lighting')) {
      guidance.push('Emphasize atmospheric quality');
      guidance.push('Specify technical lighting details');
    }

    if (model === 'runway' && normalizedCategory.includes('style')) {
      guidance.push('Embrace artistic, stylized approaches');
    }

    if (model === 'kling' && normalizedCategory.includes('subject')) {
      guidance.push('Focus on facial expressions and emotion');
    }

    if (model === 'luma' && normalizedCategory.includes('style')) {
      guidance.push('Embrace surreal, abstract concepts');
    }

    return guidance;
  }

  /**
   * Get section constraints inline (simplified)
   * @private
   */
  _getSectionConstraintsInline(section) {
    const constraints = {
      main_prompt: {
        tone: 'descriptive',
        precision: 'moderate',
        requirements: ['Clear descriptions', 'Narrative flow'],
        avoid: ['Technical jargon', 'Ambiguous terms'],
      },
      technical_specs: {
        tone: 'technical',
        precision: 'high',
        requirements: ['Exact values', 'Standard terminology'],
        avoid: ['Poetic language', 'Vague descriptors'],
      },
      alternatives: {
        tone: 'suggestive',
        precision: 'moderate',
        requirements: ['Diverse variations', 'Different directions'],
        avoid: ['Minor tweaks', 'Same concept'],
      },
      style_direction: {
        tone: 'referential',
        precision: 'high',
        requirements: ['Specific references', 'Named styles'],
        avoid: ['Generic terms', 'Vague comparisons'],
      },
    };
    return constraints[section] || null;
  }

  /**
   * Build edit history context section
   * @param {Array} editHistory - Array of recent edits
   * @returns {string} Formatted context section
   * @private
   */
  _buildEditHistoryContext(editHistory = []) {
    if (!Array.isArray(editHistory) || editHistory.length === 0) {
      return '';
    }

    let section = '\n**EDIT CONSISTENCY CONTEXT:**\n';
    section += 'Previous edits in this session (most recent to oldest):\n';

    // Show up to 10 most recent edits
    const recentEdits = editHistory.slice(0, 10);

    recentEdits.forEach((edit) => {
      const minutesAgo = edit.minutesAgo || 0;
      const timeStr = minutesAgo === 0 
        ? 'just now' 
        : minutesAgo === 1 
        ? '1 min ago' 
        : `${minutesAgo} mins ago`;

      const categoryStr = edit.category 
        ? ` [${edit.category.charAt(0).toUpperCase() + edit.category.slice(1)}]` 
        : '';

      section += `- Changed${categoryStr} from "${edit.original}" to "${edit.replacement}" (${timeStr})\n`;
    });

    section += '\n**CRITICAL CONSISTENCY REQUIREMENT:**\n';
    section += 'Your suggestions MUST respect these editorial choices. ';
    section += 'Do NOT suggest alternatives that would contradict or undo these decisions. ';
    section += 'The user has already made these changes deliberately - honor their creative direction. ';
    section += 'Build upon these choices rather than reverting them.\n';

    // Add specific guidance based on edit patterns
    if (recentEdits.length >= 3) {
      const categories = recentEdits
        .map(e => e.category)
        .filter(Boolean)
        .reduce((acc, cat) => {
          acc[cat] = (acc[cat] || 0) + 1;
          return acc;
        }, {});

      const dominantCategory = Object.entries(categories)
        .sort((a, b) => b[1] - a[1])[0]?.[0];

      if (dominantCategory) {
        section += `\n**PATTERN DETECTED:** User is actively refining ${dominantCategory} choices. `;
        section += `Your suggestions should continue this refinement direction.\n`;
      }
    }

    return section;
  }

  /**
   * Build span composition context section
   * @param {Array} allLabeledSpans - All labeled spans in the prompt
   * @param {Array} nearbySpans - Spans near the selection
   * @returns {string} Formatted context section
   * @private
   */
  _buildSpanCompositionContext(allLabeledSpans = [], nearbySpans = []) {
    if (!Array.isArray(allLabeledSpans) || allLabeledSpans.length === 0) {
      return '';
    }

    let section = '\n**COMPLETE PROMPT COMPOSITION:**\n';
    section += 'All labeled elements identified in this prompt:\n';

    // Group spans by category for better readability
    const spansByCategory = allLabeledSpans.reduce((acc, span) => {
      const category = span.category || span.role || 'other';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(span);
      return acc;
    }, {});

    // Format each category
    Object.entries(spansByCategory).forEach(([category, spans]) => {
      const formattedCategory = category.charAt(0).toUpperCase() + category.slice(1);
      spans.forEach(span => {
        const confidenceStr = span.confidence 
          ? ` (confidence: ${(span.confidence * 100).toFixed(0)}%)`
          : '';
        section += `- ${formattedCategory}: '${span.text}'${confidenceStr}\n`;
      });
    });

    // Add nearby spans context if available
    if (Array.isArray(nearbySpans) && nearbySpans.length > 0) {
      section += '\n**PROXIMATE CONTEXT:**\n';
      section += 'Elements near your selected text:\n';
      
      nearbySpans.forEach(span => {
        const distance = span.distance || 0;
        const position = span.position || 'nearby';
        const formattedCategory = (span.category || 'element').charAt(0).toUpperCase() + 
          (span.category || 'element').slice(1);
        section += `- ${position.charAt(0).toUpperCase() + position.slice(1)} (${distance} chars): ${formattedCategory} '${span.text}'\n`;
      });
    }

    section += '\n**COHERENCE PRINCIPLE:**\n';
    section += 'Your suggestions must harmonize with ALL these existing elements. ';
    section += 'This is a complete composition where each element influences the others. ';
    section += 'Avoid suggestions that would contradict or clash with the established creative direction.\n';

    return section;
  }

  /**
   * Build prompt for placeholder value suggestions
   * @param {Object} params - Parameters for building the prompt
   * @returns {string} System prompt for Claude
   */
  buildPlaceholderPrompt({
    highlightedText,
    contextBefore,
    contextAfter,
    fullPrompt,
    originalUserPrompt,
    isVideoPrompt,
    brainstormContext,
    highlightedCategory,
    highlightedCategoryConfidence,
    detectPlaceholderTypeFunc,  // Function passed in for detecting placeholder type
    dependencyContext,  // Semantic dependency context
    elementDependencies,  // Actual dependency values
    allLabeledSpans = [],  // Complete span composition
    nearbySpans = [],  // Proximate context
    editHistory = [],  // Edit history for consistency
    modelTarget = null,  // NEW: Target AI model
    promptSection = null,  // NEW: Template section
  }) {
    // Get specific constraints for this category if available
    const subcategory = detectSubcategory(highlightedText, highlightedCategory);
    let constraintInstruction = '';

    if (highlightedCategory === 'technical' && subcategory) {
      const constraint = CATEGORY_CONSTRAINTS.technical[subcategory];
      if (constraint) {
        constraintInstruction = `
CRITICAL REQUIREMENTS:
${constraint.instruction}
${constraint.forbidden}

Examples of valid suggestions: ${constraint.fallbacks.map(f => f.text).join(', ')}
`;
      }
    } else if (highlightedCategory && CATEGORY_CONSTRAINTS[highlightedCategory]) {
      const constraint = CATEGORY_CONSTRAINTS[highlightedCategory];
      constraintInstruction = `
CRITICAL REQUIREMENTS:
${constraint.instruction}
${constraint.forbidden || ''}
`;
    }

    // Detect the semantic type of the placeholder
    const placeholderType = detectPlaceholderTypeFunc
      ? detectPlaceholderTypeFunc(highlightedText, contextBefore, contextAfter)
      : 'general';
    
    const brainstormSection = this.brainstormBuilder.buildBrainstormContextSection(brainstormContext, {
      includeCategoryGuidance: true,
      isVideoPrompt,
    });
    
    const contextIntegrationBullet = brainstormSection
      ? '- Respect the Creative Brainstorm anchors above when proposing categories and example replacements.'
      : '- Each category should still fit the overall context';
    const brainstormRequirement = brainstormSection
      ? '✓ Align categories and replacements with the Creative Brainstorm anchors above\n'
      : '';
    const modeRequirement = isVideoPrompt
      ? '✓ For video: consider different visual/cinematic approaches'
      : '✓ Different approaches to achieve the goal';

    // Build span composition context
    const spanCompositionContext = this._buildSpanCompositionContext(allLabeledSpans, nearbySpans);

    // Build edit history context
    const editHistoryContext = this._buildEditHistoryContext(editHistory);

    // Build model and section context
    const modelContext = this._buildModelAndSectionContext(
      modelTarget,
      promptSection,
      highlightedCategory,
      isVideoPrompt
    );

    return `You are an expert prompt engineer specializing in placeholder value suggestion with deep contextual understanding.${
      brainstormSection ? `\n${brainstormSection.trimEnd()}` : ''
    }${dependencyContext ? `\n${dependencyContext.trimEnd()}` : ''}${spanCompositionContext ? `${spanCompositionContext.trimEnd()}` : ''}${editHistoryContext ? `${editHistoryContext.trimEnd()}` : ''}${modelContext ? `${modelContext.trimEnd()}` : ''}${constraintInstruction ? `\n${constraintInstruction}` : ''}

<analysis_process>
Step 1: Identify the placeholder type and context
- Analyze: "${highlightedText}"
- Detected Type: ${placeholderType}
- Classify the semantic category and expected value type
- Context clues: What do the surrounding words suggest about expected value type?

Step 2: Generate DIVERSE CATEGORIES of suggestions
- CRITICAL: Do NOT generate all suggestions from the same category
- If placeholder is a material (like "wooden"), provide alternatives from DIFFERENT categories:
  * Different materials (metal, glass, stone, etc.)
  * Different styles (modern, vintage, rustic, etc.)
  * Different textures (smooth, rough, polished, etc.)
  * Different aesthetics (minimalist, ornate, industrial, etc.)

Step 3: Ensure categorical diversity
- Each suggestion should represent a DIFFERENT approach or category
- Avoid variations of the same thing (not just oak, walnut, cherry)
- Think broadly about what could replace this placeholder

Step 4: Consider context appropriateness
- Original user's intent: "${originalUserPrompt}"
${contextIntegrationBullet}
</analysis_process>

**Context Analysis:**
Full prompt: ${fullPrompt.substring(0, 1500)}

Surrounding context:
- Before: "${contextBefore}"
- **PLACEHOLDER**: "${highlightedText}"
- After: "${contextAfter}"

Original user request: "${originalUserPrompt}"

**Your Task:**
Generate 12-15 suggestions to replace "${highlightedText}" organized into 4-5 CATEGORIES with 2-4 suggestions per category.

**CRITICAL REQUIREMENTS:**
✓ Create 4-5 distinct categories
✓ Include 2-4 suggestions per category (not just one!)
✓ Categories should represent different conceptual approaches
✓ Each suggestion within a category should still be unique
✓ Include category label for ALL suggestions
✓ Direct drop-in replacements - no rewriting needed
✓ Keep each suggestion concise noun/descriptor phrase (1-4 words)
✓ Contextually appropriate despite being diverse
${brainstormRequirement}${modeRequirement}

**Output Format:**
Return ONLY a JSON array with categorized suggestions (2-4 per category):

[
  {"text": "oak", "category": "Natural Wood", "explanation": "Classic hardwood with prominent grain"},
  {"text": "walnut", "category": "Natural Wood", "explanation": "Premium dark wood with rich tones"},
  {"text": "mahogany", "category": "Natural Wood", "explanation": "Deep red-brown luxury wood"},
  {"text": "brushed steel", "category": "Modern Materials", "explanation": "Contemporary industrial aesthetic"},
  {"text": "glass", "category": "Modern Materials", "explanation": "Transparent/translucent modern look"},
  {"text": "chrome", "category": "Modern Materials", "explanation": "Reflective high-tech finish"},
  {"text": "marble", "category": "Stone & Mineral", "explanation": "Elegant stone with veining patterns"},
  {"text": "granite", "category": "Stone & Mineral", "explanation": "Durable speckled stone surface"},
  {"text": "quartz", "category": "Stone & Mineral", "explanation": "Engineered stone with consistent pattern"},
  {"text": "weathered", "category": "Surface Finishes", "explanation": "Aged, worn surface quality"},
  {"text": "polished", "category": "Surface Finishes", "explanation": "Smooth, reflective finish"},
  {"text": "distressed", "category": "Surface Finishes", "explanation": "Intentionally aged appearance"}
]`;
  }

  /**
   * Build prompt for rewrite suggestions
   * @param {Object} params - Parameters for building the prompt
   * @returns {string} System prompt for Claude
   */
  buildRewritePrompt({
    highlightedText,
    contextBefore,
    contextAfter,
    fullPrompt,
    originalUserPrompt,
    isVideoPrompt,
    brainstormContext,
    phraseRole,
    highlightWordCount,
    videoConstraints,
    highlightedCategory,
    highlightedCategoryConfidence,
    dependencyContext,  // Semantic dependency context
    elementDependencies,  // Actual dependency values
    allLabeledSpans = [],  // Complete span composition
    nearbySpans = [],  // Proximate context
    editHistory = [],  // Edit history for consistency
    modelTarget = null,  // NEW: Target AI model
    promptSection = null,  // NEW: Template section
  }) {
    const brainstormSection = this.brainstormBuilder.buildBrainstormContextSection(brainstormContext, {
      isVideoPrompt,
    });

    if (isVideoPrompt) {
      const resolvedHighlightWordCount = Number.isFinite(highlightWordCount)
        ? highlightWordCount
        : this.videoService.countWords(highlightedText);
      const resolvedPhraseRole =
        phraseRole ||
        this.videoService.detectVideoPhraseRole(
          highlightedText,
          contextBefore,
          contextAfter,
          highlightedCategory
        );
      const resolvedVideoConstraints =
        videoConstraints ||
        this.videoService.getVideoReplacementConstraints(
          {
            highlightWordCount: resolvedHighlightWordCount,
            phraseRole: resolvedPhraseRole,
            highlightedText,
            highlightedCategory,
            highlightedCategoryConfidence,
          }
        );

      const {
        minWords,
        maxWords,
        maxSentences = 1,
        disallowTerminalPunctuation,
        formRequirement,
        focusGuidance,
        extraRequirements = [],
        slotDescriptor,
        mode,
      } = resolvedVideoConstraints;

      const sentenceRequirementLabel =
        mode === 'micro'
          ? 'Noun phrase only (no sentences)'
          : maxSentences === 1
          ? 'Single sentence (no multi-sentence rewrites)'
          : `${maxSentences} sentences max`;

      const brainstormRequirementLine = brainstormSection
        ? '✓ Honor the Creative Brainstorm anchors above in every alternative\n'
        : '';

      // Get category-specific focus guidance if available
      const categorySpecificFocus = this.videoService.getCategoryFocusGuidance(resolvedPhraseRole, highlightedCategory);
      
      const focusLines =
        Array.isArray(focusGuidance) && focusGuidance.length > 0
          ? focusGuidance
          : categorySpecificFocus || [
              'Camera: specific movement (dolly in/out, crane up/down, handheld, static) + lens (35mm, 50mm, 85mm) + angle',
              'Lighting: direction, quality, color temperature (e.g., "soft window light from left, 3:1 contrast ratio")',
              'Subject detail: 2-3 specific visual characteristics',
              'Setting: precise location, time of day',
              'Style: film reference (shot on 35mm, cinematic, documentary-style)',
            ];

      const requirementLines = [
        `✓ ${minWords}-${maxWords} words`,
        `✓ ${sentenceRequirementLabel}`,
        '✓ Film terminology (not generic descriptions)',
        '✓ ONE clear action/focus per suggestion',
        '✓ Specific over generic ("weathered oak" not "nice table")',
        '✓ Flows with surrounding context',
        '✓ Do NOT mention or modify template section headings (Main Prompt, Technical Specs, Alternative Approaches)',
        '✓ Avoid meta instructions like "Consider" or "You could" — output only the replacement sentence',
        '✓ Respect the Video Prompt Template tone: cinematic, efficient, no filler language',
      ];

      extraRequirements.forEach((req) => {
        if (req && !requirementLines.includes(`✓ ${req}`)) {
          requirementLines.push(`✓ ${req}`);
        }
      });

      if (disallowTerminalPunctuation) {
        requirementLines.push('✓ No ending punctuation (noun phrase only)');
      }

      const slotLine = slotDescriptor
        ? `**Slot Role:** ${slotDescriptor}.`
        : `**Phrase Role:** ${resolvedPhraseRole} — replacements must serve the same grammatical role and slot cleanly into the existing sentence.`;

      const formLine = formRequirement ? `**Form Requirement:** ${formRequirement}.` : '';

      const lengthGuardrailLine =
        mode === 'micro'
          ? `**Length Guardrail:** ${minWords}-${maxWords} words, noun phrase drop-in replacement.`
          : `**Length Guardrail:** ${minWords}-${maxWords} words, ${
              maxSentences === 1 ? 'single sentence' : `${maxSentences} sentences max`
            }, drop-in replacement.`;

      const approachLines = [
        '- Keep enhancements scoped to the highlighted slot',
        '- Use film language: dolly, crane, rack focus, shallow DOF, 35mm, f/1.8',
        '- Prioritize ONE specific element per variant',
        '- Avoid multiple simultaneous actions',
      ];

      // Add category emphasis if we have a clear category
      const categoryEmphasis = highlightedCategory && resolvedPhraseRole
        ? `\n\n🎯 **CRITICAL**: User clicked on ${highlightedCategory.toUpperCase()} text. ALL ${focusLines.length} suggestions MUST focus exclusively on ${resolvedPhraseRole}. Do NOT suggest alternatives for other categories.\n`
        : '';

      // Build span composition context
      const spanCompositionContext = this._buildSpanCompositionContext(allLabeledSpans, nearbySpans);

      // Build edit history context
      const editHistoryContext = this._buildEditHistoryContext(editHistory);

      // Build model and section context
      const modelContext = this._buildModelAndSectionContext(
        modelTarget,
        promptSection,
        highlightedCategory,
        isVideoPrompt
      );

      return `You are a video prompt expert for AI video generation (Sora, Veo3, RunwayML, Kling, Luma).${
        brainstormSection ? `\n${brainstormSection.trimEnd()}` : ''
      }${dependencyContext ? `\n${dependencyContext.trimEnd()}` : ''}${spanCompositionContext ? `${spanCompositionContext.trimEnd()}` : ''}${editHistoryContext ? `${editHistoryContext.trimEnd()}` : ''}${modelContext ? `${modelContext.trimEnd()}` : ''}${categoryEmphasis}

**APPROACH:**
${approachLines.join('\n')}

**HIGHLIGHTED SECTION:**
"${highlightedText}"

${slotLine}
**Original Length:** ${resolvedHighlightWordCount} words.
${lengthGuardrailLine}
${formLine ? `${formLine}\n` : ''}**CONTEXT:**
Before: "${contextBefore}"
After: "${contextAfter}"

**Your Task:**
Generate 3-5 enhanced alternatives. Each must be a complete drop-in replacement focusing on:

**Focus ONE per variant:**
${focusLines.map((line) => `- ${line}`).join('\n')}

**Requirements:**
${requirementLines.join('\n')}
${brainstormRequirementLine}
Return ONLY a JSON array (no markdown, no code blocks):

[
  {"text": "enhanced version...", "explanation": "Adds camera specifics..."},
  {"text": "alternative...", "explanation": "Different lighting approach..."},
  {"text": "third option...", "explanation": "Focuses on subject detail..."}
]`;
    }

    const brainstormContextReminder = brainstormSection
      ? '- Reinforce the Creative Brainstorm anchors detailed above.'
      : '';
    const brainstormQualityRequirement = brainstormSection
      ? '✓ Reinforces the Creative Brainstorm anchors above\n'
      : '';

    // Build span composition context
    const spanCompositionContext = this._buildSpanCompositionContext(allLabeledSpans, nearbySpans);

    // Build edit history context
    const editHistoryContext = this._buildEditHistoryContext(editHistory);

    // Build model and section context (only for video prompts)
    const modelContext = this._buildModelAndSectionContext(
      modelTarget,
      promptSection,
      highlightedCategory,
      isVideoPrompt
    );

    return `You are a prompt engineering expert specializing in clarity, specificity, and actionability.${
      brainstormSection ? `\n${brainstormSection.trimEnd()}` : ''
    }${dependencyContext ? `\n${dependencyContext.trimEnd()}` : ''}${spanCompositionContext ? `${spanCompositionContext.trimEnd()}` : ''}${editHistoryContext ? `${editHistoryContext.trimEnd()}` : ''}${modelContext ? `${modelContext.trimEnd()}` : ''}

<analysis_process>
Step 1: Analyze the highlighted section
- Content: "${highlightedText}"
- What is it trying to accomplish?
- Current clarity and specificity level

Step 2: Identify improvement opportunities
- Is it vague or ambiguous?
- Could it be more specific or concrete?
- Are there implicit requirements to make explicit?
- Would structure or examples help?

Step 3: Consider context
- Original intent: "${originalUserPrompt}"
- How does this fit in the full prompt?
- What constraints or requirements exist?
${brainstormContextReminder}

Step 4: Generate enhanced alternatives
- Create 3-5 variants with different improvement focuses
- Some add structure, some add examples, some add clarity
- Each should be a complete, self-contained replacement
- Maintain natural flow with surrounding context
</analysis_process>

**HIGHLIGHTED SECTION:**
"${highlightedText}"

**CONTEXT:**
Before: "${contextBefore}"
After: "${contextAfter}"

**FULL PROMPT:**
${fullPrompt}

**ORIGINAL REQUEST:**
"${originalUserPrompt}"

**Your Task:**
Generate 3-5 improved rewrites focusing on clarity and effectiveness.

**Improvement Strategies:**
- Add concrete examples or criteria
- Break down vague instructions into specific steps
- Specify formats or structures explicitly
- Add constraints or success criteria
- Make implicit requirements explicit
- Increase actionability and reduce ambiguity

**Quality Criteria:**
✓ Complete drop-in replacement
✓ Flows naturally with context
✓ More effective and specific than original
✓ Each variant takes different improvement approach
${brainstormQualityRequirement}✓ Maintains original intent and tone

Return ONLY a JSON array (no markdown, no code blocks):

[
  {"text": "improved rewrite 1...", "explanation": "why this improvement works"},
  {"text": "alternative improvement 2...", "explanation": "why this improvement works"},
  {"text": "third approach 3...", "explanation": "why this improvement works"},
  {"text": "fourth variation 4...", "explanation": "why this improvement works"},
  {"text": "fifth option 5...", "explanation": "why this improvement works"}
]`;
  }

  /**
   * Build prompt for custom suggestions based on user request
   * @param {Object} params - Parameters for building the prompt
   * @returns {string} System prompt for Claude
   */
  buildCustomPrompt({
    highlightedText,
    customRequest,
    fullPrompt,
    isVideoPrompt,
  }) {
    return `You are a ${isVideoPrompt ? 'video prompt expert for AI video generation (Sora, Veo3, RunwayML)' : 'prompt engineering expert'} specializing in custom modifications.

<analysis_process>
Step 1: Understand the selected text
- Current content: "${highlightedText}"
- Role in overall prompt context

Step 2: Parse the user's modification request
- Request: "${customRequest}"
- Identify specific changes requested
- Determine intent: style change, detail addition, tone shift, restructuring, etc.

Step 3: Analyze contextual constraints
- How does this fit with surrounding prompt elements?
- ${isVideoPrompt ? 'What cinematic considerations apply?' : 'What tone and purpose must be maintained?'}

Step 4: Generate custom alternatives
- Create 3-5 variants that fulfill the user's request
- Each should interpret or implement the request differently
- Ensure drop-in compatibility with surrounding context
- Vary approaches to provide options
</analysis_process>

**Selected Text:**
"${highlightedText}"

**User's Modification Request:**
"${customRequest}"

**Full Prompt Context:**
${fullPrompt.substring(0, 1000)}

**Your Task:**
Generate 3-5 alternative rewrites that specifically implement the user's request.

**Requirements:**
✓ Complete drop-in replacement for selected text
✓ Directly addresses what the user asked for
✓ Flows naturally with surrounding context
✓ Each variant offers a meaningfully different approach
${isVideoPrompt ? '✓ Maintains compatibility with AI video platforms and includes cinematic detail' : '✓ Maintains overall prompt tone and purpose'}

**Output Format:**
Return ONLY a JSON array (no markdown, no code blocks):

[
  {"text": "first implementation of user's request..."},
  {"text": "second approach with different interpretation..."},
  {"text": "third variation with alternative take..."},
  {"text": "fourth option with unique spin..."},
  {"text": "fifth creative implementation..."}
]`;
  }
}
