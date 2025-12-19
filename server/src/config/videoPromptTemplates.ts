interface BuildAnalysisProcessTemplateParams {
  elementLabel: string;
  currentValue: string | null;
  completionMode: string;
  isCompletion: boolean;
  contextDisplay: string;
  concept: string | null;
  contextAnalysis: {
    immediate: Record<string, unknown>;
    thematic: {
      themes: string[];
      tone: string;
    };
    stylistic: Record<string, unknown>;
    narrative: {
      hasNarrative: boolean;
    };
  };
}

interface GetElementPromptTemplateParams {
  elementType: string;
  isCompletion: boolean;
  currentValue: string | null;
  contextDisplay: string;
  concept: string | null;
}

export function buildAnalysisProcessTemplate({
  elementLabel,
  currentValue,
  completionMode,
  isCompletion,
  contextDisplay,
  concept,
  contextAnalysis,
}: BuildAnalysisProcessTemplateParams): string {
  return `<analysis_process>
Step 1: Understand the element type and creative requirements
- Element: ${elementLabel}
- Current value: ${currentValue || 'Not set - starting fresh'}
- Mode: ${completionMode} ${isCompletion ? '(help complete this partial input)' : '(generate fresh suggestions)'}
- What makes this element type visually compelling?

Step 2: Analyze existing context at multiple levels
- Context: ${contextDisplay}
- Concept: ${concept || 'Building from scratch'}
- Immediate context: ${JSON.stringify(contextAnalysis.immediate)}
- Thematic elements: ${JSON.stringify(contextAnalysis.thematic)}
- Style patterns: ${JSON.stringify(contextAnalysis.stylistic)}
- Narrative structure: ${JSON.stringify(contextAnalysis.narrative)}

Step 3: Ensure contextual harmony
- Do suggestions complement existing elements?
- Is there thematic consistency with detected themes: ${contextAnalysis.thematic.themes.join(', ') || 'none'}?
- Do suggestions match the tone: ${contextAnalysis.thematic.tone}?
- Do suggestions avoid contradicting established context?
${isCompletion ? `- CRITICAL: All suggestions must BUILD UPON the current value: "${currentValue}"` : ''}

Step 4: ${isCompletion ? 'Complete the partial input' : 'Maximize creative diversity'}
${isCompletion ? `- All 8 suggestions MUST start with or include: "${currentValue}"
- Add 2-3 relevant visual details that complete the element
- Maintain the user's intent while following video prompt guidelines
- Each completion should offer a different way to finish the element` : `- Generate 8 distinct, specific options
- Vary tone, style, intensity, and approach
- Each should offer a meaningfully different creative direction
- Ensure all are immediately usable and visually evocative`}
- Consider narrative elements: ${contextAnalysis.narrative.hasNarrative ? 'narrative flow important' : 'standalone elements'}
</analysis_process>`;
}

export function getElementPromptTemplate({
  elementType,
  isCompletion,
  currentValue,
  contextDisplay,
  concept,
}: GetElementPromptTemplateParams): string {
  const prompts: Record<string, string> = {
    subject: `${isCompletion ? 'COMPLETE' : 'Generate creative suggestions for'} the SUBJECT/CHARACTER of a video.

Context: ${contextDisplay}
Full concept: ${concept || 'User is building from scratch'}
Current value: ${currentValue || 'Not set'}

${isCompletion ? `COMPLETION MODE: The user has started typing "${currentValue}".
Your task is to provide 8 ways to COMPLETE this subject by adding 2-3 relevant visual details.

CRITICAL RULES FOR COMPLETION:
✓ ALL 8 suggestions MUST start with or include "${currentValue}"
✓ Add 2-3 specific, relevant visual details that complete the description
✓ Stay true to the subject the user has indicated
✓ Follow video prompt principles (specific, visual, what camera can see)

EXAMPLES (if user typed "abraham lincoln"):
✓ "abraham lincoln with weathered face and tall stovepipe hat"
✓ "abraham lincoln in period wool coat with weary eyes"
✓ "abraham lincoln with distinctive beard holding leather document case"
✗ "george washington" (different subject - NOT completing the input)
✗ "thomas jefferson" (different subject - NOT completing the input)` : `Provide 8 diverse, creative subjects that would make compelling video content. Consider:
- People (with 2-3 distinctive visual details: "elderly street musician with weathered hands and silver harmonica")
- Products (specific make/model with visual characteristics: "matte black DJI drone with amber LED lights")
- Animals (species + behavior/appearance: "bengal cat with spotted coat stalking prey")
- Objects (with texture/material details: "antique brass compass with worn patina")
- Abstract concepts (visualized with specific metaphors: "time visualized as golden sand particles")`}

Apply VIDEO PROMPT PRINCIPLES:
✓ SPECIFIC not generic: "weathered leather journal" not "old book"
✓ 2-3 distinctive visual details
✓ Describe what camera can SEE
✓ Use professional terminology where appropriate

Each suggestion should be SHORT (2-8 words) and visually evocative.`,

    subjectDescriptor: `${isCompletion ? 'COMPLETE' : 'Generate creative suggestions for'} a SUBJECT DESCRIPTOR that augments the main subject without repeating it.

Context: ${contextDisplay}
Full concept: ${concept || 'User is building from scratch'}
Current descriptor: ${currentValue || 'Not set'}

${isCompletion ? `COMPLETION MODE: The user started typing "${currentValue}".
Provide 8 completions that KEEP this phrasing and add 2-4 more vivid details.

CRITICAL RULES:
✓ ALWAYS keep the subject implied (do NOT restate their name or pronouns)
✓ Start with a connector like "with", "wearing", "holding", "bathed in", "surrounded by"
✓ 4-12 words long, packed with visual detail the camera can see
✓ No leading commas or trailing punctuation
✓ Focus on tangible, cinematic cues (texture, motion, lighting, objects)` : `Provide 8 distinct descriptor phrases that can attach to a subject.

CRITICAL RULES:
✓ Start with connectors such as "with", "wearing", "holding", "bathed in", "surrounded by"
✓ Never restate the subject itself – describe visual traits only
✓ 4-12 words, cinematic, highly specific
✓ Mix physical attributes, wardrobe, props, lighting, emotional cues
✓ Each descriptor must stand alone and feel different from the others`}

VIDEO PROMPT PRINCIPLES:
✓ Describe only what the camera can SEE
✓ Use tactile textures, motion, lighting, or objects
✓ Keep language concise but rich
✓ Avoid generic adjectives ("nice", "cool")
✓ No pronouns ("they", "their"); keep impersonal

Return 8 descriptors as short phrases ready to append to a subject.`,

    action: `${isCompletion ? 'COMPLETE' : 'Generate creative suggestions for'} the ACTION/ACTIVITY in a video.

Context: ${contextDisplay}
Full concept: ${concept || 'User is building from scratch'}
Current value: ${currentValue || 'Not set'}

${isCompletion ? `COMPLETION MODE: The user has started typing "${currentValue}".
Your task is to provide 8 ways to COMPLETE this action with specific, visual details.

CRITICAL RULES FOR COMPLETION:
✓ ALL 8 suggestions MUST start with or include "${currentValue}"
✓ Add specific details about HOW the action is performed
✓ Include manner, intensity, or visual characteristics
✓ Follow ONE MAIN ACTION rule (don't add multiple actions)
✓ Stay true to the action the user has indicated

EXAMPLES (if user typed "jumping"):
✓ "jumping over concrete barriers in slow motion"
✓ "jumping through ring of fire with dramatic backlight"
✓ "jumping between rooftops with rain-slicked surfaces"
✗ "running and diving" (changed the action - NOT completing the input)
✗ "dancing energetically" (different action - NOT completing the input)` : `Provide 8 dynamic, visual actions that work well in video. Consider:
- Physical movement (with specific manner: "sprinting through rain-slicked alley")
- Transformation (with visible process: "ink dissolving into clear water")
- Interaction (with object details: "catching spinning basketball mid-air")
- Performance (with technique: "playing cello with aggressive bow strokes")
- Natural phenomena (with visual progression: "ice crystallizing across window pane")`}

CRITICAL - Apply ONE MAIN ACTION RULE:
✓ ONE clear, specific action only (not "running, jumping, and spinning")
✓ "leaping over concrete barriers" not "parkour routine with flips and spins"
✓ Optimal for 4-8 second clips
✓ Physically plausible and visually clear

Use CINEMATIC terminology: "slow dolly in", "rack focus", "tracking shot".
Each action should be SHORT (2-8 words) and immediately visualizable.`,

    location: `${isCompletion ? 'COMPLETE' : 'Generate creative suggestions for'} the LOCATION/SETTING of a video.

Context: ${contextDisplay}
Full concept: ${concept || 'User is building from scratch'}
Current value: ${currentValue || 'Not set'}

${isCompletion ? `COMPLETION MODE: The user has started typing "${currentValue}".
Your task is to provide 8 ways to COMPLETE this location with atmospheric details.

CRITICAL RULES FOR COMPLETION:
✓ ALL 8 suggestions MUST start with or include "${currentValue}"
✓ Add specific environmental details, lighting, or atmosphere
✓ Include architectural features, weather, or distinctive characteristics
✓ Stay true to the location type the user has indicated

EXAMPLES (if user typed "tokyo street"):
✓ "tokyo street at night with neon signs reflecting on wet pavement"
✓ "tokyo street during rush hour with crowds and bright billboards"
✓ "tokyo street in shibuya with massive digital displays overhead"
✗ "new york alley" (different location - NOT completing the input)
✗ "paris boulevard" (different location - NOT completing the input)` : `Provide 8 visually interesting locations. Consider:
- Urban environments (specific types of streets, buildings, infrastructure)
- Natural settings (specific landscapes, weather conditions, times of day)
- Interior spaces (architectural styles, purposes, atmospheres)
- Unusual/creative settings (underwater, in space, abstract void, miniature world)
- Cultural/historical settings (specific eras, cultures, styles)`}

Each location should be SPECIFIC and EVOCATIVE. Not "a building" but "abandoned Victorian warehouse with shattered skylights".`,

    time: `${isCompletion ? 'COMPLETE' : 'Generate creative suggestions for'} the LIGHTING/TIME-OF-DAY description.

Context: ${contextDisplay}
Full concept: ${concept || 'User is building from scratch'}
Current value: ${currentValue || 'Not set'}

${isCompletion ? `COMPLETION MODE: The user has started typing "${currentValue}".
Your task is to provide 8 ways to COMPLETE this lighting/time description with specific qualities.

CRITICAL RULES FOR COMPLETION:
✓ ALL 8 suggestions MUST start with or include "${currentValue}"
✓ Add lighting quality, atmospheric conditions, or visual characteristics
✓ Include specific details about light direction, color, or intensity
✓ Stay true to the time/period the user has indicated

EXAMPLES (if user typed "golden hour"):
✓ "golden hour with warm backlight and long shadows"
✓ "golden hour at sunset with orange sky and soft diffused light"
✓ "golden hour in late afternoon with amber glow filtering through trees"
✗ "blue hour dusk" (different time - NOT completing the input)
✗ "midday sun" (different time - NOT completing the input)` : `Provide 8 specific time/lighting conditions that create visual interest:
- Time of day (golden hour, blue hour, high noon, midnight, dawn, dusk)
- Historical period (specific eras with visual characteristics)
- Season (spring bloom, autumn colors, winter frost, summer haze)
- Weather timing (during storm, after rain, before sunset)
- Future/past (specific sci-fi or period aesthetics)`}

Each suggestion should specify LIGHTING and MOOD implications. Not just "morning" but "early morning mist with low golden sun".`,

    mood: `${isCompletion ? 'COMPLETE' : 'Generate creative suggestions for'} the MOOD/ATMOSPHERE of a video.

Context: ${contextDisplay}
Full concept: ${concept || 'User is building from scratch'}
Current value: ${currentValue || 'Not set'}

${isCompletion ? `COMPLETION MODE: The user has started typing "${currentValue}".
Your task is to provide 8 ways to COMPLETE this mood with specific visual and atmospheric details.

CRITICAL RULES FOR COMPLETION:
✓ ALL 8 suggestions MUST start with or include "${currentValue}"
✓ Add visual qualities, color implications, or lighting characteristics
✓ Include specific details about energy, texture, or sensory qualities
✓ Stay true to the mood the user has indicated

EXAMPLES (if user typed "tense"):
✓ "tense with high-contrast shadows and sharp angles"
✓ "tense atmosphere with cold blue lighting and tight framing"
✓ "tense with low-key lighting and ominous undertones"
✗ "peaceful and calm" (opposite mood - NOT completing the input)
✗ "joyful energy" (different mood - NOT completing the input)` : `Provide 8 distinct moods/atmospheres. Consider:
- Emotional tones (melancholic, joyful, tense, peaceful, mysterious)
- Energy levels (frenetic, languid, pulsing, static, building)
- Sensory qualities (warm, cold, harsh, soft, textured)
- Narrative feelings (nostalgic, foreboding, hopeful, triumphant)
- Abstract atmospheres (dreamlike, surreal, hyperreal, gritty)`}

Each mood should be SPECIFIC and suggest visual/color implications. Not "happy" but "warm, golden nostalgia like a faded photograph".`,

    style: `${isCompletion ? 'COMPLETE' : 'Generate creative suggestions for'} the VISUAL STYLE of a video.

Context: ${contextDisplay}
Full concept: ${concept || 'User is building from scratch'}
Current value: ${currentValue || 'Not set'}

${isCompletion ? `COMPLETION MODE: The user has started typing "${currentValue}".
Your task is to provide 8 ways to COMPLETE this visual style with specific technical details.

CRITICAL RULES FOR COMPLETION:
✓ ALL 8 suggestions MUST start with or include "${currentValue}"
✓ Add technical specifications like lens, film stock, lighting, or color grading
✓ Include specific visual characteristics or aesthetic references
✓ Stay true to the style the user has indicated
✓ Avoid generic terms - be technically specific

EXAMPLES (if user typed "film noir"):
✓ "film noir with high-contrast shadows and Rembrandt lighting"
✓ "film noir aesthetic shot on 35mm with deep blacks and venetian blind shadows"
✓ "film noir style with low-key lighting and Dutch angles"
✗ "bright colorful animation" (opposite style - NOT completing the input)
✗ "documentary realism" (different style - NOT completing the input)` : `Provide 8 distinct visual styles using SPECIFIC references (NOT generic):
- Film stock/format: "shot on 35mm film", "Super 8 footage with light leaks", "16mm Kodak Vision3"
- Genre aesthetics: "film noir with high-contrast shadows", "documentary verité style", "French New Wave aesthetic"
- Director/cinematographer style: "in the style of Wes Anderson", "Roger Deakins naturalism", "Christopher Doyle neon-lit"
- Art movements: "German Expressionist angles", "Italian Neorealism rawness"
- Technical processes: "anamorphic lens flares", "tilt-shift miniature effect", "infrared color spectrum"`}

CRITICAL - Avoid generic terms:
✗ "cinematic" → ✓ "shot on 35mm film with shallow depth of field"
✗ "artistic" → ✓ "impressionist soft focus with pastel color palette"
✗ "moody" → ✓ "film noir aesthetic with Rembrandt lighting"

Each suggestion should include TECHNICAL implications (film stock, lens type, color grading, etc.).`,

    event: `${isCompletion ? 'COMPLETE' : 'Generate creative suggestions for'} the EVENT/CONTEXT of a video.

Context: ${contextDisplay}
Full concept: ${concept || 'User is building from scratch'}
Current value: ${currentValue || 'Not set'}

${isCompletion ? `COMPLETION MODE: The user has started typing "${currentValue}".
Your task is to provide 8 ways to COMPLETE this event/context with narrative details.

CRITICAL RULES FOR COMPLETION:
✓ ALL 8 suggestions MUST start with or include "${currentValue}"
✓ Add narrative purpose, dramatic structure, or contextual details
✓ Include specific details about the moment, progression, or payoff
✓ Stay true to the event type the user has indicated

EXAMPLES (if user typed "product reveal"):
✓ "product reveal with dramatic build-up and lighting change"
✓ "product reveal moment with slow rotation and spotlight effect"
✓ "product reveal featuring close-up details and technical specifications"
✗ "chase sequence" (different event - NOT completing the input)
✗ "celebration party" (different event - NOT completing the input)` : `Provide 8 specific events or contexts. Consider:
- Commercial contexts (product launch, demonstration, unboxing, reveal)
- Narrative events (discovery, transformation, conflict, resolution)
- Celebrations (specific types of parties, ceremonies, milestones)
- Processes (creation, destruction, assembly, metamorphosis)
- Abstract contexts (dream sequence, memory, vision, imagination)`}

Each event should provide NARRATIVE PURPOSE. Not "something happening" but "product reveal with dramatic build-up and payoff".`,
  };

  return prompts[elementType] || prompts.subject;
}

export const VIDEO_PROMPT_PRINCIPLES = `
**VIDEO PROMPT TEMPLATE PRINCIPLES (Use these as your baseline):**
These principles are from our production-ready video prompt template and should guide all suggestions:

1. **Specificity Over Generic**: "a weathered oak desk" is superior to "a nice desk"
   - Use concrete, visual details
   - Include 2-3 distinctive characteristics
   - Avoid vague adjectives

2. **Cinematic Language**: Use professional film terminology
   - Camera: dolly, crane, rack focus, shallow DOF, f/1.8
   - Lighting: Rembrandt lighting, 3:1 contrast, soft window light
   - Style: shot on 35mm film, film noir aesthetic, in the style of [director]

3. **One Main Action Rule**: Multiple actions severely degrade quality
   - Focus on ONE clear, specific, physically plausible action
   - "leaping over obstacles in slow motion" not "running, jumping, and spinning"

4. **Visual Precedence**: Describe only what the camera can SEE
   - Translate emotions into visible actions/environmental details
   - "elderly historian with trembling hands" not "a sad old person"

5. **Element Order = Priority**: First elements get processed first by AI
   - Most important visual element should come first
   - Shot type establishes composition
   - Subject defines focus
   - Action creates movement

6. **Duration Context**: Optimal clips are 4-8 seconds
   - Keep actions simple and clear
   - Avoid complex narratives (use multiple clips instead)

7. **Style References**: Avoid generic terms like "cinematic"
   - Use film stock: "shot on 35mm film", "Super 8 footage"
   - Use genre: "film noir aesthetic", "documentary realism"
   - Use director references: "in the style of Wes Anderson"
`;

