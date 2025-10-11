import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { validateEnv } from './utils/validateEnv.js';
import {
  promptSchema,
  suggestionSchema,
  customSuggestionSchema,
  sceneChangeSchema,
  creativeSuggestionSchema,
} from './utils/validation.js';

dotenv.config();

// Validate environment variables at startup
try {
  validateEnv();
} catch (error) {
  console.error('❌ Environment validation failed:', error.message);
  console.error(
    'Please check your .env file. See .env.example for required variables.'
  );
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3001;
const CLAUDE_TIMEOUT = parseInt(process.env.CLAUDE_TIMEOUT_MS) || 30000;

// Helper function to make Claude API calls with timeout
async function callClaudeAPI(systemPrompt, maxTokens = 4096) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CLAUDE_TIMEOUT);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.VITE_ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: maxTokens,
        messages: [
          {
            role: 'user',
            content: systemPrompt,
          },
        ],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`API request failed: ${errorData}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout - Claude API took too long to respond');
    }
    throw error;
  }
}

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP',
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // max 10 Claude API calls per minute
  message: 'Too many API requests, please try again later',
});

app.use('/api/', apiLimiter);

// Configure CORS properly
app.use(
  cors({
    origin:
      process.env.NODE_ENV === 'production'
        ? [process.env.FRONTEND_URL || 'https://yourdomain.com']
        : ['http://localhost:5173', 'http://localhost:5174'],
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));

app.post('/api/optimize', async (req, res) => {
  console.log('📥 Received /api/optimize request');
  console.log('📦 Request body:', JSON.stringify(req.body, null, 2));

  // Validate request body
  const { error, value } = promptSchema.validate(req.body);
  if (error) {
    console.error('❌ Validation error:', error.details[0].message);
    console.error('❌ Request body was:', JSON.stringify(req.body, null, 2));
    return res.status(400).json({
      error: 'Validation failed',
      details: error.details[0].message,
    });
  }

  const { prompt, mode, context } = value;

  let systemPrompt = '';

  if (mode === 'reasoning') {
    systemPrompt = `You are optimizing prompts for reasoning models. These models think deeply before responding, so the prompt should be clear and direct without over-structuring their reasoning process.

Transform this query into an optimized reasoning prompt:

**Task**
[Clear, concise problem statement - what needs to be solved or understood]

**Key Constraints**
[Important limitations, requirements, or parameters]

**Success Criteria**
[How to evaluate if the solution/answer is good]

**Reasoning Guidance** (optional)
[Only if needed: "Consider edge cases", "Think about tradeoffs", "Verify assumptions"]

Query: "${prompt}"

IMPORTANT: Keep it minimal. Trust the reasoning model to think deeply. Only add structure where it clarifies the problem. Ensure the optimized prompt is self-contained and can be used directly without further editing.

Provide ONLY the optimized prompt in the specified format. No preamble, no explanation, no meta-commentary about what you're doing.`;
  } else if (mode === 'research') {
    systemPrompt = `You are a research methodology expert. Transform this into a comprehensive research plan:

**Research Objective**
[Clear statement of what needs to be investigated]

**Core Research Questions**
[5-7 specific, answerable questions in priority order]

**Methodology**
[Research approach and methods to be used]

**Information Sources**
[Specific types of sources with quality criteria]

**Success Metrics**
[How to determine if research is sufficient]

**Synthesis Framework**
[How to analyze and integrate findings across sources]

**Deliverable Format**
[Structure and style of the final output]

**Anticipated Challenges**
[Potential obstacles and mitigation strategies]

Query: "${prompt}"

Make this actionable and specific. Ensure the research plan is self-contained and can be used directly without further editing.

Provide ONLY the research plan in the specified format. No preamble, no explanation, no meta-commentary about what you're doing.`;
  } else if (mode === 'socratic') {
    systemPrompt = `You are a Socratic learning guide. Create a learning journey through strategic questioning:

**Learning Objective**
[What the learner should understand by the end]

**Prior Knowledge Check**
[2-3 questions to assess current understanding]

**Foundation Questions**
[3-4 questions building core concepts]

**Deepening Questions**
[4-5 questions that progressively challenge understanding]

**Application & Synthesis**
[3-4 questions connecting concepts to real scenarios]

**Metacognitive Reflection**
[2-3 questions about the learning process itself: "What surprised you?", "What's still unclear?"]

**Common Misconceptions**
[2-3 misconceptions to address through questioning]

**Extension Paths**
[Suggested directions for continued exploration]

Topic: "${prompt}"

Focus on questions that spark insight, not just recall. Ensure the learning plan is self-contained and can be used directly without further editing.

Provide ONLY the learning plan in the specified format. No preamble, no explanation, no meta-commentary about what you're doing.`;
  } else if (mode === 'video') {
    systemPrompt = `You are an expert cinematographer and creative director specializing in AI video generation (Sora, Veo3, RunwayML, Kling, Luma, etc.). Transform this video concept into an ultra-detailed, production-ready video generation prompt with ultimate creative control.

User's video concept: "${prompt}"

Create a comprehensive video prompt with the following structure:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎬 CREATIVE FOUNDATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**WHO - SUBJECT/CHARACTER** [Define the focal point]
- Physical Description: [Age, appearance, clothing, distinctive features]
- Character State: [Emotion, energy level, physical condition]
- Positioning: [Where in frame, relationship to camera]
- Scale: [Close-up details vs full body vs environment dominance]
- Identity/Role: [Professional, archetype, or narrative function]
- Expression: [Facial expression, body language, mood indicators]
- Interaction: [Engaging with environment, objects, or other subjects]

**WHAT - ACTION/ACTIVITY** [Define the movement and narrative]
- Primary Action: [Main activity happening in frame]
- Motion Type: [Dynamic/static, fluid/jerky, fast/slow]
- Action Arc: [Beginning state → transformation → end state]
- Intensity: [Subtle gesture vs dramatic movement]
- Rhythm: [Pacing, beats, moments of stillness vs activity]
- Secondary Actions: [Background movement, environmental dynamics]
- Cause & Effect: [Actions triggering reactions or changes]

**WHERE - LOCATION/SETTING** [Define the environment]
- Environment Type: [Interior/exterior, natural/built, real/abstract]
- Architectural Details: [Structures, surfaces, spatial layout]
- Environmental Scale: [Intimate space vs vast landscape]
- Atmospheric Conditions: [Weather, air quality, particles, fog, haze]
- Background Elements: [What fills negative space, depth layers]
- Foreground Elements: [Objects between camera and subject]
- Spatial Depth: [How far can we see, layers of depth]
- Environmental Storytelling: [What the location reveals about context]

**WHEN - TIME/PERIOD/LIGHTING** [Define temporal and light context]
- Time of Day: [Dawn, morning, noon, golden hour, dusk, night, etc.]
- Lighting Quality: [Hard/soft, warm/cool, natural/artificial]
- Light Direction: [Front-lit, back-lit, side-lit, top-lit, under-lit]
- Light Color: [Specific color temperatures, tints, color casts]
- Shadow Character: [Long/short, sharp/diffused, presence/absence]
- Temporal Period: [Historical era, futuristic, timeless, anachronistic]
- Time Progression: [Static moment vs visible time passing]
- Seasonal Markers: [Visual indicators of season if relevant]

**WHY - EVENT/CONTEXT/PURPOSE** [Define narrative and intent]
- Narrative Context: [What story moment is this]
- Emotional Purpose: [What should viewer feel]
- Visual Objective: [What should draw attention]
- Conceptual Theme: [Abstract idea being expressed]
- Commercial Intent: [If product/brand video - key message]
- Audience Consideration: [Who is this for, what do they expect]
- Symbolic Elements: [Metaphors, visual poetry, subtext]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎥 CINEMATOGRAPHY & TECHNICAL EXECUTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**CAMERA - SETUP & PERSPECTIVE**
- Lens Choice: [Wide/normal/telephoto, focal length implications]
- Depth of Field: [Shallow/deep, what's in/out of focus]
- Focal Point: [Exact point of sharpest focus]
- Camera Height: [Ground level/eye level/high angle/overhead]
- Camera Angle: [Straight-on/Dutch tilt/canted angle]
- Perspective: [First-person POV/third-person/aerial/macro/etc.]
- Frame Composition: [Rule of thirds, centered, off-balance, etc.]

**CAMERA - MOVEMENT & DYNAMICS**
- Movement Type: [Static/locked-off, handheld, Steadicam, drone]
- Camera Motion: [Pan, tilt, dolly, track, crane, orbit, zoom]
- Movement Speed: [Slow creep, steady glide, rapid whip]
- Movement Motivation: [Motivated by action, reveal, or aesthetic]
- Stabilization: [Smooth/fluid vs intentional shake/energy]
- Complex Moves: [Combination movements, transitions mid-shot]
- Movement Start/End: [How movement begins and concludes]

**LIGHTING - DESIGN & MOOD**
- Primary Light Source: [Sun, window, practical, artificial, etc.]
- Fill Light: [Presence, intensity, direction, color]
- Accent/Rim Lighting: [Edge definition, separation from background]
- Practical Lights: [Visible light sources in scene]
- Light Intensity: [Bright/exposed vs dark/moody vs balanced]
- Light Contrast: [High contrast vs low contrast vs flat]
- Shadows: [Quality, length, direction, storytelling role]
- Light Behavior: [Static, flickering, moving, pulsing, changing]

**COLOR - GRADING & PALETTE**
- Overall Color Grade: [Warm/cool, saturated/desaturated, etc.]
- Primary Color Palette: [2-3 dominant colors in frame]
- Color Contrast: [Complementary, analogous, monochrome]
- Color Temperature: [Specific Kelvin values or relative warmth]
- Color Mood: [Emotional associations of color choices]
- Color Symbolism: [Intentional color meaning]
- Skin Tones: [Natural, stylized, specific rendering]
- Color Transitions: [How colors shift through duration]

**MOTION - DYNAMICS & TEMPORAL EFFECTS**
- Subject Speed: [Real-time, slow-motion, time-lapse, speed ramping]
- Frame Rate Intent: [Cinematic 24fps, smooth 60fps, etc.]
- Motion Blur: [Natural, enhanced, frozen/sharp]
- Temporal Effects: [Freeze frames, stutter effects, reverse]
- Rhythm & Pacing: [Beat, tempo, breathing room vs intensity]
- Action Choreography: [Specific blocking and movement patterns]
- Momentum: [Building energy vs winding down vs constant]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ SCENE SYNTHESIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**PRIMARY PROMPT** [150-300 words]
[Synthesize all above elements into ONE cohesive, vivid, flowing description that reads naturally while incorporating specific technical and creative details. This should feel like a cinematographer describing their vision, not a checklist. Prioritize the most important creative and technical aspects.]

**TECHNICAL PARAMETERS**
- Duration: [Recommended clip length, e.g., 5s, 10s, 15s]
- Aspect Ratio: [16:9, 9:16, 1:1, 2.39:1, etc.]
- Visual Style: [Cinematic, documentary, commercial, anime, etc.]
- Reference Aesthetic: [Film stock, era, or visual movement if relevant]

**ALTERNATIVE DIRECTIONS** [3 distinct creative variations]

Version A - [One sentence describing creative pivot]
[75-150 word alternative that changes key creative elements while maintaining concept]

Version B - [One sentence describing creative pivot]
[75-150 word alternative that explores different mood/style/approach]

Version C - [One sentence describing creative pivot]
[75-150 word alternative with bold creative departure]

**PLATFORM OPTIMIZATION**
- Best For: [Which AI video platforms suit this prompt - Sora/Veo3/RunwayML/etc.]
- Platform-Specific Tips: [Any syntax, token limits, or optimization notes]
- Compatibility Notes: [Elements that may need adjustment per platform]

**REFINEMENT GUIDANCE** [What user might want to adjust]
- Tone Adjustments: [Suggestions for shifting mood/atmosphere]
- Technical Tweaks: [Camera, lighting, or movement refinements]
- Narrative Variations: [Story/concept pivots to explore]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**IMPORTANT CREATIVE PRINCIPLES:**
1. Be hyper-specific about visual details while maintaining narrative flow
2. Balance technical precision with creative emotion
3. Consider how every element supports the central vision
4. Provide enough detail for consistency without over-constraining AI creativity
5. Ensure primary prompt feels cinematic and inspired, not mechanical
6. Make alternatives meaningfully different, not just minor tweaks
7. Think like a director AND a cinematographer

Provide ONLY the video prompt package in this format. No preamble, no explanation, no meta-commentary. Go directly into the structured template.`;
  } else {
    // Default optimize mode
    systemPrompt = `You are a prompt engineering expert. Transform this rough prompt into a clear, effective prompt:

**Goal**
[Single sentence stating what the prompt aims to achieve]

**Context**
[Essential background information and assumptions about the task/user]

**Requirements**
[Specific constraints, format requirements, or must-have elements]

**Instructions**
[Step-by-step guidance on how to approach the task, if applicable]

**Success Criteria**
[How to evaluate if the response is good]

**Output Format**
[Exact structure the response should follow]

**Examples** (if helpful)
[Brief example showing desired output style]

**Avoid**
[Common pitfalls or things to explicitly not do]

Original prompt: "${prompt}"

Create a prompt that's self-contained and immediately usable. Ensure the optimized prompt can be used directly without further editing.

Provide ONLY the optimized prompt in the specified format. No preamble, no explanation, no meta-commentary about what you're doing.`;
  }

  // Add context enhancement if provided
  if (context && Object.keys(context).some((k) => context[k])) {
    systemPrompt +=
      '\n\n**IMPORTANT - User has provided additional context:**\n';
    systemPrompt +=
      'The user has provided additional context. Incorporate this into the optimized prompt:\n\n';

    if (context.specificAspects) {
      systemPrompt += `**Specific Focus Areas:** ${context.specificAspects}\n`;
      systemPrompt +=
        'Make sure the optimized prompt explicitly addresses these aspects.\n\n';
    }

    if (context.backgroundLevel) {
      systemPrompt += `**Target Audience Level:** ${context.backgroundLevel}\n`;
      systemPrompt +=
        'Adjust the complexity and terminology to match this level.\n\n';
    }

    if (context.intendedUse) {
      systemPrompt += `**Intended Use Case:** ${context.intendedUse}\n`;
      systemPrompt += 'Format the prompt to suit this specific use case.\n\n';
    }
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.VITE_ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: systemPrompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('API Error:', errorData);
      return res
        .status(response.status)
        .json({ error: 'API request failed', details: errorData });
    }

    const data = await response.json();
    const optimizedText = data.content[0].text;

    // Basic validation - check for meta-commentary
    if (
      optimizedText.toLowerCase().includes('here is') ||
      optimizedText.toLowerCase().includes("i've created") ||
      optimizedText.toLowerCase().startsWith('sure')
    ) {
      console.warn(
        '⚠️  Response contains meta-commentary, may need refinement'
      );
    }

    res.json({ optimizedPrompt: optimizedText });
  } catch (error) {
    console.error('Server error:', error);
    res
      .status(500)
      .json({ error: 'Internal server error', message: error.message });
  }
});

app.post('/api/generate-questions', async (req, res) => {
  const { prompt } = req.body;

  console.log('📥 Received generate-questions request for:', prompt);

  if (!prompt) {
    console.log('❌ No prompt provided');
    return res.status(400).json({ error: 'Prompt is required' });
  }

  const systemPrompt = `You are an expert at understanding user intent and generating relevant clarifying questions.

Given the user's initial prompt: "${prompt}"

Generate 3 highly relevant, context-specific questions that will help improve and clarify this prompt. The questions should:

1. Be directly relevant to the specific content and intent of the user's prompt
2. Help uncover important details, constraints, or preferences
3. Be natural and conversational
4. Include 3-4 example answers for each question

Return ONLY a valid JSON object in this exact format (no markdown, no code blocks, no explanations):

{
  "questions": [
    {
      "id": 1,
      "title": "Context-specific question about the main focus or key details?",
      "description": "Why this question matters for this specific prompt",
      "field": "specificAspects",
      "examples": [
        "Example answer 1",
        "Example answer 2",
        "Example answer 3",
        "Example answer 4"
      ]
    },
    {
      "id": 2,
      "title": "Question about audience, expertise level, or background?",
      "description": "Why this matters for tailoring the response",
      "field": "backgroundLevel",
      "examples": [
        "Example answer 1",
        "Example answer 2",
        "Example answer 3"
      ]
    },
    {
      "id": 3,
      "title": "Question about purpose, use case, or intended outcome?",
      "description": "Why understanding this helps",
      "field": "intendedUse",
      "examples": [
        "Example answer 1",
        "Example answer 2",
        "Example answer 3"
      ]
    }
  ]
}`;

  try {
    console.log('🤖 Calling Claude API to generate questions...');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.VITE_ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: systemPrompt,
          },
        ],
      }),
    });

    console.log('📡 Claude API response status:', response.status);

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ Claude API Error:', errorData);
      return res
        .status(response.status)
        .json({ error: 'API request failed', details: errorData });
    }

    const data = await response.json();
    let questionsText = data.content[0].text;

    console.log('📝 Raw Claude response:', questionsText.slice(0, 200) + '...');

    // Clean up response - remove markdown code blocks if present
    questionsText = questionsText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const questionsData = JSON.parse(questionsText);

    console.log(
      '✅ Successfully parsed questions:',
      questionsData.questions?.length,
      'questions'
    );

    res.json(questionsData);
  } catch (error) {
    console.error('❌ Server error:', error);
    res
      .status(500)
      .json({ error: 'Internal server error', message: error.message });
  }
});

// Helper function to detect if highlighted text is a placeholder
function detectPlaceholder(
  highlightedText,
  contextBefore,
  contextAfter,
  fullPrompt
) {
  const text = highlightedText.toLowerCase().trim();

  // Pattern 1: Single word that's commonly a placeholder
  const placeholderKeywords = [
    'location',
    'place',
    'venue',
    'setting',
    'where',
    'person',
    'character',
    'who',
    'speaker',
    'audience',
    'time',
    'when',
    'date',
    'period',
    'era',
    'occasion',
    'style',
    'tone',
    'mood',
    'atmosphere',
    'event',
    'action',
    'activity',
    'scene',
    'color',
    'texture',
    'material',
    'angle',
    'perspective',
    'viewpoint',
  ];

  if (text.split(/\s+/).length <= 2 && placeholderKeywords.includes(text)) {
    return true;
  }

  // Pattern 2: Text in parentheses or brackets
  if (
    contextBefore.includes('(') ||
    contextAfter.startsWith(')') ||
    contextBefore.includes('[') ||
    contextAfter.startsWith(']')
  ) {
    return true;
  }

  // Pattern 3: Preceded by phrases like "such as", "like", "e.g.", "for example"
  const precedingPhrases = [
    'such as',
    'like',
    'e.g.',
    'for example',
    'including',
    'specify',
  ];
  if (
    precedingPhrases.some((phrase) =>
      contextBefore.toLowerCase().includes(phrase)
    )
  ) {
    return true;
  }

  // Pattern 4: In a list or comma-separated context suggesting it's a placeholder
  if (
    (contextBefore.includes(':') || contextBefore.includes('-')) &&
    text.split(/\s+/).length <= 3
  ) {
    return true;
  }

  // Pattern 5: Part of "include [word]" or "set [word]" pattern
  const includePattern =
    /\b(include|set|choose|specify|add|provide|give)\s+[^,\n]{0,20}$/i;
  if (includePattern.test(contextBefore)) {
    return true;
  }

  return false;
}

app.post('/api/get-enhancement-suggestions', async (req, res) => {
  console.log('📥 Received /api/get-enhancement-suggestions request');
  console.log('📦 Request body keys:', Object.keys(req.body));

  // Validate request body
  const { error, value } = suggestionSchema.validate(req.body);
  if (error) {
    console.error('❌ Validation error:', error.details[0].message);
    console.error('❌ Request body was:', JSON.stringify(req.body, null, 2));
    return res.status(400).json({
      error: 'Validation failed',
      details: error.details[0].message,
    });
  }

  const {
    highlightedText,
    contextBefore,
    contextAfter,
    fullPrompt,
    originalUserPrompt,
  } = value;

  console.log(
    '📥 Processing enhancement request for:',
    highlightedText.slice(0, 50) + '...'
  );

  // Detect if this is a video prompt
  const isVideoPrompt =
    fullPrompt.includes('**Main Prompt:**') ||
    fullPrompt.includes('**Technical Parameters:**') ||
    fullPrompt.includes('Camera Movement:');

  // Check if highlighted text is a placeholder/parameter
  const isPlaceholder = detectPlaceholder(
    highlightedText,
    contextBefore,
    contextAfter,
    fullPrompt
  );

  let aiPrompt;

  if (isPlaceholder) {
    // Generate context-aware VALUE suggestions
    aiPrompt = `You are an expert prompt engineer analyzing a placeholder value in a prompt.

**Context Analysis:**
Full prompt context: ${fullPrompt.substring(0, 1500)}

Context before: "${contextBefore}"
HIGHLIGHTED PLACEHOLDER: "${highlightedText}"
Context after: "${contextAfter}"

Original user request: "${originalUserPrompt}"

**Your Task:**
The user has highlighted "${highlightedText}" which appears to be a placeholder or parameter that needs a specific value. Analyze the full context and generate 5-8 concrete, specific suggestions for what should replace this placeholder.

**Analysis Guidelines:**
1. Understand what TYPE of value is needed (location, person, time, event, audience, style, etc.)
2. Consider the broader context and requirements in the prompt
3. Provide SPECIFIC, CONCRETE values - not rewrites or explanations
4. Each suggestion should be a direct drop-in replacement
5. Suggestions should be meaningfully different from each other
6. Consider historical accuracy, realism, or creative appropriateness based on context
${isVideoPrompt ? '7. For video prompts: consider cinematic/visual implications of each option' : '7. Consider how each option affects the overall prompt goal'}

**Example Output Patterns:**
- If placeholder is about LOCATION: provide specific place names
- If placeholder is about PERSON: provide specific names or roles
- If placeholder is about TIME: provide specific times, dates, or periods
- If placeholder is about STYLE: provide specific style descriptors
- If placeholder is about AUDIENCE: provide specific audience types
- If placeholder is about ACTION/EVENT: provide specific actions or events

Return ONLY a JSON array in this exact format (no markdown, no code blocks):

[
  {"text": "first specific value option", "explanation": "brief 1-sentence rationale"},
  {"text": "second specific value option", "explanation": "brief 1-sentence rationale"},
  {"text": "third specific value option", "explanation": "brief 1-sentence rationale"},
  {"text": "fourth specific value option", "explanation": "brief 1-sentence rationale"},
  {"text": "fifth specific value option", "explanation": "brief 1-sentence rationale"},
  {"text": "sixth specific value option", "explanation": "brief 1-sentence rationale"},
  {"text": "seventh specific value option", "explanation": "brief 1-sentence rationale"},
  {"text": "eighth specific value option", "explanation": "brief 1-sentence rationale"}
]

Each "text" should be a SHORT, SPECIFIC value (1-10 words max) that can directly replace the highlighted placeholder.`;
  } else {
    // Generate general rewrite suggestions (original behavior)
    if (isVideoPrompt) {
      aiPrompt = `You are a video prompt expert for AI video generation (Sora, Veo3, RunwayML). Analyze this highlighted section from a video generation prompt and generate 3-5 enhanced alternatives.

**HIGHLIGHTED SECTION:**
"${highlightedText}"

**CONTEXT BEFORE:**
"${contextBefore}"

**CONTEXT AFTER:**
"${contextAfter}"

**FULL PROMPT:**
${fullPrompt}

**ORIGINAL USER REQUEST:**
"${originalUserPrompt}"

Generate 3-5 complete rewrites of the highlighted section. Each rewrite should:
1. Be a drop-in replacement for the highlighted text
2. Add more cinematic detail, camera work specifics, lighting descriptions, or motion details
3. Flow naturally with the surrounding context
4. Be meaningfully different from the other suggestions
5. Maintain compatibility with AI video generation models

Focus on enhancing visual storytelling. Consider:
- More specific camera angles and movements (crane shot, Dutch angle, tracking shot, etc.)
- Detailed lighting descriptions (golden hour, rim lighting, volumetric fog, etc.)
- Motion and pacing details (slow-motion, time-lapse, dynamic action, etc.)
- Color grading and mood (warm tones, desaturated, high contrast, etc.)
- Composition and framing (rule of thirds, close-up, wide shot, etc.)
- Environmental details (weather, atmosphere, background elements)

Return ONLY a JSON array in this exact format (no markdown, no code blocks, no explanations):

[
  {"text": "first enhanced rewrite with more cinematic detail..."},
  {"text": "second enhanced rewrite with different visual approach..."},
  {"text": "third enhanced rewrite with alternative camera work..."},
  {"text": "fourth enhanced rewrite with different lighting/mood..."},
  {"text": "fifth enhanced rewrite with unique perspective..."}
]

Each "text" value should be a complete, self-contained replacement for the highlighted section that can be directly inserted into the video prompt.`;
    } else {
      aiPrompt = `You are a prompt engineering expert. Analyze this highlighted section and generate 3-5 concrete improvements.

**HIGHLIGHTED SECTION:**
"${highlightedText}"

**CONTEXT BEFORE:**
"${contextBefore}"

**CONTEXT AFTER:**
"${contextAfter}"

**FULL PROMPT:**
${fullPrompt}

**ORIGINAL USER REQUEST:**
"${originalUserPrompt}"

Generate 3-5 complete rewrites of the highlighted section. Each rewrite should:
1. Be a drop-in replacement for the highlighted text
2. Make the prompt more effective, specific, and actionable
3. Flow naturally with the surrounding context
4. Be meaningfully different from the other suggestions
5. Address potential ambiguities or add helpful structure

Focus on improving clarity, specificity, and actionability. Consider:
- Adding concrete examples or criteria
- Breaking down vague instructions into specific steps
- Specifying formats or structures more clearly
- Adding constraints or success criteria
- Making implicit requirements explicit

Return ONLY a JSON array in this exact format (no markdown, no code blocks, no explanations):

[
  {"text": "first complete rewrite of the highlighted section..."},
  {"text": "second complete rewrite of the highlighted section..."},
  {"text": "third complete rewrite of the highlighted section..."},
  {"text": "fourth complete rewrite of the highlighted section..."},
  {"text": "fifth complete rewrite of the highlighted section..."}
]

Each "text" value should be a complete, self-contained replacement for the highlighted section that can be directly inserted into the prompt.`;
    }
  }

  try {
    console.log('🤖 Calling Claude API for enhancement suggestions...');
    console.log(
      '📌 Mode:',
      isPlaceholder ? 'VALUE SUGGESTIONS' : 'REWRITE SUGGESTIONS'
    );

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.VITE_ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: aiPrompt,
          },
        ],
      }),
    });

    console.log('📡 Claude API response status:', response.status);

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ Claude API Error:', errorData);
      return res
        .status(response.status)
        .json({ error: 'API request failed', details: errorData });
    }

    const data = await response.json();
    let suggestionsText = data.content[0].text;

    console.log(
      '📝 Raw Claude response:',
      suggestionsText.slice(0, 200) + '...'
    );

    // Clean up response - remove markdown code blocks if present
    suggestionsText = suggestionsText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const suggestions = JSON.parse(suggestionsText);

    console.log(
      '✅ Successfully parsed suggestions:',
      suggestions.length,
      'suggestions'
    );

    res.json({
      suggestions,
      isPlaceholder, // Let frontend know what type of suggestions these are
    });
  } catch (error) {
    console.error('❌ Server error:', error);
    res
      .status(500)
      .json({ error: 'Internal server error', message: error.message });
  }
});

app.post('/api/get-custom-suggestions', async (req, res) => {
  // Validate request body
  const { error, value } = customSuggestionSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: 'Validation failed',
      details: error.details[0].message,
    });
  }

  const { highlightedText, customRequest, fullPrompt } = value;

  console.log('📥 Received custom suggestion request:', customRequest);

  // Detect if this is a video prompt
  const isVideoPrompt =
    fullPrompt.includes('**Main Prompt:**') ||
    fullPrompt.includes('**Technical Parameters:**') ||
    fullPrompt.includes('Camera Movement:');

  const aiPrompt = `You are a ${isVideoPrompt ? 'video prompt expert for AI video generation (Sora, Veo3, RunwayML)' : 'prompt engineering expert'}.

The user has selected this text:
"${highlightedText}"

They want you to modify it with this specific request:
"${customRequest}"

Context from full prompt:
${fullPrompt.substring(0, 1000)}

Generate 3-5 alternative rewrites that specifically address the user's request. Each rewrite should:
1. Be a complete drop-in replacement for the selected text
2. Directly implement what the user asked for
3. Flow naturally with the surrounding context
4. Be meaningfully different from each other
${isVideoPrompt ? '5. Maintain compatibility with AI video generation models and include appropriate cinematic details' : '5. Maintain the overall tone and purpose of the prompt'}

Return ONLY a JSON array in this exact format (no markdown, no code blocks, no explanations):

[
  {"text": "first rewrite implementing the user's request..."},
  {"text": "second rewrite with different approach..."},
  {"text": "third rewrite with alternative interpretation..."},
  {"text": "fourth rewrite with unique variation..."},
  {"text": "fifth rewrite with creative take..."}
]`;

  try {
    console.log('🤖 Calling Claude API for custom suggestions...');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.VITE_ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: aiPrompt,
          },
        ],
      }),
    });

    console.log('📡 Claude API response status:', response.status);

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ Claude API Error:', errorData);
      return res
        .status(response.status)
        .json({ error: 'API request failed', details: errorData });
    }

    const data = await response.json();
    let suggestionsText = data.content[0].text;

    console.log(
      '📝 Raw Claude response:',
      suggestionsText.slice(0, 200) + '...'
    );

    // Clean up response - remove markdown code blocks if present
    suggestionsText = suggestionsText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const suggestions = JSON.parse(suggestionsText);

    console.log(
      '✅ Successfully parsed custom suggestions:',
      suggestions.length,
      'suggestions'
    );

    res.json({ suggestions });
  } catch (error) {
    console.error('❌ Server error:', error);
    res
      .status(500)
      .json({ error: 'Internal server error', message: error.message });
  }
});

app.post('/api/detect-scene-change', async (req, res) => {
  // Validate request body
  const { error, value } = sceneChangeSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: 'Validation failed',
      details: error.details[0].message,
    });
  }

  const { changedField, newValue, oldValue, fullPrompt, affectedFields } =
    value;

  console.log('📥 Scene change detection request');
  console.log('Changed field:', changedField);
  console.log('Old value:', oldValue?.substring(0, 50));
  console.log('New value:', newValue?.substring(0, 50));

  // Detect if this represents a significant scene/environment change
  const aiPrompt = `You are an expert video production assistant analyzing whether a field change represents a COMPLETE SCENE/ENVIRONMENT CHANGE that would require updating related fields.

**Field that changed:** ${changedField}
**Old value:** "${oldValue || 'Not set'}"
**New value:** "${newValue}"

**Full prompt context:**
${fullPrompt.substring(0, 1500)}

**Your task:**
Determine if this change represents a COMPLETE SCENE CHANGE (like changing from "coffee shop interior" to "underwater cave" or "urban street" to "mountain peak").

**Analysis criteria:**
- Does the new value describe a fundamentally different ENVIRONMENT/LOCATION than the old value?
- Would this change make the current values in related fields (architectural details, atmospheric conditions, background elements, etc.) INCOMPATIBLE or NONSENSICAL?
- Is this a minor refinement (e.g., "modern coffee shop" → "vintage coffee shop") or a major scene change (e.g., "coffee shop" → "underwater cave")?

**Related fields that might need updating if this is a scene change:**
${JSON.stringify(affectedFields, null, 2)}

Return ONLY a JSON object in this exact format (no markdown, no code blocks):

{
  "isSceneChange": true or false,
  "confidence": "high" or "medium" or "low",
  "reasoning": "brief explanation of why this is or isn't a scene change",
  "suggestedUpdates": {
    "field1": "suggested new value that fits the new environment",
    "field2": "suggested new value that fits the new environment"
  }
}

If isSceneChange is FALSE, return suggestedUpdates as an empty object {}.
If isSceneChange is TRUE, provide specific suggested values for ALL affected fields that would fit the new environment.`;

  try {
    console.log('🤖 Calling Claude API for scene change detection...');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.VITE_ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: aiPrompt,
          },
        ],
      }),
    });

    console.log('📡 Claude API response status:', response.status);

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ Claude API Error:', errorData);
      return res
        .status(response.status)
        .json({ error: 'API request failed', details: errorData });
    }

    const data = await response.json();
    let resultText = data.content[0].text;

    console.log('📝 Raw Claude response:', resultText.slice(0, 200) + '...');

    // Clean up response - remove markdown code blocks if present
    resultText = resultText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const result = JSON.parse(resultText);

    console.log(
      '✅ Scene change detection result:',
      result.isSceneChange ? 'YES' : 'NO',
      `(${result.confidence})`
    );

    res.json(result);
  } catch (error) {
    console.error('❌ Server error:', error);
    res
      .status(500)
      .json({ error: 'Internal server error', message: error.message });
  }
});

app.post('/api/get-creative-suggestions', async (req, res) => {
  // Validate request body
  const { error, value } = creativeSuggestionSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: 'Validation failed',
      details: error.details[0].message,
    });
  }

  const { elementType, currentValue, context, concept } = value;

  console.log('📥 Creative suggestion request for:', elementType);

  const elementPrompts = {
    subject: `Generate creative suggestions for the SUBJECT/CHARACTER of a video.

Context: ${context || 'No other elements defined yet'}
Full concept: ${concept || 'User is building from scratch'}
Current value: ${currentValue || 'Not set'}

Provide 8 diverse, creative subjects that would make compelling video content. Consider:
- People (specific types, ages, professions, activities)
- Products (tech, fashion, food, vehicles, etc.)
- Animals (specific species with interesting behaviors)
- Objects (with narrative potential)
- Abstract concepts (visualized creatively)

Each suggestion should be SPECIFIC and VISUAL. Not "a person" but "elderly street musician" or "parkour athlete in motion".`,

    action: `Generate creative suggestions for the ACTION/ACTIVITY in a video.

Context: ${context || 'No other elements defined yet'}
Full concept: ${concept || 'User is building from scratch'}
Current value: ${currentValue || 'Not set'}

Provide 8 dynamic, visual actions that work well in video. Consider:
- Physical movement (running, jumping, dancing, floating, falling)
- Transformation (morphing, dissolving, assembling, exploding)
- Interaction (holding, throwing, catching, touching)
- Performance (playing instrument, cooking, creating art)
- Natural phenomena (growing, flowing, burning, freezing)

Each action should be SPECIFIC and CINEMATIC. Not "moving" but "leaping over obstacles in slow motion".`,

    location: `Generate creative suggestions for the LOCATION/SETTING of a video.

Context: ${context || 'No other elements defined yet'}
Full concept: ${concept || 'User is building from scratch'}
Current value: ${currentValue || 'Not set'}

Provide 8 visually interesting locations. Consider:
- Urban environments (specific types of streets, buildings, infrastructure)
- Natural settings (specific landscapes, weather conditions, times of day)
- Interior spaces (architectural styles, purposes, atmospheres)
- Unusual/creative settings (underwater, in space, abstract void, miniature world)
- Cultural/historical settings (specific eras, cultures, styles)

Each location should be SPECIFIC and EVOCATIVE. Not "a building" but "abandoned Victorian warehouse with shattered skylights".`,

    time: `Generate creative suggestions for the TIME/PERIOD of a video.

Context: ${context || 'No other elements defined yet'}
Full concept: ${concept || 'User is building from scratch'}
Current value: ${currentValue || 'Not set'}

Provide 8 specific time/lighting conditions that create visual interest:
- Time of day (golden hour, blue hour, high noon, midnight, dawn, dusk)
- Historical period (specific eras with visual characteristics)
- Season (spring bloom, autumn colors, winter frost, summer haze)
- Weather timing (during storm, after rain, before sunset)
- Future/past (specific sci-fi or period aesthetics)

Each suggestion should specify LIGHTING and MOOD implications. Not just "morning" but "early morning mist with low golden sun".`,

    mood: `Generate creative suggestions for the MOOD/ATMOSPHERE of a video.

Context: ${context || 'No other elements defined yet'}
Full concept: ${concept || 'User is building from scratch'}
Current value: ${currentValue || 'Not set'}

Provide 8 distinct moods/atmospheres. Consider:
- Emotional tones (melancholic, joyful, tense, peaceful, mysterious)
- Energy levels (frenetic, languid, pulsing, static, building)
- Sensory qualities (warm, cold, harsh, soft, textured)
- Narrative feelings (nostalgic, foreboding, hopeful, triumphant)
- Abstract atmospheres (dreamlike, surreal, hyperreal, gritty)

Each mood should be SPECIFIC and suggest visual/color implications. Not "happy" but "warm, golden nostalgia like a faded photograph".`,

    style: `Generate creative suggestions for the VISUAL STYLE of a video.

Context: ${context || 'No other elements defined yet'}
Full concept: ${concept || 'User is building from scratch'}
Current value: ${currentValue || 'Not set'}

Provide 8 distinct visual styles. Consider:
- Film genres (cinematic blockbuster, documentary, film noir, etc.)
- Animation styles (anime, claymation, CGI, rotoscope)
- Art movements (impressionist, cubist, minimalist, maximalist)
- Photographic styles (vintage film, digital clean, lomography)
- Technical approaches (slow-motion, time-lapse, hyper-lapse, macro)

Each style should be SPECIFIC with technical implications. Not "artistic" but "1970s Super 8 film with warm grain and light leaks".`,

    event: `Generate creative suggestions for the EVENT/CONTEXT of a video.

Context: ${context || 'No other elements defined yet'}
Full concept: ${concept || 'User is building from scratch'}
Current value: ${currentValue || 'Not set'}

Provide 8 specific events or contexts. Consider:
- Commercial contexts (product launch, demonstration, unboxing, reveal)
- Narrative events (discovery, transformation, conflict, resolution)
- Celebrations (specific types of parties, ceremonies, milestones)
- Processes (creation, destruction, assembly, metamorphosis)
- Abstract contexts (dream sequence, memory, vision, imagination)

Each event should provide NARRATIVE PURPOSE. Not "something happening" but "product reveal with dramatic build-up and payoff".`,
  };

  const systemPrompt = elementPrompts[elementType] || elementPrompts.subject;

  const fullPrompt = `${systemPrompt}

Based on all context provided, generate 8 creative, specific suggestions for this element.

IMPORTANT: If there is existing context about other elements, make sure your suggestions COMPLEMENT and work well with those elements. For example:
- If subject is "athlete", suggest actions like "parkour vaulting" not "sleeping"
- If location is "underwater", suggest subjects like "scuba diver" not "race car"
- If mood is "tense", suggest styles like "high-contrast noir" not "bright cheerful animation"

Return ONLY a JSON array in this exact format (no markdown, no code blocks):

[
  {"text": "specific suggestion 1", "explanation": "why this works well with the context"},
  {"text": "specific suggestion 2", "explanation": "why this works well with the context"},
  {"text": "specific suggestion 3", "explanation": "why this works well with the context"},
  {"text": "specific suggestion 4", "explanation": "why this works well with the context"},
  {"text": "specific suggestion 5", "explanation": "why this works well with the context"},
  {"text": "specific suggestion 6", "explanation": "why this works well with the context"},
  {"text": "specific suggestion 7", "explanation": "why this works well with the context"},
  {"text": "specific suggestion 8", "explanation": "why this works well with the context"}
]

Each "text" should be SHORT and SPECIFIC (2-8 words). Each "explanation" should be a brief sentence about why it fits.`;

  try {
    console.log('🤖 Calling Claude API for creative suggestions...');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.VITE_ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: fullPrompt,
          },
        ],
      }),
    });

    console.log('📡 Claude API response status:', response.status);

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ Claude API Error:', errorData);
      return res
        .status(response.status)
        .json({ error: 'API request failed', details: errorData });
    }

    const data = await response.json();
    let suggestionsText = data.content[0].text;

    console.log(
      '📝 Raw Claude response:',
      suggestionsText.slice(0, 200) + '...'
    );

    suggestionsText = suggestionsText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const suggestions = JSON.parse(suggestionsText);

    console.log(
      '✅ Successfully parsed creative suggestions:',
      suggestions.length,
      'suggestions'
    );

    res.json({ suggestions });
  } catch (error) {
    console.error('❌ Server error:', error);
    res
      .status(500)
      .json({ error: 'Internal server error', message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Proxy server running on http://localhost:${PORT}`);
});
