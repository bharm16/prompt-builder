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

    return `You are an expert prompt engineer specializing in placeholder value suggestion with deep contextual understanding.${
      brainstormSection ? `\n${brainstormSection.trimEnd()}` : ''
    }${constraintInstruction ? `\n${constraintInstruction}` : ''}

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

      return `You are a video prompt expert for AI video generation (Sora, Veo3, RunwayML, Kling, Luma).${
        brainstormSection ? `\n${brainstormSection.trimEnd()}` : ''
      }${categoryEmphasis}

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

    return `You are a prompt engineering expert specializing in clarity, specificity, and actionability.${
      brainstormSection ? `\n${brainstormSection.trimEnd()}` : ''
    }

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
