import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.post('/api/optimize', async (req, res) => {
  const { prompt, mode, context } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

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
    systemPrompt = `You are a video prompt generation expert specializing in AI video generation models like Sora, Veo3, RunwayML, and similar platforms. Transform this video concept into a detailed, high-quality video generation prompt.

**Main Prompt:**
[Create a vivid, detailed description including: subject, setting, lighting, camera work, motion, and mood. Be specific about visual elements while maintaining creative flow. 150-250 words.]

**Technical Parameters:**
- Duration: [Recommended duration in seconds, typically 5-15s]
- Aspect Ratio: [16:9, 9:16, 1:1, or other appropriate ratio]
- Style: [Cinematic, documentary, anime, stop-motion, etc.]
- Camera Movement: [Static, tracking, dolly, crane, handheld, etc.]
- Frame Rate: [24fps for cinematic, 30fps for standard, 60fps for smooth motion]

**Alternative Variations:**
1. [First variation with different angle/mood/emphasis]
2. [Second variation exploring different creative direction]
3. [Third variation with alternative technical approach]

**Platform-Specific Notes:**
[Tips for optimization on specific platforms - Sora, Veo3, RunwayML, etc. Include any model-specific syntax or best practices.]

**Avoid:**
- Vague descriptions or generic terms
- Conflicting visual elements or impossible physics
- Overly complex prompts that confuse the AI
- Requesting copyrighted characters or trademarked content

User's video concept: "${prompt}"

**IMPORTANT GUIDELINES:**
1. Balance technical precision with creative vision
2. Include specific visual details (colors, textures, mood)
3. Specify camera angles and movement clearly
4. Consider lighting conditions (golden hour, harsh shadows, soft diffused, etc.)
5. Describe motion and pacing (slow motion, time-lapse, real-time)
6. Ensure variations offer meaningfully different creative directions
7. Keep prompts compatible with multiple video generation platforms

Create a comprehensive video prompt package that will generate consistent, high-quality results. Ensure the prompt is self-contained and can be used directly without further editing.

Provide ONLY the video prompt package in the specified format. No preamble, no explanation, no meta-commentary about what you're doing.`;
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
  if (context && Object.keys(context).some(k => context[k])) {
    systemPrompt += '\n\n**IMPORTANT - User has provided additional context:**\n';
    systemPrompt += 'The user has provided additional context. Incorporate this into the optimized prompt:\n\n';

    if (context.specificAspects) {
      systemPrompt += `**Specific Focus Areas:** ${context.specificAspects}\n`;
      systemPrompt += 'Make sure the optimized prompt explicitly addresses these aspects.\n\n';
    }

    if (context.backgroundLevel) {
      systemPrompt += `**Target Audience Level:** ${context.backgroundLevel}\n`;
      systemPrompt += 'Adjust the complexity and terminology to match this level.\n\n';
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
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: systemPrompt
        }]
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('API Error:', errorData);
      return res.status(response.status).json({ error: 'API request failed', details: errorData });
    }

    const data = await response.json();
    const optimizedText = data.content[0].text;

    // Basic validation - check for meta-commentary
    if (optimizedText.toLowerCase().includes('here is') ||
        optimizedText.toLowerCase().includes('i\'ve created') ||
        optimizedText.toLowerCase().startsWith('sure')) {
      console.warn('⚠️  Response contains meta-commentary, may need refinement');
    }

    res.json({ optimizedPrompt: optimizedText });
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
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
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: systemPrompt
        }]
      })
    });

    console.log('📡 Claude API response status:', response.status);

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ Claude API Error:', errorData);
      return res.status(response.status).json({ error: 'API request failed', details: errorData });
    }

    const data = await response.json();
    let questionsText = data.content[0].text;

    console.log('📝 Raw Claude response:', questionsText.slice(0, 200) + '...');

    // Clean up response - remove markdown code blocks if present
    questionsText = questionsText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    const questionsData = JSON.parse(questionsText);

    console.log('✅ Successfully parsed questions:', questionsData.questions?.length, 'questions');

    res.json(questionsData);
  } catch (error) {
    console.error('❌ Server error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

app.post('/api/get-enhancement-suggestions', async (req, res) => {
  const { highlightedText, contextBefore, contextAfter, fullPrompt, originalUserPrompt } = req.body;

  console.log('📥 Received enhancement request for:', highlightedText.slice(0, 50) + '...');

  if (!highlightedText) {
    return res.status(400).json({ error: 'Highlighted text is required' });
  }

  // Detect if this is a video prompt based on content
  const isVideoPrompt = fullPrompt.includes('**Main Prompt:**') ||
                        fullPrompt.includes('**Technical Parameters:**') ||
                        fullPrompt.includes('**Alternative Variations:**') ||
                        fullPrompt.includes('Camera Movement:') ||
                        fullPrompt.includes('Aspect Ratio:');

  let aiPrompt = '';

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

  try {
    console.log('🤖 Calling Claude API for enhancement suggestions...');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.VITE_ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: aiPrompt
        }]
      })
    });

    console.log('📡 Claude API response status:', response.status);

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ Claude API Error:', errorData);
      return res.status(response.status).json({ error: 'API request failed', details: errorData });
    }

    const data = await response.json();
    let suggestionsText = data.content[0].text;

    console.log('📝 Raw Claude response:', suggestionsText.slice(0, 200) + '...');

    // Clean up response - remove markdown code blocks if present
    suggestionsText = suggestionsText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    const suggestions = JSON.parse(suggestionsText);

    console.log('✅ Successfully parsed suggestions:', suggestions.length, 'suggestions');

    res.json({ suggestions });
  } catch (error) {
    console.error('❌ Server error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Proxy server running on http://localhost:${PORT}`);
});
