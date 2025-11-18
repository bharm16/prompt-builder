import {
  buildAnalysisProcessTemplate,
  getElementPromptTemplate,
  VIDEO_PROMPT_PRINCIPLES,
} from '../../config/videoPromptTemplates.js';
import {
  detectDescriptorCategory,
  getCategoryInstruction,
  getCategoryForbidden,
  getAllCategories,
} from './SubjectDescriptorCategories.js';

/**
 * Service responsible for building prompts for AI video generation.
 * Handles all prompt construction logic with context awareness.
 */
export class PromptBuilderService {
  /**
   * Build system prompt for creative suggestions with multi-level context analysis
   */
  buildSystemPrompt({ elementType, currentValue, context, concept }) {
    // Check if this is a subject descriptor
    const isDescriptor = elementType === 'subjectDescriptor';

    // If it's a descriptor, use specialized descriptor prompt
    if (isDescriptor) {
      return this.buildDescriptorPrompt({ currentValue, context, concept });
    }

    const elementLabel =
      elementType === 'subjectDescriptor' ? 'subject descriptor' : elementType;
    const contextDisplay = context ? JSON.stringify(context, null, 2) : 'No other elements defined yet';

    // Perform multi-level context analysis
    const contextAnalysis = {
      immediate: this.analyzeImmediateContext(context),
      thematic: this.extractThematicElements(concept),
      stylistic: this.identifyStylePatterns(context),
      narrative: this.detectNarrativeStructure(concept),
    };

    // Determine if we're completing an existing value or generating fresh suggestions
    const isCompletion = currentValue && currentValue.trim().length > 0;
    const completionMode = isCompletion ? 'COMPLETION' : 'GENERATION';

    const analysisProcess = buildAnalysisProcessTemplate({
      elementLabel,
      currentValue,
      completionMode,
      isCompletion,
      contextDisplay,
      concept,
      contextAnalysis,
    });

    const basePrompt = getElementPromptTemplate({
      elementType,
      isCompletion,
      currentValue,
      contextDisplay,
      concept,
    });

    return `You are a creative video consultant specializing in contextually-aware, visually compelling suggestions.

${VIDEO_PROMPT_PRINCIPLES}

${analysisProcess}

${basePrompt}

**Your Task:**
${isCompletion ?
`🎯 COMPLETION MODE ACTIVE 🎯

The user has already started typing "${currentValue}".
Your ONLY job is to help them COMPLETE this element by adding relevant details.

**CRITICAL COMPLETION RULES:**
✓ ALL 8 suggestions MUST include "${currentValue}"
✓ Build upon what the user typed - don't change the subject/action/location/etc.
✓ Add 2-3 specific, relevant visual details following video prompt guidelines
✓ Each completion should offer a different way to finish the element
✓ Follow all VIDEO PROMPT TEMPLATE PRINCIPLES (specificity, visual details, technical language)

**WRONG (changing the user's input):**
User typed: "abraham lincoln"
❌ "george washington in colonial attire" - WRONG! Different subject!
❌ "thomas jefferson with quill pen" - WRONG! Different subject!
❌ "historical figure from 1800s" - WRONG! Too generic and loses the specific subject!

**RIGHT (completing the user's input):**
User typed: "abraham lincoln"
✓ "abraham lincoln with weathered face and tall stovepipe hat"
✓ "abraham lincoln in period wool coat with weary expression"
✓ "abraham lincoln with distinctive beard holding leather document case"
✓ "abraham lincoln in dimly-lit study with candlelight"

Generate 8 completions following the element-specific guidelines above.`
:
`Generate 8 creative, specific suggestions for this element, following the VIDEO PROMPT TEMPLATE PRINCIPLES above.`}

**Contextual Harmony Requirements:**
✓ If existing context provided, ensure suggestions COMPLEMENT those elements
✓ Maintain thematic consistency across all suggestions
✓ Avoid contradictions (e.g., "underwater" location → don't suggest "race car" subject)
✓ Consider implied tone and style from existing elements
${isCompletion ? `✓ MOST IMPORTANT: Build upon "${currentValue}" - don't suggest completely different options` : ''}

**Examples of Good Contextual Fit:**
- Subject "athlete" → Actions like "parkour vaulting" not "sleeping"
- Location "underwater" → Subjects like "scuba diver" not "race car"
- Mood "tense" → Styles like "high-contrast noir" not "bright cheerful animation"

**Quality Criteria:**
✓ Each suggestion is SHORT and SPECIFIC (2-8 words)
✓ All 8 suggestions are meaningfully different
✓ Explanations clearly show ${isCompletion ? 'how the completion enhances the original input' : 'contextual reasoning'}
✓ Visually evocative and immediately usable
${isCompletion ? `✓ ALL suggestions include "${currentValue}" as the core element` : ''}

**Output Format:**
Return ONLY a JSON array (no markdown, no code blocks):

[
  {"text": "specific suggestion 1", "explanation": "${isCompletion ? 'how this completes the user input while following video prompt principles' : 'why this works with the context'}"},
  {"text": "specific suggestion 2", "explanation": "${isCompletion ? 'how this completes the user input while following video prompt principles' : 'why this works with the context'}"},
  {"text": "specific suggestion 3", "explanation": "${isCompletion ? 'how this completes the user input while following video prompt principles' : 'why this works with the context'}"},
  {"text": "specific suggestion 4", "explanation": "${isCompletion ? 'how this completes the user input while following video prompt principles' : 'why this works with the context'}"},
  {"text": "specific suggestion 5", "explanation": "${isCompletion ? 'how this completes the user input while following video prompt principles' : 'why this works with the context'}"},
  {"text": "specific suggestion 6", "explanation": "${isCompletion ? 'how this completes the user input while following video prompt principles' : 'why this works with the context'}"},
  {"text": "specific suggestion 7", "explanation": "${isCompletion ? 'how this completes the user input while following video prompt principles' : 'why this works with the context'}"},
  {"text": "specific suggestion 8", "explanation": "${isCompletion ? 'how this completes the user input while following video prompt principles' : 'why this works with the context'}"}
]`;
  }

  /**
   * Build specialized prompt for subject descriptors with category awareness
   * @private
   */
  buildDescriptorPrompt({ currentValue, context, concept }) {
    const isCompletion = currentValue && currentValue.trim().length > 0;

    // Detect category from current value or context
    const detection = currentValue ? detectDescriptorCategory(currentValue) : null;
    const categoryHint = detection?.confidence > 0.5 ? detection.category : null;

    // Check if subject exists in context to provide better guidance
    const hasSubject = context?.subject;
    const subjectContext = context?.subject || 'the subject';

    // Build category-aware guidance
    let categoryGuidance = '';
    if (categoryHint) {
      const instruction = getCategoryInstruction(categoryHint);
      const forbidden = getCategoryForbidden(categoryHint);
      categoryGuidance = `\n**🎯 Detected Category: ${categoryHint}** (confidence: ${Math.round(detection.confidence * 100)}%)
${instruction}
${forbidden ? `\n⚠️ ${forbidden}` : ''}
\nFocus suggestions within this category for consistency.\n`;
    } else if (hasSubject) {
      const allCategories = getAllCategories();
      categoryGuidance = `\n**Descriptor Categories Available:**
${allCategories.map(cat => {
  const instruction = getCategoryInstruction(cat);
  return `• **${cat}**: ${instruction}`;
}).join('\n')}

💡 Choose ONE category focus per descriptor for maximum specificity and clarity.\n`;
    }

    return `You are a video prompt expert specializing in rich, specific subject descriptions for AI video generation.

${VIDEO_PROMPT_PRINCIPLES}

${categoryGuidance}

**Context:**
Subject: "${subjectContext}"
${context?.action ? `Action: "${context.action}"` : ''}
${context?.location ? `Location: "${context.location}"` : ''}
${context?.mood ? `Mood: "${context.mood}"` : ''}
${concept ? `\nOverall Concept: "${concept}"` : ''}

**Current Descriptor Value:** ${currentValue ? `"${currentValue}"` : '(empty - fresh suggestions needed)'}

**Your Task:**
Generate 8 ${isCompletion ? 'completions' : 'suggestions'} for this subject descriptor${categoryHint ? ` (${categoryHint} category)` : ''}.

**CRITICAL Requirements:**
✓ 3-8 words per suggestion (concise yet specific)
✓ Directly observable visual details ONLY (what the camera sees)
✓ Each suggestion explores a DIFFERENT approach within ${categoryHint || 'descriptor categories'}
✓ Complement the main subject without redundancy
✓ Film-language specificity (avoid generic descriptions)
✓ Descriptive phrases, not complete sentences
${isCompletion ? `✓ ALL 8 suggestions MUST include "${currentValue}" as the base` : ''}
${categoryHint === 'physical' ? '✓ Focus on observable traits: facial features, body type, distinctive marks' : ''}
${categoryHint === 'wardrobe' ? '✓ Include garment type, material, condition, era markers' : ''}
${categoryHint === 'props' ? '✓ Specify object, material, condition, what they\'re doing with it' : ''}
${categoryHint === 'emotional' ? '✓ Show emotion through visible cues: expression, gaze, body language' : ''}
${categoryHint === 'action' ? '✓ Describe pose, position, or ongoing physical action' : ''}
${categoryHint === 'lighting' ? '✓ Describe light direction, quality, color on the subject specifically' : ''}

**Quality Criteria:**
✓ Specific over generic ("weathered oak walking stick" not "stick")
✓ Visual storytelling (reveals character history through details)
✓ Cinematic language (describes what camera captures)
✓ Avoids redundancy with main subject or other context elements
✓ Each suggestion offers meaningfully different direction
${isCompletion ? `✓ Builds upon "${currentValue}" rather than replacing it` : ''}

**Examples of Strong Descriptors by Category:**
- Physical: "with weathered hands and sun-worn face", "athletic build with broad shoulders"
- Wardrobe: "wearing sun-faded denim jacket", "dressed in vintage 1940s attire"
- Props: "holding worn leather journal", "clutching silver harmonica"
- Emotional: "with weary expression and distant gaze", "eyes reflecting quiet determination"
- Action: "leaning against brick wall", "sitting cross-legged on floor"
- Lighting: "bathed in warm golden light", "face half-shadowed in chiaroscuro"

**Output Format:**
Return ONLY a JSON array (no markdown, no code blocks):

[
  {"text": "descriptor 1", "explanation": "why this adds visual depth to the subject"},
  {"text": "descriptor 2", "explanation": "what this reveals about character/story"},
  {"text": "descriptor 3", "explanation": "how this enhances the scene visually"},
  {"text": "descriptor 4", "explanation": "why this detail matters cinematically"},
  {"text": "descriptor 5", "explanation": "what this contributes to the overall concept"},
  {"text": "descriptor 6", "explanation": "how this complements existing elements"},
  {"text": "descriptor 7", "explanation": "why this specific detail works"},
  {"text": "descriptor 8", "explanation": "what makes this visually compelling"}
]`;
  }

  /**
   * Analyze immediate context for better suggestions
   * @private
   */
  analyzeImmediateContext(context) {
    if (!context) return {};

    return {
      hasSubject: !!context.subject,
      hasLocation: !!context.location,
      hasAction: !!context.action,
      hasMood: !!context.mood,
      elementCount: Object.keys(context).length,
      elements: context,
    };
  }

  /**
   * Extract thematic elements from concept
   * @private
   */
  extractThematicElements(concept) {
    if (!concept) return { themes: [], tone: 'neutral' };

    const themes = [];
    const conceptLower = concept.toLowerCase();

    // Detect common themes
    if (conceptLower.includes('tech') || conceptLower.includes('digital') || conceptLower.includes('cyber')) {
      themes.push('technology');
    }
    if (conceptLower.includes('nature') || conceptLower.includes('forest') || conceptLower.includes('ocean')) {
      themes.push('nature');
    }
    if (conceptLower.includes('urban') || conceptLower.includes('city') || conceptLower.includes('street')) {
      themes.push('urban');
    }
    if (conceptLower.includes('fantasy') || conceptLower.includes('magic') || conceptLower.includes('mystical')) {
      themes.push('fantasy');
    }

    // Detect tone
    let tone = 'neutral';
    if (conceptLower.includes('dark') || conceptLower.includes('mysterious') || conceptLower.includes('ominous')) {
      tone = 'dark';
    } else if (conceptLower.includes('bright') || conceptLower.includes('cheerful') || conceptLower.includes('happy')) {
      tone = 'bright';
    } else if (conceptLower.includes('calm') || conceptLower.includes('peaceful') || conceptLower.includes('serene')) {
      tone = 'calm';
    }

    return { themes, tone };
  }

  /**
   * Identify style patterns from context
   * @private
   */
  identifyStylePatterns(context) {
    if (!context || !context.style) return { style: 'default' };

    const styleLower = context.style.toLowerCase();
    const patterns = {
      cinematic: styleLower.includes('cinematic') || styleLower.includes('film'),
      artistic: styleLower.includes('artistic') || styleLower.includes('abstract'),
      realistic: styleLower.includes('realistic') || styleLower.includes('documentary'),
      animated: styleLower.includes('animated') || styleLower.includes('cartoon'),
      vintage: styleLower.includes('vintage') || styleLower.includes('retro'),
    };

    return patterns;
  }

  /**
   * Detect narrative structure from concept
   * @private
   */
  detectNarrativeStructure(concept) {
    if (!concept) return { hasNarrative: false };

    const narrativeKeywords = ['story', 'journey', 'transformation', 'discovery', 'conflict', 'resolution'];
    const hasNarrative = narrativeKeywords.some(keyword =>
      concept.toLowerCase().includes(keyword)
    );

    return {
      hasNarrative,
      isTransformative: concept.includes('transform') || concept.includes('change'),
      isJourney: concept.includes('journey') || concept.includes('travel'),
      hasConflict: concept.includes('conflict') || concept.includes('versus'),
    };
  }
}
